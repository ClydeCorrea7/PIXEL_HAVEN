/**
 * RECIPE//PANIC
 * PIXEL_HAVEN // ARCADE_OS
 */

const CONFIG = {
    regular: {
        components: ['shape', 'base', 'icing', 'topping'],
        timer: 25000,
        shiftChance: 0,
        levels: 1
    },
    hard: {
        components: ['shape', 'base', 'icing', 'topping', 'extra'],
        timer: 20000,
        shiftChance: 0.5,
        levels: 1.2
    },
    extreme: {
        components: ['shape', 'base', 'icing', 'topping', 'extra', 'extra2', 'extra3'],
        timer: 15000,
        shiftChance: 1.0,
        levels: 1.8
    }
};

const INGREDIENTS = {
    base: [
        { id: 'sponge', name: 'SPONGE', color: '#f5d5a6' },
        { id: 'cocoa', name: 'COCOA', color: '#5d4037' },
        { id: 'velvet', name: 'VELVET', color: '#b71c1c' },
        { id: 'matcha', name: 'MATCHA', color: '#8bc34a' }
    ],
    shape: [
        { id: 'classic', name: 'CLASSIC', class: 'layer-shape-classic', color: 'rgba(255,255,255,0.1)' },
        { id: 'heart', name: 'HEART', class: 'layer-shape-heart', color: 'rgba(255,252,252,0.1)' },
        { id: 'star', name: 'STAR', class: 'layer-shape-star', color: 'rgba(252,255,252,0.1)' }
    ],
    icing: [
        { id: 'vanilla', name: 'VANILLA', color: '#fff9c4' },
        { id: 'berry', name: 'BERRY', color: '#f06292' },
        { id: 'mint', name: 'MINT', color: '#4db6ac' },
        { id: 'neon', name: 'NEON', color: '#00f2ff' }
    ],
    topping: [
        { id: 'cherry', name: 'CHERRY', color: '#d32f2f' },
        { id: 'wafer', name: 'WAFER', color: '#d7ccc8' },
        { id: 'glitch', name: 'GLITCH', color: '#ff00ea' }
    ],
    extra: [
        { id: 'gold', name: 'GOLD_FOIL', color: '#ffd700' },
        { id: 'rainbow', name: 'RAINBOW', color: 'linear-gradient(45deg, #f06, #0ff, #f06)' },
        { id: 'void', name: 'VOID_DUST', color: '#1a1a1a' }
    ],
    extra2: [
        { id: 'spark', name: 'SILVER', color: '#e0e0e0' },
        { id: 'shard', name: 'CYAN_DATA', color: '#00e5ff' }
    ],
    extra3: [
        { id: 'cube', name: 'BIT_CUBE', color: '#3f51b5' },
        { id: 'orb', name: 'NEO_ORB', color: '#673ab7' }
    ]
};

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
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'submit':
                osc.type = 'square';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'error':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.setValueAtTime(150, now + 0.05);
                osc.frequency.setValueAtTime(100, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'shift':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(40, now);
                osc.frequency.linearRampToValueAtTime(80, now + 0.8);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.8);
                osc.start(now);
                osc.stop(now + 0.8);
                break;
            case 'trash':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
        }
    }
}

class RecipeGame {
    constructor() {
        this.lives = 3;
        this.score = 0;
        this.mode = null;
        this.currentCake = [];
        this.targetRecipe = null;
        this.timer = null;
        this.gameActive = false;
        this.isShifting = false;
        this.startTime = 0;
        this.duration = 0;
        this.hasShifted = false;
        this.shouldShift = false;
        this.currentCategory = 'shape';
        this.audio = new AudioEngine();

        this.initDOMElements();
        this.setupEventListeners();
    }

    initDOMElements() {
        this.els = {
            overlay: document.getElementById('overlay'),
            lives: document.getElementById('lives-display'),
            timerBar: document.getElementById('timer-bar'),
            shiftMarker: document.getElementById('shift-marker'),
            score: document.getElementById('score-display'),
            playerStack: document.getElementById('player-stack'),
            targetRecipe: document.getElementById('target-recipe'),
            ingredientGrid: document.getElementById('ingredient-grid'),
            tabs: document.querySelectorAll('.tab-btn'),
            shiftAlert: document.getElementById('shift-alert'),
            flicker: document.getElementById('crt-flicker'),
            submitBtn: document.getElementById('submit-btn'),
            trashBtn: document.getElementById('trash-btn'),
            feedback: document.getElementById('feedback-layer'),
            extraTab: document.getElementById('extra-tab'),
            extra2Tab: document.getElementById('extra2-tab'),
            extra3Tab: document.getElementById('extra3-tab')
        };
    }

