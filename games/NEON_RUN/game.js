/**
 * NEON//RUN - ANCHOR & PATTERN REFINEMENT
 * High-speed arcade runner with dynamic modifiers.
 */

const lerp = (a, b, t) => a + (b - a) * t;

class Sound {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    play(type, freq = 440, dur = 0.1, vol = 0.1) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + dur);
    }

    jump() { this.play('square', 400 + Math.random() * 100, 0.1, 0.05); }
    land() { this.play('sine', 150, 0.05, 0.1); }
    death() {
        this.play('sawtooth', 100, 0.5, 0.2);
        this.play('square', 50, 0.3, 0.1);
    }
    mod() { this.play('sine', 800, 0.4, 0.05); }
}

class Game {
    constructor() {
        this.sound = new Sound();
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.viewport = document.getElementById('game-viewport');
        this.scoreElement = document.getElementById('score');
        this.finalScoreElement = document.getElementById('final-score');
        this.eventIndicator = document.getElementById('event-indicator');
        this.slowMoIndicator = document.getElementById('slow-mo-indicator');
        this.slowMoBtn = document.getElementById('slow-mo-btn');

        this.state = 'START';
        this.DEBUG = false;

        // --- CONSTANTS ---
        this.BASE_SPEED = 9;
        this.BASE_GRAVITY = 0.8;
        this.SLOW_MO_SCALE = 0.5;
        this.NEUTRAL_MIN = 180;
        this.NEUTRAL_MAX = 300;
        this.MOD_MIN = 480;
        this.MOD_MAX = 900;
        this.WARNING_DUR = 60;

        this.GROUND_HEIGHT = 60;

        // --- MODIFIERS REGISTRY ---
        this.MODIFIERS = [
            { id: 'SPEED_SURGE', name: 'SPEED//SURGE', class: 'mod-speed-surge', color: '#00f0ff' },
            { id: 'GRAVITY_FLIP', name: 'GRAVITY//FLIP', class: 'mod-gravity-flip', color: '#ff00aa' },
            { id: 'LOW_GRAVITY', name: 'LOW_GRAVITY', class: 'mod-low-gravity', color: '#00ff88' },
            { id: 'HEAVY_GRAVITY', name: 'HEAVY_GRAVITY', class: 'mod-heavy-gravity', color: '#ffcc00' },
            { id: 'DOUBLE_OBSTACLES', name: 'CLUSTER//REDACTED', class: 'mod-phase-obstacles', color: '#ff004c' },
            { id: 'NARROW_GAPS', name: 'NARROW//SCAN', class: 'mod-phase-obstacles', color: '#00ccff' },
            { id: 'PHASE_OBSTACLES', name: 'PHASE//SHIFT', class: 'mod-phase-obstacles', color: '#aaaaaa' },
            { id: 'SCREEN_DISTORTION', name: 'SIGNAL//LOSS', class: 'mod-screen-distortion', color: '#ffffff' },
            { id: 'REVERSE_MOMENTUM', name: 'REVERSE//PULL', class: 'mod-reverse-momentum', color: '#ff3300' },
            { id: 'SHADOW_ECHO', name: 'SHADOW//ECHO', class: 'mod-shadow-echo', color: '#66ffcc' }
        ];

        this.keys = { space: false };
        this.activeMod = null;
        this.phase = 'NEUTRAL';
        this.phaseTimer = this.NEUTRAL_MIN;
        this.nextMod = null;

        this.distance = 0;
        this.lastTime = 0;
        this.isSlowMo = false;
        this.timescale = 1.0;

        this.player = new Player(this);
        this.obstacles = [];
        this.nextObstacleDist = 0;

        this.init();
    }

    getGroundY() { return this.canvas.height - this.GROUND_HEIGHT; }
    getCeilingY() { return this.GROUND_HEIGHT; }

    init() {
        this.bindEvents();
        this.resize();
        window.addEventListener('resize', () => { this.resize(); this.checkOrientation(); });
        window.addEventListener('orientationchange', () => this.checkOrientation());
        this.checkOrientation();
        requestAnimationFrame(this.loop.bind(this));
    }

    checkOrientation() {
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isPortrait = window.innerHeight > window.innerWidth;
        const overlay = document.getElementById('orientation-overlay');
        const mobileControls = document.getElementById('mobile-controls');

        if (isMobile && isPortrait) {
            overlay.style.display = 'flex';
            mobileControls.style.display = 'none';
            if (this.state === 'PLAYING') this.pause();
        } else {
            overlay.style.display = 'none';
            if (isMobile) mobileControls.style.display = 'block';
            else mobileControls.style.display = 'none';
        }
    }

