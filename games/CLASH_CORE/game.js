/**
 * CLASH//CORE - ZEN CYBERPUNK EDITION
 * Visual Overhaul: Particle Systems, Parallax Grids, and Neon Bloom.
 */

class Particle {
    constructor(x, y, color, speed, angle, life) {
        this.x = x; this.y = y; this.color = color;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        this.x += this.vx * (dt / 16);
        this.y += this.vy * (dt / 16);
        this.life -= dt;
    }
    draw(ctx) {
        const opacity = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = opacity;
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        ctx.globalAlpha = 1;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.hpBar = document.getElementById('hp-bar');
        this.scoreVal = document.getElementById('score-val');
        this.combatLog = document.getElementById('combat-log');
        this.enemyNameDisplay = document.getElementById('enemy-name');
        this.clashPrompt = document.getElementById('clash-prompt');
        this.pulseRing = document.getElementById('pulse-ring');
        
        this.startScreen = document.getElementById('start-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        
        this.PLAYER_MAX_HP = 10;
        this.state = 'START';
        this.playerHP = this.PLAYER_MAX_HP;
        this.score = 0;
        this.level = 1;
        this.lastTime = 0;
        this.isFrozen = false;
        this.gridOffset = 0;
        
        this.particles = [];
        this.enemy = null;
        this.playerSwing = 0;
        
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.init();
    }

    init() {
        this.bindEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.spawnEnemy();
        requestAnimationFrame(this.loop.bind(this));
    }

    resize() {
        this.canvas.width = 600;
        this.canvas.height = 800;
        const isDesktop = window.innerWidth >= 768;
        this.enemyY = isDesktop ? 320 : 240;
        this.playerY = isDesktop ? 480 : 640;
    }

    playSound(type, freq, dur, vol = 0.1) {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + dur);
    }

