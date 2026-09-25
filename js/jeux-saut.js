/* « Concours de sauts » — 5 manches contre 3 dauphins IA progressifs.
 * Mix décidé : (1) maintenir pour charger la plongée + (3) relâcher dans la
 * zone verte du courant porteur (timing). Hauteur = charge x timing.
 * Canvas 2D vanilla, 100 % offline. Fonctions pures en tête (testables en Node). */
const SautPure = (() => {
    const W = 800;
    const H = 450;
    const WATER_Y = 330;      // ligne d'eau
    const PX_PER_M = 26;      // échelle : ~10,5 m max -> 273 px au-dessus de l'eau
    const GRAVITY = 0.35;
    const ROUNDS = 5;

    const RIVALS = [
        { name: 'Éclair', skill: 0.9 },
        { name: 'Ondine', skill: 0.5 },
        { name: 'Neptune', skill: 0.1 }
    ];

    const DIFFICULTIES = {
        // gaugeSpeed : allers-retours du curseur par seconde (calme, zone visable).
        // aiBonus : niveau des IA.
        detente: { label: 'Détente', gaugeSpeed: 0.45, aiBonus: -0.6, zone: 0.22 },
        normal:  { label: 'Normal',  gaugeSpeed: 0.7, aiBonus: 0,     zone: 0.18 },
        rapide:  { label: 'Rapide',  gaugeSpeed: 1.0, aiBonus: 0.7,   zone: 0.12 }
    };

    // Zone verte du courant porteur : centrée, largeur selon difficulté.
    function bonusZone(round, cfg) {
        const w = cfg.zone;
        const center = 0.5 + 0.12 * Math.sin(round * 1.7); // se déplace à chaque manche
        return { z0: center - w / 2, z1: center + w / 2 };
    }

    function timingBonus(cursor, zone) {
        return (cursor >= zone.z0 && cursor <= zone.z1) ? 1.3 : 1.0;
    }

    // Hauteur du joueur (mètres) : charge 0..1 x bonus timing + pointe de hasard.
    function playerHeight(charge, bonus, rand) {
        return 2 + charge * 6 * bonus + rand * 0.5;
    }

    // IA : de plus en plus hautes à chaque manche (progressif).
    function aiHeight(round, skill, aiBonus, rand) {
        return 3.2 + round * 0.85 + skill * 1.2 + aiBonus + rand * 1.2;
    }

    // Classement d'une manche : [{ name, h, player }] trié décroissant.
    function rankRound(entries) {
        return entries.slice().sort((a, b) => b.h - a.h);
    }

    // Points par manche selon le rang : 4/3/2/1. Totaux cumulés.
    function roundPoints(rankIndex) {
        return [4, 3, 2, 1][rankIndex] || 0;
    }

    // Arc balistique correspondant à une hauteur en mètres (pour l'animation).
    function arcFor(meters) {
        const apexPx = Math.min(meters * PX_PER_M, WATER_Y - 30);
        return { vy0: -Math.sqrt(2 * GRAVITY * apexPx), apexPx };
    }

    return { W, H, WATER_Y, PX_PER_M, GRAVITY, ROUNDS, RIVALS, DIFFICULTIES,
        bonusZone, timingBonus, playerHeight, aiHeight, rankRound, roundPoints, arcFor };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SautPure;
}

if (typeof document !== 'undefined') (() => {
    const P = SautPure;
    const GAME = 'Concours de sauts';
    const OPTS_KEY = 'dolphinarium_saut_opts_v1';

    const focusEl = document.getElementById('saut-focus');
    const menuEl = document.getElementById('saut-menu');
    const optionsEl = document.getElementById('saut-options-panel');
    const canvas = document.getElementById('saut-canvas');
    const ctx = canvas.getContext('2d');
    const roundEl = document.getElementById('saut-round');
    const bestEl = document.getElementById('saut-best');
    const promptEl = document.getElementById('saut-prompt');
    const chargeWrap = document.getElementById('saut-charge-wrap');
    const chargeFill = document.getElementById('saut-charge-fill');
    const cursorEl = document.getElementById('saut-cursor');
    const zoneEl = document.getElementById('saut-zone');
    const boardEl = document.getElementById('saut-board');
    const overEl = document.getElementById('saut-over');
    const overTableEl = document.getElementById('saut-over-table');
    const overBestEl = document.getElementById('saut-over-best');
    const newRecordEl = document.getElementById('saut-record');
    const muteBtn = document.getElementById('saut-mute');

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

    let screen = 'menu'; // menu | ai | charge | fly | over
    let round = 1;
    let totals = {};      // { name: mètres cumulés }
    let history = [];     // [{ round, ranked: [{name,h,player}] }]
    let charge = 0;
    let charging = false;
    let chargeT = 0;
    let fly = null;       // { x, y, vx, vy, name, player, h } ou null
    let aiQueue = [];
    let aiTimer = 0;
    let particles = [];
    let audioCtx = null;
    let audioGain = null;
    let best = (DolphinariumStorage.getBestGameScores()[GAME] || {}).score || 0;

    bestEl.textContent = 'Record : ' + best + ' m';
    syncOptionsUI();

    function showScreen(name) {
        screen = name;
        menuEl.hidden = name !== 'menu';
        overEl.hidden = name !== 'over';
        chargeWrap.hidden = !(name === 'charge');
        promptEl.hidden = !(name === 'ai' || name === 'charge' || name === 'fly');
        if (name === 'menu') document.getElementById('saut-play-btn').focus();
        if (name === 'over') document.getElementById('saut-restart').focus();
        if (name === 'charge' || name === 'fly') canvas.focus();
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

    function splashSound(big) {
        if (!audioCtx || opts.muted) return;
        const t = audioCtx.currentTime;
        const len = audioCtx.sampleRate * (big ? 0.4 : 0.2);
        const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const f = audioCtx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = big ? 1400 : 900;
        const g = audioCtx.createGain();
        g.gain.value = big ? 0.3 : 0.18;
        src.connect(f).connect(g).connect(audioGain);
        src.start(t);
    }

    function splash(x, n) {
        for (let i = 0; i < n; i++) {
            particles.push({ x: x + (Math.random() - 0.5) * 30, y: P.WATER_Y,
                vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 4 - 1,
                r: 2 + Math.random() * 3, life: 40 + Math.random() * 20 });
        }
    }

    /* ----- Déroulement ----- */
    function startMatch() {
        ensureAudio();
        round = 1;
        totals = { 'Vous': 0 };
        P.RIVALS.forEach(r => { totals[r.name] = 0; });
        history = [];
        particles = [];
        startRound();
    }

    function startRound() {
        roundEl.textContent = 'Manche ' + round + ' / ' + P.ROUNDS;
        renderBoard(null);
        // Les 3 rivaux sautent en premier, l'un après l'autre.
        aiQueue = P.RIVALS.map(r => ({
            name: r.name,
            h: P.aiHeight(round, r.skill, cfg().aiBonus, Math.random())
        }));
        aiTimer = 0;
        fly = null;
        showScreen('ai');
        promptEl.textContent = 'Manche ' + round + ' — les rivaux s\u2019élancent…';
    }

    function launchAi(entry, x) {
        const arc = P.arcFor(entry.h);
        fly = { x, y: P.WATER_Y, vx: 2.0, vy: arc.vy0, name: entry.name, player: false, h: entry.h };
        tone(500, 1000, 0.2, 0.15);
    }

    function beginCharge() {
        charge = 0;
        charging = false;
        chargeT = 0;
        fly = null;
        showScreen('charge');
        promptEl.textContent = 'À vous ! Maintenez pour plonger, relâchez dans le vert !';
        positionZone();
    }

    function positionZone() {
        const zone = P.bonusZone(round, cfg());
        zoneEl.style.left = (zone.z0 * 100) + '%';
        zoneEl.style.width = ((zone.z1 - zone.z0) * 100) + '%';
    }

    function cursorPos(t) {
        // Balayage 0 -> 1 -> 0 à la vitesse de la difficulté.
        const ph = (t * cfg().gaugeSpeed) % 2;
        return ph < 1 ? ph : 2 - ph;
    }

    function releaseJump() {
        if (screen !== 'charge' || !charging) return;
        charging = false;
        const cursor = cursorPos(chargeT);
        const zone = P.bonusZone(round, cfg());
        const bonus = P.timingBonus(cursor, zone);
        const h = P.playerHeight(charge, bonus, Math.random());
        const arc = P.arcFor(h);
        fly = { x: 150, y: P.WATER_Y, vx: 2.4, vy: arc.vy0, name: 'Vous', player: true, h };
        if (bonus > 1) {
            promptEl.textContent = '⚡ Courant porteur ! +' + h.toFixed(1) + ' m en vue…';
            tone(700, 1600, 0.3, 0.18);
        } else {
            promptEl.textContent = 'Splash ! +' + h.toFixed(1) + ' m…';
            tone(500, 1000, 0.2, 0.15);
        }
        showScreen('fly');
    }

    function finishJump(f) {
        splash(f.x, f.player ? 26 : 16);
        splashSound(f.player);
        totals[f.name] = (totals[f.name] || 0) + f.h;
        if (!f.player) {
            // Prochain rival, ou à vous après le dernier (pause lisible entre sauts).
            if (aiQueue.length) {
                aiTimer = 90;
            } else {
                beginCharge();
                return;
            }
        } else {
            // Fin de manche : classement + tableau.
            const ranked = P.rankRound([
                { name: 'Vous', h: f.h, player: true },
                ...lastAi
            ]);
            ranked.forEach((e, i) => { e.pts = P.roundPoints(i); });
            history.push({ round, ranked });
            renderBoard(ranked);
            promptEl.textContent = 'Manche ' + round + ' terminée — ' + ranked[0].name + ' en tête !';
            setTimeout(() => {
                if (screen !== 'fly') return;
                if (round < P.ROUNDS) { round++; startRound(); }
                else finishMatch();
            }, 3000);
        }
        fly = null;
    }

    let lastAi = [];

    function finishMatch() {
        const final = Object.entries(totals)
            .map(([name, h]) => ({ name, h, player: name === 'Vous' }))
            .sort((a, b) => b.h - a.h);
        const mine = Math.round(totals['Vous'] * 10) / 10;
        const isRecord = mine > best;
        if (mine > 0 || best === 0) {
            DolphinariumStorage.saveGameScore({ game: GAME, score: mine });
        }
        if (isRecord) {
            best = mine;
            bestEl.textContent = 'Record : ' + best + ' m';
        }
        overTableEl.innerHTML = final.map((e, i) =>
            '<li class="' + (e.player ? 'me' : '') + (i === 0 ? ' winner' : '') + '">'
            + (i === 0 ? '🏆 ' : (i + 1) + '. ') + e.name + ' — ' + e.h.toFixed(1) + ' m</li>'
        ).join('');
        overBestEl.textContent = 'Record : ' + best + ' m';
        newRecordEl.hidden = !isRecord || mine === 0;
        showScreen('over');
    }

    function renderBoard(ranked) {
        const rows = ['Vous', ...P.RIVALS.map(r => r.name)].map(name => {
            const h = (totals[name] || 0).toFixed(1);
            const medal = ranked && ranked[0] && ranked[0].name === name ? ' 👑' : '';
            return '<li class="' + (name === 'Vous' ? 'me' : '') + '">' + name + medal + ' — ' + h + ' m</li>';
        }).join('');
        boardEl.innerHTML = rows;
    }

    /* ----- Boucle ----- */
    function loop() {
        if (!focusEl.hidden && (screen === 'ai' || screen === 'charge' || screen === 'fly')) {
            try {
                frame();
            } catch (err) {
                console.error('[saut] frame ignorée :', err);
                closeFocus();
                return;
            }
            requestAnimationFrame(loop);
        }
    }

    function frame() {
        // Charge : le dauphin descend, le curseur balaie la jauge.
        if (screen === 'charge' && charging) {
            chargeT += 1 / 60;
            charge = Math.min(1, chargeT / 2.4);
            chargeFill.style.width = (charge * 100) + '%';
            cursorEl.style.left = (cursorPos(chargeT) * 100) + '%';
            if (chargeT > 6) releaseJump(); // sécurité : relâche auto
        }
        // Sauts IA en file.
        if (screen === 'ai' && !fly) {
            if (aiTimer > 0) {
                aiTimer--;
            } else if (aiQueue.length) {
                const entry = aiQueue.shift();
                lastAi.push({ name: entry.name, h: entry.h, player: false });
                if (aiQueue.length === 0 && lastAi.length > P.RIVALS.length) {
                    lastAi = lastAi.slice(-P.RIVALS.length);
                }
                const x = 250 + (P.RIVALS.length - aiQueue.length) * 130;
                launchAi(entry, x);
                promptEl.textContent = entry.name + ' s\u2019élance… (' + entry.h.toFixed(1) + ' m visés)';
            }
        }
        // Vol balistique du sauteur courant.
        if (fly) {
            fly.vy += P.GRAVITY;
            fly.x += fly.vx;
            fly.y += fly.vy;
            if (fly.vy > 0 && fly.y >= P.WATER_Y) {
                const done = fly;
                fly = null;
                finishJump(done);
            }
        }
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life--;
        });
        particles = particles.filter(p => p.life > 0);

        // Rendu.
        ctx.clearRect(0, 0, P.W, P.H);
        drawScene();
        if (screen === 'charge') drawDiver();
        if (fly) drawJumper();
        drawParticles();
    }

    /* ----- Rendu ----- */
    function drawScene() {
        const sky = ctx.createLinearGradient(0, 0, 0, P.WATER_Y);
        sky.addColorStop(0, '#7ec8e3');
        sky.addColorStop(1, '#caf0f8');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, P.W, P.WATER_Y);
        // Soleil doux.
        ctx.fillStyle = 'rgba(255, 244, 200, 0.9)';
        ctx.beginPath(); ctx.arc(690, 70, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 244, 200, 0.25)';
        ctx.beginPath(); ctx.arc(690, 70, 52, 0, Math.PI * 2); ctx.fill();
        // Échelle des hauteurs (0-10 m).
        ctx.fillStyle = 'rgba(3, 4, 94, 0.55)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        for (let m = 0; m <= 10; m += 2) {
            const y = P.WATER_Y - m * P.PX_PER_M;
            ctx.fillRect(14, y, 10, 2);
            ctx.fillText(m + ' m', 28, y + 4);
        }
        // Mer.
        const sea = ctx.createLinearGradient(0, P.WATER_Y, 0, P.H);
        sea.addColorStop(0, '#0096c7');
        sea.addColorStop(1, '#03045e');
        ctx.fillStyle = sea;
        ctx.fillRect(0, P.WATER_Y, P.W, P.H - P.WATER_Y);
        // Vaguelettes.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        const t = Date.now() / 700;
        for (let i = 0; i < 9; i++) {
            const x = ((i * 130 + t * 30) % (P.W + 60)) - 30;
            ctx.beginPath();
            ctx.moveTo(x, P.WATER_Y + 4);
            ctx.quadraticCurveTo(x + 12, P.WATER_Y - 2 + Math.sin(t + i) * 2, x + 24, P.WATER_Y + 4);
            ctx.stroke();
        }
    }

    function drawDolphinShape(scale) {
        // Petit dauphin de profil réutilisé (même langage que la Nage).
        ctx.save();
        ctx.scale(scale, scale);
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
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(20, -5, 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#062a44';
        ctx.beginPath(); ctx.arc(21, -5, 1.7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawDiver() {
        // Le plongeur descend avec la charge + bouillon de bulles.
        const y = P.WATER_Y + 20 + charge * 70;
        ctx.save();
        ctx.translate(150, y);
        ctx.rotate(0.5);
        ctx.globalAlpha = 0.95;
        drawDolphinShape(1);
        ctx.restore();
        if (charging && Math.random() < 0.5) {
            particles.push({ x: 150 + (Math.random() - 0.5) * 20, y: y - 10,
                vx: (Math.random() - 0.5), vy: -1 - Math.random(), r: 1.5 + Math.random() * 2, life: 30 });
        }
    }

    function drawJumper() {
        const angle = Math.atan2(fly.vy, fly.vx);
        ctx.save();
        ctx.translate(fly.x, fly.y);
        ctx.rotate(fly.player ? angle : angle * 0.9);
        if (!fly.player) ctx.globalAlpha = 0.85;
        drawDolphinShape(fly.player ? 1 : 0.9);
        ctx.restore();
        // Étiquette du sauteur.
        ctx.fillStyle = fly.player ? '#03045e' : 'rgba(3, 4, 94, 0.7)';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fly.name + ' ' + fly.h.toFixed(1) + ' m', fly.x, Math.min(fly.y - 44, P.WATER_Y - 8));
    }

    function drawParticles() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /* ----- Écrans ----- */
    function openFocus() {
        lastAi = [];
        focusEl.hidden = false;
        document.body.style.overflow = 'hidden';
        showScreen('menu');
        requestAnimationFrame(loop);
    }

    function closeFocus() {
        screen = 'menu';
        charging = false;
        fly = null;
        focusEl.hidden = true;
        document.body.style.overflow = '';
    }

    function showScreen(name) {
        screen = name;
        menuEl.hidden = name !== 'menu';
        overEl.hidden = name !== 'over';
        chargeWrap.hidden = !(name === 'charge');
        promptEl.hidden = !(name === 'ai' || name === 'charge' || name === 'fly');
        if (name === 'menu') document.getElementById('saut-play-btn').focus();
        if (name === 'over') document.getElementById('saut-restart').focus();
        if (name === 'charge' || name === 'fly') canvas.focus();
    }

    function syncOptionsUI() {
        muteBtn.textContent = opts.muted ? '🔇 Son coupé' : '🔊 Son';
        muteBtn.setAttribute('aria-pressed', String(opts.muted));
        document.querySelectorAll('input[name="saut-diff"]').forEach(r => {
            r.checked = r.value === opts.difficulty;
        });
        const muteOpt = document.getElementById('saut-opt-sound');
        if (muteOpt) muteOpt.checked = !opts.muted;
    }

    /* ----- Entrées : maintenir = plonger, relâcher = sauter ----- */
    function pressStart(e) {
        if (e) e.preventDefault();
        ensureAudio();
        if (screen !== 'charge' || charging) return;
        charging = true;
        charge = 0;
        chargeT = 0;
    }

    function pressEnd() {
        releaseJump();
    }

    document.getElementById('hub-saut-play').addEventListener('click', openFocus);
    document.getElementById('saut-play-btn').addEventListener('click', () => { startMatch(); requestAnimationFrame(loop); });
    document.getElementById('saut-quit-btn').addEventListener('click', closeFocus);
    document.getElementById('saut-close').addEventListener('click', closeFocus);
    document.getElementById('saut-options-btn').addEventListener('click', () => {
        optionsEl.hidden = !optionsEl.hidden;
    });
    document.getElementById('saut-restart').addEventListener('click', () => { startMatch(); requestAnimationFrame(loop); });
    document.getElementById('saut-over-menu').addEventListener('click', () => showScreen('menu'));
    muteBtn.addEventListener('click', () => {
        opts.muted = !opts.muted; saveOpts(); syncOptionsUI();
    });
    document.getElementById('saut-opt-sound').addEventListener('change', (e) => {
        opts.muted = !e.target.checked; saveOpts(); syncOptionsUI();
    });
    document.querySelectorAll('input[name="saut-diff"]').forEach(r => {
        r.addEventListener('change', (e) => { opts.difficulty = e.target.value; saveOpts(); });
    });

    document.addEventListener('keydown', (e) => {
        if (focusEl.hidden) return;
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            if (document.activeElement && document.activeElement.tagName === 'BUTTON' && e.code === 'Space') return;
            pressStart(e);
        } else if (e.code === 'KeyR' && (screen === 'fly' || screen === 'over')) {
            startMatch(); requestAnimationFrame(loop);
        } else if (e.code === 'Escape') {
            closeFocus();
        }
    });
    document.addEventListener('keyup', (e) => {
        if ((e.code === 'Space' || e.code === 'ArrowUp') && !focusEl.hidden) pressEnd();
    });

    canvas.addEventListener('pointerdown', (e) => {
        pressStart(e);
        if (canvas.setPointerCapture && e.pointerId !== undefined) {
            try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
        }
    });
    const endPointer = () => pressEnd();
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && screen === 'charge' && charging) {
            // Sécurité : on relâche proprement plutôt que de charger dans le vide.
            releaseJump();
        }
    });

    showScreen('menu');
})();