    resize() {
        const container = document.getElementById('game-container');
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.ctx.imageSmoothingEnabled = false;
    }

    bindEvents() {
        const handleAction = (e) => {
            if (this.state === 'START') this.start();
            else if (this.state === 'PLAYING') this.player.jump();
        };

        const toggleSlowMo = () => { if (this.state === 'PLAYING') this.isSlowMo = !this.isSlowMo; };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') { if (!this.keys.space) { this.keys.space = true; handleAction(e); } }
            if (e.code === 'KeyR' && this.state === 'OVER') this.restart();
            if (e.code === 'KeyD') this.DEBUG = !this.DEBUG;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.shiftKey) toggleSlowMo();
            if (e.code === 'Escape' && this.state === 'PLAYING') this.pause();
            else if (e.code === 'Escape' && this.state === 'PAUSED') this.resume();
        });

        window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.keys.space = false; });

        document.getElementById('game-container').addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('#mobile-controls')) return;
            if (this.state === 'PLAYING' || this.state === 'START') { e.preventDefault(); handleAction(e); }
        }, { passive: false });

        const bindButton = (id, action) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const handler = (e) => { e.preventDefault(); e.stopPropagation(); action(); };
            btn.addEventListener('click', handler);
            btn.addEventListener('touchstart', handler);
        };

        bindButton('slow-mo-btn', toggleSlowMo);
        bindButton('resume-btn', () => this.resume());
        bindButton('restart-btn', () => this.restart());
        bindButton('retry-btn', () => this.restart());

        document.querySelectorAll('.exit-btn, #exit-btn').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); window.location.href = '../../index.html'; };
        });
    }

    start() {
        this.state = 'PLAYING';
        this.sound.mod();
        document.getElementById('start-screen').classList.remove('active');
    }
    pause() { this.state = 'PAUSED'; document.getElementById('pause-screen').classList.add('active'); }
    resume() { this.state = 'PLAYING'; document.getElementById('pause-screen').classList.remove('active'); }
    gameOver() {
        this.state = 'OVER';
        this.sound.death();
        this.isSlowMo = false; // Reset slow-mo on death
        this.finalScoreElement.innerText = Math.floor(this.distance);
        document.getElementById('game-over-screen').classList.add('active');
        this.endModifier(); // Reset VFX on death
    }

    restart() {
        this.state = 'PLAYING';
        this.distance = 0;
        this.phase = 'NEUTRAL';
        this.phaseTimer = this.NEUTRAL_MIN;
        this.activeMod = null;
        this.nextMod = null;
        this.timescale = 1.0;
        this.isSlowMo = false;
        this.player.reset();
        this.obstacles = [];
        this.nextObstacleDist = 0;
        this.endModifier();
        document.getElementById('game-over-screen').classList.remove('active');
        document.getElementById('pause-screen').classList.remove('active');
    }

    updateSystem(step) {
        if (this.state !== 'PLAYING') return;
        this.phaseTimer -= step;
        if (this.phaseTimer <= 0) {
            if (this.phase === 'NEUTRAL') this.enterWarning();
            else if (this.phase === 'WARNING') this.enterActive();
            else if (this.phase === 'ACTIVE') this.enterNeutral();
        }
    }

    enterNeutral() {
        this.endModifier();
        this.phase = 'NEUTRAL';
        this.phaseTimer = this.NEUTRAL_MIN + Math.random() * (this.NEUTRAL_MAX - this.NEUTRAL_MIN);
    }

    enterWarning() {
        this.phase = 'WARNING';
        this.phaseTimer = this.WARNING_DUR;
        this.nextMod = this.MODIFIERS[Math.floor(Math.random() * this.MODIFIERS.length)];
        this.eventIndicator.innerText = `>>> ${this.nextMod.name} <<<`;
        this.eventIndicator.classList.add('active', 'warning');
    }

    enterActive() {
        this.phase = 'ACTIVE';
        this.sound.mod();
        this.phaseTimer = this.MOD_MIN + Math.random() * (this.MOD_MAX - this.MOD_MIN);
        this.activeMod = this.nextMod;
        this.nextMod = null;
        this.eventIndicator.classList.remove('warning');
        this.viewport.classList.add(this.activeMod.class);
    }

    endModifier() {
        if (this.activeMod) this.viewport.classList.remove(this.activeMod.class);
        this.activeMod = null;
        this.player.gravitySign = 1;
        this.isSlowMo = false; // Emergency reset on phase change
        this.slowMoIndicator.classList.remove('active');
        this.eventIndicator.classList.remove('active', 'warning');
    }

    // --- REFINED CONTEXT GENERATOR ---
    spawnObstacle() {
        const modId = this.activeMod?.id || 'NORMAL';
        let spacing = 500 + Math.random() * 300;
        let speed = this.getCurrentSpeed();

        switch (modId) {
            case 'SPEED_SURGE': spacing = 1700; this.addPattern('SINGLE_ON_SURFACE'); break;
            case 'GRAVITY_FLIP': spacing = 950; this.addPattern('SURFACE_CLUSTERS'); break;
            case 'LOW_GRAVITY': spacing = 850; this.addPattern('AIR_CHANNELS'); break;
            case 'HEAVY_GRAVITY': spacing = 850; this.addPattern('GROUNDED_RAVEN'); break;
            case 'DOUBLE_OBSTACLES': spacing = 950; this.addPattern('DOUBLE_ON_SURFACE'); break;
            case 'NARROW_GAPS': spacing = 400; this.addPattern('RHYTHM_ON_SURFACE'); break;
            default: this.addPattern('DEFAULT_ON_SURFACE'); break;
        }

        this.nextObstacleDist = this.distance + (spacing / (speed / 9));
    }

    addPattern(patternId) {
        const color = this.activeMod?.color || '#ff00aa';
        const flipped = (this.activeMod?.id === 'GRAVITY_FLIP');

        switch (patternId) {
            case 'SINGLE_ON_SURFACE':
                this.obstacles.push(new Obstacle(this, 'SURFACE', 0, color, flipped));
                break;
            case 'SURFACE_CLUSTERS':
                this.obstacles.push(new Obstacle(this, 'SURFACE', 0, color, flipped));
                this.obstacles.push(new Obstacle(this, 'SURFACE', 300, color, flipped));
                break;
            case 'AIR_CHANNELS':
                // Two pillars that leave a central gap, reaching all the way to ceiling/floor
                // Passing h=0 and isPillar=true to trigger dynamic height recalculation
                this.obstacles.push(new Obstacle(this, 'SURFACE', 0, color, true, 0, 0, true)); // Top pillar
                this.obstacles.push(new Obstacle(this, 'SURFACE', 0, color, false, 0, 0, true)); // Bottom pillar
                break;
            case 'GROUNDED_RAVEN':
                this.obstacles.push(new Obstacle(this, 'SURFACE', 0, color, false, 0, 35));
                this.obstacles.push(new Obstacle(this, 'SURFACE', 350, color, false, 0, 35));
                break;
            case 'DOUBLE_ON_SURFACE':
                this.obstacles.push(new Obstacle(this, 'SURFACE', 0, color, flipped));
                this.obstacles.push(new Obstacle(this, 'SURFACE', 200, color, flipped));
                break;
            case 'RHYTHM_ON_SURFACE':
                this.obstacles.push(new Obstacle(this, 'SURFACE', 0, color, flipped));
                break;
            case 'DEFAULT_ON_SURFACE':
                // Removed the 10% random AIR chance to ensure zero floating pillars in neutral
                this.obstacles.push(new Obstacle(this, 'SURFACE', 0, color, flipped));
                break;
        }
    }

    getCurrentSpeed() {
        let s = this.BASE_SPEED;
        if (this.activeMod?.id === 'SPEED_SURGE') s *= 1.9;
        if (this.activeMod?.id === 'REVERSE_MOMENTUM') s *= 0.7;
        return s;
    }

    getCurrentGravity() {
        let g = this.BASE_GRAVITY;
        if (this.activeMod?.id === 'LOW_GRAVITY') g *= 0.4;
        if (this.activeMod?.id === 'HEAVY_GRAVITY') g *= 1.7;
        if (this.activeMod?.id === 'GRAVITY_FLIP') this.player.gravitySign = -1;
        return g;
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;
        const targetTimescale = this.isSlowMo ? this.SLOW_MO_SCALE : 1.0;
        this.timescale = lerp(this.timescale, targetTimescale, 0.15);
        const step = dt * this.timescale * 0.06;
        this.updateSystem(step);
        const speed = this.getCurrentSpeed();
        this.distance += speed * step;
        this.scoreElement.innerText = Math.floor(this.distance);
        this.player.update(step);
        if (this.distance > this.nextObstacleDist) this.spawnObstacle();
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.update(speed * step);
            if (!obs.ghost && obs.checkCollision(this.player)) this.gameOver();
            if (obs.x < -250) this.obstacles.splice(i, 1);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const gh = this.GROUND_HEIGHT;
        const groundY = this.getGroundY();
        const ceilY = this.getCeilingY();

        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, groundY, this.canvas.width, 4);
        this.ctx.fillRect(0, ceilY - 4, this.canvas.width, 4);

        this.ctx.strokeStyle = this.activeMod ? this.activeMod.color : '#00f0ff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, groundY, this.canvas.width, gh);
        this.ctx.strokeRect(0, 0, this.canvas.width, gh);

        this.obstacles.forEach(o => o.draw(this.ctx));
        this.player.draw(this.ctx);

        if (this.activeMod?.id === 'SHADOW_ECHO') {
            this.ctx.globalAlpha = 0.2;
            this.ctx.fillStyle = '#ff00aa';
            this.ctx.fillRect(this.player.x + Math.sin(this.distance / 40) * 150, this.player.y, this.player.w, this.player.h);
            this.ctx.globalAlpha = 1.0;
        }

        const grad = this.ctx.createRadialGradient(this.canvas.width / 2, this.canvas.height / 2, 0, this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.8);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.5)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    loop(time) {
        const dt = time - this.lastTime;
        this.lastTime = time;
        this.update(dt || 16);
        this.draw();
        requestAnimationFrame(this.loop.bind(this));
    }
}

