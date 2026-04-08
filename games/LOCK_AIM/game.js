/**
 * LOCK//AIM - PIXEL_HAVEN ARCADE OS
 * A precision-based survival shooter.
 * LOCKED DIRECTION MECHANIC: Hold to Lock, Release to Fire.
 */

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.02;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= this.decay; }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        ctx.globalAlpha = 1;
    }
}

class Projectile {
    constructor(x, y, angle) {
        this.x = x; this.y = y;
        this.speed = 12;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.radius = 4;
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < -50 || this.x > 650 || this.y < -50 || this.y > 850) this.active = false;
    }
    draw(ctx) {
        ctx.shadowBlur = 10; ctx.shadowColor = '#00f0ff';
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor(type, x, y, speedMult) {
        this.x = x; this.y = y;
        this.type = type;
        const baseSpeed = type === 'FAST' ? 2.2 : 1.2;
        this.speed = baseSpeed * speedMult;
        this.angle = Math.atan2(400 - this.y, 300 - this.x);
        this.baseAngle = this.angle;
        this.radius = 12;
        this.color = type === 'BASIC' ? '#00f0ff' : (type === 'FAST' ? '#ff00ff' : '#ffff00');
        this.time = Math.random() * 1000;
        this.active = true;
    }
    update(dt, globalSpeedMult) {
        this.time += dt * 0.005 * globalSpeedMult;
        let moveAngle = this.baseAngle;
        if (this.type === 'ERRATIC') {
            moveAngle += Math.sin(this.time * 2) * 0.5;
        }
        this.x += Math.cos(moveAngle) * this.speed;
        this.y += Math.sin(moveAngle) * this.speed;
    }
    draw(ctx) {
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 10, this.y - 10, 20, 20);
        ctx.shadowBlur = 0;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreVal = document.getElementById('score-val');
        this.bestVal = document.getElementById('best-val');
        this.statusMsg = document.getElementById('status-msg');
        this.lockIndicator = document.getElementById('lock-indicator');
        
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        
        this.state = 'START';
        this.score = 0;
        this.best = parseInt(localStorage.getItem('lockaim_best')) || 0;
        this.bestVal.innerText = String(this.best).padStart(6, '0');
        
        this.playerPos = { x: 300, y: 400 };
        this.aimAngle = 0;
        this.isLocked = false;
        this.lockCharge = 0;
        this.isTriggerDown = false;
        this.lockedAngle = 0;
        this.gridOffset = 0;
        
        this.projectile = null;
        this.enemies = [];
        this.particles = [];
        this.lastTime = 0;
        
        this.difficulty = 1;
        this.spawnTimer = 2000;
        this.nextSpawn = 0;
        
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindEvents();
        requestAnimationFrame(this.loop.bind(this));
    }

    resize() {
        this.canvas.width = 600;
        this.canvas.height = 800;
    }

    bindEvents() {
        const getTouchPosition = (e) => {
            const touch = e.touches ? e.touches[0] : e;
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: (touch.clientX - rect.left) * (600 / rect.width),
                y: (touch.clientY - rect.top) * (800 / rect.height)
            };
        };

        const onMove = (e) => {
            if (this.state !== 'PLAYING' || this.isLocked) return;
            const pos = getTouchPosition(e);
            this.aimAngle = Math.atan2(pos.y - this.playerPos.y, pos.x - this.playerPos.x);
        };

        const onLockStart = (e) => {
            if (this.state !== 'PLAYING' || this.projectile) return;
            if (e.touches) {
                const rect = this.canvas.getBoundingClientRect();
                const touchX = e.touches[e.touches.length - 1].clientX;
                if (touchX < rect.left + rect.width * 0.5) return; 
            }
            this.isTriggerDown = true;
            this.lockCharge = 0;
        };

        const onFireRelease = (e) => {
            if (this.state !== 'PLAYING' || !this.isTriggerDown) return;
            if (this.lockCharge >= 350) this.fire();
            else {
                this.statusMsg.innerText = 'CALIBRATION ABORTED';
                this.playSound('sine', 100, 0.1, 0.05);
            }
            this.isTriggerDown = false;
            this.isLocked = false;
            this.lockCharge = 0;
            this.lockIndicator.classList.add('hidden');
        };

        window.addEventListener('mousedown', onLockStart);
        window.addEventListener('mouseup', onFireRelease);
        window.addEventListener('mousemove', onMove);
        this.canvas.addEventListener('touchstart', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const touchX = e.touches[e.touches.length - 1].clientX;
            if (touchX > rect.left + rect.width * 0.5) { e.preventDefault(); onLockStart(e); }
        }, { passive: false });
        window.addEventListener('touchend', (e) => { if (this.isTriggerDown) onFireRelease(e); });
        window.addEventListener('touchmove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const touchX = e.touches[0].clientX;
            if (!this.isLocked && touchX < rect.left + rect.width * 0.6) onMove(e);
        }, { passive: false });

        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('retry-btn').onclick = () => this.restart();
        document.getElementById('restart-btn').onclick = () => this.restart();
        document.querySelectorAll('.exit-btn').forEach(btn => btn.onclick = () => window.location.href = '../../index.html');
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

    start() {
        this.state = 'PLAYING';
        this.startScreen.classList.remove('active');
        this.playSound('square', 440, 0.2);
    }

    restart() {
        this.score = 0;
        this.scoreVal.innerText = '000000';
        this.enemies = []; this.projectile = null; this.particles = [];
        this.difficulty = 1; this.spawnTimer = 2000;
        this.gameOverScreen.classList.remove('active');
        this.state = 'PLAYING';
    }

    fire() {
        if (this.projectile) return;
        this.projectile = new Projectile(this.playerPos.x, this.playerPos.y, this.lockedAngle);
        this.playSound('sawtooth', 220, 0.1, 0.2);
    }

    spawnEnemy(speedMult) {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = Math.random() * 600; y = -40; }
        else if (side === 1) { x = 640; y = Math.random() * 800; }
        else if (side === 2) { x = Math.random() * 600; y = 840; }
        else { x = -40; y = Math.random() * 800; }

        const r = Math.random();
        let type = 'BASIC';
        if (this.difficulty > 2 && r < 0.3) type = 'FAST';
        else if (this.difficulty > 4 && r < 0.6) type = 'ERRATIC';
        
        this.enemies.push(new Enemy(type, x, y, speedMult));
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.difficulty += dt * 0.00008;
        const stage = Math.floor(this.score / 2000) + 1;
        const speedMult = 1.0 + (stage - 1) * 0.2;
        this.spawnTimer = Math.max(350, 2200 - this.difficulty * 300);
        this.gridOffset = (this.gridOffset + dt * 0.02 * speedMult) % 60;

        if (this.isTriggerDown) {
            this.lockCharge = Math.min(350, this.lockCharge + dt);
            this.statusMsg.innerText = `STAGE ${stage} // CALIBRATING... ${Math.floor(this.lockCharge/3.5).toString().padStart(3,'0')}%`;
            if (this.lockCharge < 350) {
                if (Math.random() < 0.1) this.playSound('sine', 200 + this.lockCharge * 2.5, 0.05, 0.05);
            } else if (!this.isLocked) {
                this.isLocked = true;
                this.lockedAngle = this.aimAngle;
                this.lockIndicator.classList.remove('hidden');
                this.statusMsg.innerText = `STAGE ${stage} // LOCK READY`;
                this.playSound('square', 600, 0.1, 0.2);
            }
        } else {
            this.statusMsg.innerText = `STAGE ${stage} // SYSTEM STANDBY`;
        }

        this.nextSpawn -= dt;
        if (this.nextSpawn <= 0) {
            const count = Math.min(4, Math.floor(1 + (this.difficulty / 5)));
            for (let i = 0; i < count; i++) this.spawnEnemy(speedMult);
            this.nextSpawn = this.spawnTimer;
        }

        if (this.projectile) {
            this.projectile.update();
            if (!this.projectile.active) this.projectile = null;
        }

        this.enemies.forEach((e, i) => {
            e.update(dt, speedMult);
            if (this.projectile) {
                const dist = Math.hypot(e.x - this.projectile.x, e.y - this.projectile.y);
                if (dist < e.radius + 10) { this.enemies.splice(i, 1); this.projectile = null; this.onEnemyKilled(e); }
            }
            if (Math.hypot(e.x - 300, e.y - 400) < 30) this.gameOver();
        });

        this.particles.forEach((p, i) => { p.update(); if (p.life <= 0) this.particles.splice(i, 1); });
    }

    onEnemyKilled(e) {
        this.score += 100;
        this.scoreVal.innerText = String(this.score).padStart(6, '0');
        for (let i = 0; i < 15; i++) this.particles.push(new Particle(e.x, e.y, e.color));
        this.playSound('noise', 0, 0.1, 0.1);
        if (this.score > this.best) { this.best = this.score; this.bestVal.innerText = String(this.best).padStart(6, '0'); localStorage.setItem('lockaim_best', this.best); }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        document.getElementById('final-score').innerText = String(this.score).padStart(6, '0');
        this.gameOverScreen.classList.add('active');
        this.playSound('sawtooth', 80, 0.5, 0.3);
    }

    draw() {
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, 600, 800);
        this.drawGrid();

        // Player
        this.ctx.shadowBlur = 20; this.ctx.shadowColor = '#00f0ff';
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.beginPath(); this.ctx.arc(300, 400, 20, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.fillStyle = '#fff'; this.ctx.fillRect(296, 396, 8, 8);
        this.ctx.shadowBlur = 0;

        if (this.isTriggerDown) {
            const p = this.lockCharge / 350;
            this.ctx.strokeStyle = '#ff00ff'; this.ctx.lineWidth = 4;
            this.ctx.beginPath(); this.ctx.arc(300, 400, 60 - p * 40, 0, Math.PI * 2); this.ctx.stroke();
        }

        const angle = this.isLocked ? this.lockedAngle : this.aimAngle;
        this.ctx.strokeStyle = this.isLocked ? '#ff00ff' : 'rgba(0, 240, 255, 0.3)';
        this.ctx.setLineDash(this.isLocked ? [] : [10, 10]);
        this.ctx.lineWidth = this.isLocked ? 4 : 2;
        this.ctx.beginPath(); this.ctx.moveTo(300, 400); this.ctx.lineTo(300 + Math.cos(angle) * 800, 400 + Math.sin(angle) * 800); this.ctx.stroke();
        this.ctx.setLineDash([]);

        if (this.projectile) this.projectile.draw(this.ctx);
        this.enemies.forEach(e => e.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
        for (let i = -60; i < 660; i += 60) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, 800); this.ctx.stroke();
        }
        for (let i = 0; i < 860; i += 60) {
            const y = (i + this.gridOffset) % 860;
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(600, y); this.ctx.stroke();
        }
    }

    loop(time) {
        const dt = time - (this.lastTime || time);
        this.lastTime = time;
        if (!document.hidden) {
            this.update(dt);
            this.draw();
        }
        requestAnimationFrame(this.loop.bind(this));
    }
}

new Game();
