/* Page zen : nappes de vagues + sifflements lointains 100 % procéduraux (Web Audio, zéro fichier),
 * lumières bleues et dauphin flou pilotés en CSS/JS. L'AudioContext démarre sur clic (politique autoplay). */
(() => {
    const enterOverlay = document.getElementById('zen-enter');
    const enterBtn = document.getElementById('zen-enter-btn');
    const dolphin = document.getElementById('zen-dolphin');
    const muteBtn = document.getElementById('zen-mute');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let ctx = null;
    let master = null;
    let muted = false;
    let timers = [];

    const rand = (min, max) => min + Math.random() * (max - min);

    /* ----- Nappes de vagues : bruit brun bouclé + filtre passe-bas modulé (houle ~9 s) ----- */
    function startWaves() {
        const len = ctx.sampleRate * 4;
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02; // brunisage
            data[i] = last * 3.2;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 420;
        lowpass.Q.value = 0.6;

        const waveGain = ctx.createGain();
        waveGain.gain.value = 0.22;

        // Houle : LFO lent sur le volume…
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.11;
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 0.12;
        lfo.connect(lfoDepth).connect(waveGain.gain);

        // …et balayage doux sur le filtre.
        const lfo2 = ctx.createOscillator();
        lfo2.frequency.value = 0.07;
        const lfo2Depth = ctx.createGain();
        lfo2Depth.gain.value = 180;
        lfo2.connect(lfo2Depth).connect(lowpass.frequency);

        src.connect(lowpass).connect(waveGain).connect(master);
        src.start();
        lfo.start();
        lfo2.start();
    }

    /* ----- Sifflement lointain : sinus glissant + enveloppe douce + panoramique aléatoire ----- */
    function whistle() {
        if (!ctx || muted) return;
        const t = ctx.currentTime + 0.05;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const f0 = rand(900, 1600);
        const f1 = rand(1400, 2400);
        const dur = rand(0.7, 1.4);
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
        osc.frequency.exponentialRampToValueAtTime(Math.max(600, f1 * rand(0.5, 0.8)), t + dur);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(rand(0.04, 0.09), t + dur * 0.3); // lointain : discret
        g.gain.linearRampToValueAtTime(0, t + dur);

        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        osc.connect(g);
        if (pan) {
            pan.pan.value = rand(-0.8, 0.8);
            g.connect(pan).connect(master);
        } else {
            g.connect(master);
        }
        osc.start(t);
        osc.stop(t + dur + 0.1);
    }

    function scheduleWhistles() {
        const loop = () => {
            whistle();
            // Parfois un second appel rapproché, comme un dialogue.
            if (Math.random() < 0.35) {
                timers.push(setTimeout(whistle, rand(1200, 3000)));
            }
            timers.push(setTimeout(loop, rand(20000, 50000)));
        };
        timers.push(setTimeout(loop, rand(4000, 9000)));
    }

    /* ----- Dauphin flou : traverse l'écran de temps en temps, siffle au passage ----- */
    function crossDolphin() {
        if (!dolphin) return;
        const top = rand(12, 68); // % vertical
        const flip = Math.random() < 0.5; // sens de nage
        const scale = rand(0.7, 1.3); // profondeur
        dolphin.style.top = top + '%';
        dolphin.style.setProperty('--zen-scale', scale.toFixed(2));
        dolphin.classList.toggle('flip', flip);
        dolphin.classList.remove('swimming');
        void dolphin.offsetWidth; // relance l'animation
        dolphin.classList.add('swimming');
        // Petit sifflement quand il passe au milieu de l'écran.
        timers.push(setTimeout(whistle, 5000));
    }

    function scheduleDolphin() {
        if (reduceMotion) return;
        const loop = () => {
            crossDolphin();
            timers.push(setTimeout(loop, rand(22000, 42000)));
        };
        timers.push(setTimeout(loop, 6000)); // première apparition rapide pour la démo
    }

    /* ----- 🥚 Ballet rare : trois dauphins qui dansent doucement (parfois seulement) ----- */
    const danceEl = document.getElementById('zen-dance');

    function scheduleDance() {
        if (reduceMotion || !danceEl) return;
        const loop = () => {
            danceEl.hidden = false;
            danceEl.classList.remove('dancing');
            void danceEl.offsetWidth; // relance l'animation
            danceEl.classList.add('dancing');
            // On range après le fondu, puis on reprogramme loin dans le temps.
            timers.push(setTimeout(() => {
                danceEl.classList.remove('dancing');
                danceEl.hidden = true;
            }, 26500));
            timers.push(setTimeout(loop, rand(240000, 480000)));
        };
        timers.push(setTimeout(loop, rand(90000, 180000))); // première danse : 1,5 à 3 min
    }

    /* ----- Entrée / sortie ----- */
    enterBtn.addEventListener('click', () => {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain();
            master.gain.value = 0.9;
            master.connect(ctx.destination);
            startWaves();
            scheduleWhistles();
            scheduleDolphin();
            scheduleDance();
        } else if (ctx.state === 'suspended') {
            ctx.resume();
        }
        enterOverlay.classList.add('hidden');
    });

    muteBtn.addEventListener('click', () => {
        muted = !muted;
        if (master) {
            master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.3);
        }
        muteBtn.textContent = muted ? '🔇 Son coupé' : '🔊 Ambiance sonore';
        muteBtn.setAttribute('aria-pressed', String(muted));
    });

    window.addEventListener('pagehide', () => {
        timers.forEach(clearTimeout);
        if (ctx) ctx.close();
    });
})();
