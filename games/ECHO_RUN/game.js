/**
 * ECHO//LOOP - VERTICAL ASCENT + PHASED ECHO
 * Climb infinitely while your recent past replays in 2.5s bursts every 3.5s.
 */

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.heightVal = document.getElementById('height-val');
        this.pulseBar = document.getElementById('pulse-bar');
        this.statusMsg = document.getElementById('status-msg');
        
        // --- OVERLAYS ---
        this.startScreen = document.getElementById('start-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        
        // --- CONFIG ---
        this.ECHO_CYCLE_TIME = 3.5; // Trigger every 3.5s
        this.ECHO_REPLAY_DUR = 2.5; // Replay for 2.5s
        this.BUFFER_SIZE = Math.floor(2.5 * 60); // 150 frames at 60fps
        
        // --- STATE ---
        this.state = 'START';
        this.maxHeight = 0;
        this.cameraY = 0;
        this.cycleTimer = 0; // counts up to 3.5
        this.replayFrame = -1; // -1 means not replaying
        
        this.inputBuffer = []; // Last 2.5s of inputs
        this.currentInputs = { left: false, right: false, jump: false };
        
        this.player = new Player(this);
        this.platforms = [];
        this.nextPlatformY = 600;
        
        // Audio
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        this.init();
    }

    init() {
        this.createStartPlatforms();
        this.bindEvents();
        this.checkMobile();
        this.resize();
        window.addEventListener('resize', () => { this.resize(); this.checkMobile(); });
        requestAnimationFrame(this.loop.bind(this));
    }

    playSound(type, freq, dur) {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + dur);
    }

    createStartPlatforms() {
        // Ground
        this.platforms.push({ x: 0, y: 750, w: 600, h: 50 });
        // Initial setup
        for (let i = 0; i < 10; i++) {
            this.spawnPlatform();
        }
    }

    spawnPlatform() {
        const lastP = this.platforms[this.platforms.length - 1];
        const minGap = 110;
        const maxGap = 160; // Max vertical peak is 173 with current physics. Setting 160 for safety.
        
        const y = this.nextPlatformY;
        const w = 85 + Math.random() * 50;
        
        // Horizontal constraint: Reachable from the last platform
        const range = 250; 
        let minX = lastP ? lastP.x - range : 0;
        let maxX = lastP ? lastP.x + lastP.w + range - w : 600 - w;
        
        minX = Math.max(0, minX);
        maxX = Math.min(600 - w, maxX);
        
        const x = minX + Math.random() * (maxX - minX);
        
        this.platforms.push({ x, y, w, h: 15 });
        this.nextPlatformY -= (minGap + Math.random() * (maxGap - minGap));
    }

    checkMobile() {
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const mobileControls = document.getElementById('mobile-controls');
        mobileControls.style.display = isMobile ? 'flex' : 'none';
    }

    resize() {
        this.canvas.width = 600;
        this.canvas.height = 800;
        this.ctx.imageSmoothingEnabled = false;
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.currentInputs.left = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.currentInputs.right = true;
            if (e.code === 'Space') this.currentInputs.jump = true;
            if (e.code === 'KeyR') this.restart();
            if (e.code === 'Escape') this.togglePause();
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.currentInputs.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.currentInputs.right = false;
            if (e.code === 'Space') this.currentInputs.jump = false;
        });

        const bindBtn = (id, key) => {
            const el = document.getElementById(id);
            el.addEventListener('mousedown', () => this.currentInputs[key] = true);
            el.addEventListener('mouseup', () => this.currentInputs[key] = false);
            el.addEventListener('touchstart', (e) => { e.preventDefault(); this.currentInputs[key] = true; });
            el.addEventListener('touchend', (e) => { e.preventDefault(); this.currentInputs[key] = false; });
        };
        bindBtn('btn-left', 'left');
        bindBtn('btn-right', 'right');
        bindBtn('btn-jump', 'jump');

        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('resume-btn').onclick = () => this.resume();
        document.getElementById('restart-btn').onclick = () => this.restart();
        document.getElementById('retry-btn').onclick = () => this.restart();
        document.querySelectorAll('.exit-btn').forEach(btn => btn.onclick = () => window.location.href = '../../index.html');
    }

    start() {
        this.state = 'PLAYING';
        this.startScreen.classList.remove('active');
        this.playSound('sine', 440, 0.2);
    }

    togglePause() {
        if (this.state === 'PLAYING') this.state = 'PAUSED', this.pauseScreen.classList.add('active');
        else if (this.state === 'PAUSED') this.resume();
    }

    resume() {
        this.state = 'PLAYING';
        this.pauseScreen.classList.remove('active');
    }

    restart() {
        this.maxHeight = 0;
        this.cameraY = 0;
        this.cycleTimer = 0;
        this.replayFrame = -1;
        this.inputBuffer = [];
        this.platforms = [];
        this.nextPlatformY = 600;
        this.player.reset();
        this.createStartPlatforms();
        this.state = 'PLAYING';
        this.gameOverScreen.classList.remove('active');
        this.statusMsg.innerText = 'STABILIZING...';
        this.pulseBar.style.width = '0%';
        this.pulseBar.classList.remove('active');
    }

    gameOver() {
        this.state = 'OVER';
        document.getElementById('final-height').innerText = Math.floor(this.maxHeight / 10);
        this.gameOverScreen.classList.add('active');
        this.playSound('sawtooth', 100, 0.5);
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        // --- ECHO LOGIC ---
        // Always record current raw input (rolling history)
        this.inputBuffer.push({...this.currentInputs});
        if (this.inputBuffer.length > this.BUFFER_SIZE) this.inputBuffer.shift();

        let mergedInput = {...this.currentInputs};

        if (this.replayFrame === -1) {
            // ONLY increment the countdown during the recording phase
            this.cycleTimer += dt / 1000;
            
            // Check for trigger
            if (this.cycleTimer >= this.ECHO_CYCLE_TIME) {
                this.replayFrame = 0;
                this.cycleTimer = 0;
                this.statusMsg.innerText = 'ECHO ACTIVE';
                this.pulseBar.classList.add('active');
                this.playSound('square', 880, 0.1);
            } else {
                this.pulseBar.style.width = (this.cycleTimer / this.ECHO_CYCLE_TIME * 100) + '%';
            }
        } else {
            // In replay mode (Active ECHO)
            const replayInput = this.inputBuffer[this.replayFrame] || { left: false, right: false, jump: false };
            mergedInput.left = mergedInput.left || replayInput.left;
            mergedInput.right = mergedInput.right || replayInput.right;
            mergedInput.jump = mergedInput.jump || replayInput.jump;

            this.replayFrame++;
            if (this.replayFrame >= this.BUFFER_SIZE) {
                this.replayFrame = -1;
                this.statusMsg.innerText = 'STABILIZED';
                this.pulseBar.classList.remove('active');
                this.pulseBar.style.width = '0%';
                this.cycleTimer = 0; // Ensure it starts clean
            } else {
                this.pulseBar.style.width = '100%';
            }
        }

        this.player.update(mergedInput);

        // Camera following
        const targetCamY = this.player.y - 500;
        if (targetCamY < this.cameraY) this.cameraY = targetCamY;

        // Height tracking
        const currentHeight = Math.abs(Math.min(0, this.player.y - 700));
        if (currentHeight > this.maxHeight) {
            this.maxHeight = currentHeight;
            this.heightVal.innerText = Math.floor(this.maxHeight / 10);
        }

        // Procedural spawn
        if (this.platforms[this.platforms.length - 1].y > this.cameraY - 200) {
            this.spawnPlatform();
        }

        // Cleanup
        if (this.platforms.length > 30) this.platforms.shift();

        // Death check (fall off bottom)
        if (this.player.y > this.cameraY + 850) this.gameOver();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(0, -this.cameraY);

        // Platforms
        this.ctx.fillStyle = '#222';
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 2;
        this.platforms.forEach(p => {
            this.ctx.fillRect(p.x, p.y, p.w, p.h);
            this.ctx.strokeRect(p.x, p.y, p.w, p.h);
        });

        // Player
        this.player.draw(this.ctx);
        this.ctx.restore();
    }

    loop(time) {
        const dt = time - (this.lastTime || time);
        this.lastTime = time;
        this.update(dt);
        this.draw();
        requestAnimationFrame(this.loop.bind(this));
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.w = 24; this.h = 32;
        this.accel = 1.0; this.gravity = 0.45; this.friction = 0.88; this.jumpPower = -12.5;
        this.reset();
    }
    reset() { this.x = 288; this.y = 700; this.vx = 0; this.vy = 0; this.onGround = false; this.jumpLocked = false; }
    
    update(input) {
        if (input.left) this.vx -= this.accel;
        if (input.right) this.vx += this.accel;
        this.vx *= this.friction;
        this.x += this.vx;

        if (input.jump && this.onGround && !this.jumpLocked) {
            this.vy = this.jumpPower;
            this.onGround = false; this.jumpLocked = true;
            this.game.playSound('sine', 600, 0.1);
        }
        if (!input.jump) this.jumpLocked = false;

        this.vy += this.gravity;
        this.y += this.vy;

        // Collisions
        this.onGround = false;
        this.game.platforms.forEach(p => {
            if (this.x < p.x + p.w && this.x + this.w > p.x && this.y < p.y + p.h && this.y + this.h > p.y) {
                if (this.vy > 0 && this.y + this.h - this.vy <= p.y + 2) {
                    this.y = p.y - this.h; this.vy = 0; this.onGround = true;
                }
            }
        });

        // Boundaries
        if (this.x < 0) { this.x = 0; this.vx = 0; }
        if (this.x + this.w > 600) { this.x = 600 - this.w; this.vx = 0; }
    }

    draw(ctx) {
        ctx.shadowBlur = 15; ctx.shadowColor = '#00ff88';
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
        ctx.strokeRect(this.x + 3, this.y + 3, this.w - 6, this.h - 6);
    }
}

new Game();