    bindEvents() {
        const handleInput = (e) => {
            if (e.repeat) return;
            if (this.state === 'PLAYING') this.playerClashAttempt();
            if (e.code === 'Escape') this.togglePause();
            if (e.code === 'KeyR' && this.state !== 'PLAYING') this.restart();
        };
        window.addEventListener('keydown', handleInput);
        this.canvas.addEventListener('mousedown', handleInput);
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(e); });

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
        if (this.state === 'PLAYING') (this.state = 'PAUSED', this.pauseScreen.classList.add('active'));
        else if (this.state === 'PAUSED') this.resume();
    }

    resume() { this.state = 'PLAYING'; this.pauseScreen.classList.remove('active'); }

    restart() {
        this.playerHP = this.PLAYER_MAX_HP;
        this.score = 0; this.level = 1;
        this.hpBar.style.width = '100%';
        this.scoreVal.innerText = '000000';
        this.gameOverScreen.classList.remove('active');
        this.spawnEnemy();
        this.state = 'PLAYING';
        this.combatLog.innerText = 'SYSTEM STABILIZED';
    }

    spawnEnemy() {
        const types = [
            { name: "INITIATE-V1", color: "#00f0ff", windup: 1800, hp: 2, score: 100, window: 160 },
            { name: "SENTRY-V2", color: "#00ffcc", windup: 1600, hp: 3, score: 200, window: 150 },
            { name: "BLADE-V3", color: "#99ff00", windup: 1400, hp: 3, score: 300, window: 140 },
            { name: "SHADE-V4", color: "#ffff00", windup: 1200, hp: 4, score: 400, window: 130 },
            { name: "VANGUARD-V5", color: "#ffaa00", windup: 1000, hp: 4, score: 600, window: 120 },
            { name: "REAPER-V6", color: "#ff6600", windup: 900,  hp: 5, score: 800, window: 110 },
            { name: "CORE-V7", color: "#ff0000", windup: 800,  hp: 5, score: 1200, window: 100 },
            { name: "GHOST-V8", color: "#ff00aa", windup: 700,  hp: 6, score: 1600, window: 90 },
            { name: "VOID-V9", color: "#ff00ff", windup: 600,  hp: 6, score: 2000, window: 80 },
            { name: "OMEGA-VX", color: "#ffffff", windup: 450,  hp: 8, score: 5000, window: 70 }
        ];
        const data = types[Math.min(this.level - 1, types.length - 1)];
        this.enemy = new Enemy(this, data);
        this.enemyNameDisplay.innerText = `LEVEL ${this.level}: [${data.name}]`;
    }

    spawnParticles(x, y, color, count, speedRange) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color, Math.random() * speedRange, Math.random() * Math.PI * 2, 500 + Math.random() * 500));
        }
    }

    playerClashAttempt() {
        if (this.isFrozen || !this.enemy || this.enemy.state !== 'ATTACKING') return;
        this.playerSwing = 1.6;
        const timeInAttack = Date.now() - this.enemy.attackStartTime;
        const isPerfect = (timeInAttack >= this.enemy.windup - this.enemy.window);
        if (isPerfect) this.clashSuccess();
        else this.clashFailure('EARLY CLASH');
    }

    clashSuccess() {
        this.enemy.takeDamage();
        this.playerSwing = 2.4;
        this.score += 50;
        this.scoreVal.innerText = String(this.score).padStart(6, '0');
        this.combatLog.innerText = 'PERFECT CLASH';
        this.combatLog.classList.add('perfect');
        this.spawnParticles(300, (this.playerY + this.enemyY) / 2, '#fff', 30, 8);
        this.spawnParticles(300, (this.playerY + this.enemyY) / 2, '#00f0ff', 20, 5);
        this.freezeFrame(180);
        this.screenShake();
        this.playSound('square', 1200, 0.1, 0.15);
        this.playSound('sawtooth', 80, 0.2, 0.15);
    }

    clashFailure(reason) {
        this.enemy.state = 'RECOVERY';
        this.enemy.recoveryTimer = 500;
        this.takeDamage();
        this.combatLog.innerText = reason;
        this.combatLog.classList.remove('perfect');
        this.playSound('sawtooth', 60, 0.3, 0.2);
        document.getElementById('game-container').classList.add('shake');
        setTimeout(() => document.getElementById('game-container').classList.remove('shake'), 200);
    }

    takeDamage() {
        this.playerHP--;
        this.hpBar.style.width = (this.playerHP / this.PLAYER_MAX_HP * 100) + '%';
        if (this.playerHP <= 0) this.gameOver();
    }

    gameOver() {
        this.state = 'OVER';
        document.getElementById('final-score').innerText = String(this.score).padStart(6, '0');
        this.gameOverScreen.classList.add('active');
    }

    freezeFrame(dur) { this.isFrozen = true; setTimeout(() => this.isFrozen = false, dur); }
    screenShake() { this.canvas.classList.add('shake'); setTimeout(() => this.canvas.classList.remove('shake'), 200); }

    update(dt) {
        if (!this.enemy) return;
        this.enemy.update(dt);
        this.gridOffset = (this.gridOffset + dt * 0.1) % 60;
        this.playerSwing = Math.max(0, this.playerSwing - dt * 0.012);
        this.particles.forEach((p, i) => { p.update(dt); if (p.life <= 0) this.particles.splice(i, 1); });

        if (this.enemy.state === 'ATTACKING') {
            const progress = (Date.now() - this.enemy.attackStartTime) / this.enemy.windup;
            const offset = 188.5 - (progress * 188.5);
            this.pulseRing.style.strokeDashoffset = offset;
            this.clashPrompt.classList.toggle('active', progress > 0.82);
        } else {
            this.pulseRing.style.strokeDashoffset = 188.5;
            this.clashPrompt.classList.remove('active');
        }
    }

    draw() {
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        
        this.ctx.globalCompositeOperation = 'lighter';
        this.particles.forEach(p => p.draw(this.ctx));
        if (this.enemy) this.enemy.draw(this.ctx);
        this.drawPlayer(this.ctx);
        this.ctx.globalCompositeOperation = 'source-over';
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let i = -60; i < 660; i += 60) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0); this.ctx.lineTo(i, 800);
            this.ctx.stroke();
        }
        for (let i = 0; i < 860; i += 60) {
            const y = i + this.gridOffset;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y); this.ctx.lineTo(600, y);
            this.ctx.stroke();
        }
    }

    drawPlayer(ctx) {
        const x = 300;
        const y = this.playerY;
        
        // --- RANGE INDICATION (CENTERED AT PLAYER) ---
        ctx.save();
        ctx.strokeStyle = this.enemy && this.enemy.state === 'ATTACKING' ? 'rgba(0,240,255,0.4)' : 'rgba(0,240,255,0.1)';
        ctx.setLineDash([10, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 160, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.restore();

        // --- BODY RENDERING (CENTERED) ---
        ctx.save();
        ctx.translate(x, y);
        
        // Aura Glow
        ctx.shadowBlur = 30; ctx.shadowColor = '#00f0ff';
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-15, -20, 30, 40); // Base Chassis
        
        // Core Chassis Layer
        ctx.shadowBlur = 0;
        const grad = ctx.createLinearGradient(-15, -20, 15, 20);
        grad.addColorStop(0, '#00f0ff'); grad.addColorStop(1, '#0055ff');
        ctx.fillStyle = grad;
        ctx.fillRect(-15, -20, 30, 40);
        
        // Inner Core Glow
        ctx.fillStyle = '#fff';
        ctx.fillRect(-2, -5, 4, 10);
        ctx.restore();

        // --- WEAPON RENDER (ATTACHED) ---
        // Side emitter at x + 15 (right edge)
        this.drawWeapon(ctx, x + 15, y, this.playerSwing, '#00f0ff', true);
    }

    drawWeapon(ctx, x, y, swing, color, isPlayer) {
        ctx.save();
        ctx.translate(x, y);
        
        const dir = isPlayer ? 1 : -1;
        // Joint Rotation Base Offset
        ctx.rotate((isPlayer ? -0.2 : 2.9) + (swing * dir * 1.2));
        
        // --- WEAPON JOINT / EMITTER ---
        ctx.fillStyle = '#fff';
        ctx.fillRect(-2, -2, 4, 10); // Arm connection
        
        // --- BLADE RENDERING ---
        ctx.shadowBlur = 20; ctx.shadowColor = color;
        ctx.fillStyle = color;
        
        ctx.beginPath();
        ctx.moveTo(-4 * dir, -8);
        ctx.lineTo(8 * dir, -8);
        ctx.lineTo(12 * dir, -65); // Saber Length
        ctx.lineTo(0, -75); // Pointy tip
        ctx.lineTo(-8 * dir, -65);
        ctx.fill();
        
        // Central Light Core
        ctx.fillStyle = '#fff';
        ctx.fillRect(-1 * dir, -10, 2 * dir, -55);
        
        ctx.restore();
    }

    loop(time) {
        const dt = time - (this.lastTime || time);
        this.lastTime = time;
        if (this.state === 'PLAYING' && !this.isFrozen) this.update(dt);
        this.draw();
        requestAnimationFrame(this.loop.bind(this));
    }
}

