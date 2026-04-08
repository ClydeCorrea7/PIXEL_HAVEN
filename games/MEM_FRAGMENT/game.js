/**
 * MEM//FRAGMENT - PSYCHOLOGICAL MEMORY DISTORTION
 * A high-fidelity sequence game where the interface becomes unreliable.
 */

class Sound {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    play(type, freq, dur, vol = 0.1) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Pixelated sound = Square or Sawtooth
        osc.type = type === 'sine' ? 'square' : type; 
        
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        // Bitcrush-like effect: sudden volume steps
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol * 0.5, this.ctx.currentTime + dur * 0.5);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + dur);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
    }
    
    tile(index) {
        // Pixelated tile notes (Square wave)
        const freqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33];
        this.play('square', freqs[index % freqs.length], 0.15, 0.05);
    }
    
    win() {
        // Brighter 8-bit arpeggio
        this.play('square', 523.25, 0.05, 0.05);
        setTimeout(() => this.play('square', 659.25, 0.05, 0.05), 50);
        setTimeout(() => this.play('square', 783.99, 0.05, 0.05), 100);
        setTimeout(() => this.play('square', 1046.50, 0.1, 0.05), 150);
    }
    
    fail() {
        // Harsh industrial fail sound
        this.play('sawtooth', 80, 0.6, 0.1);
        this.play('square', 40, 0.6, 0.1);
    }
}

