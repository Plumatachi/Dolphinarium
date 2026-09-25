/* « Sauts périlleux » — flappy dauphin sous-marin : chaque impulsion = un tonneau 360°.
 * Canvas 2D vanilla, 100 % offline. Fonctions pures en tête (testables en Node),
 * jeu et DOM derrière `typeof document !== 'undefined'`.
 * Écrans : menu (Jouer/Options/Quitter) -> play -> over. Overlay focus dédié. */
const FlappyPure = (() => {
    const W = 480;
    const H = 640;
    const DOLPHIN_X = 120;
    const DOLPHIN_R = 16;
    const GRAVITY = 0.32;   // chute douce (fini le piquet vers le sol)
    const FLAP_VY = -7.0;
    const MAX_FALL = 7;
    const GATE_W = 72;
    const GATE_SPACING = 275;

    // Difficultés : Détente = lent + ouvertures larges + arches espacées,
    // Normal = référence, Rapide = vite + ouvertures étroites + arches resserrées.
    const DIFFICULTIES = {
        detente: { label: 'Détente', gap0: 205, gapMin: 165, speed0: 1.5, speedMax: 3.2, ramp: 0.05, spacing: 315 },
        normal:  { label: 'Normal',  gap0: 185, gapMin: 148, speed0: 1.9, speedMax: 4.0, ramp: 0.07, spacing: 275 },
        rapide:  { label: 'Rapide',  gap0: 165, gapMin: 132, speed0: 2.4, speedMax: 4.6, ramp: 0.09, spacing: 245 }
    };

    function gapFor(score, cfg) { return Math.max(cfg.gapMin, cfg.gap0 - score * 2); }
    function speedFor(score, cfg) { return Math.min(cfg.speedMax, cfg.speed0 + score * cfg.ramp); }

    function createState() {
        return { y: H / 2, vy: 0, roll: 0, score: 0, gates: [], frame: 0 };
    }

    function flap(state) {
        state.vy = FLAP_VY;
        state.roll = 1; // tonneau : 1 -> 0
    }

    function stepPhysics(state) {
        state.vy = Math.min(MAX_FALL, state.vy + GRAVITY);
        state.y += state.vy;
        if (state.roll > 0) state.roll = Math.max(0, state.roll - 1 / 28); // ~0,5 s à 60 ips
        state.frame++;
    }

    function spawnGate(state, gapY, cfg) {
        state.gates.push({ x: W + 40, gapY, gap: gapFor(state.score, cfg), counted: false, seed: state.frame });
    }

    function stepGates(state, speed) {
        state.gates.forEach(g => { g.x -= speed; });
        state.gates = state.gates.filter(g => g.x > -GATE_W - 20);
        state.gates.forEach(g => {
            if (!g.counted && g.x + GATE_W < DOLPHIN_X - DOLPHIN_R) {
                g.counted = true;
                state.score++;
            }
        });
    }

    function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
        const nx = Math.max(rx, Math.min(cx, rx + rw));
        const ny = Math.max(ry, Math.min(cy, ry + rh));
        const dx = cx - nx;
        const dy = cy - ny;
        return dx * dx + dy * dy < r * r;
    }

    function hitGate(state) {
        return state.gates.some(g => {
            const topH = g.gapY - g.gap / 2;
            const botY = g.gapY + g.gap / 2;
            return circleRectCollide(DOLPHIN_X, state.y, DOLPHIN_R - 3, g.x, -20, GATE_W, topH + 20)
                || circleRectCollide(DOLPHIN_X, state.y, DOLPHIN_R - 3, g.x, botY, GATE_W, H - botY + 20);
        });
    }

    function outOfBounds(state) {
        return state.y - DOLPHIN_R < 0 || state.y + DOLPHIN_R > H;
    }

    function seeded(n) {
        let x = (n * 9301 + 49297) % 233280;
        return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    }

    return { W, H, DOLPHIN_X, DOLPHIN_R, GRAVITY, FLAP_VY, GATE_W, GATE_SPACING, DIFFICULTIES,
        gapFor, speedFor, createState, flap, stepPhysics, spawnGate, stepGates,
        circleRectCollide, hitGate, outOfBounds, seeded };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlappyPure;
}

