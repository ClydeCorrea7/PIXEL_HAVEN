/**
 * PULSE//SURVIVE - Kinetic Time Control Engine
 * Visual Fidelity Patch v1.4
 */

class Vec2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mul(s) { this.x *= s; this.y *= s; return this; }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const len = this.length();
        if (len > 0) { this.x /= len; this.y /= len; }
        return this;
    }
    static dist(a, b) { return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2); }
}

class SoundEngine {
    constructor() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    play(freq, type, duration, volume = 0.1) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(volume, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + duration);
    }
    trigger() { this.play(200, 'square', 0.2, 0.03); }
    explode() { this.play(100 + Math.random() * 40, 'sawtooth', 0.2, 0.02); }
    enemyHit() { this.play(60 + Math.random() * 20, 'square', 0.3, 0.05); }
}

const CONFIG = {
    PLAYER_SPEED: 175,
    INPUT_THRESHOLD: 0.1,    // Minimum joystick/stick magnitude to trigger time
    SPAWN_INTERVAL: 1500,    // Base ms
    COLORS: {
        PLAYER: '#00f2ff',
        BASIC: '#ff00ea',
        FAST: '#fff200',
        DASHER: '#ffffff'
    }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'MENU';
        this.score = 0;
        this.timeScale = 0;
        
        this.player = { pos: new Vec2(0, 0), radius: 6 };
        this.enemies = [];
        this.dyingEnemies = [];
        this.particles = [];
        this.keys = {};
        this.inputVector = new Vec2(0, 0);
        
        this.lastTime = 0;
        this.spawnTimer = 0;
        this.elapsedTime = 0;
        this.pulseTimer = 10.0;
        this.pulses = [];

        this.joystick = {
            active: false,
            origin: new Vec2(0, 0),
            current: new Vec2(0, 0),
            maxDist: 50
        };

        this.sounds = new SoundEngine();
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' && (this.state === 'MENU' || this.state === 'GAMEOVER')) {
                this.start();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // Joystick Event Listeners
        const jContainer = document.getElementById('joystick-container');
        const jNub = document.getElementById('joystick-nub');

        const handleTouch = (e) => {
            if (this.state !== 'PLAYING') return;
            const touch = e.touches[0];
            const rect = jContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dx = touch.clientX - centerX;
            const dy = touch.clientY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const moveX = Math.min(dist, this.joystick.maxDist) * (dx / dist);
            const moveY = Math.min(dist, this.joystick.maxDist) * (dy / dist);

            this.joystick.active = true;
            this.joystick.current = new Vec2(dx, dy);
            jNub.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
        };

        jContainer.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch(e); });
        jContainer.addEventListener('touchmove', (e) => { e.preventDefault(); handleTouch(e); });
        jContainer.addEventListener('touchend', (e) => {
            this.joystick.active = false;
            this.joystick.current = new Vec2(0, 0);
            jNub.style.transform = `translate(-50%, -50%)`;
        });

        document.getElementById('start-btn').onclick = (e) => { e.stopPropagation(); this.start(); };
        document.getElementById('restart-btn').onclick = (e) => { e.stopPropagation(); this.start(); };
        
        // Mobile tap to start
        window.addEventListener('touchstart', (e) => {
            if (this.state === 'MENU' || this.state === 'GAMEOVER') this.start();
        }, { passive: false });

        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        // Expanded resolution for a larger 'Tactical Field'
        this.canvas.width = 960;  // 1.5x Original Width
        this.canvas.height = 540; // 1.5x Original Height
        this.player.pos = new Vec2(this.canvas.width / 2, this.canvas.height / 2);
    }

    start() {
        this.state = 'PLAYING';
        this.score = 0;
        this.elapsedTime = 0;
        this.pulseTimer = 10.0;
        this.enemies = [];
        this.dyingEnemies = [];
        this.particles = [];
        this.pulses = [];
        this.player.pos = new Vec2(this.canvas.width / 2, this.canvas.height / 2);
        this.player.radius = 6;
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('death-screen').classList.remove('active');
        document.body.classList.remove('frozen');
    }

    updateInput() {
        this.inputVector = new Vec2(0, 0);

        // Keyboard Logic
        if (this.keys['KeyW'] || this.keys['ArrowUp']) this.inputVector.y -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) this.inputVector.y += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.inputVector.x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) this.inputVector.x += 1;

        // Joystick Overlap
        if (this.joystick.active) {
            const mag = this.joystick.current.length();
            if (mag > 5) {
                this.inputVector.x = this.joystick.current.x / mag;
                this.inputVector.y = this.joystick.current.y / mag;
            }
        }

        const mag = this.inputVector.length();
        if (mag > 0) {
            this.inputVector.normalize();
            this.timeScale = 1;
        } else {
            this.timeScale = 0;
        }

        const body = document.body;
        if (this.timeScale === 0) {
            body.classList.add('frozen');
            document.getElementById('time-label').textContent = 'FROZEN';
        } else {
            body.classList.remove('frozen');
            document.getElementById('time-label').textContent = 'ACTIVE';
        }
    }

    spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        const padding = 100;

        if (side === 0) { x = Math.random() * this.canvas.width; y = -padding; }
        else if (side === 1) { x = this.canvas.width + padding; y = Math.random() * this.canvas.height; }
        else if (side === 2) { x = Math.random() * this.canvas.width; y = this.canvas.height + padding; }
        else { x = -padding; y = Math.random() * this.canvas.height; }

        const r = Math.random();
        let type = 'BASIC';
        if (this.elapsedTime > 30 && r > 0.7) type = 'FAST';
        if (this.elapsedTime > 60 && r > 0.9) type = 'DASHER';

        this.enemies.push({
            pos: new Vec2(x, y),
            type: type,
            speed: type === 'FAST' ? 126 : 84,
            radius: 5,
            dashTimer: 0,
            isDashing: false
        });
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.updateInput();

        if (this.timeScale > 0) {
            // Player movement
            const move = new Vec2(this.inputVector.x, this.inputVector.y).mul(CONFIG.PLAYER_SPEED * dt);
            this.player.pos.add(move);

            // Keep in bounds
            this.player.pos.x = Math.max(10, Math.min(this.canvas.width - 10, this.player.pos.x));
            this.player.pos.y = Math.max(10, Math.min(this.canvas.height - 10, this.player.pos.y));

            this.elapsedTime += dt;
            document.getElementById('score-display').textContent = this.formatTime(this.elapsedTime);

            // Pulse Timer
            this.pulseTimer -= dt;
            if (this.pulseTimer <= 0) {
                this.triggerPulse();
                this.pulseTimer = 10.0;
            }
            document.getElementById('pulse-countdown').textContent = this.pulseTimer.toFixed(1) + 's';

            // Spawning
            this.spawnTimer += dt * 1000;
            const currentSpawnRate = Math.max(400, CONFIG.SPAWN_INTERVAL - (this.elapsedTime * 20));
            if (this.spawnTimer > currentSpawnRate) {
                this.spawnEnemy();
                this.spawnTimer = 0;
            }

            // Enemies
            this.enemies.forEach((en, idx) => {
                const dir = new Vec2(this.player.pos.x - en.pos.x, this.player.pos.y - en.pos.y).normalize();
                
                if (en.type === 'DASHER') {
                    en.dashTimer += dt;
                    if (en.isDashing) {
                        en.pos.add(dir.mul(245 * dt));
                        if (en.dashTimer > 0.6) { en.isDashing = false; en.dashTimer = 0; }
                    } else {
                        if (en.dashTimer > 1.2) { en.isDashing = true; en.dashTimer = 0; }
                    }
                } else {
                    en.pos.add(dir.mul(en.speed * dt));
                }

                // Collision
                if (Vec2.dist(this.player.pos, en.pos) < this.player.radius + en.radius) {
                    this.gameOver();
                }
            });

            // Update Dying Enemies
            this.dyingEnemies.forEach((de, idx) => {
                de.radius += 100 * dt;
                de.alpha -= 2.5 * dt;
                if (de.alpha <= 0) this.dyingEnemies.splice(idx, 1);
            });

            // Update Pulse Graphics
            this.pulses.forEach((p, idx) => {
                p.radius += 1800 * dt; // Ultra-snappy expansion
                p.alpha -= 3.5 * dt;   // Sharp high-intensity fade
                
                // Keep visuals locked to the 120px tactical zone
                if (p.radius > 120) p.alpha *= 0.8;
                if (p.alpha <= 0 || p.radius > 150) this.pulses.splice(idx, 1);
            });
        }
    }

    triggerPulse() {
        const radius = 120;
        this.pulses.push({ pos: new Vec2(this.player.pos.x, this.player.pos.y), radius: 5, alpha: 1.0 });
        
        // Neutralize enemies in range
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (Vec2.dist(this.player.pos, this.enemies[i].pos) < radius) {
                const en = this.enemies.splice(i, 1)[0];
                this.dyingEnemies.push({ ...en, alpha: 1.0 });
                this.sounds.enemyHit();
            }
        }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        document.getElementById('death-screen').classList.add('active');
        document.getElementById('final-score').textContent = this.formatTime(this.elapsedTime);
        document.body.classList.add('frozen');
    }

    formatTime(s) {
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 10);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
    }

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid lines (Parallax-ish)
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.1)';
        ctx.lineWidth = 1;
        const spacing = 120;
        const offsetX = -(this.player.pos.x % spacing);
        const offsetY = -(this.player.pos.y % spacing);
        
        for (let x = offsetX; x < this.canvas.width; x += spacing) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
        }
        for (let y = offsetY; y < this.canvas.height; y += spacing) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
        }

        // Draw Player
        ctx.shadowBlur = 15; ctx.shadowColor = CONFIG.COLORS.PLAYER;
        ctx.fillStyle = CONFIG.COLORS.PLAYER;
        ctx.beginPath(); ctx.arc(this.player.pos.x, this.player.pos.y, this.player.radius, 0, Math.PI * 2); ctx.fill();
        
        // Pulse Charge-Up Animation (Precise)
        if (this.state === 'PLAYING') {
            const chargeRatio = 1 - (this.pulseTimer / 10.0);
            
            // Subtle aura
            ctx.strokeStyle = `rgba(0, 242, 255, ${chargeRatio * 0.3})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(this.player.pos.x, this.player.pos.y, this.player.radius + 15 * chargeRatio, 0, Math.PI * 2); ctx.stroke();
            
            // Critical Charge sequence (Last 1.5s)
            if (this.pulseTimer < 1.5) {
                const preFireRatio = 1 - (this.pulseTimer / 1.5);
                ctx.strokeStyle = `rgba(0, 242, 255, ${0.5 + Math.random() * 0.5})`;
                ctx.lineWidth = 2;
                // Collapsing ring to the player
                const ringRad = this.player.radius + (40 * (1 - preFireRatio));
                ctx.beginPath(); ctx.arc(this.player.pos.x, this.player.pos.y, ringRad, 0, Math.PI * 2); ctx.stroke();
                
                // Sparks
                for(let i=0; i<3; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const d = ringRad + Math.random() * 5;
                    ctx.fillRect(this.player.pos.x + Math.cos(angle)*d, this.player.pos.y + Math.sin(angle)*d, 1.5, 1.5);
                }
            }
        }

        // Player Arrow (Direction)
        if (this.inputVector.length() > 0) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.player.pos.x, this.player.pos.y);
            ctx.lineTo(this.player.pos.x + this.inputVector.x * 20, this.player.pos.y + this.inputVector.y * 20);
            ctx.stroke();
        }

        // Draw Enemies
        this.enemies.forEach(en => {
            ctx.shadowBlur = 10;
            ctx.shadowColor = CONFIG.COLORS[en.type];
            ctx.fillStyle = CONFIG.COLORS[en.type];
            
            ctx.beginPath();
            if (en.type === 'BASIC') {
                ctx.arc(en.pos.x, en.pos.y, en.radius, 0, Math.PI * 2);
            } else if (en.type === 'FAST') {
                ctx.moveTo(en.pos.x, en.pos.y - en.radius);
                ctx.lineTo(en.pos.x + en.radius, en.pos.y + en.radius);
                ctx.lineTo(en.pos.x - en.radius, en.pos.y + en.radius);
                ctx.closePath();
            } else if (en.type === 'DASHER') {
                ctx.rect(en.pos.x - en.radius, en.pos.y - en.radius, en.radius*2, en.radius*2);
            }
            ctx.fill();
        });

        // Draw Dying Enemies
        this.dyingEnemies.forEach(de => {
            ctx.shadowBlur = 15; ctx.shadowColor = '#fff';
            ctx.strokeStyle = `rgba(255, 255, 255, ${de.alpha})`;
            ctx.lineWidth = 2;
            
            // Fragmented data ring
            ctx.setLineDash([2, 5]);
            ctx.beginPath(); ctx.arc(de.pos.x, de.pos.y, de.radius, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(de.pos.x, de.pos.y, de.radius * 0.5, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        });

        // Draw Pulses
        this.pulses.forEach(p => {
            const displayRadius = Math.min(p.radius, 120); // Locked to gameplay zone
            ctx.shadowBlur = 30; ctx.shadowColor = CONFIG.COLORS.PLAYER;
            ctx.strokeStyle = `rgba(0, 242, 255, ${p.alpha})`;
            ctx.lineWidth = 4;
            
            // Primary 120px shockwave boundary
            ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, displayRadius, 0, Math.PI * 2); ctx.stroke();
            
            // High-frequency ripples
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 10]);
            ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, displayRadius * 0.6, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        });
    }

    loop(t) {
        const dt = (t - this.lastTime) / 1000 || 0;
        this.lastTime = t;
        
        this.update(dt);
        this.draw();
        
        requestAnimationFrame((t) => this.loop(t));
    }
}

window.onload = () => { new Game(); };
