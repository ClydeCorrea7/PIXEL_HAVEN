/**
 * TILE//SYNC - Game Logic
 * PIXEL_HAVEN // ARCADE_OS
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    play(type) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        switch(type) {
            case 'select':
                osc.type = 'square';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'deselect':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(330, now);
                osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'match':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(1320, now + 0.3);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'error':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.setValueAtTime(80, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'hammer':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(50, now);
                osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
            case 'ui':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
        }
    }
}

class TileSync {
    constructor() {
        this.board = document.getElementById('board');
        this.overlay = document.getElementById('overlay');
        this.selectedPreview = document.getElementById('selected-preview');
        this.selectionCounter = document.getElementById('selection-counter');
        this.executeBtn = document.getElementById('execute-btn');
        this.dismissBtn = document.getElementById('dismiss-btn');
        this.chargeMeter = document.getElementById('charge-meter');
        this.chargeText = document.getElementById('charge-text');
        this.hammerBtn = document.getElementById('hammer-btn');
        this.hammerCountDisplay = document.getElementById('hammer-count');
        this.gameStatus = document.getElementById('game-status');
        this.feedbackToast = document.getElementById('feedback-toast');
        this.displayMode = document.getElementById('display-mode');
        this.displayLevel = document.getElementById('display-level');

        this.audio = new AudioEngine();
        this.symbols = ['◆', '▲', '●', '■', '⚔', '✦', '⚛', '⚡', '✿', '★', '✚', '☯', '☾', '☀', '⚓', '♫'];
        this.currentMode = 'safe';
        this.currentLevel = 1;
        this.tiles = []; 
        this.selectedTiles = [];
        this.charge = 0;
        this.hammers = 0;
        this.isHammerActive = false;
        this.decayInterval = null;
        this.boardScale = 1;
    }

    init() {
        console.log("TILE//SYNC Initialized");
        this.addKeyboardListeners();
    }

    addKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            if (this.overlay.classList.contains('hidden')) {
                if (e.code === 'Space') {
                    e.preventDefault();
                    if (!this.executeBtn.disabled) this.executeMatch();
                } else if (e.key.toLowerCase() === 'c') {
                    this.dismissSelection();
                }
            }
        });
    }

    start(mode) {
        this.audio.init();
        this.audio.play('ui');
        this.currentMode = mode;
        this.currentLevel = 1;
        this.charge = 0;
        this.hammers = 0;

        // Force Full Screen on Start (User Interaction required)
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        }

        this.displayMode.textContent = mode.toUpperCase();
        this.overlay.classList.add('hidden');
        this.initLevel();
    }

    initLevel() {
        this.resetGameState();
        this.generateBoard();
        this.updateUI();
        this.startDecaySystem();
    }

    resetGameState() {
        this.tiles = [];
        this.selectedTiles = [];
        this.isHammerActive = false;
        this.board.innerHTML = '';
        if (this.decayInterval) clearInterval(this.decayInterval);
    }

    generatePyramidLayout() {
        // Using 2x2 coordinate units for Mahjong logic
        const layout = [];
        // Layer 0: 12x8 area
        for (let x = 0; x < 12; x += 2) {
            for (let y = 0; y < 8; y += 2) {
                layout.push({x, y, z: 0});
            }
        }
        // Layer 1: 10x6 area
        for (let x = 1; x < 11; x += 2) {
            for (let y = 1; y < 7; y += 2) {
                layout.push({x, y, z: 1});
            }
        }
        // Layer 2: 8x4 area
        for (let x = 2; x < 10; x += 2) {
            for (let y = 2; y < 6; y += 2) {
                layout.push({x, y, z: 2});
            }
        }
        return layout;
    }

    generateFortressLayout() {
        const layout = [];
        // Base
        for (let x = 0; x < 14; x += 2) {
            for (let y = 0; y < 10; y += 2) {
                if (x < 4 || x > 10 || y < 2 || y > 8)
                layout.push({x, y, z: 0});
            }
        }
        // Towers
        for (let x = 0; x < 14; x += 12) {
            for (let y = 0; y < 10; y += 2) {
                layout.push({x, y, z: 1});
            }
        }
        // Center stack
        for (let x = 6; x < 10; x += 2) {
            for (let y = 4; y < 8; y += 2) {
                layout.push({x, y, z: 0}, {x, y, z: 1}, {x, y, z: 2});
            }
        }
        return layout;
    }

    generateComplexLayout() {
        const layout = [];
        for (let z = 0; z < 5; z++) {
            const start = z;
            const size = 10 - z;
            for (let x = start; x < start + size; x += 2) {
                for (let y = start; y < start + size / 2; y += 2) {
                    layout.push({x, y, z});
                }
            }
        }
        return layout;
    }

    generateBoard() {
        const tileCount = Math.min(20 + (this.currentLevel - 1) * 10, 100);
        const layout = this.createTemplateLayout(tileCount);
        
        // Calculate bounds upfront for positionTile
        const bounds = {
            maxUnitsX: Math.max(...layout.map(p => p.x), 10) + 2,
            maxUnitsY: Math.max(...layout.map(p => p.y), 6) + 2
        };

        const tileAssignments = this.getSolvableAssignments(layout);
        
        tileAssignments.forEach((data, index) => {
            const tileData = {
                id: `tile-${index}`,
                x: data.x,
                y: data.y,
                z: data.z,
                symbol: data.symbol,
                state: 'idle',
                neighbors: { top: [], left: [], right: [] }
            };

            const el = document.createElement('div');
            el.className = 'tile';
            el.id = tileData.id;
            el.innerHTML = `<span class="symbol">${tileData.symbol}</span>`;
            
            this.positionTile(el, tileData, bounds);

            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.handleTileClick(tileData);
            });
            
            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleTileClick(tileData);
            }, {passive: false});
            
            tileData.element = el;
            this.tiles.push(tileData);
            this.board.appendChild(el);
        });

        this.updateAccessibility();
        window.addEventListener('resize', () => this.repositionAllTiles());
    }

    createTemplateLayout(targetCount) {
        const templates = ['pyramid', 'rectangle', 'bridge', 'ring', 'split'];
        const chosen = templates[Math.floor(Math.random() * templates.length)];
        
        switch(chosen) {
            case 'pyramid': return this.layoutPyramid(targetCount);
            case 'bridge': return this.layoutBridge(targetCount);
            case 'ring': return this.layoutRing(targetCount);
            case 'split': return this.layoutSplit(targetCount);
            default: return this.layoutRectangle(targetCount);
        }
    }

    layoutRectangle(target) {
        const layout = [];
        let cols = Math.ceil(Math.sqrt(target));
        if (cols % 2 !== 0) cols++;
        const rows = Math.ceil(target / cols);
        
        let count = 0;
        for (let y = 0; y < rows && count < target; y++) {
            for (let x = 0; x < cols && count < target; x++) {
                layout.push({ x: x * 2, y: y * 2, z: 0 });
                count++;
            }
        }
        return layout;
    }

    layoutPyramid(target) {
        const layout = [];
        let count = 0;
        let z = 0;
        let size = 8;
        while (count < target && size > 0) {
            for (let x = 0; x < size && count < target; x++) {
                for (let y = 0; y < size && count < target; y++) {
                    layout.push({ x: (x * 2) + z, y: (y * 2) + z, z: z });
                    count++;
                }
            }
            z++;
            size -= 2;
        }
        return layout;
    }

    layoutBridge(target) {
        const layout = [];
        let count = 0;
        // Two pillars
        for (let side = 0; side < 2; side++) {
            const xOffset = side * 10;
            for (let x = 0; x < 2 && count < target; x++) {
                for (let y = 0; y < 6 && count < target; y++) {
                    layout.push({ x: xOffset + (x * 2), y: y * 2, z: 0 });
                    count++;
                }
            }
        }
        // Bridge top
        for (let x = 1; x < 5 && count < target; x++) {
            for (let y = 2; y < 4 && count < target; y++) {
                layout.push({ x: x * 2 + 2, y: y * 2, z: 1 });
                count++;
            }
        }
        return layout;
    }

    layoutRing(target) {
        const layout = [];
        let count = 0;
        const size = 8;
        // Outer Frame
        for (let x = 0; x < size && count < target; x++) {
            layout.push({ x: x * 2, y: 0, z: 0 });
            layout.push({ x: x * 2, y: (size - 1) * 2, z: 0 });
            count += 2;
        }
        for (let y = 1; y < size - 1 && count < target; y++) {
            layout.push({ x: 0, y: y * 2, z: 0 });
            layout.push({ x: (size - 1) * 2, y: y * 2, z: 0 });
            count += 2;
        }
        // Center island
        for (let x = 3; x < 5 && count < target; x++) {
            for (let y = 3; y < 5 && count < target; y++) {
                layout.push({ x: x * 2, y: y * 2, z: 1 });
                count++;
            }
        }
        return layout;
    }

    layoutSplit(target) {
        const layout = [];
        let count = 0;
        const half = Math.floor(target / 2);
        // Island 1
        for (let x = 0; x < 4 && count < half; x++) {
            for (let y = 0; y < 4 && count < half; y++) {
                layout.push({ x: x * 2, y: y * 2, z: 0 });
                count++;
            }
        }
        // Island 2
        let count2 = 0;
        for (let x = 0; x < 4 && count < target; x++) {
            for (let y = 0; y < 4 && count < target; y++) {
                layout.push({ x: x * 2 + 12, y: y * 2, z: 0 });
                count++;
            }
        }
        return layout;
    }

    getSolvableAssignments(layout) {
        const availablePositions = layout.map((p, i) => ({...p, id: i}));
        const results = [];
        const symPool = [...this.symbols];
        this.shuffleArray(symPool);
        let symIdx = 0;

        // Difficulty Scaling: Higher levels = more quads and hexes
        const levelFactor = Math.min(this.currentLevel / 10, 1);
        let weights;
        
        if (this.currentMode === 'safe') {
            // Safe: Mostly pairs, few quads, no hex
            weights = { 2: 0.9 - levelFactor * 0.3, 4: 0.1 + levelFactor * 0.3, 6: 0 };
        } else if (this.currentMode === 'spicy') {
            // Spicy: Balanced scaling
            weights = { 2: 0.7 - levelFactor * 0.4, 4: 0.2 + levelFactor * 0.2, 6: 0.1 + levelFactor * 0.2 };
        } else {
            // Chaos: Aggressive scaling
            weights = { 2: 0.4 - levelFactor * 0.3, 4: 0.3 + levelFactor * 0.2, 6: 0.3 + levelFactor * 0.2 };
        }

        while (availablePositions.length > 0) {
            let size = 2;
            const r = Math.random();
            if (r < (weights[6] || 0)) size = 6;
            else if (r < (weights[6] || 0) + (weights[4] || 0)) size = 4;
            else size = 2;

            if (size > availablePositions.length) size = availablePositions.length;
            if (size % 2 !== 0 && size > 1) size -= 1; 

            const symbol = symPool[symIdx % symPool.length];
            symIdx++;

            const exposed = [];
            for (let i = 0; i < size; i++) {
                if (availablePositions.length === 0) break;
                const freeIdx = this.findExposedPositionIndex(availablePositions);
                if (freeIdx === -1) break;
                exposed.push(availablePositions.splice(freeIdx, 1)[0]);
            }

            exposed.forEach(p => results.push({...p, symbol}));
        }
        return results;
    }

    findExposedPositionIndex(positions) {
        // A position is exposed if no one is on top
        // And it has a free side relative to current list
        const exposedIndices = [];
        for (let i = 0; i < positions.length; i++) {
            const p = positions[i];
            const onTop = positions.some(t => t.z === p.z + 1 && Math.abs(t.x - p.x) < 2 && Math.abs(t.y - p.y) < 2);
            if (onTop) continue;

            const leftBlocked = positions.some(t => t.z === p.z && t.x === p.x - 2 && Math.abs(t.y - p.y) < 2);
            const rightBlocked = positions.some(t => t.z === p.z && t.x === p.x + 2 && Math.abs(t.y - p.y) < 2);
            
            if (!leftBlocked || !rightBlocked) exposedIndices.push(i);
        }
        if (exposedIndices.length > 0) {
            return exposedIndices[Math.floor(Math.random() * exposedIndices.length)];
        }
        return -1;
    }

    positionTile(el, pos, bounds) {
        if (!bounds) {
            bounds = {
                maxUnitsX: Math.max(...this.tiles.map(t => t.x), 10) + 2,
                maxUnitsY: Math.max(...this.tiles.map(t => t.y), 6) + 2
            };
        }

        let sidebarWidth = 300;
        if (window.innerWidth < 600 || window.innerHeight < 500) sidebarWidth = 140;
        else if (window.innerWidth < 900) sidebarWidth = 220;

        const condensation = (window.innerWidth < 600 || window.innerHeight < 500) ? 10 : 40;
        const verticalMargin = window.innerHeight < 500 ? 10 : 60;
        const boardAreaWidth = window.innerWidth - sidebarWidth - condensation;
        const boardAreaHeight = window.innerHeight - verticalMargin;
        
        const tileWidth = Math.min(boardAreaWidth / (bounds.maxUnitsX / 2 + 1), boardAreaHeight / (bounds.maxUnitsY / 2 + 1) * 0.75, 70);
        const tileHeight = tileWidth * (4/3);
        
        const unitX = tileWidth / 2;
        const unitY = tileHeight / 2;

        const centerX = (window.innerWidth - sidebarWidth) / 2;
        const centerY = window.innerHeight / 2;
        
        el.style.width = `${tileWidth}px`;
        el.style.height = `${tileHeight}px`;
        el.style.fontSize = `${tileWidth * 0.5}px`;
        
        const offsetX = (bounds.maxUnitsX / 2) * unitX;
        const offsetY = (bounds.maxUnitsY / 2) * unitY;

        el.style.left = `${centerX - offsetX + pos.x * unitX}px`;
        el.style.top = `${centerY - offsetY + pos.y * unitY}px`;
        // Lower tile z-index relative to UI (UI is 100)
        el.style.zIndex = Math.min(pos.z * 10, 90);
        el.style.transform = `translate(${pos.z * 4}px, ${-pos.z * 4}px)`;
    }

    repositionAllTiles() {
        this.tiles.forEach(tile => {
            if (tile.state !== 'removing') {
                this.positionTile(tile.element, {x: tile.x, y: tile.y, z: tile.z});
            }
        });
    }

    getSetConfigurations(total) {
        const configs = [];
        let remaining = total;
        
        // Mode based distribution weights
        let weights = { 2: 0.8, 4: 0.2, 6: 0 };
        if (this.currentMode === 'spicy') weights = { 2: 0.4, 4: 0.4, 6: 0.2 };
        if (this.currentMode === 'chaos') weights = { 2: 0.2, 4: 0.4, 6: 0.4 };

        while (remaining > 0) {
            let size = 2;
            const r = Math.random();
            if (r < weights[6]) size = 6;
            else if (r < weights[6] + weights[4]) size = 4;
            else size = 2;

            if (remaining >= size) {
                configs.push({ size });
                remaining -= size;
            } else {
                // Not enough room for chosen size, pick smallest available
                configs.push({ size: 2 });
                remaining -= 2;
            }
        }
        return configs;
    }

    handleTileClick(tile) {
        if (tile.state === 'removing' || tile.state === 'locked') return;
        
        if (this.isHammerActive) {
            this.useHammer(tile);
            return;
        }

        // Check if free
        if (!this.isTileFree(tile)) {
            this.showFeedback("Tile is Blocked!");
            this.audio.play('error');
            tile.element.classList.add('shake');
            setTimeout(() => tile.element.classList.remove('shake'), 400);
            return;
        }

        // Selection logic
        const alreadySelected = this.selectedTiles.find(t => t.id === tile.id);
        
        if (alreadySelected) {
            this.deselectTile(tile);
            this.audio.play('deselect');
        } else {
            // Must be same symbol
            if (this.selectedTiles.length > 0 && this.selectedTiles[0].symbol !== tile.symbol) {
                this.showFeedback("Symbols must match!");
                this.audio.play('error');
                return;
            }
            this.selectTile(tile);
            this.audio.play('select');
        }

        this.updateUI();
    }

    updateAccessibility() {
        this.tiles.forEach(tile => {
            if (tile.state === 'removing') return;
            
            // Calculate and store neighbors for metadata requirement
            tile.neighbors = {
                top: this.tiles.filter(t => t.state !== 'removing' && t.z === tile.z + 1 && Math.abs(t.x - tile.x) < 2 && Math.abs(t.y - tile.y) < 2),
                left: this.tiles.filter(t => t.state !== 'removing' && t.z === tile.z && t.x === tile.x - 2 && Math.abs(t.y - tile.y) < 2),
                right: this.tiles.filter(t => t.state !== 'removing' && t.z === tile.z && t.x === tile.x + 2 && Math.abs(t.y - tile.y) < 2)
            };

            const isFree = tile.neighbors.top.length === 0 && (tile.neighbors.left.length === 0 || tile.neighbors.right.length === 0);
            
            if (isFree) {
                tile.element.classList.remove('blocked');
                tile.element.style.pointerEvents = 'auto';
            } else {
                tile.element.classList.add('blocked');
                tile.element.style.pointerEvents = 'none';
            }
        });
        
        this.verifyPlayability();
    }

    isTileFree(tile) {
        return tile.neighbors.top.length === 0 && (tile.neighbors.left.length === 0 || tile.neighbors.right.length === 0);
    }

    verifyPlayability() {
        // Validation step: Check if at least one match of size 2 exists
        const freeTiles = this.tiles.filter(t => t.state === 'idle' && this.isTileFree(t));
        const symbolCounts = {};
        freeTiles.forEach(t => {
            symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1;
        });
        
        const possible = Object.values(symbolCounts).some(count => count >= 2);
        if (!possible && this.tiles.filter(t => t.state === 'idle').length > 0) {
            this.gameStatus.textContent = "NO MOVES LEFT - SHUFFLING...";
            this.showFeedback("No moves! Shuffling...", "danger");
            setTimeout(() => this.shuffleRest(), 1500);
        }
    }

    shuffleRest() {
        const remaining = this.tiles.filter(t => t.state === 'idle');
        const symbols = remaining.map(t => t.symbol);
        this.shuffleArray(symbols);
        remaining.forEach((t, i) => {
            t.symbol = symbols[i];
            t.element.innerHTML = `<span class="symbol">${t.symbol}</span>`;
        });
        this.updateAccessibility();
    }

    selectTile(tile) {
        tile.state = 'selected';
        tile.element.classList.add('selected');
        this.selectedTiles.push(tile);
    }

    deselectTile(tile) {
        tile.state = 'idle';
        tile.element.classList.remove('selected');
        this.selectedTiles = this.selectedTiles.filter(t => t.id !== tile.id);
    }

    dismissSelection() {
        this.audio.play('ui');
        this.selectedTiles.forEach(tile => {
            tile.state = 'idle';
            tile.element.classList.remove('selected');
        });
        this.selectedTiles = [];
        this.updateUI();
    }

    executeMatch() {
        const count = this.selectedTiles.length;
        const symbol = this.selectedTiles[0].symbol;

        // Allowed sizes: 2, 4, 6
        if (![2, 4, 6].includes(count)) {
            this.showFeedback("Select exactly 2, 4, or 6!", "danger");
            this.audio.play('error');
            this.selectedPreview.classList.add('shake');
            setTimeout(() => this.selectedPreview.classList.remove('shake'), 400);
            return;
        }

        this.audio.play('match');

        // Success!
        this.selectedTiles.forEach(tile => {
            tile.state = 'removing';
            tile.element.classList.add('removing');
            setTimeout(() => {
                tile.element.remove();
            }, 400);
        });

        // Reward system
        if (count === 6) this.addCharge(5);
        else if (count === 4) this.addCharge(3);
        else if (count === 2) this.addCharge(1);

        this.selectedTiles = [];
        this.showFeedback(`Success! +${count} Cleared`, "success");
        
        setTimeout(() => {
            this.updateAccessibility();
            this.checkWinCondition();
        }, 500);
        
        this.updateUI();
    }

    addCharge(amount) {
        this.charge += amount;
        if (this.charge >= 10) {
            this.hammers += Math.floor(this.charge / 10);
            this.charge %= 10;
        }
        this.updateUI();
    }

    activateHammer() {
        if (this.hammers <= 0 || this.isHammerActive) return;
        this.audio.play('ui');
        this.isHammerActive = true;
        this.hammerBtn.classList.add('glow');
        this.gameStatus.textContent = "HAMMER READY: SELECT ANY TILE";
        this.gameStatus.style.color = "var(--accent-purple)";
    }

    useHammer(tile) {
        const symbolToClear = tile.symbol;
        const setSize = tile.setSize;
        
        this.tiles.forEach(t => {
            if (t.symbol === symbolToClear && t.state !== 'removing') {
                t.state = 'removing';
                t.element.classList.add('removing');
                setTimeout(() => t.element.remove(), 400);
            }
        });

        this.hammers--;
        this.isHammerActive = false;
        this.hammerBtn.classList.remove('glow');
        this.audio.play('hammer');
        this.showFeedback("Hammer Used!", "purple");
        
        setTimeout(() => {
            this.updateAccessibility();
            this.checkWinCondition();
        }, 450);
        this.updateUI();
    }

    updateUI() {
        if (this.displayLevel) this.displayLevel.textContent = this.currentLevel;
        // Preview
        if (this.selectedTiles.length > 0) {
            this.selectedPreview.innerHTML = `<span>${this.selectedTiles[0].symbol}</span>`;
            this.selectedPreview.classList.add('has-item');
            const count = this.selectedTiles.length;
            this.selectionCounter.textContent = `${count} SELECTED`;
            this.executeBtn.disabled = ![2, 4, 6].includes(count);
        } else {
            this.selectedPreview.innerHTML = `<div class="empty-symbol">?</div>`;
            this.selectedPreview.classList.remove('has-item');
            this.selectionCounter.textContent = `0 SELECTED`;
            this.executeBtn.disabled = true;
        }

        // Charge
        const pct = (this.charge / 10) * 100;
        this.chargeMeter.style.width = `${pct}%`;
        this.chargeText.textContent = `CHARGE: ${this.charge} / 10`;
        this.hammerCountDisplay.textContent = this.hammers;

        if (!this.isHammerActive) {
            this.gameStatus.textContent = "READY";
            this.gameStatus.style.color = "white";
        }
    }

    showFeedback(msg, type = "normal") {
        this.feedbackToast.textContent = msg;
        this.feedbackToast.className = `toast show ${type}`;
        setTimeout(() => this.feedbackToast.classList.remove('show'), 2000);
    }

    startDecaySystem() {
        if (this.currentMode === 'safe') return;

        const interval = this.currentMode === 'chaos' ? 15000 : 25000;
        this.decayInterval = setInterval(() => {
            this.applyDecay();
        }, interval);
    }

    applyDecay() {
        // Pick random free tiles that aren't selected
        const freeTiles = this.tiles.filter(t => t.state === 'idle' && this.isTileFree(t));
        if (freeTiles.length === 0) return;

        // Target one set
        const target = freeTiles[Math.floor(Math.random() * freeTiles.length)];
        const setToDecay = this.tiles.filter(t => t.symbol === target.symbol && t.state === 'idle');

        setToDecay.forEach(t => {
            t.element.classList.add('unstable');
        });

        this.showFeedback("Visual Warning: Tiles Unstable!", "danger");

        // Lock them after 10s if not selected
        setTimeout(() => {
            setToDecay.forEach(t => {
                if (t.state === 'idle') {
                    t.state = 'locked';
                    t.element.classList.remove('unstable');
                    t.element.classList.add('locked');
                }
            });
            
            // Unlock after a while (as per prompt: "NOT instant or unfair", "Must NOT be instant")
            // Prompt says "tiles become temporarily locked".
            setTimeout(() => {
                setToDecay.forEach(t => {
                    if (t.state === 'locked') {
                        t.state = 'idle';
                        t.element.classList.remove('locked');
                    }
                });
                this.updateAccessibility();
            }, 10000);

        }, 8000);
    }

    checkWinCondition() {
        const remaining = this.tiles.filter(t => t.state !== 'removing');
        if (remaining.length === 0) {
            this.audio.play('match');
            this.gameStatus.textContent = "LEVEL COMPLETE!";
            this.showFeedback(`Level ${this.currentLevel} Cleared!`, "success");
            
            setTimeout(() => {
                this.currentLevel++;
                if (this.currentLevel > 9) this.currentLevel = 9; // Cap
                this.initLevel();
            }, 2500);
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

const game = new TileSync();
window.onload = () => game.init();
