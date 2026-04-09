/**
 * MEMORY//GLITCH - PIXEL_HAVEN ARCADE_OS [v2.0]
 * Senior Engineering: Deception Logic & Neural Memory Matching
 */

class MemoryGlitch {
    constructor() {
        // Configuration
        this.levels = [
            { r: 4, c: 4, disguise: 0, failLimit: 5 },
            { r: 5, c: 6, disguise: 0, failLimit: 6 },
            { r: 6, c: 6, disguise: 0.35, failLimit: 7 }, 
            { r: 7, c: 8, disguise: 0.5, failLimit: 8 }  
        ];
        
        this.symbols = ['⌬', '⏽', '⧉', '⩔', '⨀', '⩓', '⧫', '⬢', '⬡', '⬙', '⬗', '⬖', '▲', '▼', '◀', '▶', '☀', '★', '⚙', '⚯', '⚕', '⚛', '⚒', '⚓', '⚔', '⚱', '⚰', '⚗', '⚘', '⛓'];
        this.powerupIcons = {
            'REVEAL': '👁',
            'FREEZE': '❄',
            'HAMMER': '🔨',
            'HINT': '❓'
        };

        // State variables
        this.currentLevelIndex = 0;
        this.score = 0;
        this.fails = 0;
        this.tiles = [];
        this.flippedTiles = [];
        this.isLocked = false;
        this.isFreezeActive = false;
        
        // Input holding
        this.holdTimer = null;
        this.holdTile = null;

        // Sound Engine
        this.ctx_audio = null;
        this.initAudio();

        this.init();
    }

    initAudio() {
        window.addEventListener('mousedown', () => {
            if (!this.ctx_audio) this.ctx_audio = new (window.AudioContext || window.webkitAudioContext)();
        }, { once: true });
    }