class Player {
    constructor(game) { this.game = game; this.w = 32; this.h = 44; this.reset(); }
    reset() { this.x = 100; this.y = 0; this.vy = 0; this.onGround = false; this.gravitySign = 1; this.isFastFalling = false; }

    jump() {
        const jf = -13 * this.gravitySign;
        if (this.onGround) {
            this.vy = jf;
            this.onGround = false;
            this.game.sound.jump();
        }
        else if (!this.isFastFalling) {
            this.vy = 16 * this.gravitySign;
            this.isFastFalling = true;
            this.game.sound.play('sawtooth', 200, 0.1, 0.03);
        }
    }

    update(step) {
        const g = this.game.getCurrentGravity();
        this.vy += g * this.gravitySign * step;
        this.y += this.vy * step;
        const groundRel = this.game.getGroundY() - this.h;
        const ceilRel = this.game.getCeilingY();
        if (this.gravitySign === 1) {
            if (this.y >= groundRel) {
                if (!this.onGround) this.game.sound.land();
                this.y = groundRel;
                this.vy = 0;
                this.onGround = true;
                this.isFastFalling = false;
            }
        } else {
            if (this.y <= ceilRel) {
                if (!this.onGround) this.game.sound.land();
                this.y = ceilRel;
                this.vy = 0;
                this.onGround = true;
                this.isFastFalling = false;
            }
        }
    }

