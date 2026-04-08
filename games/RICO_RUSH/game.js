/**
 * RICO//RUSH - Core Game Logic
 * Precision Ricochet Physics Implementation
 */

class Vec2 {
    constructor(x, y) { this.x = x; this.y = y; }
    static add(a, b) { return new Vec2(a.x + b.x, a.y + b.y); }
    static sub(a, b) { return new Vec2(a.x - b.x, a.y - b.y); }
    static mul(v, s) { return new Vec2(v.x * s, v.y * s); }
    static dot(a, b) { return a.x * b.x + a.y * b.y; }
    static mag(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
    static normalize(v) { const m = Vec2.mag(v); return m > 0 ? new Vec2(v.x / m, v.y / m) : new Vec2(0, 0); }
    static dist(a, b) { return Vec2.mag(Vec2.sub(a, b)); }
    static reflect(v, n) { const d = Vec2.dot(v, n); return Vec2.sub(v, Vec2.mul(n, 2 * d)); }
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
    fire() { this.play(150, 'square', 0.2, 0.05); }
    bounce() { this.play(400 + Math.random() * 50, 'triangle', 0.1, 0.02); }
    hit() { this.play(200, 'square', 0.3, 0.1); }
    win() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.play(f, 'sine', 0.4, 0.05), i * 150)); }
    fail() { this.play(100, 'sawtooth', 0.5, 0.1); }
}