    playSound(type) {
        if (!this.ctx_audio) return;
        const osc = this.ctx_audio.createOscillator();
        const gain = this.ctx_audio.createGain();
        osc.connect(gain);
        gain.connect(this.ctx_audio.destination);

        const now = this.ctx_audio.currentTime;

        switch(type) {
            case 'flip':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(); osc.stop(now + 0.1);
                break;
            case 'match':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.4);
                osc.start(); osc.stop(now + 0.4);
                break;
            case 'fail':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(110, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(); osc.stop(now + 0.3);
                break;
            case 'shuffle':
                const bufferSize = this.ctx_audio.sampleRate * 0.4;
                const buffer = this.ctx_audio.createBuffer(1, bufferSize, this.ctx_audio.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = this.ctx_audio.createBufferSource();
                noise.buffer = buffer;
                const filter = this.ctx_audio.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, now);
                filter.frequency.linearRampToValueAtTime(100, now + 0.4);
                noise.connect(filter);
                filter.connect(gain);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.4);
                noise.start();
                break;
            case 'powerup':
                osc.type = 'square';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(2000, now + 0.5);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.5);
                osc.start(); osc.stop(now + 0.5);
                break;
        }
    }

    init() {
        document.getElementById('start-btn').onclick = () => this.startLevel();
        document.getElementById('next-btn').onclick = () => this.nextLevel();
        document.getElementById('restart-btn').onclick = () => {
            this.currentLevelIndex = 0;
            this.startLevel();
        };
    }

    startLevel() {
        const config = this.levels[this.currentLevelIndex];
        this.fails = 0;
        this.score = 0;
        this.flippedTiles = [];
        this.isLocked = false;
        
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('result-screen').classList.remove('active');
        document.getElementById('level-val').textContent = (this.currentLevelIndex + 1).toString().padStart(2, '0');
        
        this.updateFailMeter();
        this.cancelHold(); // Cleanup (v2.10)
        this.generateGrid(config);
    }

    generateGrid(config) {
        const totalTiles = config.r * config.c;
        const gridEl = document.getElementById('memory-grid');
        gridEl.style.gridTemplateColumns = `repeat(${config.c}, 1fr)`;
        gridEl.innerHTML = '';

        // Select Pairs
        let pairCounts = (totalTiles) / 2;
        
        // Powerup Generation Rules (v2.1)
        let pTypes = Object.keys(this.powerupIcons);
        if (this.currentLevelIndex < 3) {
            // Before 7x8: 3 random types
            this.shuffleArray(pTypes);
            pTypes = pTypes.slice(0, 3);
        } else {
            // At 7x8: All 4 active
        }
        
        let pool = [];
        pTypes.forEach(type => {
            const pair = { id: Math.random(), symbol: this.powerupIcons[type], powerup: type, matched: false };
            pool.push({...pair}, {...pair});
        });

        // Add Standard Pairs
        const standardPairsCount = pairCounts - pTypes.length;
        this.shuffleArray(this.symbols);
        for (let i = 0; i < standardPairsCount; i++) {
            const pair = { id: Math.random(), symbol: this.symbols[i % this.symbols.length], powerup: null, matched: false };
            pool.push({...pair}, {...pair});
        }

        this.shuffleArray(pool);

        // Map to internal tile objects and apply disguise
        this.tiles = pool.map((p, idx) => {
            const isDisguised = Math.random() < config.disguise;
            let displaySymbol = p.symbol;
            
            if (isDisguised) {
                // Pick a random false symbol
                let falseSymbol = this.symbols[Math.floor(Math.random() * this.symbols.length)];
                while(falseSymbol === p.symbol) falseSymbol = this.symbols[Math.floor(Math.random() * this.symbols.length)];
                displaySymbol = falseSymbol;
            }

            return {
                ...p,
                index: idx,
                disguised: isDisguised,
                revealed: false,
                displaySymbol: displaySymbol,
                dom: null
            };
        });

        // Create DOM
        const fontSize = config.c > 6 ? '1.5rem' : config.c > 4 ? '2.2rem' : '2.8rem';
        
        this.tiles.forEach(t => {
            const el = document.createElement('div');
            el.className = `tile ${t.powerup ? 'powerup' : ''} ${t.disguised ? 'disguised' : ''}`;
            el.innerHTML = `
                <div class="tile-inner">
                    <div class="tile-front">◈</div>
                    <div class="tile-back" style="font-size: ${fontSize}">${t.displaySymbol}</div>
                    <div class="hold-progress"></div>
                </div>
            `;
            
            el.addEventListener('mousedown', (e) => this.handleTileClick(t, el, e));
            el.addEventListener('touchstart', (e) => this.handleTileClick(t, el, e), {passive: false});
            el.addEventListener('mouseup', () => this.cancelHold());
            el.addEventListener('mouseleave', () => this.cancelHold());
            el.addEventListener('touchend', () => this.cancelHold());

            gridEl.appendChild(el);
            t.dom = el;
        });

        this.updateHUD();
    }

    handleTileClick(tile, el, e) {
        if (e && e.type === 'touchstart') e.preventDefault(); // Prevent double trigger
        if (this.isLocked || tile.matched || tile.revealed) return;
        
        // Start Hold Timer for Disguise mode
        if (tile.disguised) {
            this.holdTile = tile;
            const progress = el.querySelector('.hold-progress');
            progress.style.transition = 'width 2s linear';
            progress.style.width = '100%';

            this.holdTimer = setTimeout(() => {
                this.revealTrueIdentity(tile, el);
            }, 2000);
        }

        // Tap logic (Flip)
        this.flipTile(tile, el);
    }

    cancelHold() {
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            if (this.holdTile && this.holdTile.dom) {
                const progress = this.holdTile.dom.querySelector('.hold-progress');
                progress.style.transition = 'none';
                progress.style.width = '0%';
            }
            this.holdTimer = null;
            this.holdTile = null;
        }
    }

    revealTrueIdentity(tile, el) {
        if (!tile.disguised || tile.matched) return;
        
        tile.disguised = false;
        tile.displaySymbol = tile.symbol;
        el.querySelector('.tile-back').textContent = tile.symbol;
        el.classList.remove('disguised');
        el.classList.add('identity-shift');
        setTimeout(() => el.classList.remove('identity-shift'), 500);
        
        this.statusMsg("IDENTITY_VERIFIED");
        this.cancelHold();
    }

    flipTile(tile, el) {
        if (this.flippedTiles.length >= 2 || tile.revealed) return;

        this.playSound('flip');
        tile.revealed = true;
        el.classList.add('flipped');
        this.flippedTiles.push({tile, el});

        if (this.flippedTiles.length === 2) {
            this.checkMatch();
        }
    }

    checkMatch() {
        this.isLocked = true;
        const [t1, t2] = this.flippedTiles;
        const terminal = document.getElementById('arcade-terminal');

        if (t1.tile.symbol === t2.tile.symbol) {
            // MATCH
            this.playSound('match');
            terminal.classList.add('flash-success');
            setTimeout(() => terminal.classList.remove('flash-success'), 400);

            t1.tile.matched = t2.tile.matched = true;
            t1.el.classList.add('matched');
            t2.el.classList.add('matched');
            
            if (t1.tile.powerup) this.triggerPowerup(t1.tile.powerup);
            
            this.score += 100;
            this.flippedTiles = [];
            this.isLocked = false;
            this.checkWin();
        } else {
            // FAIL
            this.playSound('fail');
            terminal.classList.add('flash-error');
            setTimeout(() => terminal.classList.remove('flash-error'), 400);

            setTimeout(() => {
                if (!this.isFreezeActive) {
                    this.fails++;
                    this.updateFailMeter();
                } else {
                    this.isFreezeActive = false;
                    this.statusMsg("FREEZE_PROTECTION_VOID");
                }

                t1.tile.revealed = t2.tile.revealed = false;
                t1.el.classList.remove('flipped');
                t2.el.classList.remove('flipped');
                this.flippedTiles = [];
                this.isLocked = false;

                const config = this.levels[this.currentLevelIndex];
                if (this.fails >= config.failLimit) {
                    this.triggerShuffle();
                }
            }, 1000);
        }
        this.updateHUD();
    }

    triggerShuffle() {
        this.cancelHold(); // Cleanup (v2.10)
        this.isLocked = true;
        this.fails = 0;
        this.updateFailMeter();
        this.playSound('shuffle');
        this.statusMsg("CRITICAL_MEMORY_SHIFT");

        const gridEl = document.getElementById('memory-grid');
        gridEl.classList.add('shuffling');

        setTimeout(() => {
            // Get all unmatched tiles
            const unmatched = this.tiles.filter(t => !t.matched);
            // Get their current indices
            const indices = unmatched.map(t => t.index);
            // Shuffle the indices
            this.shuffleArray(indices);

            // Assign new shuffled indices and re-apply disguise (v2.14)
            const config = this.levels[this.currentLevelIndex];
            unmatched.forEach((t, i) => {
                t.index = indices[i];
                
                // Reshuffle disguise identity
                t.disguised = Math.random() < config.disguise;
                if (t.disguised) {
                    let falseSymbol = this.symbols[Math.floor(Math.random() * this.symbols.length)];
                    while(falseSymbol === t.symbol) falseSymbol = this.symbols[Math.floor(Math.random() * this.symbols.length)];
                    t.displaySymbol = falseSymbol;
                } else {
                    t.displaySymbol = t.symbol;
                }
                
                // Sync DOM
                t.dom.querySelector('.tile-back').textContent = t.displaySymbol;
                t.dom.className = `tile ${t.powerup ? 'powerup' : ''} ${t.disguised ? 'disguised' : ''}`;
            });

            // Re-sort the primary tiles array by the new indices
            this.tiles.sort((a, b) => a.index - b.index);

            // Clear and re-populate the grid DOM in the new order
            gridEl.innerHTML = '';
            this.tiles.forEach(t => gridEl.appendChild(t.dom));

            gridEl.classList.remove('shuffling');
            this.isLocked = false;
        }, 400);
    }

    triggerPowerup(type) {
        this.playSound('powerup');
        this.statusMsg(`POWERUP_ACTIVATED: ${type}`);
        
        switch(type) {
            case 'REVEAL':
                this.isLocked = true;
                this.tiles.forEach(t => t.dom.classList.add('flipped'));
                setTimeout(() => {
                    this.tiles.forEach(t => {
                        if (!t.matched) t.dom.classList.remove('flipped');
                    });
                    this.isLocked = false;
                }, 3000);
                break;
            case 'FREEZE':
                this.isFreezeActive = true;
                break;
            case 'HAMMER':
                this.isLocked = true;
                // Reveal a random pair that isn't matched
                const unmatched = this.tiles.filter(t => !t.matched && !t.powerup);
                if (unmatched.length > 0) {
                    const target = unmatched[0];
                    const pair = this.tiles.find(t => t.symbol === target.symbol && t !== target);
                    [target, pair].forEach(t => {
                        t.matched = true;
                        t.revealed = true;
                        t.dom.classList.add('flipped', 'matched');
                    });
                }
                this.isLocked = false;
                this.checkWin();
                break;
            case 'HINT':
                const pool = this.tiles.filter(t => !t.matched && !t.powerup);
                if (pool.length > 0) {
                    const t = pool[0];
                    const p = this.tiles.find(x => x.symbol === t.symbol && x !== t);
                    [t, p].forEach(x => x.dom.classList.add('powerup-hint'));
                    setTimeout(() => {
                        [t, p].forEach(x => x.dom.classList.remove('powerup-hint'));
                    }, 2000);
                }
                break;
        }
    }

    checkWin() {
        this.cancelHold(); // Cleanup (v2.10)
        const remaining = this.tiles.filter(t => !t.matched);
        if (remaining.length === 0) {
            setTimeout(() => {
                this.win();
            }, 500);
        }
    }

    win() {
        this.statusMsg("LINK_STABILIZED");
        document.getElementById('result-screen').classList.add('active');
        document.getElementById('result-title').textContent = "SECTOR_CLEARED";
        document.getElementById('final-stability').textContent = Math.max(0, 100 - (this.fails * 5)) + "%";
        
        if (this.currentLevelIndex < this.levels.length - 1) {
            document.getElementById('next-btn').classList.remove('hidden');
        } else {
            document.getElementById('restart-btn').classList.remove('hidden');
            document.getElementById('result-title').textContent = "GRAND_STABILIZATION_COMPLETE";
        }
    }

    nextLevel() {
        this.currentLevelIndex++;
        this.startLevel();
    }

    // UTILITIES
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    updateFailMeter() {
        const config = this.levels[this.currentLevelIndex];
        const meter = document.getElementById('fail-meter');
        meter.innerHTML = '';
        for (let i = 0; i < config.failLimit; i++) {
            const bar = document.createElement('div');
            bar.className = `fail-bar ${i < this.fails ? 'active' : ''}`;
            meter.appendChild(bar);
        }
    }

    updateHUD() {
        const matchedCount = this.tiles.filter(t => t.matched).length / 2;
        const totalPairs = this.tiles.length / 2;
        document.getElementById('pairs-val').textContent = `${matchedCount}/${totalPairs}`;
        document.getElementById('score-val').textContent = this.score.toString().padStart(6, '0');
    }

    statusMsg(msg) {
        const el = document.getElementById('status-msg');
        el.textContent = msg;
        el.classList.add('value');
        setTimeout(() => el.classList.remove('value'), 500);
    }
}

const game = new MemoryGlitch();
