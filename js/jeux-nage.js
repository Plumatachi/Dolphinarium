/* « Descente abyssale » — nage libre dans une arène rocheuse (bandes haut/bas infranchissables).
 * Rochers/algues accrochés en haut ou en bas, coquilles qui tombent ou reposent au sol,
 * crabes sur les rochers du fond, ennemis orientés dans leur sens de nage.
 * Aucun obstacle ne peut boucher le passage (longueurs plafonnées).
 * Canvas 2D vanilla, 100 % offline. Fonctions pures en tête (testables en Node). */
const NagePure = (() => {
    // Arène paysage : 800x450, bandes de roche haut/bas, le dauphin nage entre les deux.
    const W = 800;
    const H = 450;
    const DOLPHIN_X = 150;
    const DOLPHIN_R = 15;

    const ROCK_H = 48;
    const PLAY_TOP = ROCK_H + 10;
    const PLAY_BOTTOM = H - ROCK_H - 10;
    const PLAY_H = PLAY_BOTTOM - PLAY_TOP;
    // Plafond absolu (mode Rapide) : même une paire haut+bas parfaitement alignée
    // laisse >= 90 px de couloir pour un dauphin de 30 px. Les modes doux réduisent
    // encore les tailles via lenRatio.
    const MAX_LEN = Math.floor(PLAY_H * 0.36);

    const DIFFICULTIES = {
        detente: { label: 'Détente', speed0: 1.6, speedMax: 3.0, ramp: 0.004, lives: 4, maxFoes: 4, lenRatio: 0.27, density: 1.45, foeMul: 0.9 },
        normal:  { label: 'Normal',  speed0: 2.0, speedMax: 3.8, ramp: 0.006, lives: 3, maxFoes: 6, lenRatio: 0.34, density: 1.0, foeMul: 1.0 },
        rapide:  { label: 'Rapide',  speed0: 2.5, speedMax: 4.6, ramp: 0.009, lives: 3, maxFoes: 8, lenRatio: 0.36, density: 0.8, foeMul: 1.15 }
    };

    function lenFor(cfg) { return Math.floor(PLAY_H * cfg.lenRatio); }

    // Cycle plongée/remontée : 0 -> 5000 m puis retour, en boucle.
    // À peine plus sombre à 500 m, nettement à 1000 m, abysses à 5000 m.
    const CYCLE = 5000;

    function depthFor(dist) {
        const phase = (dist * 0.45) % (2 * CYCLE);
        return phase < CYCLE ? phase : 2 * CYCLE - phase;
    }

    function stageFor(depth) {
        if (depth < 1000) return 0; // surface et pénombre haute
        if (depth < 3000) return 1; // zone minuit
        return 2;                   // abysses
    }

    function zoneFor(depth) {
        if (depth < 500) return 'Surface';
        if (depth < 1500) return 'Pénombre';
        if (depth < 3500) return 'Minuit';
        return 'Abysses';
    }

    // Dégradés lents : paliers [profondeur, haut, bas]. Interpolation linéaire entre paliers.
    const STOPS = [
        [0,    [2, 120, 200], [150, 220, 240]],
        [500,  [2, 112, 188], [135, 205, 228]],
        [1000, [2, 70, 140],  [60, 120, 170]],
        [2000, [2, 40, 110],  [10, 50, 110]],
        [3500, [1, 15, 50],   [2, 8, 30]],
        [5000, [0, 3, 10],    [0, 1, 4]]
    ];

    function mix(a, b, t) {
        return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
    }

    function stageBlend(depth) {
        const d = Math.max(0, Math.min(CYCLE, depth));
        let i = 0;
        while (i < STOPS.length - 2 && d > STOPS[i + 1][0]) i++;
        const [d0, top0, bot0] = STOPS[i];
        const [d1, top1, bot1] = STOPS[i + 1];
        const f = (d - d0) / (d1 - d0);
        return {
            top: mix(top0, top1, f),
            bot: mix(bot0, bot1, f),
            rays: Math.max(0, 1 - d / 1200),              // la lumière du jour meurt vite
            plankton: d > 1800 ? Math.min(1, (d - 1800) / 1200) : 0,
            halo: d > 3000 ? Math.min(1, (d - 3000) / 2000) : 0 // auréole des abysses
        };
    }

    function speedFor(dist, cfg) {
        return Math.min(cfg.speedMax, cfg.speed0 + dist * cfg.ramp / 60);
    }

    function obstacleEvery(depth, density) {
        return Math.max(30, (85 - depth * 0.12) * (density || 1));
    }

    function createState(lives) {
        return { y: (PLAY_TOP + PLAY_BOTTOM) / 2, vy: 0, dist: 0, depth: 0, prevDepth: 0,
            score: 0, lives, inv: 0, frame: 0, scroll: 0, obsTimer: 50, fishTimer: 90,
            foes: [], items: [], over: false };
    }

    function clampY(y) {
        return Math.max(PLAY_TOP + DOLPHIN_R, Math.min(PLAY_BOTTOM - DOLPHIN_R, y));
    }

    /* Rectangle de collision des obstacles accrochés (null = collision circulaire via f.r). */
    function obstacleRect(f) {
        if (f.kind === 'rock') {
            return f.side === 'top'
                ? { x: f.x - f.w / 2, y: 0, w: f.w, h: f.len }
                : { x: f.x - f.w / 2, y: H - f.len, w: f.w, h: f.len };
        }
        if (f.kind === 'algae') {
            const w = f.w + 8; // marge pour l'ondulation
            return f.side === 'top'
                ? { x: f.x - w / 2, y: 0, w, h: f.len }
                : { x: f.x - w / 2, y: H - f.len, w, h: f.len };
        }
        if (f.kind === 'crabrock') {
            return { x: f.x - 24, y: H - f.len, w: 48, h: f.len };
        }
        return null;
    }

    function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
        const nx = Math.max(rx, Math.min(cx, rx + rw));
        const ny = Math.max(ry, Math.min(cy, ry + rh));
        const dx = cx - nx;
        const dy = cy - ny;
        return dx * dx + dy * dy < r * r;
    }

    function step(state, input, cfg) {
        // Watchdog anti-softlock : une coordonnée corrompue (NaN) rendrait le dauphin
        // invisible ET les collisions impossibles (comparaisons toujours fausses).
        if (!Number.isFinite(state.y) || !Number.isFinite(state.vy)) {
            state.y = (PLAY_TOP + PLAY_BOTTOM) / 2;
            state.vy = 0;
        }
        if (input.pointerY !== null && input.pointerY !== undefined) {
            state.y += (input.pointerY - state.y) * 0.14;
            state.vy = (input.pointerY - state.y) * 0.05;
        } else {
            if (input.up) state.vy -= 0.55;
            if (input.down) state.vy += 0.55;
            state.vy *= 0.92;
            state.vy = Math.max(-7, Math.min(7, state.vy));
            state.y += state.vy;
        }
        state.y = clampY(state.y);

        const speed = speedFor(state.dist, cfg);
        state.dist += speed;
        state.scroll += speed;
        state.prevDepth = state.depth;
        state.depth = depthFor(state.dist);
        state.score += speed * 0.06;
        state.frame++;
        if (state.inv > 0) state.inv--;

        const events = { ate: 0, hit: false };

        // Cap d'ennemis à l'écran : lisibilité avant tout.
        if (--state.obsTimer <= 0) {
            state.obsTimer = obstacleEvery(state.depth, cfg.density);
            if (state.foes.length < cfg.maxFoes) spawnObstacle(state, cfg);
        }
        if (--state.fishTimer <= 0) {
            state.fishTimer = 150 + Math.random() * 80;
            spawnSchool(state);
        }
        if (state.depth > 80 && state.foes.length < cfg.maxFoes
            && Math.random() < 0.004 + state.depth * 0.00002) {
            spawnFoe(state);
        }

        state.foes.forEach(f => {
            f.x -= (speed * (f.fast ? 1.7 : 1) + (f.vx || 0)) * cfg.foeMul;
            f.y += (f.vy || 0);
            f.t += 0.08;
            if (f.sine) f.y = f.baseY + Math.sin(f.t) * f.sine;
            if (f.drift) f.y += f.drift;
            // Les coquilles qui tombent se posent au sol.
            if (f.fall && f.y >= H - ROCK_H - 11) {
                f.y = H - ROCK_H - 11;
                f.vy = 0;
                f.fall = false;
            }
            // Les nageurs restent dans l'arène (les accrochés ont y fixe).
            if (f.kind === 'jelly' || f.kind === 'barracuda') {
                f.y = Math.max(PLAY_TOP + 20, Math.min(PLAY_BOTTOM - 20, f.y));
            }
        });
        state.items.forEach(it => { it.x -= speed; it.t += 0.1; });
        state.foes = state.foes.filter(f => f.x > -70);
        state.items = state.items.filter(it => it.x > -30);

        state.items = state.items.filter(it => {
            const dx = it.x - DOLPHIN_X;
            const dy = it.y - state.y;
            if (dx * dx + dy * dy < (DOLPHIN_R + 10) * (DOLPHIN_R + 10)) {
                state.score += 10;
                events.ate++;
                return false;
            }
            return true;
        });

        if (state.inv <= 0) {
            const hit = state.foes.some(f => {
                const rect = obstacleRect(f);
                if (rect) {
                    return circleRectCollide(DOLPHIN_X, state.y, DOLPHIN_R - 3,
                        rect.x, rect.y, rect.w, rect.h);
                }
                const dx = f.x - DOLPHIN_X;
                const dy = f.y - state.y;
                const rr = DOLPHIN_R + (f.r || 14) - 6;
                return dx * dx + dy * dy < rr * rr;
            });
            if (hit) {
                state.lives--;
                state.inv = 100;
                events.hit = true;
                if (state.lives <= 0) state.over = true;
            }
        }
        return events;
    }

    function randSide() {
        return Math.random() < 0.5 ? 'top' : 'bottom';
    }

    function spawnObstacle(state, cfg) {
        const kind = pickWeighted([['rock', 0.32], ['algae', 0.3], ['shell', 0.18], ['crabrock', 0.2]]);
        const x = W + 50;
        const cap = lenFor(cfg || DIFFICULTIES.normal);
        if (kind === 'rock') {
            const len = 60 + Math.random() * Math.max(10, cap - 60);
            state.foes.push({ kind, side: randSide(), x, len, w: 26 + Math.random() * 18,
                t: Math.random() * 6, baseY: 0 });
        } else if (kind === 'algae') {
            const len = 50 + Math.random() * Math.max(10, cap - 50);
            state.foes.push({ kind, side: randSide(), x, len, w: 10 + Math.random() * 5,
                t: Math.random() * 6, baseY: 0 });
        } else if (kind === 'shell') {
            if (Math.random() < 0.5) {
                // Tombe lentement depuis le haut.
                state.foes.push({ kind, x, y: -20, vy: 0.5 + Math.random() * 0.4,
                    fall: true, r: 13, t: Math.random() * 6 });
            } else {
                // Repose au sol.
                state.foes.push({ kind, x, y: H - ROCK_H - 11, vy: 0,
                    fall: false, r: 13, t: Math.random() * 6 });
            }
        } else {
            // Crabe perché sur un rocher du fond (rect couvre rocher + crabe).
            state.foes.push({ kind, side: 'bottom', x, len: ROCK_H + 34, t: Math.random() * 6, baseY: 0 });
        }
    }

    function spawnSchool(state) {
        const y = PLAY_TOP + 40 + Math.random() * (PLAY_BOTTOM - PLAY_TOP - 80);
        for (let i = 0; i < 4; i++) {
            state.items.push({ x: W + 40 + i * 34, y: y + (i % 2) * 22 - 11, t: Math.random() * 6 });
        }
    }

    function spawnFoe(state) {
        const jelly = Math.random() < 0.45;
        const y = PLAY_TOP + 30 + Math.random() * (PLAY_BOTTOM - PLAY_TOP - 60);
        if (jelly) {
            state.foes.push({ kind: 'jelly', x: W + 50, y, baseY: y, t: 0, r: 15, sine: 14, drift: 0.25, vx: 0 });
        } else {
            state.foes.push({ kind: 'barracuda', x: W + 50, y, baseY: y, t: 0, r: 15, sine: 20, fast: true, vx: 0.6 });
        }
    }

    function pickWeighted(pairs) {
        let roll = Math.random();
        for (const [kind, w] of pairs) {
            roll -= w;
            if (roll <= 0) return kind;
        }
        return pairs[0][0];
    }

    function seeded(n) {
        let x = (n * 9301 + 49297) % 233280;
        return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    }

    return { W, H, DOLPHIN_X, DOLPHIN_R, ROCK_H, PLAY_TOP, PLAY_BOTTOM, PLAY_H, MAX_LEN, CYCLE,
        DIFFICULTIES, lenFor, stageFor, zoneFor, depthFor, stageBlend, speedFor, obstacleEvery, createState, clampY, obstacleRect,
        circleRectCollide, step, spawnObstacle, spawnSchool, spawnFoe, seeded };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NagePure;
}

