/**
 * NULL//PAUSE - Temporal Drift Racing
 * PIXEL_HAVEN // ARCADE_OS v1.0
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
    static dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
    static distToSegment(p, a, b) {
        const l2 = Vec2.dist(a, b) ** 2;
        if (l2 === 0) return Vec2.dist(p, a);
        let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Vec2.dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
    static intersect(p1, p2, p3, p4) {
        const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
        if (det === 0) return false;
        const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
        const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }
}

class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.engineOsc = null;
        this.engineGain = null;
    }

    init() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    play(freq, type, duration, volume = 0.1, ramp = true) {
        this.init();
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(volume, this.ctx.currentTime);
        if (ramp) g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + duration);
    }

    startEngine() {
        if (this.engineOsc) return;
        this.init();
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
    }

    updateEngine(speed, isNull) {
        if (!this.engineOsc) return;
        const freq = 40 + (speed * 15);
        this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
        const vol = isNull ? 0.02 : Math.min(0.08, 0.02 + (speed * 0.01));
        this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }

    shift() { this.play(300, 'square', 0.1, 0.05); }
    nullStart() { this.play(150, 'sine', 0.5, 0.1); }
    boost() { if (Math.random() < 0.1) this.play(800 + Math.random() * 200, 'sine', 0.05, 0.02); }
    crash() { this.play(60, 'sawtooth', 0.8, 0.2); this.play(100, 'square', 0.4, 0.1); }
}

const CONFIG = {
    MAX_SPEED: 12.5, // 500 KM/H
    ACCEL: 0.06,     // High-torque build-up
    FRICTION_BASE: 0.988,
    TURN_SPEED: 0.05,
    DRIFT_FACTOR: 0.96,
    NULL_DURATION: 7.5,
    NULL_COOLDOWN: 4.0,
    VIEW_DISTANCE: 2000,
    TRACK_WIDTH: 250, // Expanded road width
    OBSTACLE_RATE: 0.15
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'MENU';
        this.score = 0;
        this.level = 1;
        this.lastTime = 0;
        this.chassisColor = '#f2ff00'; 
        this.colorSelected = false; // Forced selection protocol

        // Procedural Starfield Generation
        this.stars = [];
        for (let i = 0; i < 400; i++) {
            this.stars.push({
                x: Math.random() * 2000,
                y: Math.random() * 2000,
                size: Math.random() * 1.5,
                p: Math.random() * 0.4 + 0.1
            });
        }

        // Cosmic Dust & Nebula Clusters (Atmospheric Depth)
        this.dust = [];
        const colors = ['rgba(0, 240, 255, 0.04)', 'rgba(255, 0, 76, 0.03)', 'rgba(120, 0, 255, 0.02)'];
        for (let i = 0; i < 30; i++) {
            this.dust.push({
                x: Math.random() * 4000,
                y: Math.random() * 4000,
                size: 300 + Math.random() * 500,
                color: colors[Math.floor(Math.random() * colors.length)],
                p: Math.random() * 0.15 + 0.05
            });
        }

        // Player State
        this.car = {
            pos: new Vec2(0, 0),
            angle: -Math.PI / 2,
            speed: 0,
            velocity: new Vec2(0, 0),
            radius: 18, // Increased for v1.13 zoom
            gear: 1
        };

        // Null System
        this.null = {
            active: false,
            timeRemaining: CONFIG.NULL_DURATION,
            cooldown: 0,
            available: true
        };

        this.keys = {};
        this.track = [];
        this.obstacles = [];
        this.joystickX = 0; // Steering deviation
        this.sounds = new SoundEngine();
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        const bindKeys = (type) => (e) => {
            const isDown = type === 'keydown' || type === 'touchstart';
            this.keys[e.code] = isDown;
            if (isDown && (e.code === 'Space' || e.code === 'KeyR') && (this.state === 'MENU' || this.state === 'GAMEOVER')) {
                this.start();
            } else if (isDown && e.code === 'Space' && this.state === 'PLAYING') {
                this.toggleNull(isDown);
            } else if (!isDown && e.code === 'Space' && this.state === 'PLAYING') {
                this.toggleNull(isDown);
            }
        };

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if ((e.code === 'Space' || e.code === 'KeyR') && (this.state === 'MENU' || this.state === 'GAMEOVER')) {
                this.start();
            } else if (e.code === 'Space' && this.state === 'PLAYING') {
                this.toggleNull(true);
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'Space') this.toggleNull(false);
        });

        // Color Selection Logic
        const colorOpts = document.querySelectorAll('.color-opt');
        colorOpts.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                colorOpts.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.chassisColor = opt.dataset.color;
                this.colorSelected = true; // VALIDATED!
                this.sounds.shift(); // Selection beep
            });
            // Also support touch for mobile
            opt.addEventListener('touchstart', (e) => {
                e.preventDefault(); e.stopPropagation();
                colorOpts.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.chassisColor = opt.dataset.color;
                this.colorSelected = true; // VALIDATED!
                this.sounds.shift();
            });
        });

        const startBtn = document.getElementById('start-btn');
        startBtn.addEventListener('click', (e) => { e.stopPropagation(); this.start(); });
        startBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.start(); });

        // Mobile Controls
        const jBoundary = document.getElementById('joystick-boundary');
        const jNub = document.getElementById('joystick-nub');
        const accelBtn = document.getElementById('accel-btn');
        const nullBtn = document.getElementById('null-btn');

        const updateJoystick = (e) => {
            const touch = e.touches[0];
            const rect = jBoundary.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = Math.min(60, Math.max(-60, touch.clientX - centerX));
            const dy = Math.min(60, Math.max(-60, touch.clientY - centerY));
            this.joystickX = dx / 60; // -1 to 1
            jNub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        };

        jBoundary.addEventListener('touchstart', (e) => { e.preventDefault(); updateJoystick(e); });
        jBoundary.addEventListener('touchmove', (e) => { e.preventDefault(); updateJoystick(e); });
        jBoundary.addEventListener('touchend', (e) => {
            this.joystickX = 0;
            jNub.style.transform = `translate(-50%, -50%)`;
        });

        accelBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys['KeyW'] = true; });
        accelBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.keys['KeyW'] = false; });
        nullBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.state === 'PLAYING') this.toggleNull(true);
            else this.start();
        });
        nullBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.toggleNull(false); });

        // Generic tap for menu (REMOVED - v1.17.5)

        document.getElementById('start-btn').onclick = (e) => { e.stopPropagation(); this.start(); };
        document.getElementById('restart-btn').onclick = (e) => { e.stopPropagation(); this.start(); };

        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        this.canvas.width = 960;
        this.canvas.height = 540;
    }

    start() {
        if (!this.colorSelected) {
            // Visual feedback that selection is required
            const hint = document.querySelector('.color-selection p');
            hint.style.color = '#ff4c00';
            hint.textContent = 'PROTOCOL_REQUIRED_SELECT_COLOR';
            hint.classList.add('blink');
            setTimeout(() => {
                hint.style.color = 'rgba(255,255,255,0.7)';
                hint.textContent = 'CHASSIS_COLOR:';
                hint.classList.remove('blink');
            }, 2000);
            return;
        }
        if (this.state === 'PLAYING') return;
        this.state = 'PLAYING';
        this.score = 0;
        this.elapsedTime = 0;
        this.car.pos = new Vec2(200, 200);
        this.car.angle = 0;
        this.car.speed = 0;
        this.car.velocity = new Vec2(0, 0);
        this.null.timeRemaining = CONFIG.NULL_DURATION;
        this.null.cooldown = 0;
        this.null.available = true;
        this.null.active = false;
        this.currentSegment = 0;
        this.generateTrack();
        this.sounds.startEngine();
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('death-screen').classList.remove('active');
        document.body.classList.remove('null-active');
    }

    winLevel() {
        this.level++;
        this.sounds.shift(); // Victory sound
        this.state = 'WIN'; // Bypass PLAYING guard in start()
        this.start(); // Restart at next level complexity
    }

    generateTrack() {
        this.track = [];
        this.obstacles = [];
        let p = new Vec2(200, 200);
        this.track.push(new Vec2(p.x, p.y));
        let angle = 0;
        const spacing = 350;
        const numSegments = 30 + (this.level * 25);

        // Difficulty Curve Scaling
        const turnComplexity = Math.min(0.20, (this.level - 1) * 0.03); // Starts straight at L1
        const obstacleChance = this.level < 3 ? 0 : Math.min(0.35, (this.level - 2) * 0.05);

        for (let i = 0; i < numSegments; i++) {
            let attempts = 0;
            let foundValid = false;
            let nextP, nextAngle;

            while (attempts < 20 && !foundValid) {
                nextAngle = angle;
                const r = Math.random();

                // Generative complexity increases with level
                if (r < turnComplexity * 0.4) nextAngle += Math.PI / 2.1;
                else if (r < turnComplexity * 0.8) nextAngle -= Math.PI / 2.1;
                else if (r < turnComplexity) nextAngle += Math.PI * 0.95;
                else nextAngle += (Math.random() - 0.5) * 0.2; // Very slight curve

                nextP = new Vec2(p.x + Math.cos(nextAngle) * spacing, p.y + Math.sin(nextAngle) * spacing);

                // CROSS-SEGMENT INTERSECTION & PROXIMITY CHECK (High Fidelity)
                let tooClose = false;
                for (let j = 0; j < this.track.length - 1; j++) {
                    const segA = this.track[j], segB = this.track[j + 1];

                    // 1. Line Intersection Check
                    if (Vec2.intersect(p, nextP, segA, segB)) {
                        tooClose = true;
                        break;
                    }

                    // 2. Road-Surface Proximity Check (The 'Grey Part' Buffer)
                    // We check distance from midpoints and ends against previous segments
                    const midP = new Vec2((p.x + nextP.x) / 2, (p.y + nextP.y) / 2);
                    const d1 = Vec2.distToSegment(p, segA, segB);
                    const d2 = Vec2.distToSegment(nextP, segA, segB);
                    const d3 = Vec2.distToSegment(midP, segA, segB);

                    if (j < this.track.length - 15) { // Skip immediate predecessors
                        if (d1 < CONFIG.TRACK_WIDTH * 2.1 || d2 < CONFIG.TRACK_WIDTH * 2.1 || d3 < CONFIG.TRACK_WIDTH * 2.1) {
                            tooClose = true;
                            break;
                        }
                    }
                }
                if (!tooClose) foundValid = true;
                attempts++;
            }

            angle = nextAngle;
            p = nextP;
            this.track.push(new Vec2(p.x, p.y));

            // Obstacle Spawning (Scaling Hazards)
            if (i > 15 && Math.random() < obstacleChance) {
                const off = (Math.random() - 0.5) * (CONFIG.TRACK_WIDTH - 60);
                const normAngle = angle + Math.PI / 2;

                // Advanced Hazards (Barricades) at Level 10+
                const isBig = (this.level >= 10 && Math.random() < 0.3);
                this.obstacles.push({
                    pos: new Vec2(p.x + Math.cos(normAngle) * off, p.y + Math.sin(normAngle) * off),
                    radius: isBig ? 30 : 15,
                    type: isBig ? 'BARRICADE' : 'CUBE'
                });
            }
        }
    }

    toggleNull(active) {
        if (active && this.null.available && this.null.timeRemaining > 0) {
            this.null.active = true;
            this.sounds.nullStart();
            document.body.classList.add('null-active');
        } else {
            this.null.active = false;
            document.body.classList.remove('null-active');
            if (this.null.cooldown === 0 && active === false && this.null.available === false) {
                // started cooldown logic handled in update
            }
        }
    }

    resetToLast() {
        const lastValid = this.track[this.currentSegment];
        this.car.pos = new Vec2(lastValid.x, lastValid.y);
        this.car.speed *= 0.2; // Kinetic Penalty
        this.car.velocity = new Vec2(0, 0);
        this.sounds.shift(); // High-pitched reset beep
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.sounds.crash();
        document.getElementById('death-screen').classList.add('active');
        document.getElementById('final-score').textContent = this.level;
        document.body.classList.remove('null-active');
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        // Null System Update
        if (this.null.active) {
            this.null.timeRemaining -= dt;
            if (this.null.timeRemaining <= 0) {
                this.null.timeRemaining = 0;
                this.toggleNull(false);
                this.null.available = false;
                this.null.cooldown = CONFIG.NULL_COOLDOWN;
            }
        } else {
            if (this.null.cooldown > 0) {
                this.null.cooldown -= dt;
                if (this.null.cooldown <= 0) {
                    this.null.cooldown = 0;
                    this.null.available = true;
                    this.null.timeRemaining = CONFIG.NULL_DURATION; // FULL RESET!
                }
            }
        }

        // Physics Logic
        if (this.null.active) {
            // ONLY ROTATION + Slow Backup
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.car.angle -= CONFIG.TURN_SPEED * 1.5;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) this.car.angle += CONFIG.TURN_SPEED * 1.5;

            // Minimal backward movement to fix positions
            if (this.keys['KeyS'] || this.keys['ArrowDown']) {
                const backVec = new Vec2(-Math.cos(this.car.angle), -Math.sin(this.car.angle));
                this.car.pos.add(backVec.mul(1));
            }
            // Speed Preservation (Position is locked in NULL)
            this.car.velocity = new Vec2(0, 0);
        } else {
            // Gear Calculation Stage
            const prevGear = this.car.gear || 1;
            this.car.gear = Math.max(1, Math.min(6, Math.floor(Math.abs(this.car.speed * 40) / 100) + 1));
            if (this.car.gear !== prevGear) this.sounds.shift();

            // Torque & Friction Scaling
            const dynamicFriction = CONFIG.FRICTION_BASE + (this.car.gear * 0.0012);

            let currentAccel = CONFIG.ACCEL;

            // Center-Line Slipstream Boost (+20%)
            let minCenterDist = 9999;
            for (let i = 0; i < this.track.length - 1; i++) {
                const d = this.distToSegment(this.car.pos, this.track[i], this.track[i + 1]);
                if (d < minCenterDist) minCenterDist = d;
            }
            if (minCenterDist < 12) {
                currentAccel += 0.02; // 25% Boost for precision
                this.onCenterLine = true;
                this.sounds.boost();
            } else {
                this.onCenterLine = false;
            }

            if (this.keys['KeyW'] || this.keys['ArrowUp']) this.car.speed += currentAccel;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) this.car.speed -= currentAccel * 0.8;

            this.car.speed *= dynamicFriction;
            this.car.speed = Math.max(-2, Math.min(this.car.speed, CONFIG.MAX_SPEED));

            const turnForce = (Math.abs(this.car.speed) / CONFIG.MAX_SPEED) * CONFIG.TURN_SPEED;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.car.angle -= turnForce;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) this.car.angle += turnForce;

            // Joystick Support
            if (Math.abs(this.joystickX) > 0.1) this.car.angle += this.joystickX * turnForce * 1.5;

            // Target Direction
            const targetVel = new Vec2(Math.cos(this.car.angle), Math.sin(this.car.angle)).mul(this.car.speed);

            // Drift Interpolation
            this.car.velocity.x = this.car.velocity.x * CONFIG.DRIFT_FACTOR + targetVel.x * (1 - CONFIG.DRIFT_FACTOR);
            this.car.velocity.y = this.car.velocity.y * CONFIG.DRIFT_FACTOR + targetVel.y * (1 - CONFIG.DRIFT_FACTOR);

            this.car.pos.add(this.car.velocity);
            this.score += dt;
        }

        this.sounds.updateEngine(this.car.speed, this.null.active);

        // Collision Check (Sequential Track Compliance)
        let onTrack = false;
        let segmentFoundIndex = -1;

        // Only allow compliance with local segments [current...current+8] to prevent plane-skipping
        const lookAhead = 8;
        for (let i = this.currentSegment; i < Math.min(this.track.length - 1, this.currentSegment + lookAhead); i++) {
            const d = this.distToSegment(this.car.pos, this.track[i], this.track[i + 1]);
            if (d < CONFIG.TRACK_WIDTH / 2) {
                onTrack = true;
                segmentFoundIndex = i;
                break;
            }
        }

        if (!onTrack) { this.resetToLast(); return; }

        // Progress the lineage if we advance
        if (segmentFoundIndex > this.currentSegment) {
            this.currentSegment = segmentFoundIndex;
        }

        // Obstacle Collision
        for (const obs of this.obstacles) {
            if (Vec2.dist(this.car.pos, obs.pos) < this.car.radius + obs.radius) {
                this.gameOver();
                return;
            }
        }

        // Win Goal check
        const goal = this.track[this.track.length - 1];
        if (Vec2.dist(this.car.pos, goal) < 150) {
            this.winLevel();
            return;
        }

        this.updateHUD();
    }

    distToSegment(p, a, b) {
        return Vec2.distToSegment(p, a, b);
    }

    updateHUD() {
        const timerEl = document.getElementById('null-timer');
        const fillEl = document.getElementById('null-bar-fill');
        const speedEl = document.getElementById('speed-val');
        const coolBar = document.getElementById('cooldown-bar-bg');
        const coolFill = document.getElementById('cooldown-bar-fill');

        timerEl.textContent = this.null.timeRemaining.toFixed(1) + 's';
        fillEl.style.width = (this.null.timeRemaining / CONFIG.NULL_DURATION * 100) + '%';

        const kmh = Math.abs(Math.floor(this.car.speed * 40));
        speedEl.textContent = kmh;
        document.getElementById('gear-val').textContent = this.car.gear || 1;
        document.getElementById('level-val').textContent = this.level;

        const goalDist = Vec2.dist(this.car.pos, this.track[this.track.length - 1]);
        document.getElementById('dist-val').textContent = Math.floor(goalDist / 10);

        if (this.null.cooldown > 0) {
            coolBar.classList.remove('hidden');
            coolFill.style.width = (this.null.cooldown / CONFIG.NULL_COOLDOWN * 100) + '%';
        } else {
            coolBar.classList.add('hidden');
        }
    }

    draw() {
        if (this.track.length === 0) return;
        const ctx = this.ctx;
        
        // 1. DEEP SPACE BASE
        ctx.fillStyle = '#010105';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 2. VIBRANT COSMIC DUST & NEBULA
        ctx.save();
        this.dust.forEach(d => {
            const dx = (d.x - this.car.pos.x * d.p) % 4000;
            const dy = (d.y - this.car.pos.y * d.p) % 4000;
            const fx = dx < 0 ? dx + 4000 : dx;
            const fy = dy < 0 ? dy + 4000 : dy;
            
            ctx.beginPath();
            const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, d.size);
            // High Saturation Colors
            const baseColor = d.color.replace('0.04', '0.2').replace('0.03', '0.3').replace('0.02', '0.2');
            g.addColorStop(0, baseColor);
            g.addColorStop(0.8, baseColor.replace('0.', '0.0'));
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.arc(fx, fy, d.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        // 3. BRIGHTER PARALLAX STARS
        ctx.save();
        this.stars.forEach(s => {
            const sx = (s.x - this.car.pos.x * s.p) % 2000;
            const sy = (s.y - this.car.pos.y * s.p) % 2000;
            const fx = sx < 0 ? sx + 2000 : sx;
            const fy = sy < 0 ? sy + 2000 : sy;
            if (fx < this.canvas.width && fy < this.canvas.height) {
                // Brighter, multi-colored stars
                ctx.fillStyle = s.p > 0.3 ? '#fff' : (s.p > 0.2 ? '#00f0ff' : '#ff004c');
                ctx.globalAlpha = s.p * 3;
                ctx.fillRect(fx, fy, s.size * 1.5, s.size * 1.5);
            }
        });
        ctx.restore();
        
        // 4. INFINITE GRID
        ctx.save();
        const gStep = 150;
        const oX = -(this.car.pos.x % gStep);
        const oY = -(this.car.pos.y % gStep);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let x = oX; x < this.canvas.width + gStep; x += gStep) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
        }
        for (let y = oY; y < this.canvas.height + gStep; y += gStep) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        // Camera Follow (Total Horizon Zoom 0.5x)
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(0.5, 0.5);
        ctx.translate(-this.car.pos.x, -this.car.pos.y);

        // Draw Track (Visual Lineage)
        for (let i = 0; i < this.track.length - 1; i++) {
            const p1 = this.track[i], p2 = this.track[i + 1];
            ctx.beginPath();
            ctx.strokeStyle = i < this.currentSegment ? '#111' : '#222';
            ctx.lineWidth = CONFIG.TRACK_WIDTH;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        // Track Edges (Sequential Drive Line)
        for (let i = 0; i < this.track.length - 1; i++) {
            const p1 = this.track[i], p2 = this.track[i + 1];
            ctx.beginPath();
            ctx.strokeStyle = i < this.currentSegment ? '#00ff41' : '#f2ff00';
            ctx.lineWidth = 4;
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        // Center Line (Yellow Slipstream / Green Resonance)
        for (let i = 0; i < this.track.length - 1; i++) {
            const p1 = this.track[i], p2 = this.track[i + 1];
            ctx.beginPath();
            ctx.strokeStyle = i < this.currentSegment ? 'rgba(0, 255, 65, 0.4)' : 'rgba(242, 255, 0, 0.4)';
            if (this.onCenterLine && i === this.currentSegment) {
                ctx.shadowBlur = 15; ctx.shadowColor = '#f2ff00';
                ctx.strokeStyle = '#f2ff00';
            }
            ctx.lineWidth = 2;
            ctx.setLineDash([20, 30]);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        }

        // Draw Finish Line (Goal)
        const last = this.track[this.track.length - 1];
        ctx.fillStyle = '#00f0ff';
        ctx.shadowBlur = 30; ctx.shadowColor = '#00f0ff';
        ctx.beginPath(); ctx.arc(last.x, last.y, 160, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.fill();

        // Draw Obstacles
        this.obstacles.forEach(obs => {
            ctx.fillStyle = '#ff004c'; // Hazard Red
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff004c';
            const size = obs.radius * 2;
            ctx.fillRect(obs.pos.x - obs.radius, obs.pos.y - obs.radius, size, size);

            // Visual glitch overlay for barricades
            if (obs.type === 'BARRICADE') {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
                ctx.strokeRect(obs.pos.x - obs.radius, obs.pos.y - obs.radius, size, size);
            }
        });

        // Draw Car
        ctx.save();
        ctx.translate(this.car.pos.x, this.car.pos.y);
        ctx.rotate(this.car.angle);

        ctx.shadowBlur = 10; ctx.shadowColor = this.chassisColor;
        ctx.fillStyle = this.chassisColor;
        ctx.fillRect(-18, -12, 36, 24); // Body (v1.13)
        ctx.fillStyle = '#000';
        ctx.fillRect(6, -9, 9, 18); // Windshield
        
        // Thrusters
        if (!this.null.active && this.keys['KeyW']) {
            ctx.fillStyle = '#00f0ff';
            if (this.chassisColor === '#00f0ff') ctx.fillStyle = '#ff004c'; // Contrast thruster
            ctx.fillRect(-22, -8, 4, 16);
        }
        ctx.restore();

        ctx.restore();
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
