/**
 * BRICK//BREACH - Tactical Brick Breaking
 * PIXEL_HAVEN // ARCADE_OS v1.0
 */

class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    init() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
    play(freq, type, duration, volume = 0.1) {
        this.init();
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(volume, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + duration);
    }
    paddle() { this.play(440, 'sine', 0.1); }
    brick() { this.play(880, 'square', 0.05, 0.05); }
    powerup() { this.play(660, 'sawtooth', 0.3, 0.08); }
    lose() { this.play(110, 'sawtooth', 0.5, 0.2); }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'MENU';
        this.score = 0;
        this.level = 1;

        // Constants
        this.baseBallSpeed = 6;
        this.ballRadius = 6;
        this.paddleHeight = 12;
        this.brickRows = 5; // Cap per user request
        this.brickCols = 8; 
        this.brickPadding = 12;
        this.brickOffsetTop = 80;
        this.brickOffsetLeft = 40;

        // Paddle State
        this.paddle = {
            width: 100,
            x: 0,
            targetX: 0
        };

        // Ball State
        this.ball = {
            x: 0,
            y: 0,
            dx: 0,
            dy: 0,
            speed: this.baseBallSpeed,
            active: false,
            pierceQuota: 0 // For HEAVY_BALL mod (v4.0)
        };

        // Modifier System
        this.activeMod = null;
        this.modTimer = 0;
        this.modDrops = [];

        this.bricks = [];
        this.particles = [];
        this.projectiles = []; // Constructor sync
        this.inputDelayBuffer = [];
        this.shake = 0;
        this.sounds = new SoundEngine();

        // CELESTIAL ENGINE (v3.0)
        this.stars = [];
        for (let i = 0; i < 500; i++) {
            this.stars.push({
                x: Math.random() * 2000 - 600, // Massive coverage
                y: Math.random() * 2000 - 600,
                z: Math.random() * 2 + 1,
                size: Math.random() * 2
            });
        }
        this.ballTrail = [];
        this.frameCounter = 0;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Controls
        const handleMove = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const rect = this.canvas.getBoundingClientRect();
            let relativeX = (clientX - rect.left) * (this.canvas.width / rect.width);
            
            // Modifier: Reverse Control
            if (this.activeMod === 'REVERSE') {
                relativeX = this.canvas.width - relativeX;
            }

            this.paddle.targetX = Math.max(0, Math.min(this.canvas.width - this.paddle.width, relativeX - this.paddle.width / 2));
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handleMove(e);
        }, { passive: false });

        window.addEventListener('touchstart', (e) => {
            if (this.state === 'MENU' || this.state === 'GAMEOVER') {
                this.start();
            } else if (this.state === 'PLAYING' && !this.ball.active) {
                this.launchBall();
            }
        }, { passive: false });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (this.state === 'PLAYING' && !this.ball.active) {
                    this.launchBall();
                } else if (this.state === 'MENU' || this.state === 'GAMEOVER') {
                    this.start();
                }
            }
        });

        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('restart-btn').onclick = () => this.start();
        document.getElementById('next-btn').onclick = () => this.nextLevel();

        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.resetPaddle();
    }

    resetPaddle() {
        this.paddle.width = 100;
        this.paddle.x = (this.canvas.width - this.paddle.width) / 2;
        this.paddle.targetX = this.paddle.x;
    }

    start() {
        this.state = 'PLAYING';
        this.score = 0;
        this.level = 1;
        this.resetLevel();
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('game-over-screen').classList.remove('active');
        document.getElementById('win-screen').classList.remove('active');
    }

    nextLevel() {
        this.level++;
        this.state = 'PLAYING'; // Restore operational protocol
        this.resetLevel();
        document.getElementById('win-screen').classList.remove('active');
    }

    resetLevel() {
        this.ball.active = false;
        this.state = 'PLAYING';
        this.resetPaddle();
        this.ball.x = this.paddle.x + this.paddle.width / 2;
        this.ball.y = this.canvas.height - this.paddleHeight - 30;
        this.ball.dx = 0;
        this.ball.dy = 0;
        this.resetMod();
        this.modDrops = [];
        this.particles = [];
        this.projectiles = [];
        
        document.getElementById('level-val').textContent = this.level;

        // Dynamic Scaling
        this.baseBallSpeed = 6 + (this.level * 0.4);
        this.ball.speed = this.baseBallSpeed;

        this.bricks = [];
        const rows = this.brickRows; // Cap at 5
        const cols = 4 + this.level; // Column scaling (v2.6)
        
        const bWidth = (this.canvas.width - (this.brickOffsetLeft * 2) - (this.brickPadding * (cols - 1))) / cols;
        const bHeight = 22;

        const totalBricks = rows * cols;
        const minPowerups = Math.max(2, Math.floor(totalBricks / 10));
        let powerupIndices = [];
        while (powerupIndices.length < minPowerups) {
            let idx = Math.floor(Math.random() * totalBricks);
            if (!powerupIndices.includes(idx)) powerupIndices.push(idx);
        }

        let count = 0;
        for (let r = 0; r < rows; r++) {
            this.bricks[r] = [];
            for (let c = 0; c < cols; c++) {
                this.bricks[r][c] = {
                    x: c * (bWidth + this.brickPadding) + this.brickOffsetLeft,
                    y: r * (bHeight + this.brickPadding) + this.brickOffsetTop,
                    w: bWidth,
                    h: bHeight,
                    alive: true,
                    health: 2, // Standard 2-hit protocol (v4.0)
                    type: powerupIndices.includes(count) ? this.getRandomMod() : 'NORMAL'
                };
                count++;
            }
        }
    }

    getRandomMod() {
        const mods = [
            'SPEED_UP', 'SLOW_MO', 'HEAVY_BALL', 'LIGHT_BALL',
            'CURVE_BALL',
            'PADDLE_EXTEND', 'PADDLE_SHRINK', 'MAGNET', 'SLIPPERY',
            'REVERSE', 'DELAY',
            'EXPLOSIVE', 'LASER',
            'FRAGILE'
        ];
        return mods[Math.floor(Math.random() * mods.length)];
    }

    launchBall() {
        this.ball.active = true;
        this.ball.dx = (Math.random() - 0.5) * 4;
        this.ball.dy = -this.ball.speed;
    }

    resetMod() {
        this.activeMod = null;
        this.modTimer = 0;
        this.paddle.width = 100;
        this.ball.speed = this.baseBallSpeed;
        this.ballRadius = 6;
        this.ball.pierceQuota = 0;
        this.inputDelayBuffer = [];
        document.getElementById('modifier-hud').classList.add('hidden');
    }

    applyMod(type) {
        this.resetMod();
        this.activeMod = type;
        this.modTimer = 8000; // 8s duration
        document.getElementById('modifier-hud').classList.remove('hidden');
        document.getElementById('mod-type').textContent = type.replace('_', ' ');

        switch(type) {
            case 'SPEED_UP': this.ball.speed = this.baseBallSpeed * 1.6; break;
            case 'SLOW_MO': this.ball.speed = this.baseBallSpeed * 0.6; break;
            case 'PADDLE_EXTEND': this.paddle.width = 180; break;
            case 'PADDLE_SHRINK': this.paddle.width = 60; break;
            case 'HEAVY_BALL': this.ball.pierceQuota = 2; break; // Pierce up to 2 bricks
            case 'LIGHT_BALL': this.ballRadius = 3.5; this.ball.speed = this.baseBallSpeed * 1.8; break;
        }
    }

    update(dt) {
        // 1. INPUT PROCESSING
        let rawTargetX = this.paddle.targetX;

        if (this.activeMod === 'DELAY') {
            this.inputDelayBuffer.push(rawTargetX);
            if (this.inputDelayBuffer.length > 20) rawTargetX = this.inputDelayBuffer.shift();
            else rawTargetX = this.paddle.x; // Stay still while buffering
        }

        if (this.activeMod === 'AUTO_DRIFT') {
            this.paddle.targetX += Math.sin(Date.now() / 500) * 10;
        }

        // Paddle Smoothing
        let lerpFactor = this.activeMod === 'SLIPPERY' ? 0.05 : 0.2;
        this.paddle.x += (rawTargetX - this.paddle.x) * lerpFactor;

        if (!this.ball.active) {
            this.ball.x = this.paddle.x + this.paddle.width / 2;
            this.ball.y = this.canvas.height - this.paddleHeight - 30;
        } else {
            // Ball Physics: Curve Ball
            if (this.activeMod === 'CURVE_BALL') {
                const centerX = this.canvas.width / 2;
                const force = (this.ball.x - centerX) * 0.0005;
                this.ball.dx -= force;
            }

            this.ball.x += this.ball.dx;
            this.ball.y += this.ball.dy;

            // Border Collision
            if (this.ball.x + this.ballRadius > this.canvas.width || this.ball.x - this.ballRadius < 0) {
                this.ball.dx *= -1;
                this.ball.x = Math.max(this.ballRadius, Math.min(this.canvas.width - this.ballRadius, this.ball.x));
            }
            if (this.ball.y - this.ballRadius < 0) {
                this.ball.dy *= -1;
            }

            // Paddle Collision
            if (this.ball.dy > 0 && 
                this.ball.y + this.ballRadius > this.canvas.height - this.paddleHeight - 20 &&
                this.ball.x > this.paddle.x && this.ball.x < this.paddle.x + this.paddle.width) {
                
                const hitPos = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
                let angleMod = this.activeMod === 'HEAVY_BALL' ? 0.4 : (this.activeMod === 'LIGHT_BALL' ? 1.2 : 0.8);
                
                this.ball.dx = hitPos * this.ball.speed * angleMod;
                this.ball.dy = -Math.sqrt(Math.pow(this.ball.speed, 2) - Math.pow(this.ball.dx, 2));

                this.sounds.paddle();
                this.shake = 4;

                if (this.activeMod === 'MAGNET') this.ball.active = false;
            }

            // Failure Condition
            if (this.ball.y > this.canvas.height) {
                this.sounds.lose();
                this.gameOver();
            }

            // Brick Multi-Collision
            this.checkBrickCollision();
        }

        // Mod Drops Update
        for (let i = this.modDrops.length - 1; i >= 0; i--) {
            const mod = this.modDrops[i];
            mod.y += 3;
            if (mod.y > this.canvas.height) {
                this.modDrops.splice(i, 1);
            } else if (mod.y + 20 > this.canvas.height - this.paddleHeight - 20 &&
                       mod.x > this.paddle.x && mod.x < this.paddle.x + this.paddle.width) {
                this.sounds.powerup();
                this.applyMod(mod.type);
                this.modDrops.splice(i, 1);
            }
        }

        // Mod Timer
        if (this.modTimer > 0) {
            this.modTimer -= dt;
            document.getElementById('mod-timer').textContent = (this.modTimer / 1000).toFixed(1) + 's';
            if (this.modTimer <= 0) this.resetMod();
        }

        // Win Condition (Hardened v2.2)
        if (this.bricks.length > 0 && this.bricks.flat().every(b => !b.alive)) {
            this.state = 'WIN';
            this.win();
        }

        // Particles
        this.particles.forEach((p, i) => {
            p.x += p.dx; p.y += p.dy; p.life -= 0.02;
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        // Laser Firing (Mod Logic)
        if (this.activeMod === 'LASER' && Date.now() % 200 < 30) {
            if (this.projectiles.length < 10) {
                this.projectiles.push({ x: this.paddle.x + 10, y: this.canvas.height - 40 });
                this.projectiles.push({ x: this.paddle.x + this.paddle.width - 10, y: this.canvas.height - 40 });
            }
        }
    }

    checkBrickCollision() {
        for (let r = 0; r < this.bricks.length; r++) {
            for (let c = 0; c < this.bricks[r].length; c++) {
                const b = this.bricks[r][c];
                if (b.alive) {
                    if (this.ball.x + this.ballRadius > b.x && this.ball.x - this.ballRadius < b.x + b.w &&
                        this.ball.y + this.ballRadius > b.y && this.ball.y - this.ballRadius < b.y + b.h) {
                        
                        this.destroyBrick(r, c, false); 

                        // HEAVY BALL Logic (v4.0)
                        if (this.ball.pierceQuota > 0) {
                            this.ball.pierceQuota--;
                        } else {
                            this.ball.dy *= -1;
                        }
                        return;
                    }
                }
            }
        }

        // Projectile Processing
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.y -= 10;
            if (p.y < 0) this.projectiles.splice(i, 1);
            else {
                for (let r = 0; r < this.bricks.length; r++) {
                    for (let c = 0; c < this.bricks[r].length; c++) {
                        const b = this.bricks[r][c];
                        if (b.alive && p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) {
                            this.destroyBrick(r, c, false);
                            this.projectiles.splice(i, 1);
                            return;
                        }
                    }
                }
            }
        }
    }

    destroyBrick(r, c, isCascade = false) {
        if (!this.bricks[r] || !this.bricks[r][c]) return;
        const b = this.bricks[r][c];
        if (!b.alive) return;
        
        let damage = (this.activeMod === 'FRAGILE') ? 2 : 1;
        b.health -= damage;

        if (b.health <= 0) {
            b.alive = false;
            this.score += 10;
            document.getElementById('score-val').textContent = this.score;
            this.createParticles(b.x + b.w/2, b.y + b.h/2, b.type !== 'NORMAL' ? '#ff00ff' : '#00ffcc');
            if (b.type !== 'NORMAL') {
                this.modDrops.push({ x: b.x + b.w/2, y: b.y + b.h/2, type: b.type });
            }
        }

        this.sounds.brick();
        this.shake = isCascade ? 2 : 8;

        // Containment Protocol (v2.5/v4.2) 
        if (!isCascade && this.activeMod === 'EXPLOSIVE') {
            const neighbors = [[r-1,c], [r+1,c], [r,c-1], [r,c+1]];
            neighbors.forEach(([nr, nc]) => {
                this.destroyBrick(nr, nc, true); 
            });
        }
    }

    createParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x, y,
                dx: (Math.random() - 0.5) * 6,
                dy: (Math.random() - 0.5) * 6,
                color, life: 1.0
            });
        }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        // SYSTEM PURGE (v2.4)
        this.bricks = [];
        this.modDrops = [];
        this.projectiles = [];
        this.particles = [];
        this.ball.active = false;
        
        document.getElementById('game-over-screen').classList.add('active');
        document.getElementById('final-score').textContent = this.score;
    }

    win() {
        this.state = 'WIN';
        // SECTOR SANITIZATION (v2.8)
        this.bricks = [];
        this.modDrops = [];
        this.projectiles = [];
        this.particles = [];
        this.ball.active = false;
        
        document.getElementById('win-screen').classList.add('active');
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. CELESTIAL BACKGROUND (v3.0)
        this.ctx.fillStyle = '#050508';
        this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
        
        // Stars
        this.ctx.fillStyle = '#fff';
        this.stars.forEach(s => {
            const speed = (this.state === 'PLAYING' ? 0.2 : 0.05) * s.z;
            s.y = (s.y + speed) % this.canvas.height;
            this.ctx.globalAlpha = 0.5 + Math.sin(Date.now()/500 + s.x) * 0.5;
            this.ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        this.ctx.globalAlpha = 1.0;

        // Nebula Glow
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width/2, this.canvas.height/2, 0,
            this.canvas.width/2, this.canvas.height/2, 400
        );
        gradient.addColorStop(0, 'rgba(40, 0, 80, 0.15)');
        gradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);

        // OPTICAL ZOOM ENGINE (v2.3)
        const zoom = Math.max(0.6, 1.0 - (this.level - 1) * 0.05);
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

        if (this.shake > 0) {
            this.ctx.translate((Math.random()-0.5)*this.shake, (Math.random()-0.5)*this.shake);
            this.shake *= 0.9;
            if (this.shake < 0.1) this.shake = 0;
        }

        // Bricks
        this.bricks.forEach(row => row.forEach(b => {
            if (b.alive) {
                this.ctx.fillStyle = b.type !== 'NORMAL' ? (b.health === 2 ? '#ff00ff' : '#aa00aa') : (b.health === 2 ? '#00ffcc' : '#008866');
                this.ctx.fillRect(b.x, b.y, b.w, b.h);
                
                // ADVANCED FRACTURE VFX (v4.3)
                if (b.health === 1) {
                    this.ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                    this.ctx.lineWidth = 1.2;
                    this.ctx.beginPath();
                    // Webbing effect
                    const cx = b.x + b.w/2;
                    const cy = b.y + b.h/2;
                    for (let i = 0; i < 4; i++) {
                        const angle = (i * Math.PI / 2) + Math.random();
                        this.ctx.moveTo(cx, cy);
                        this.ctx.lineTo(cx + Math.cos(angle) * 15, cy + Math.sin(angle) * 10);
                        // Branch
                        this.ctx.lineTo(cx + Math.cos(angle + 0.3) * 25, cy + Math.sin(angle - 0.2) * 15);
                    }
                    this.ctx.stroke();
                    this.ctx.lineWidth = 1;
                }

                if (b.type !== 'NORMAL') {
                    this.ctx.strokeStyle = '#fff';
                    this.ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
                }
            }
        }));

        // Paddle
        this.ctx.fillStyle = '#fff';
        this.ctx.shadowBlur = 10; this.ctx.shadowColor = '#fff';
        this.ctx.fillRect(this.paddle.x, this.canvas.height - this.paddleHeight - 20, this.paddle.width, this.paddleHeight);
        this.ctx.shadowBlur = 0;

        // Ball Trail (v3.0)
        if (this.state === 'PLAYING') {
            this.ballTrail.push({x: this.ball.x, y: this.ball.y});
            if (this.ballTrail.length > 10) this.ballTrail.shift();
        }
        this.ballTrail.forEach((t, i) => {
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, this.ballRadius * (i/10), 0, Math.PI*2);
            this.ctx.fillStyle = this.activeMod === 'PIERCING' ? `rgba(255, 0, 255, ${i/15})` : `rgba(255, 255, 255, ${i/15})`;
            this.ctx.fill();
        });

        // Ball
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ballRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeMod === 'PIERCING' ? '#ff00ff' : '#fff';
        this.ctx.shadowBlur = 15; this.ctx.shadowColor = this.ctx.fillStyle;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Mod Drops (Sanitized v3.1)
        this.modDrops.forEach(m => {
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.shadowBlur = 10; this.ctx.shadowColor = '#ff00ff';
            this.ctx.beginPath();
            this.ctx.moveTo(m.x, m.y);
            this.ctx.lineTo(m.x + 12, m.y + 24);
            this.ctx.lineTo(m.x - 12, m.y + 24);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Particles
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, 4, 4);
        });
        // Projectiles
        this.projectiles.forEach(p => {
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.fillRect(p.x, p.y, 4, 15);
        });

        this.ctx.globalAlpha = 1.0;
        this.ctx.restore();
    }

    loop(t) {
        const dt = t - (this.lastTime || t);
        this.lastTime = t;
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

const game = new Game();