class Enemy {
    constructor(game, data) {
        this.game = game; this.data = data;
        this.hp = data.hp; this.maxHP = data.hp;
        this.windup = data.windup; this.window = data.window; this.color = data.color;
        this.state = 'IDLE'; this.timer = 1200; this.attackStartTime = 0; this.swing = 0;
    }
    update(dt) {
        this.swing = Math.max(0, this.swing - dt * 0.012);
        if (this.state === 'IDLE') {
            this.timer -= dt;
            if (this.timer <= 0) (this.state = 'ATTACKING', this.attackStartTime = Date.now());
        } else if (this.state === 'ATTACKING') {
            if (Date.now() - this.attackStartTime >= this.windup) {
                this.game.clashFailure('LATE STRIKE'); this.swing = 1.4;
            }
        } else if (this.state === 'RECOVERY') {
            this.recoveryTimer -= dt;
            if (this.recoveryTimer <= 0) (this.state = 'IDLE', this.timer = 800 + Math.random() * 800);
        }
    }
    takeDamage() {
        this.hp--;
        if (this.hp <= 0) (this.game.score += this.data.score, this.game.level++, this.game.spawnEnemy());
        else (this.state = 'RECOVERY', this.recoveryTimer = 400);
    }
    draw(ctx) {
        const x = 300;
        const y = this.game.enemyY;
        
        ctx.save();
        ctx.translate(x, y);
        
        // --- CHASSIS RENDERING (CENTERED) ---
        ctx.shadowBlur = 30; ctx.shadowColor = this.color;
        
        if (this.state === 'ATTACKING') {
            const p = (Date.now() - this.attackStartTime) / this.windup;
            ctx.fillStyle = p > 0.82 ? '#fff' : this.color;
            const s = 1.0 + p * 0.25;
            ctx.fillRect(-25 * s, -25 * s, 50 * s, 50 * s);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(-25, -25, 50, 50);
        }
        
        // Inner Core Glow
        ctx.fillStyle = '#fff';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.restore();
        
        // --- WEAPON RENDER (ATTACHED LEFT) ---
        this.game.drawWeapon(ctx, x - 22, y - 5, this.swing, this.color, false);
        
        // HP Pips
        for (let i = 0; i < this.maxHP; i++) {
            ctx.fillStyle = i < this.hp ? this.color : '#111';
            ctx.fillRect(x - (this.maxHP * 10) + (i * 20), y - 65, 16, 6);
        }
        ctx.shadowBlur = 0;
    }
}

new Game();