if (typeof document !== 'undefined') (() => {
    const P = FlappyPure;
    const GAME = 'Sauts périlleux';
    const OPTS_KEY = 'dolphinarium_flappy_opts_v1';

    const focusEl = document.getElementById('flappy-focus');
    const menuEl = document.getElementById('flappy-menu');
    const optionsEl = document.getElementById('flappy-options-panel');
    const canvas = document.getElementById('flappy-canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('flappy-score');
    const bestEl = document.getElementById('flappy-best');
    const hintEl = document.getElementById('flappy-hint');
    const overEl = document.getElementById('flappy-over');
    const overScoreEl = document.getElementById('flappy-over-score');
    const overBestEl = document.getElementById('flappy-over-best');
    const newRecordEl = document.getElementById('flappy-record');
    const muteBtn = document.getElementById('flappy-mute');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ----- Options persistées (son + difficulté, via storage.js : sûr en file://) ----- */
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

    let state = P.createState();
    let screen = 'menu'; // menu | play | over | pause — un seul écran visible à la fois
    let bubbles = [];
    let audioCtx = null;
    let audioGain = null;
    let best = (DolphinariumStorage.getBestGameScores()[GAME] || {}).score || 0;

    bestEl.textContent = 'Record : ' + best;
    syncOptionsUI();

    /* ----- Machine à écrans : un seul visible, les autres cachés (fini le menu fantôme) ----- */
    function showScreen(name) {
        screen = name;
        menuEl.hidden = name !== 'menu';
        overEl.hidden = name !== 'over';
        hintEl.hidden = name !== 'play';
        if (name === 'menu') document.getElementById('flappy-play-btn').focus();
        if (name === 'over') document.getElementById('flappy-restart').focus();
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

    function splash() {
        if (!audioCtx || opts.muted) return;
        const t = audioCtx.currentTime;
        const len = audioCtx.sampleRate * 0.3;
        const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const f = audioCtx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 900;
        const g = audioCtx.createGain();
        g.gain.value = 0.25;
        src.connect(f).connect(g).connect(audioGain);
        src.start(t);
    }

    /* ----- Rendu ----- */
    function drawBackground(frame) {
        const grad = ctx.createLinearGradient(0, 0, 0, P.H);
        grad.addColorStop(0, '#023e8a');
        grad.addColorStop(0.55, '#03045e');
        grad.addColorStop(1, '#010a24');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, P.W, P.H);
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#90e0ef';
        for (let i = 0; i < 3; i++) {
            const x = 90 + i * 140 + Math.sin(frame / 90 + i) * 12;
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 20, P.H); ctx.lineTo(x - 50, P.H);
            ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(2, 60, 90, 0.85)';
        for (let i = 0; i < 5; i++) {
            const x = ((i * 170 - frame * 0.7) % (P.W + 120) + P.W + 120) % (P.W + 120) - 60;
            const h = 90 + (i * 37) % 70;
            ctx.beginPath();
            ctx.ellipse(x, P.H + 10, 26, h, 0, Math.PI, 0);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(4, 90, 120, 0.9)';
        for (let i = 0; i < 4; i++) {
            const x = ((i * 230 + 80 - frame * 1.4) % (P.W + 140) + P.W + 140) % (P.W + 140) - 70;
            const h = 60 + (i * 53) % 50;
            ctx.beginPath();
            ctx.ellipse(x, P.H + 8, 20, h, 0, Math.PI, 0);
            ctx.fill();
        }
    }

    function drawBubbles() {
        ctx.strokeStyle = 'rgba(144, 224, 239, 0.5)';
        bubbles.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
    }

    function drawGate(g) {
        const topH = g.gapY - g.gap / 2;
        const botY = g.gapY + g.gap / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 180, 216, 0.9)';
        ctx.shadowBlur = reduceMotion ? 0 : 18;
        ctx.fillStyle = 'rgba(0, 180, 216, 0.75)';
        roundRect(g.x, -20, P.GATE_W, topH + 20, 12);
        roundRect(g.x, botY, P.GATE_W, P.H - botY + 20, 12);
        ctx.restore();
        const rnd = P.seeded(g.seed);
        ctx.fillStyle = 'rgba(202, 240, 248, 0.9)';
        for (let i = 0; i < 8; i++) {
            const onTop = rnd() < topH / P.H;
            const y = onTop ? rnd() * topH : botY + rnd() * (P.H - botY);
            ctx.beginPath();
            ctx.arc(g.x + 8 + rnd() * (P.GATE_W - 16), y, 2.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawDolphin() {
        const tilt = Math.max(-0.45, Math.min(0.6, state.vy / 14));
        const rollEase = state.roll > 0 ? (1 - Math.cos((1 - state.roll) * Math.PI * 2)) / 2 : 0;
        ctx.save();
        ctx.translate(P.DOLPHIN_X, state.y);
        ctx.rotate(tilt + rollEase * Math.PI * 2);
        ctx.fillStyle = '#90e0ef';
        ctx.beginPath();
        ctx.ellipse(0, 0, 27, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(26, -2, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0077b6';
        ctx.beginPath();
        ctx.moveTo(-4, -12); ctx.lineTo(-12, -30); ctx.lineTo(-20, -11);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-26, 0); ctx.lineTo(-42, -12); ctx.lineTo(-36, 0); ctx.lineTo(-42, 12);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, 12); ctx.lineTo(-8, 24); ctx.lineTo(-14, 12);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(14, -5, 4.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#03045e';
        ctx.beginPath(); ctx.arc(15, -5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    /* ----- Boucle ----- */
    function loop() {
        if (screen !== 'play') return;
        try {
            frame();
        } catch (err) {
            // Même garde-fou que la Nage : jamais de boucle morte.
            console.error('[flappy] frame ignorée :', err);
            screen = 'pause';
            hintEl.hidden = false;
            hintEl.textContent = '⏸️ Petit accroc — P pour reprendre';
            return;
        }
        requestAnimationFrame(loop);
    }

    function frame() {
        const before = state.score;
        P.stepPhysics(state);
        P.stepGates(state, P.speedFor(state.score, cfg()));
        if (state.score > before) { tone(900, 1320, 0.3, 0.14); scoreEl.textContent = state.score; }
        if (state.gates.length === 0 || state.gates[state.gates.length - 1].x < P.W - cfg().spacing) {
            P.spawnGate(state, 130 + Math.random() * (P.H - 260), cfg());
        }
        if (Math.random() < 0.25) {
            bubbles.push({ x: Math.random() * P.W, y: P.H + 8, r: 1.5 + Math.random() * 3, v: 1 + Math.random() * 1.5 });
        }
        if (P.hitGate(state) || P.outOfBounds(state)) return gameOver();
        bubbles.forEach(b => { b.y -= b.v; });
        bubbles = bubbles.filter(b => b.y > -12);
        ctx.clearRect(0, 0, P.W, P.H);
        drawBackground(state.frame);
        state.gates.forEach(drawGate);
        drawBubbles();
        drawDolphin();
    }

    function startGame() {
        ensureAudio();
        state = P.createState();
        bubbles = [];
        scoreEl.textContent = '0';
        P.spawnGate(state, P.H / 2, cfg());
        state.gates[0].x = P.W + 170; // délai de grâce : la 1re arche arrive doucement
        showScreen('play');
        requestAnimationFrame(loop);
    }

    function gameOver() {
        splash();
        const isRecord = state.score > best;
        if (state.score > 0 || best === 0) {
            DolphinariumStorage.saveGameScore({ game: GAME, score: state.score });
        }
        if (isRecord) {
            best = state.score;
            bestEl.textContent = 'Record : ' + best;
        }
        overScoreEl.textContent = state.score;
        overBestEl.textContent = 'Record : ' + best;
        newRecordEl.hidden = !isRecord || state.score === 0;
        showScreen('over');
    }

    function doFlap() {
        ensureAudio();
        if (screen === 'menu' || screen === 'over') startGame();
        if (screen !== 'play') return;
        P.flap(state);
        tone(420, 880, 0.12, 0.18);
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

    /* ----- Options ----- */
    function syncOptionsUI() {
        muteBtn.textContent = opts.muted ? '🔇 Son coupé' : '🔊 Son';
        muteBtn.setAttribute('aria-pressed', String(opts.muted));
        document.querySelectorAll('input[name="flappy-diff"]').forEach(r => {
            r.checked = r.value === opts.difficulty;
        });
        const muteOpt = document.getElementById('flappy-opt-sound');
        if (muteOpt) muteOpt.checked = !opts.muted;
    }

    function setMuted(m) {
        opts.muted = m;
        saveOpts();
        syncOptionsUI();
    }

    /* ----- Câblage ----- */
    document.getElementById('hub-flappy-play').addEventListener('click', openFocus);
    document.getElementById('flappy-play-btn').addEventListener('click', startGame);
    document.getElementById('flappy-quit-btn').addEventListener('click', closeFocus);
    document.getElementById('flappy-close').addEventListener('click', closeFocus);
    document.getElementById('flappy-options-btn').addEventListener('click', () => {
        optionsEl.hidden = !optionsEl.hidden;
    });
    document.getElementById('flappy-restart').addEventListener('click', startGame);
    document.getElementById('flappy-over-menu').addEventListener('click', () => showScreen('menu'));
    muteBtn.addEventListener('click', () => setMuted(!opts.muted));
    document.getElementById('flappy-opt-sound').addEventListener('change', (e) => setMuted(!e.target.checked));
    document.querySelectorAll('input[name="flappy-diff"]').forEach(r => {
        r.addEventListener('change', (e) => { opts.difficulty = e.target.value; saveOpts(); });
    });

    document.addEventListener('keydown', (e) => {
        if (focusEl.hidden) return;
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            if (document.activeElement && document.activeElement.tagName === 'BUTTON' && e.code === 'Space') return;
            e.preventDefault();
            doFlap();
        } else if (e.code === 'KeyP' && (screen === 'play' || screen === 'pause')) {
            if (screen === 'play') {
                screen = 'pause';
                hintEl.hidden = false;
                hintEl.textContent = '⏸️ Pause — P pour reprendre';
            } else {
                showScreen('play');
                requestAnimationFrame(loop);
            }
        } else if (e.code === 'KeyR' && (screen === 'play' || screen === 'over' || screen === 'pause')) {
            startGame();
        } else if (e.code === 'Escape') {
            closeFocus();
        }
    });

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        doFlap();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && screen === 'play') {
            screen = 'pause';
            hintEl.hidden = false;
            hintEl.textContent = '⏸️ Pause — P pour reprendre';
        }
    });

    showScreen('menu');
})();