if (typeof document !== 'undefined') (() => {
    const P = NagePure;
    const GAME = 'Descente abyssale';
    const OPTS_KEY = 'dolphinarium_nage_opts_v1';

    const focusEl = document.getElementById('nage-focus');
    const menuEl = document.getElementById('nage-menu');
    const optionsEl = document.getElementById('nage-options-panel');
    const canvas = document.getElementById('nage-canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('nage-score');
    const bestEl = document.getElementById('nage-best');
    const depthEl = document.getElementById('nage-depth');
    const zoneEl = document.getElementById('nage-zone');
    const livesEl = document.getElementById('nage-lives');
    const hintEl = document.getElementById('nage-hint');
    const overEl = document.getElementById('nage-over');
    const overScoreEl = document.getElementById('nage-over-score');
    const overBestEl = document.getElementById('nage-over-best');
    const newRecordEl = document.getElementById('nage-record');
    const muteBtn = document.getElementById('nage-mute');

    let opts = { muted: false, difficulty: 'normal' };
    try {
        const raw = DolphinariumStorage.getItem(OPTS_KEY);
        if (raw) opts = Object.assign(opts, JSON.parse(raw));
        if (!P.DIFFICULTIES[opts.difficulty]) opts.difficulty = 'normal';
    } catch { /* défauts */ }
    function saveOpts() {
        DolphinariumStorage.setItem(OPTS_KEY, JSON.stringify(opts));
    }
    function cfg() { return P.DIFFICULTIES[opts.difficulty]; }

    let state = P.createState(cfg().lives);
    let screen = 'menu'; // menu | play | over | pause
    let input = { up: false, down: false, pointerY: null, pointerOn: false };
    let audioCtx = null;
    let audioGain = null;
    let best = (DolphinariumStorage.getBestGameScores()[GAME] || {}).score || 0;

    bestEl.textContent = 'Record : ' + best;
    syncOptionsUI();

    function showScreen(name) {
        screen = name;
        menuEl.hidden = name !== 'menu';
        overEl.hidden = name !== 'over';
        hintEl.hidden = name !== 'play';
        if (name === 'menu') document.getElementById('nage-play-btn').focus();
        if (name === 'over') document.getElementById('nage-restart').focus();
        if (name === 'play') canvas.focus();
    }

    /* ----- Audio procédural ----- */
    function ensureAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioGain = audioCtx.createGain();
            audioGain.gain.value = 0.5;
            audioGain.connect(audioCtx.destination);
        } else if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function tone(f0, f1, dur, vol) {
        if (!audioCtx || opts.muted) return;
        const t = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
        o.connect(g).connect(audioGain);
        o.start(t); o.stop(t + dur + 0.06);
    }

    function thud() {
        if (!audioCtx || opts.muted) return;
        const t = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.2);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g).connect(audioGain);
        o.start(t); o.stop(t + 0.26);
    }

    /* ----- Rendu (dégradés lents via P.stageBlend) ----- */
    function drawBackground(colors, frame, scroll) {
        const grad = ctx.createLinearGradient(0, 0, 0, P.H);
        grad.addColorStop(0, 'rgb(' + colors.top.join(',') + ')');
        grad.addColorStop(1, 'rgb(' + colors.bot.join(',') + ')');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, P.W, P.H);
        ctx.save();
        ctx.globalAlpha = 0.07 * colors.rays;
        ctx.fillStyle = '#caf0f8';
        for (let i = 0; i < 3; i++) {
            const x = 90 + i * 140 + Math.sin(frame / 90 + i) * 12;
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 20, P.H); ctx.lineTo(x - 50, P.H);
            ctx.fill();
        }
        ctx.restore();
        if (colors.plankton > 0) {
            ctx.fillStyle = 'rgba(144, 224, 239,' + (0.5 * colors.plankton).toFixed(2) + ')';
            for (let i = 0; i < 14; i++) {
                const x = (i * 173 + frame * 0.4) % P.W;
                const y = (i * 211 + frame * 0.2) % P.H;
                ctx.beginPath();
                ctx.arc(x, y, 1.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        drawRockBands(scroll);
    }

    /* Auréole de lumière autour du dauphin dans les grandes profondeurs. */
    function drawHalo(amount) {
        if (amount <= 0) return;
        const g = ctx.createRadialGradient(P.DOLPHIN_X, state.y, 10, P.DOLPHIN_X, state.y, 170);
        g.addColorStop(0, 'rgba(144, 224, 239,' + (0.28 * amount).toFixed(2) + ')');
        g.addColorStop(1, 'rgba(144, 224, 239, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, P.W, P.H);
    }

    /* Bandes de roche haut/bas : base grise, arête claire, mouchetis qui défile. */
    function drawRockBands(scroll) {
        const band = (y0, h, flip) => {
            const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
            if (!flip) { g.addColorStop(0, '#3c414c'); g.addColorStop(1, '#5a606c'); }
            else { g.addColorStop(0, '#5a606c'); g.addColorStop(1, '#3c414c'); }
            ctx.fillStyle = g;
            ctx.fillRect(0, y0, P.W, h);
            // Arête côté arène.
            ctx.fillStyle = '#7d8492';
            ctx.fillRect(0, flip ? y0 : y0 + h - 4, P.W, 4);
            // Mouchetis défilant.
            const rnd = P.seeded(7);
            const dots = [];
            for (let i = 0; i < 26; i++) dots.push([rnd() * P.W, rnd() * (h - 10) + 5]);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            dots.forEach(([dx, dy]) => {
                const x = ((dx - scroll) % P.W + P.W) % P.W;
                ctx.beginPath();
                ctx.arc(x, y0 + dy, 2.2, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            dots.forEach(([dx, dy]) => {
                const x = ((dx + 40 - scroll) % P.W + P.W) % P.W;
                ctx.beginPath();
                ctx.arc(x, y0 + dy, 1.3, 0, Math.PI * 2);
                ctx.fill();
            });
        };
        band(0, P.ROCK_H, false);
        band(P.H - P.ROCK_H, P.ROCK_H, true);
    }

    /* Vrai dauphin de profil : dos bombé, rostre, dorsale, caudale, ventre clair, sourire. */
    function drawDolphin(y, tilt) {
        ctx.save();
        ctx.translate(P.DOLPHIN_X, y);
        ctx.rotate(tilt);
        if (state.inv > 0 && Math.floor(state.frame / 6) % 2 === 0) ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#dff3fa';
        ctx.beginPath();
        ctx.moveTo(34, -1);
        ctx.quadraticCurveTo(10, 13, -24, 9);
        ctx.quadraticCurveTo(-32, 8, -34, 4);
        ctx.quadraticCurveTo(-10, 14, 34, -1);
        ctx.fill();
        ctx.fillStyle = '#3a86c8';
        ctx.beginPath();
        ctx.moveTo(36, -2);
        ctx.quadraticCurveTo(28, -10, 12, -12);
        ctx.quadraticCurveTo(-10, -15, -26, -8);
        ctx.quadraticCurveTo(-33, -5, -35, 0);
        ctx.quadraticCurveTo(-15, 6, 8, 5);
        ctx.quadraticCurveTo(24, 4, 36, -2);
        ctx.fill();
        ctx.fillStyle = '#2a6aa0';
        ctx.beginPath();
        ctx.moveTo(-2, -12);
        ctx.quadraticCurveTo(-8, -30, -18, -33);
        ctx.quadraticCurveTo(-14, -22, -16, -11);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(4, 6);
        ctx.quadraticCurveTo(-4, 18, -14, 20);
        ctx.quadraticCurveTo(-8, 10, -2, 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a6aa0';
        ctx.beginPath();
        ctx.moveTo(-34, -1);
        ctx.quadraticCurveTo(-46, -12, -54, -12);
        ctx.quadraticCurveTo(-48, -4, -44, 0);
        ctx.quadraticCurveTo(-48, 4, -54, 12);
        ctx.quadraticCurveTo(-46, 12, -34, 1);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(20, -5, 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#062a44';
        ctx.beginPath(); ctx.arc(21, -5, 1.7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#062a44';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(24, 0); ctx.quadraticCurveTo(30, 1, 35, -2);
        ctx.stroke();
        ctx.restore();
    }

    function drawFoe(f) {
        ctx.save();
        // Les accrochés n'ont pas de y : on les ancre à leur bande (haut / bas / sol).
        // Sans ça, translate(x, undefined) est ignoré et tout s'empile à l'origine.
        const anchorY = (f.kind === 'rock' || f.kind === 'algae')
            ? (f.side === 'top' ? 0 : P.H)
            : (f.kind === 'crabrock' ? P.H - P.ROCK_H : f.y);
        ctx.translate(f.x, anchorY);
        if (f.kind === 'rock') {
            // Stalactite (haut) ou stalagmite (bas) ancrée dans la bande.
            const dir = f.side === 'top' ? 1 : -1;
            const w = f.w / 2;
            ctx.fillStyle = '#4a505c';
            ctx.beginPath();
            if (dir === 1) {
                ctx.moveTo(-w, 0); ctx.lineTo(w, 0);
                ctx.quadraticCurveTo(w * 0.7, f.len * 0.7, 0, f.len);
                ctx.quadraticCurveTo(-w * 0.7, f.len * 0.7, -w, 0);
            } else {
                ctx.moveTo(-w, 0); ctx.lineTo(w, 0);
                ctx.quadraticCurveTo(w * 0.7, -f.len * 0.7, 0, -f.len);
                ctx.quadraticCurveTo(-w * 0.7, -f.len * 0.7, -w, 0);
            }
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.ellipse(-w * 0.3, dir * f.len * 0.35, w * 0.28, f.len * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (f.kind === 'crabrock') {
            // Rocher du fond, crabe perché dessus.
            ctx.fillStyle = '#4a505c';
            ctx.beginPath(); ctx.ellipse(0, 12, 26, 15, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath(); ctx.ellipse(-6, 6, 9, 5, -0.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e26d5a';
            ctx.beginPath(); ctx.ellipse(0, -8, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#e26d5a'; ctx.lineWidth = 2;
            [-1, 1].forEach(s => {
                ctx.beginPath(); ctx.moveTo(s * 8, -10); ctx.lineTo(s * 18, -18); ctx.stroke();
                ctx.beginPath(); ctx.arc(s * 19, -19, 3, 0, Math.PI * 2); ctx.fill();
                for (let l = 0; l < 3; l++) {
                    ctx.beginPath(); ctx.moveTo(s * 8, -4 + l * 4); ctx.lineTo(s * 16, -2 + l * 4); ctx.stroke();
                }
            });
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-3, -12, 2, 0, Math.PI * 2); ctx.arc(3, -12, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.arc(-3, -12, 1, 0, Math.PI * 2); ctx.arc(3, -12, 1, 0, Math.PI * 2); ctx.fill();
        } else if (f.kind === 'algae') {
            // Touffe ancrée en haut ou en bas, brins ondulants.
            const dir = f.side === 'top' ? 1 : -1;
            ctx.strokeStyle = '#2e8b57';
            ctx.lineCap = 'round';
            for (let b = -1; b <= 1; b++) {
                ctx.lineWidth = b === 0 ? 7 : 5;
                ctx.beginPath();
                ctx.moveTo(b * 8, 0);
                ctx.quadraticCurveTo(
                    b * 8 + Math.sin(f.t + b) * 12, dir * f.len * 0.5,
                    b * 6 + Math.sin(f.t + b + 1) * 10, dir * (f.len - 6));
                ctx.stroke();
            }
            ctx.fillStyle = '#3aa56b';
            ctx.beginPath(); ctx.arc(0, dir * (f.len - 4), 4, 0, Math.PI * 2); ctx.fill();
        } else if (f.kind === 'shell') {
            ctx.fillStyle = '#d9a5b3';
            ctx.beginPath();
            ctx.moveTo(0, 12);
            ctx.quadraticCurveTo(-16, 4, -13, -10);
            ctx.quadraticCurveTo(0, -16, 13, -10);
            ctx.quadraticCurveTo(16, 4, 0, 12);
            ctx.fill();
            ctx.strokeStyle = '#a86a7c'; ctx.lineWidth = 1.6;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(i * 6, -11); ctx.stroke();
            }
        } else if (f.kind === 'jelly') {
            ctx.fillStyle = 'rgba(230, 170, 220, 0.75)';
            ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = 'rgba(230, 170, 220, 0.7)'; ctx.lineWidth = 2;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 5, 0);
                ctx.quadraticCurveTo(i * 5 + Math.sin(f.t + i) * 5, 14, i * 5, 26);
                ctx.stroke();
            }
        } else if (f.kind === 'barracuda') {
            // Orienté vers la gauche = son sens de nage.
            ctx.scale(-1, 1);
            ctx.fillStyle = '#7a8b99';
            ctx.beginPath();
            ctx.ellipse(0, 0, 26, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-24, 0); ctx.lineTo(-36, -9); ctx.lineTo(-36, 9);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(14, -2, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.arc(14, -2, 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    function drawFish(it) {
        ctx.save();
        ctx.translate(it.x, it.y + Math.sin(it.t) * 3);
        ctx.scale(-1, 1); // nage vers la gauche comme tout le décor
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-16, -5); ctx.lineTo(-16, 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(4, -1, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    /* ----- Boucle : TOUTE la frame est protégée (physique + rendu).
     * Sans ça, une exception en dessin fige le canvas à mi-frame (fond sans dauphin). ----- */
    function loop() {
        if (screen !== 'play') return;
        let ev;
        try {
            ev = P.step(state, input, cfg());
            if (ev.ate > 0) tone(700, 1400, 0.15, 0.16);
            if (ev.hit) {
                thud();
                livesEl.textContent = '❤️'.repeat(Math.max(0, state.lives)) + '🤍'.repeat(Math.max(0, cfg().lives - state.lives));
            }
            if (state.over) return gameOver();
            scoreEl.textContent = Math.floor(state.score);
            const goingDown = state.depth >= (state.prevDepth || 0);
            depthEl.textContent = Math.floor(state.depth) + ' m ' + (goingDown ? '↓' : '↑');
            zoneEl.textContent = P.zoneFor(state.depth);
            const colors = P.stageBlend(state.depth);
            ctx.clearRect(0, 0, P.W, P.H);
            drawBackground(colors, state.frame, state.scroll);
            state.items.forEach(drawFish);
            state.foes.forEach(drawFoe);
            drawDolphin(state.y, Math.max(-0.4, Math.min(0.4, state.vy * 0.04)));
            drawHalo(colors.halo);
        } catch (err) {
            // Jamais de boucle morte : on bascule en pause explicite plutôt que de figer.
            console.error('[nage] frame ignorée :', err);
            screen = 'pause';
            hintEl.hidden = false;
            hintEl.textContent = '⏸️ Petit accroc — P pour reprendre';
            return;
        }
        requestAnimationFrame(loop);
    }

    function startGame() {
        ensureAudio();
        state = P.createState(cfg().lives);
        input.pointerY = null;
        scoreEl.textContent = '0';
        depthEl.textContent = '0 m ↓';
        zoneEl.textContent = 'Surface';
        livesEl.textContent = '❤️'.repeat(cfg().lives);
        showScreen('play');
        requestAnimationFrame(loop);
    }

    function gameOver() {
        tone(300, 90, 0.5, 0.2);
        const final = Math.floor(state.score);
        const isRecord = final > best;
        if (final > 0 || best === 0) {
            DolphinariumStorage.saveGameScore({ game: GAME, score: final });
        }
        if (isRecord) {
            best = final;
            bestEl.textContent = 'Record : ' + best;
        }
        overScoreEl.textContent = final;
        overBestEl.textContent = 'Record : ' + best;
        newRecordEl.hidden = !isRecord || final === 0;
        showScreen('over');
    }

    function openFocus() {
        focusEl.hidden = false;
        document.body.style.overflow = 'hidden';
        showScreen('menu');
    }

    function closeFocus() {
        screen = 'menu';
        focusEl.hidden = true;
        document.body.style.overflow = '';
    }

    function showScreen(name) {
        screen = name;
        menuEl.hidden = name !== 'menu';
        overEl.hidden = name !== 'over';
        hintEl.hidden = name !== 'play';
        if (name === 'menu') document.getElementById('nage-play-btn').focus();
        if (name === 'over') document.getElementById('nage-restart').focus();
        if (name === 'play') canvas.focus();
    }

    /* ----- Options ----- */
    function syncOptionsUI() {
        muteBtn.textContent = opts.muted ? '🔇 Son coupé' : '🔊 Son';
        muteBtn.setAttribute('aria-pressed', String(opts.muted));
        document.querySelectorAll('input[name="nage-diff"]').forEach(r => {
            r.checked = r.value === opts.difficulty;
        });
        const muteOpt = document.getElementById('nage-opt-sound');
        if (muteOpt) muteOpt.checked = !opts.muted;
    }

    /* ----- Câblage ----- */
    document.getElementById('hub-nage-play').addEventListener('click', openFocus);
    document.getElementById('nage-play-btn').addEventListener('click', startGame);
    document.getElementById('nage-quit-btn').addEventListener('click', closeFocus);
    document.getElementById('nage-close').addEventListener('click', closeFocus);
    document.getElementById('nage-options-btn').addEventListener('click', () => {
        optionsEl.hidden = !optionsEl.hidden;
    });
    document.getElementById('nage-restart').addEventListener('click', startGame);
    document.getElementById('nage-over-menu').addEventListener('click', () => showScreen('menu'));
    muteBtn.addEventListener('click', () => {
        opts.muted = !opts.muted; saveOpts(); syncOptionsUI();
    });
    document.getElementById('nage-opt-sound').addEventListener('change', (e) => {
        opts.muted = !e.target.checked; saveOpts(); syncOptionsUI();
    });
    document.querySelectorAll('input[name="nage-diff"]').forEach(r => {
        r.addEventListener('change', (e) => { opts.difficulty = e.target.value; saveOpts(); });
    });

    document.addEventListener('keydown', (e) => {
        if (focusEl.hidden) return;
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            e.preventDefault();
            if (screen === 'menu' || screen === 'over') startGame();
            if (screen !== 'play') return;
            input.up = e.code === 'ArrowUp';
            input.down = e.code === 'ArrowDown';
            input.pointerY = null;
        } else if (e.code === 'Space' && screen === 'menu') {
            if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
            e.preventDefault();
            startGame();
        } else if (e.code === 'KeyP' && (screen === 'play' || screen === 'pause')) {
            if (screen === 'play') {
                screen = 'pause';
                hintEl.hidden = false;
                hintEl.textContent = '⏸️ Pause — P pour reprendre';
            } else {
                showScreen('play');
                requestAnimationFrame(loop);
            }
        } else if (e.code === 'KeyR' && screen !== 'menu') {
            startGame();
        } else if (e.code === 'Escape') {
            closeFocus();
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowUp') input.up = false;
        if (e.code === 'ArrowDown') input.down = false;
    });

    function pointerToY(e) {
        const rect = canvas.getBoundingClientRect();
        if (!rect || !Number.isFinite(e.clientY) || !(rect.height > 0)) return null;
        const y = (e.clientY - rect.top) / rect.height * P.H;
        if (!Number.isFinite(y)) return null;
        return Math.max(P.PLAY_TOP, Math.min(P.PLAY_BOTTOM, y));
    }

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        ensureAudio();
        if (screen === 'menu' || screen === 'over') startGame();
        if (screen !== 'play') return;
        input.pointerOn = true;
        const y = pointerToY(e);
        if (y !== null) input.pointerY = y;
        if (canvas.setPointerCapture && e.pointerId !== undefined) {
            try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
        }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (screen === 'play' && (input.pointerOn || e.pointerType === 'mouse')) {
            const y = pointerToY(e);
            if (y !== null) input.pointerY = y;
        }
    });
    // Relâchement : on oublie la cible (pas de suivi fantôme) et on stabilise.
    const endPointer = () => { input.pointerOn = false; input.pointerY = null; state.vy = 0; };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && screen === 'play') {
            screen = 'pause';
            hintEl.hidden = false;
            hintEl.textContent = '⏸️ Pause — P pour reprendre';
        }
    });

    showScreen('menu');
})();