    draw(ctx) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.game.activeMod ? this.game.activeMod.color : '#00f0ff';
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.shadowBlur = 0;
    }
}

class Obstacle {
    constructor(game, type, offset = 0, color = '#ff00aa', inverted = false, yShift = 0, hFix = 0, isPillar = false, ghost = false) {
        this.game = game;
        this.color = color;
        this.ghost = ghost;
        this.isPillar = isPillar;
        this.x = game.canvas.width + 100 + offset;
        this.w = 30 + Math.random() * 15;
        this.h = (hFix || (45 + Math.random() * 30));

        // Anchors strictly based on SURFACE vs AIR
        if (type === 'SURFACE') {
            this.anchor = inverted ? 'CEILING' : 'GROUND';
        } else {
            this.anchor = 'CENTER';
        }

        this.yShift = yShift;
        this.updateY();
    }

    updateY() {
        if (this.anchor === 'GROUND') {
            if (this.isPillar) {
                // Reach from center gap bottom to ground
                const gap = 160;
                this.h = this.game.canvas.height / 2 - gap / 2 - this.game.GROUND_HEIGHT;
            }
            this.y = this.game.getGroundY() - this.h;
        }
        else if (this.anchor === 'CEILING') {
            if (this.isPillar) {
                // Reach from ceiling to center gap top
                const gap = 160;
                this.h = this.game.canvas.height / 2 - gap / 2 - this.game.GROUND_HEIGHT;
            }
            this.y = this.game.getCeilingY();
        }
        else this.y = (this.game.canvas.height / 2 - this.h / 2) + this.yShift;
    }

    update(speed) { this.x -= speed; this.updateY(); }

    checkCollision(player) {
        const p = 6;
        return (player.x < this.x + this.w - p && player.x + player.w > this.x + p && player.y < this.y + this.h - p && player.y + player.h > this.y + p);
    }

    draw(ctx) {
        if (this.game.activeMod?.id === 'PHASE_OBSTACLES' || this.ghost) ctx.globalAlpha = 0.4;

        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;

        // Base obstacle
        ctx.fillRect(this.x, this.y, this.w, this.h);

        // Visual Detail: Platform Top & Bottom
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(this.x, this.y, this.w, 4); // Top edge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(this.x, this.y + this.h - 4, this.w, 4); // Bottom edge

        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }
}

new Game();