class MemFragment {
    constructor() {
        this.sound = new Sound();
        this.grid = document.getElementById('grid');
        this.levelVal = document.getElementById('level-val');
        this.scoreVal = document.getElementById('score-val');
        this.corruptionBar = document.getElementById('corruption-bar');
        this.statusMsg = document.getElementById('status-msg');
        this.viewport = document.getElementById('game-viewport');
        
        // --- OVERLAYS ---
        this.startScreen = document.getElementById('start-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        
        // --- STATE ---
        this.state = 'START';
        this.sequence = [];
        this.playerIndex = 0;
        this.level = 1;
        this.score = 0;
        this.corruption = 0;
        this.tiles = [];
        this.isInputBlocked = true;
        
        this.init();
    }

    init() {
        this.createGrid(3); // Start with 3x3
        this.bindEvents();
    }

    createGrid(size) {
        this.grid.innerHTML = '';
        this.tiles = [];
        this.grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        
        for (let i = 0; i < size * size; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.index = i;
            tile.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleTileClick(i); });
            tile.addEventListener('mousedown', (e) => { this.handleTileClick(i); });
            this.grid.appendChild(tile);
            this.tiles.push(tile);
        }
    }

    bindEvents() {
        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('retry-btn').onclick = () => this.restart();
        document.getElementById('resume-btn').onclick = () => this.resume();
        document.getElementById('restart-btn').onclick = () => this.restart();
        
        document.querySelectorAll('.exit-btn').forEach(btn => {
            btn.onclick = () => window.location.href = '../../index.html';
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.state === 'PLAYING' || this.state === 'SHOWING' || this.state === 'WAITING') this.pause();
                else if (this.state === 'PAUSED') this.resume();
            }
        });
    }

    start() {
        this.state = 'PLAYING';
        this.startScreen.classList.remove('active');
        this.nextRound();
    }

    pause() {
        this.prevState = this.state;
        this.state = 'PAUSED';
        this.pauseScreen.classList.add('active');
    }

    resume() {
        this.state = this.prevState;
        this.pauseScreen.classList.remove('active');
    }

    restart() {
        this.state = 'PLAYING';
        this.level = 1;
        this.score = 0;
        this.corruption = 0;
        this.sequence = [];
        this.levelVal.innerText = '1';
        this.scoreVal.innerText = '0';
        this.corruptionBar.style.width = '0%';
        this.viewport.className = '';
        this.statusMsg.innerText = 'CALIBRATING...';
        this.statusMsg.style.color = '';
        
        // Clear all tile states
        this.tiles.forEach(tile => {
            tile.classList.remove('active', 'error');
            tile.style.filter = '';
            tile.style.order = '0';
        });

        this.gameOverScreen.classList.remove('active');
        this.pauseScreen.classList.remove('active');
        this.startScreen.classList.remove('active');
        this.nextRound();
    }

    async nextRound() {
        this.isInputBlocked = true;
        this.playerIndex = 0;
        
        // Increase sequence length
        const seqLength = 2 + Math.floor(this.level / 2);
        this.sequence = [];
        for (let i = 0; i < seqLength; i++) {
            this.sequence.push(Math.floor(Math.random() * this.tiles.length));
        }

        this.statusMsg.innerText = 'SYNCING...';
        await this.delay(1000);
        
        // DECEPTION: Random shuffle BEFORE start at extreme corruption
        if (this.corruption > 85) await this.shuffleTilesBriefly();

        this.statusMsg.innerText = 'OBSERVE';
        await this.playSequence();
        
        // Reset all deceptions before input
        this.tiles.forEach(t => { t.style.order = '0'; t.style.filter = ''; });
        
        this.statusMsg.innerText = 'REPLICATE';
        this.isInputBlocked = false;
        this.state = 'WAITING';
    }

    async playSequence() {
        this.state = 'SHOWING';
        
        for (let i = 0; i < this.sequence.length; i++) {
            if (this.state === 'PAUSED') {
                while(this.state === 'PAUSED') await this.delay(100);
            }
            
            // 1. DECEPTION: Timing Distortion (High Corruption)
            let baseDelay = 400;
            if (this.corruption > 60) {
                baseDelay += (Math.random() - 0.5) * (this.corruption * 4);
            }

            // 2. DECEPTION: Fake Signal (Extreme Corruption)
            if (this.corruption > 80 && Math.random() > 0.85) {
                const fakeIndex = Math.floor(Math.random() * this.tiles.length);
                if (fakeIndex !== this.sequence[i]) {
                    this.statusMsg.innerText = 'ERR//SIGNAL';
                    await this.highlightTile(fakeIndex, 150, true); // Visual only, no sound
                    await this.delay(200);
                    this.statusMsg.innerText = 'OBSERVE';
                }
            }

            // 3. DECEPTION: Position Shift (Extreme Corruption)
            if (this.corruption > 90 && Math.random() > 0.7) {
                await this.shuffleTilesBriefly();
            }

            const tileIndex = this.sequence[i];
            await this.highlightTile(tileIndex, baseDelay);
            
            // Gap between signals
            let gap = 250;
            if (this.corruption > 60) gap += (Math.random() * this.corruption);
            await this.delay(gap);
        }
    }

    async highlightTile(index, duration, isFake = false) {
        const tile = this.tiles[index];
        if (!tile) return;
        
        tile.classList.add('active');
        if (!isFake) this.sound.tile(index);
        
        // 4. DECEPTION: Color Shift (Medium Corruption)
        if (this.corruption > 30) {
            const shift = isFake ? 180 : (this.corruption / 2);
            tile.style.filter = `hue-rotate(${shift}deg) saturate(1.5)`;
        }

        await this.delay(duration);
        tile.classList.remove('active');
        tile.style.filter = '';
    }

    handleTileClick(index) {
        if (this.isInputBlocked || this.state !== 'WAITING') return;

        // Visual feedback
        const tile = this.tiles[index];
        tile.classList.add('active');
        this.sound.tile(index);
        setTimeout(() => tile.classList.remove('active'), 150);

        if (index === this.sequence[this.playerIndex]) {
            this.playerIndex++;
            if (this.playerIndex === this.sequence.length) {
                this.roundWin();
            }
        } else {
            this.roundFail();
        }
    }

    async roundWin() {
        this.isInputBlocked = true;
        this.statusMsg.innerText = 'CALIBRATED';
        this.sound.win();
        this.score += this.level * 100;
        this.scoreVal.innerText = this.score;
        
        // Increase corruption
        this.corruption = Math.min(100, this.corruption + 4 + Math.floor(this.level / 2));
        this.updateCorruptionEffects();
        
        this.level++;
        this.levelVal.innerText = this.level;
        
        await this.delay(1000);
        this.nextRound();
    }

    async roundFail() {
        this.isInputBlocked = true;
        this.statusMsg.innerText = 'FAILURE';
        this.sound.fail();
        
        // Glitch effect
        this.viewport.classList.add('distort-blur');
        this.tiles.forEach(t => t.classList.add('error'));
        
        await this.delay(1500);
        this.gameOver();
    }

    updateCorruptionEffects() {
        this.corruptionBar.style.width = `${this.corruption}%`;
        
        this.viewport.className = ''; // Reset
        
        if (this.corruption > 80) this.viewport.classList.add('distort-blur');
        else if (this.corruption > 60) this.viewport.classList.add('distort-hue');
        else if (this.corruption > 40) this.viewport.classList.add('distort-flicker');

        // Dynamic status color
        if (this.corruption > 90) this.statusMsg.style.color = '#ff0000';
    }

    async shuffleTilesBriefly() {
        this.statusMsg.innerText = 'LOC//SHIFT';
        const shuffledIndices = this.tiles.map((_, i) => i).sort(() => Math.random() - 0.5);
        
        this.tiles.forEach((tile, i) => {
            tile.style.order = shuffledIndices[i];
        });

        await this.delay(400); // Wait for shift visibility
        this.tiles.forEach(tile => tile.style.order = '0');
        this.statusMsg.innerText = 'OBSERVE';
    }

    gameOver() {
        this.state = 'OVER';
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('final-corruption').innerText = this.corruption;
        this.gameOverScreen.classList.add('active');
    }

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

new MemFragment();
