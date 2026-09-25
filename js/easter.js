/* 🥚 Easter eggs globaux du Dolphinarium (chargé sur toutes les pages) :
 * - Konami marin : ↑↑↓↓←→←AB -> pluie de dauphins
 * - Logo taquin : 5 clics sur le logo -> tonneau + splash
 * - Mode abysses : visite entre 22h et 6h -> voile sombre + bulle "bonsoir"
 * 100 % offline, sons procéduraux, respecte prefers-reduced-motion. */
const EasterPure = (() => {
    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

    // Progression dans la séquence (testable) : retourne la nouvelle position.
    function konamiStep(pos, key) {
        const k = key.length === 1 ? key.toLowerCase() : key;
        if (k === KONAMI[pos]) return pos + 1;
        // Tolérance : si la touche relance le début, on ne repart pas de zéro bêtement.
        return k === KONAMI[0] ? 1 : 0;
    }

    function isNightHour(h) {
        return h >= 22 || h < 6;
    }

    return { KONAMI, konamiStep, isNightHour };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EasterPure;
}

if (typeof document !== 'undefined') (() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let audioCtx = null;

    function ensureAudio() {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            else if (audioCtx.state === 'suspended') audioCtx.resume();
        } catch { audioCtx = null; }
        return audioCtx;
    }

    function plouf(volume) {
        const ctx = ensureAudio();
        if (!ctx) return;
        try {
            const t = ctx.currentTime;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(600, t);
            o.frequency.exponentialRampToValueAtTime(150, t + 0.25);
            g.gain.setValueAtTime(volume, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            o.connect(g).connect(ctx.destination);
            o.start(t); o.stop(t + 0.32);
        } catch { /* silencieux */ }
    }

    /* ----- Konami marin : pluie de dauphins ----- */
    let konamiPos = 0;
    let rainCooldownUntil = 0;

    function dolphinRain() {
        if (reduceMotion) return;
        const now = Date.now();
        if (now < rainCooldownUntil) return;
        rainCooldownUntil = now + 10000;
        for (let i = 0; i < 36; i++) {
            const drop = document.createElement('span');
            drop.className = 'easter-rain';
            drop.textContent = Math.random() < 0.85 ? '🐬' : '🐳';
            drop.style.left = (Math.random() * 100) + 'vw';
            drop.style.fontSize = (1.2 + Math.random() * 1.8) + 'rem';
            drop.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
            drop.style.animationDelay = (Math.random() * 1.5) + 's';
            document.body.appendChild(drop);
            setTimeout(() => drop.remove(), 7000);
        }
        [523, 659, 784, 1047].forEach((f, i) => {
            setTimeout(() => plouf(0.08), i * 90);
        });
    }

    document.addEventListener('keydown', (e) => {
        // On ignore la frappe dans les champs (recherche wiki...).
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        konamiPos = EasterPure.konamiStep(konamiPos, e.key);
        if (konamiPos >= EasterPure.KONAMI.length) {
            konamiPos = 0;
            dolphinRain();
        }
    });

    /* ----- Logo taquin : 5 clics en rafale -> tonneau, sans jamais recharger.
     * Chaque clic est intercepté : pulsation immédiate, puis navigation vers
     * l'accueil 500 ms plus tard SAUF si un autre clic arrive (rafale = on reste,
     * la fête joue au 5e). Clic isolé / Ctrl+clic : comportement normal. ----- */
    let logoClicks = 0;
    let logoNavTimer = null;

    function logoPulse(mark) {
        if (!mark || reduceMotion) return;
        mark.classList.remove('logo-tap');
        void mark.getBoundingClientRect();
        mark.classList.add('logo-tap');
        setTimeout(() => mark.classList.remove('logo-tap'), 350);
    }

    function logoParty() {
        const mark = document.querySelector('.logo .logo-mark');
        if (mark && !reduceMotion) {
            mark.classList.remove('logo-party');
            void mark.getBoundingClientRect();
            mark.classList.add('logo-party');
            setTimeout(() => mark.classList.remove('logo-party'), 1100);
        }
        plouf(0.15);
    }

    document.addEventListener('click', (e) => {
        const logo = e.target.closest('.logo');
        if (!logo) return;
        // Laisse passer les ouvertures spéciales (nouvel onglet...) et le clavier modifié.
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        logoClicks++;
        clearTimeout(logoNavTimer);
        logoPulse(logo.querySelector('.logo-mark'));
        if (logoClicks >= 5) {
            logoClicks = 0;
            logoParty(); // on reste sur place pour profiter de la fête
        } else {
            const href = logo.getAttribute('href');
            logoNavTimer = setTimeout(() => {
                logoClicks = 0;
                if (href) window.location.href = href;
            }, 500);
        }
    });

    /* ----- Mode abysses : 22h -> 6h ----- */
    if (EasterPure.isNightHour(new Date().getHours())) {
        document.body.classList.add('abyss-mode');
        const bubble = document.createElement('div');
        bubble.className = 'abyss-bubble';
        bubble.textContent = '🌙 Bonsoir… les abysses veillent sur vos clics.';
        document.body.appendChild(bubble);
        setTimeout(() => bubble.remove(), 6000);
    }
})();