const CONFIG = { BULLET_SPEED: 1000, MAX_BOUNCES: 25, BULLET_RADIUS: 4, ENEMY_RADIUS: 15, NEON_BLUE: '#00f2ff', NEON_PINK: '#ff00ea' };
const State = { MENU: 'MENU', AIMING: 'AIMING', FLYING: 'FLYING', SUCCESS: 'SUCCESS', FAILURE: 'FAILURE' };

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas'); this.ctx = this.canvas.getContext('2d');
        this.state = State.MENU; this.level = 0; this.enemies = []; this.walls = []; this.particles = []; this.bulletHistory = [];
        this.playerPos = new Vec2(0, 0); this.bullet = null; this.mousePos = new Vec2(0, 0);
        this.isMouseDown = false; this.shake = 0; this.timeScale = 1.0; this.hitStop = 0;
        this.sounds = new SoundEngine(); this.init();
    }

    init() {
        this.resize(); window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => this.inputStart(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove', (e) => this.inputMove(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseup', () => this.inputEnd());
        document.getElementById('start-btn').onclick = () => this.startLevel(0);
        document.getElementById('next-btn').onclick = () => this.startLevel(this.level + 1);
        document.getElementById('retry-btn').onclick = () => this.startLevel(this.level);
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const c = document.getElementById('game-container'), s = Math.min(c.clientWidth * 0.9, c.clientHeight * 0.8, 800);
        this.canvas.width = s; this.canvas.height = s;
        if (this.state !== State.MENU) this.startLevel(this.level);
    }

    startLevel(idx) {
        this.level = idx; const lvls = this.getLevels(), lvl = idx < lvls.length ? lvls[idx] : this.generateProcedural(idx);
        const w = this.canvas.width, h = this.canvas.height;
        this.playerPos = new Vec2(lvl.player.x * w, lvl.player.y * h);
        this.enemies = lvl.enemies.map(e => ({ pos: new Vec2(e.x * w, e.y * h), alive: true }));
        this.walls = [{ a: new Vec2(0, 0), b: new Vec2(w, 0) }, { a: new Vec2(w, 0), b: new Vec2(w, h) }, { a: new Vec2(w, h), b: new Vec2(0, h) }, { a: new Vec2(0, h), b: new Vec2(0, 0) }];
        if (lvl.walls) lvl.walls.forEach(wl => this.walls.push({ a: new Vec2(wl.x1 * w, wl.y1 * h), b: new Vec2(wl.x2 * w, wl.y2 * h) }));
        this.bullet = null; this.bulletHistory = []; this.state = State.AIMING; this.particles = []; this.hitStop = 0;
        this.maxCharges = lvl.charges || 1; this.currentCharges = this.maxCharges;
        document.getElementById('level-num').textContent = idx + 1; this.updateUI();
        document.getElementById('start-screen').classList.remove('active'); document.getElementById('result-screen').classList.remove('active');
    }

    updateUI() {
        document.getElementById('shot-count').textContent = `${this.currentCharges}/${this.maxCharges}`;
        const m = document.getElementById('kinetic-meter');
        if (this.state === State.FLYING && this.bullet) {
            m.classList.remove('hidden'); const rem = CONFIG.MAX_BOUNCES - this.bullet.bounces;
            document.getElementById('bounce-count').textContent = rem;
            document.getElementById('bounce-bar').style.width = `${(rem / CONFIG.MAX_BOUNCES) * 100}%`;
            rem <= 5 ? m.classList.add('low-energy') : m.classList.remove('low-energy');
        } else m.classList.add('hidden');
    }

    inputStart(x, y) { if (this.state === State.AIMING) { this.isMouseDown = true; this.updateM(x, y); } }
    inputMove(x, y) { this.updateM(x, y); }
    inputEnd() { if (this.isMouseDown) { this.isMouseDown = false; this.fire(); } }
    updateM(x, y) { const r = this.canvas.getBoundingClientRect(); this.mousePos = new Vec2(x - r.left, y - r.top); }

    fire() {
        if (this.state !== State.AIMING || this.currentCharges <= 0 || this.bullet) return;
        const d = Vec2.normalize(Vec2.sub(this.mousePos, this.playerPos));
        if (Vec2.mag(Vec2.sub(this.mousePos, this.playerPos)) < 10) return;
        this.bullet = { pos: new Vec2(this.playerPos.x, this.playerPos.y), vel: Vec2.mul(d, CONFIG.BULLET_SPEED), bounces: 0 };
        this.state = State.FLYING; this.currentCharges--; this.updateUI();
        this.createP(this.playerPos, CONFIG.NEON_BLUE, 8); this.shake = 10; this.sounds.fire();
    }

    update(dt) {
        if (this.hitStop > 0) { this.hitStop -= dt; return; }
        if (this.state === State.FLYING) this.moveBullet(dt);
        if (this.shake > 0) { this.shake *= 0.8; if (this.shake < 0.1) this.shake = 0; }
        this.particles = this.particles.filter(p => {
            p.pos = Vec2.add(p.pos, Vec2.mul(p.vel, dt)); p.vel = Vec2.mul(p.vel, 0.94);
            p.vel.y += 200 * dt; p.rot += p.rotV * dt; p.life -= dt; return p.life > 0;
        });
    }

    moveBullet(dt) {
        let rem = dt, limit = 5;
        while (rem > 0 && limit-- > 0) {
            const s = this.bullet.pos, e = Vec2.add(s, Vec2.mul(this.bullet.vel, rem));
            let hit = null;
            for (const w of this.walls) {
                const i = this.lineI(s, e, w.a, w.b);
                if (i && (!hit || i.t < hit.t)) {
                    const eg = Vec2.sub(w.b, w.a), n = Vec2.normalize(new Vec2(-eg.y, eg.x));
                    hit = { ...i, n: Vec2.dot(this.bullet.vel, n) < 0 ? n : Vec2.mul(n, -1), type: 'wall' };
                }
            }
            for (let i = 0; i < this.enemies.length; i++) {
                if (!this.enemies[i].alive) continue;
                const iI = this.circI(s, e, this.enemies[i].pos, CONFIG.ENEMY_RADIUS);
                if (iI && (!hit || iI.t < hit.t)) hit = { ...iI, type: 'enemy', idx: i };
            }
            if (hit) {
                this.bulletHistory.unshift({ ...this.bullet.pos }); if (this.bulletHistory.length > 12) this.bulletHistory.pop();
                this.bullet.pos = hit.p; rem -= rem * hit.t;
                if (hit.type === 'enemy') {
                    this.enemies[hit.idx].alive = false; this.createP(hit.p, CONFIG.NEON_PINK, 20);
                    this.shake = 20; this.hitStop = 0.1; this.sounds.hit();
                    if (this.enemies.every(en => !en.alive)) {
                        this.state = State.SUCCESS; this.bullet = null; this.updateUI(); this.sounds.win();
                        setTimeout(() => this.showR(true), 500); return;
                    }
                } else {
                    this.bullet.vel = Vec2.reflect(this.bullet.vel, hit.n); this.bullet.bounces++;
                    this.createP(hit.p, CONFIG.NEON_BLUE, 5); this.shake = 8; this.sounds.bounce(); this.updateUI();
                    if (this.bullet.bounces >= CONFIG.MAX_BOUNCES) {
                        this.bullet = null; this.updateUI(); if (this.currentCharges > 0) this.state = State.AIMING;
                        else { this.state = State.FAILURE; this.sounds.fail(); setTimeout(() => this.showR(false), 500); }
                        return;
                    }
                    this.bullet.pos = Vec2.add(this.bullet.pos, Vec2.mul(hit.n, 0.1));
                }
            } else { this.bulletHistory.unshift({ ...this.bullet.pos }); if (this.bulletHistory.length > 12) this.bulletHistory.pop(); this.bullet.pos = e; rem = 0; }
        }
    }

    showR(s) {
        document.getElementById('result-screen').classList.add('active');
        const st = document.getElementById('result-status'), n = document.getElementById('next-btn');
        st.textContent = s ? 'MISSION CLEAR' : 'MISSION FAILED'; st.className = s ? 'glitch success' : 'glitch failure';
        n.style.display = s ? 'block' : 'none';
    }

    createP(p, c, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 150;
            this.particles.push({ pos: { ...p }, vel: new Vec2(Math.cos(a) * s, Math.sin(a) * s), rot: Math.random() * 6, rotV: (Math.random() - 0.5) * 20, color: c, life: 0.6 + Math.random() * 0.8, size: 1 + Math.random() * 5 });
        }
    }

    lineI(p1, p2, p3, p4) {
        const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y); if (d === 0) return null;
        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d, ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
        return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) ? { t: ua, p: new Vec2(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y)) } : null;
    }

    circI(s, e, c, r) {
        const d = Vec2.sub(e, s), f = Vec2.sub(s, c), a = Vec2.dot(d, d), b = 2 * Vec2.dot(f, d), cl = Vec2.dot(f, f) - r * r;
        let disc = b * b - 4 * a * cl; if (disc < 0) return null; disc = Math.sqrt(disc);
        const t1 = (-b - disc) / (2 * a), t2 = (-b + disc) / (2 * a);
        if (t1 >= 0 && t1 <= 1) return { t: t1, p: Vec2.add(s, Vec2.mul(d, t1)) };
        if (t2 >= 0 && t2 <= 1) return { t: t2, p: Vec2.add(s, Vec2.mul(d, t2)) };
        return null;
    }

    draw() {
        const ctx = this.ctx; ctx.save(); if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.05)';
        for (let x = 0; x < this.canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke(); }
        for (let y = 0; y < this.canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke(); }
        ctx.strokeStyle = CONFIG.NEON_BLUE; ctx.lineWidth = 4; ctx.shadowBlur = 10; ctx.shadowColor = CONFIG.NEON_BLUE;
        this.walls.forEach(w => { ctx.beginPath(); ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); ctx.stroke(); });
        ctx.fillStyle = CONFIG.NEON_BLUE; ctx.beginPath(); ctx.arc(this.playerPos.x, this.playerPos.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 15; ctx.strokeStyle = '#fff'; ctx.stroke();
        this.enemies.forEach(e => {
            if (!e.alive) return;
            ctx.shadowColor = CONFIG.NEON_PINK; ctx.shadowBlur = 20; ctx.fillStyle = CONFIG.NEON_PINK;
            ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y, CONFIG.ENEMY_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y, CONFIG.ENEMY_RADIUS * 0.4, 0, Math.PI * 2); ctx.fill();
        });
        if (this.state === State.AIMING && this.isMouseDown) this.drawPred();
        if (this.state === State.FLYING && this.bulletHistory.length > 1) {
            ctx.beginPath(); ctx.strokeStyle = CONFIG.NEON_BLUE; ctx.lineWidth = CONFIG.BULLET_RADIUS * 2; ctx.lineCap = 'round';
            ctx.moveTo(this.bulletHistory[0].x, this.bulletHistory[0].y);
            for (let i = 1; i < this.bulletHistory.length; i++) { ctx.globalAlpha = 0.3 * (1 - i / this.bulletHistory.length); ctx.lineTo(this.bulletHistory[i].x, this.bulletHistory[i].y); }
            ctx.stroke(); ctx.globalAlpha = 1.0;
        }
        if (this.state === State.FLYING && this.bullet) {
            ctx.save(); ctx.translate(this.bullet.pos.x, this.bullet.pos.y); ctx.rotate(Math.atan2(this.bullet.vel.y, this.bullet.vel.x));
            ctx.shadowColor = CONFIG.NEON_BLUE; ctx.shadowBlur = 15; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, 4); ctx.lineTo(-8, 0); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = CONFIG.NEON_BLUE; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        this.particles.forEach(p => {
            ctx.save(); ctx.globalAlpha = p.life > 0.3 ? 1.0 : p.life / 0.3; ctx.fillStyle = p.color;
            ctx.translate(p.pos.x, p.pos.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
        });
        ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    }

    drawPred() {
        const ctx = this.ctx; let cP = new Vec2(this.playerPos.x, this.playerPos.y);
        let cD = Vec2.normalize(Vec2.sub(this.mousePos, this.playerPos)); if (Vec2.mag(Vec2.sub(this.mousePos, this.playerPos)) < 10) return;
        ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(0, 162, 255, 0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cP.x, cP.y); let b = 0, t = 0;
        while (b < 3 && t < 2000) {
            const e = Vec2.add(cP, Vec2.mul(cD, 2000)); let n = null;
            for (const w of this.walls) {
                const i = this.lineI(cP, e, w.a, w.b);
                if (i && i.t > 0.001 && (!n || i.t < n.t)) {
                    const eg = Vec2.sub(w.b, w.a), nm = Vec2.normalize(new Vec2(-eg.y, eg.x));
                    n = { ...i, nm: Vec2.dot(cD, nm) < 0 ? nm : Vec2.mul(nm, -1) };
                }
            }
            if (n) { ctx.lineTo(n.p.x, n.p.y); cP = n.p; cD = Vec2.reflect(cD, n.nm); b++; t += Vec2.dist(cP, n.p); }
            else { ctx.lineTo(e.x, e.y); break; }
        }
        ctx.stroke(); ctx.setLineDash([]);
    }

    loop(t) { const dt = (t - this.lastTime) / 1000 || 0; this.lastTime = t; this.update(dt); this.draw(); requestAnimationFrame((t) => this.loop(t)); }

    generateProcedural(idx) {
        const d = idx - 20, eC = 4 + Math.floor(d / 4), wC = 3 + Math.floor(d / 3);
        const p = { x: 0.1 + Math.random() * 0.2, y: 0.1 + Math.random() * 0.8 }, en = []; for (let i = 0; i < eC; i++) en.push({ x: 0.5 + Math.random() * 0.4, y: 0.1 + Math.random() * 0.8 });
        const w = []; for (let i = 0; i < wC; i++) {
            const wx = 0.3 + Math.random() * 0.4, wy = Math.random() * 0.6, l = 0.2 + Math.random() * 0.3;
            if (Math.random() > 0.5) w.push({ x1: wx, y1: wy, x2: wx, y2: wy + l }); else w.push({ x1: wx, y1: wy, x2: wx + l, y2: wy });
        }
        return { player: p, enemies: en, walls: w, charges: 2 + Math.floor(d / 4) };
    }

    getLevels() {
        return [
            // Sectors 1-5: The Threshold (Introduction)
            { player: { x: 0.1, y: 0.5 }, enemies: [{ x: 0.9, y: 0.5 }], walls: [{ x1: 0.5, y1: 0.4, x2: 0.5, y2: 0.6 }], charges: 1 },
            { player: { x: 0.1, y: 0.1 }, enemies: [{ x: 0.9, y: 0.9 }], walls: [{ x1: 0, y1: 0.4, x2: 0.7, y2: 0.4 }, { x1: 0.3, y1: 0.6, x2: 1.0, y2: 0.6 }], charges: 1 },
            { player: { x: 0.5, y: 0.05 }, enemies: [{ x: 0.1, y: 0.5 }], walls: [{ x1: 0, y1: 0.4, x2: 0.4, y2: 0.4 }, { x1: 0.6, y1: 0.4, x2: 1, y2: 0.4 }], charges: 1 },
            { player: { x: 0.1, y: 0.5 }, enemies: [{ x: 0.9, y: 0.1 }], walls: [{ x1: 0.5, y1: 0, x2: 0.5, y2: 0.4 }, { x1: 0.5, y1: 0.6, x2: 0.5, y2: 1 }], charges: 1 },
            { player: { x: 0.5, y: 0.5 }, enemies: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }], walls: [{ x1: 0.2, y1: 0.4, x2: 0.4, y2: 0.4 }, { x1: 0.6, y1: 0.6, x2: 0.8, y2: 0.6 }], charges: 2 },

            // Sectors 6-10: Reflection Corridors
            { player: { x: 0.05, y: 0.05 }, enemies: [{ x: 0.95, y: 0.95 }], walls: [{ x1: 0.3, y1: 0, x2: 0.3, y2: 0.3 }, { x1: 0.3, y1: 0.5, x2: 0.3, y2: 1 }, { x1: 0.7, y1: 0, x2: 0.7, y2: 0.5 }, { x1: 0.7, y1: 0.7, x2: 0.7, y2: 1 }], charges: 1 },
            { player: { x: 0.5, y: 0.1 }, enemies: [{ x: 0.1, y: 0.9 }], walls: [{ x1: 0, y1: 0.5, x2: 0.3, y2: 0.5 }, { x1: 0.5, y1: 0.5, x2: 0.8, y2: 0.5 }], charges: 1 },
            { player: { x: 0.1, y: 0.5 }, enemies: [{ x: 0.9, y: 0.1 }], walls: [{ x1: 0.4, y1: 0, x2: 0.4, y2: 0.45 }, { x1: 0.4, y1: 0.55, x2: 0.4, y2: 1 }, { x1: 0.6, y1: 0, x2: 0.6, y2: 0.45 }, { x1: 0.6, y1: 0.55, x2: 0.6, y2: 1 }], charges: 1 },
            { player: { x: 0.5, y: 0.5 }, enemies: [{ x: 0.1, y: 0.1 }], walls: [{ x1: 0, y1: 0.3, x2: 0.4, y2: 0.3 }, { x1: 0.6, y1: 0.3, x2: 1, y2: 0.3 }, { x1: 0, y1: 0.7, x2: 0.4, y2: 0.7 }, { x1: 0.6, y1: 0.7, x2: 1, y2: 0.7 }], charges: 1 },
            { player: { x: 0.1, y: 0.1 }, enemies: [{ x: 0.9, y: 0.9 }], walls: [{ x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.2 }, { x1: 0.2, y1: 0.2, x2: 0.2, y2: 0.8 }, { x1: 0.8, y1: 0.2, x2: 0.8, y2: 0.8 }, { x1: 0.2, y1: 0.8, x2: 0.7, y2: 0.8 }], charges: 1 },

            // Sectors 11-15: Geometric Gauntlet
            { player: { x: 0.5, y: 0.5 }, enemies: [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.9 }], walls: [{ x1: 0, y1: 0.3, x2: 0.45, y2: 0.3 }, { x1: 0.55, y1: 0.3, x2: 1, y2: 0.3 }, { x1: 0, y1: 0.7, x2: 0.45, y2: 0.7 }, { x1: 0.55, y1: 0.7, x2: 1, y2: 0.7 }], charges: 2 },
            { player: { x: 0.1, y: 0.5 }, enemies: [{ x: 0.9, y: 0.9 }], walls: [{ x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.8 }, { x1: 0.6, y1: 0.2, x2: 0.6, y2: 0.8 }], charges: 1 },
            { player: { x: 0.1, y: 0.1 }, enemies: [{ x: 0.9, y: 0.5 }], walls: [{ x1: 0, y1: 0.3, x2: 0.8, y2: 0.3 }, { x1: 0.2, y1: 0.6, x2: 1.0, y2: 0.6 }], charges: 1 },
            { player: { x: 0.5, y: 0.05 }, enemies: [{ x: 0.1, y: 0.95 }], walls: [{ x1: 0, y1: 0.4, x2: 0.45, y2: 0.4 }, { x1: 0.55, y1: 0.4, x2: 1, y2: 0.4 }, { x1: 0, y1: 0.6, x2: 0.45, y2: 0.6 }, { x1: 0.55, y1: 0.6, x2: 1, y2: 0.6 }], charges: 1 },
            { player: { x: 0.1, y: 0.5 }, enemies: [{ x: 0.9, y: 0.2 }], walls: [{ x1: 0.5, y1: 0, x2: 0.5, y2: 0.3 }, { x1: 0.5, y1: 0.7, x2: 0.5, y2: 1.0 }], charges: 1 },

            // Sectors 16-20: Grandmaster Trials
            { player: { x: 0.5, y: 0.5 }, enemies: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }], walls: [{ x1: 0.3, y1: 0, x2: 0.3, y2: 0.4 }, { x1: 0.3, y1: 0.6, x2: 0.3, y2: 1 }, { x1: 0.7, y1: 0, x2: 0.7, y2: 0.4 }, { x1: 0.7, y1: 0.6, x2: 0.7, y2: 1 }], charges: 1 },
            { player: { x: 0.05, y: 0.5 }, enemies: [{ x: 0.95, y: 0.5 }], walls: [{ x1: 0.3, y1: 0.2, x2: 0.3, y2: 0.8 }, { x1: 0.6, y1: 0.2, x2: 0.6, y2: 0.8 }], charges: 1 },
            { player: { x: 0.5, y: 0.1 }, enemies: [{ x: 0.2, y: 0.9 }], walls: [{ x1: 0, y1: 0.3, x2: 0.4, y2: 0.3 }, { x1: 0.6, y1: 0.3, x2: 1, y2: 0.3 }, { x1: 0, y1: 0.7, x2: 0.4, y2: 0.7 }, { x1: 0.6, y1: 0.7, x2: 1, y2: 0.7 }], charges: 1 },
            { player: { x: 0.1, y: 0.1 }, enemies: [{ x: 0.5, y: 0.5 }], walls: [{ x1: 0.4, y1: 0.2, x2: 0.6, y2: 0.2 }, { x1: 0.4, y1: 0.8, x2: 0.6, y2: 0.8 }, { x1: 0.2, y1: 0.4, x2: 0.2, y2: 0.6 }, { x1: 0.8, y1: 0.4, x2: 0.8, y2: 0.6 }], charges: 1 },
            { player: { x: 0.5, y: 0.45 }, enemies: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }, { x: 0.9, y: 0.9 }], walls: [{ x1: 0.3, y1: 0.3, x2: 0.45, y2: 0.45 }, { x1: 0.55, y1: 0.55, x2: 0.7, y2: 0.7 }, { x1: 0.3, y1: 0.7, x2: 0.45, y2: 0.55 }, { x1: 0.55, y1: 0.45, x2: 0.7, y2: 0.3 }], charges: 5 }
        ];
    }
}
window.onload = () => { new Game(); };