    setupEventListeners() {
        this.els.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchCategory(tab.dataset.category);
            });
        });

        window.addEventListener('keydown', (e) => {
            if (!this.gameActive) return;
            if (e.code === 'Space') {
                e.preventDefault();
                this.submitCake();
            }
            if (e.code === 'KeyR') {
                this.clearStack();
            }
        });
    }

    start(mode) {
        this.audio.init();
        this.mode = mode;
        this.lives = 3;
        this.score = 0;
        this.gameActive = true;
        this.els.overlay.classList.add('hidden');
        this.updateLivesDisplay();
        this.updateScoreDisplay();
        
        if (mode === 'hard') {
            this.els.extraTab.classList.remove('hidden');
        } else if (mode === 'extreme') {
            this.els.extraTab.classList.remove('hidden');
            this.els.extra2Tab.classList.remove('hidden');
            this.els.extra3Tab.classList.remove('hidden');
        } else {
            this.els.extraTab.classList.add('hidden');
            this.els.extra2Tab.classList.add('hidden');
            this.els.extra3Tab.classList.add('hidden');
        }

        this.newOrder();
    }

    newOrder() {
        this.currentCake = [];
        this.hasShifted = false;
        this.isShifting = false;
        this.shouldShift = Math.random() < CONFIG[this.mode].shiftChance;
        this.els.playerStack.innerHTML = '';
        this.els.submitBtn.disabled = false;
        this.switchCategory('shape');
        
        this.generateRecipe();
        this.startTimer();
        this.renderRecipe();
    }

    generateRecipe() {
        const components = CONFIG[this.mode].components;
        this.targetRecipe = components.map(type => {
            const pool = INGREDIENTS[type] || INGREDIENTS.extra;
            const choice = pool[Math.floor(Math.random() * pool.length)];
            return { type, ...choice };
        });
    }

    startTimer() {
        if (this.timer) clearInterval(this.timer);
        this.startTime = Date.now();
        this.duration = CONFIG[this.mode].timer;
        
        this.timer = setInterval(() => {
            if (!this.gameActive) return;

            const elapsed = Date.now() - this.startTime;
            const progress = 1 - (elapsed / this.duration);

            if (progress <= 0) {
                this.handleFail('PROTOCOL_TIMEOUT');
                return;
            }

            this.els.timerBar.style.width = `${progress * 100}%`;

            // Shift Logic at 60% of duration (progress = 0.4 left)
            if (this.shouldShift && !this.hasShifted && progress <= 0.4) {
                this.performShift();
            }
        }, 32);
    }

    performShift() {
        this.hasShifted = true;
        this.isShifting = true;
        this.audio.play('shift');
        
        this.els.submitBtn.disabled = true;
        this.els.flicker.classList.add('flicker-active');
        this.els.shiftAlert.classList.add('active');

        setTimeout(() => {
            const numChanges = Math.random() > 0.7 ? 2 : 1;
            const changeIndices = [];
            while(changeIndices.length < numChanges) {
                const idx = Math.floor(Math.random() * this.targetRecipe.length);
                if (!changeIndices.includes(idx)) changeIndices.push(idx);
            }

            changeIndices.forEach(idx => {
                const type = this.targetRecipe[idx].type;
                const pool = INGREDIENTS[type] || INGREDIENTS.extra;
                let newChoice;
                do {
                    newChoice = pool[Math.floor(Math.random() * pool.length)];
                } while (newChoice.id === this.targetRecipe[idx].id && pool.length > 1);
                
                this.targetRecipe[idx] = { type, ...newChoice, shifted: true };
            });

            this.renderRecipe();
            
            this.isShifting = false;
            this.els.submitBtn.disabled = false;
            this.els.flicker.classList.remove('flicker-active');
            this.els.shiftAlert.classList.remove('active');
        }, 800);
    }

    renderRecipe() {
        this.els.targetRecipe.innerHTML = this.targetRecipe.map(item => `
            <div class="recipe-item ${item.shifted ? 'changed' : ''}">
                <div class="recipe-color-preview" style="background: ${item.color || '#333'}">
                    ${item.class ? '<span style="font-size:12px; display:block; text-align:center; opacity:0.5; margin-top:5px">⬚</span>' : ''}
                </div>
                <div class="recipe-info">
                    <span class="recipe-type">${item.type.toUpperCase()}</span>
                    <span class="recipe-value">${item.name}</span>
                </div>
            </div>
        `).join('');
    }

    switchCategory(cat) {
        this.currentCategory = cat;
        this.els.tabs.forEach(t => t.classList.toggle('active', t.dataset.category === cat));
        
        const pool = INGREDIENTS[cat] || INGREDIENTS.extra;
        this.els.ingredientGrid.innerHTML = pool.map(item => `
            <div class="ingredient-item-ui" onclick="game.addLayer('${item.id}', '${cat}')">
                <div class="ingredient-preview" style="background: ${item.color || '#444'}"></div>
                <div class="ingredient-name">${item.name}</div>
            </div>
        `).join('');
    }

    addLayer(id, type) {
        if (this.isShifting || !this.gameActive) return;
        
        // Prevent adding more layers than recipe needs
        if (this.currentCake.length >= this.targetRecipe.length) {
            this.audio.play('error');
            return;
        }

        const pool = INGREDIENTS[type] || INGREDIENTS.extra;
        const item = pool.find(i => i.id === id);
        this.currentCake.push({ type, ...item });
        this.audio.play('select');
        this.renderStack();
    }

    renderStack() {
        this.els.playerStack.innerHTML = this.currentCake.map(layer => {
            let style = layer.color ? `background: ${layer.color}` : '';
            if (layer.color && layer.color.includes('gradient')) {
                style = `background-image: ${layer.color}`;
            }
            let className = `layer layer-${layer.type} ${layer.class || ''}`;
            return `<div class="${className}" style="${style}"></div>`;
        }).join('');
    }

    clearStack() {
        if (this.isShifting || !this.gameActive) return;
        this.currentCake = [];
        this.audio.play('trash');
        this.renderStack();
    }

    submitCake() {
        if (this.isShifting || !this.gameActive) return;

        const isCorrect = this.checkRecipe();
        
        if (isCorrect) {
            this.handleSuccess();
        } else {
            this.handleFail('AUTH_FAILED');
        }
    }

    checkRecipe() {
        if (this.currentCake.length !== this.targetRecipe.length) return false;
        
        for (let i = 0; i < this.targetRecipe.length; i++) {
            if (this.currentCake[i].id !== this.targetRecipe[i].id) return false;
        }
        return true;
    }

    handleSuccess() {
        this.audio.play('submit');
        this.score += 100 * CONFIG[this.mode].levels;
        this.updateScoreDisplay();
        this.showFeedback('SYNC_MATCH', 'msg-correct');
        this.newOrder();
    }

    handleFail(msg) {
        this.audio.play('error');
        this.lives--;
        this.updateLivesDisplay();
        this.showFeedback(msg, 'msg-wrong');
        
        if (this.lives <= 0) {
            this.endGame();
        } else {
            this.newOrder();
        }
    }

    showFeedback(text, className) {
        const div = document.createElement('div');
        div.className = `feedback-msg ${className}`;
        div.innerText = text;
        this.els.feedback.appendChild(div);
        setTimeout(() => div.remove(), 800);
    }

    updateLivesDisplay() {
        const icons = this.els.lives.querySelectorAll('.life-icon');
        icons.forEach((icon, i) => {
            icon.classList.toggle('active', i < this.lives);
        });
    }

    updateScoreDisplay() {
        this.els.score.innerText = String(Math.floor(this.score)).padStart(3, '0');
    }

    endGame() {
        this.gameActive = false;
        clearInterval(this.timer);
        this.els.overlay.classList.remove('hidden');
        document.querySelector('.glitch-text').innerText = 'CORE_CRITICAL';
        document.querySelector('.glitch-text').setAttribute('data-text', 'CORE_CRITICAL');
        document.querySelector('.subtitle').innerText = `TOTAL SYNC: ${Math.floor(this.score)}`;
        
        document.querySelectorAll('.mode-title').forEach(t => {
            t.innerText = 'REBOOT';
        });
    }
}

window.game = new RecipeGame();
