/* Moteur du quiz Dolphinarium : thèmes -> questions mélangées -> score -> historique.
 * Dépendances globales (ordre de chargement) : QUIZ_DATA (quiz-data.js), DolphinariumStorage (storage.js). */
(() => {
    const THEME_ICONS = {
        'Espèces & diversité': '🐬',
        'Anatomie & super-sens': '🔊',
        'Communication & intelligence': '🧠',
        'Vie sociale & comportement': '🌊',
        'Reproduction & cycle de vie': '👶',
        'Conservation & idées reçues': '🛟'
    };

    const themesEl = document.getElementById('quiz-themes');
    const historyEl = document.getElementById('quiz-history');
    const clearBtn = document.getElementById('quiz-clear');
    const homeView = document.getElementById('quiz-home');
    const gameView = document.getElementById('quiz-game');
    const resultView = document.getElementById('quiz-result');

    const progressText = document.getElementById('quiz-progress-text');
    const progressBar = document.getElementById('quiz-progress-bar');
    const questionEl = document.getElementById('quiz-question');
    const typeBadge = document.getElementById('quiz-type');
    const optionsEl = document.getElementById('quiz-options');
    const feedbackEl = document.getElementById('quiz-feedback');

    const scoreEl = document.getElementById('quiz-score');
    const scoreMsg = document.getElementById('quiz-score-msg');
    const replayBtn = document.getElementById('quiz-replay');
    const backBtn = document.getElementById('quiz-back');
    const quitBtn = document.getElementById('quiz-quit');

    let questions = [];
    let currentTheme = '';
    let index = 0;
    let score = 0;

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function show(view) {
        [homeView, gameView, resultView].forEach(v => v.hidden = v !== view);
    }

    function renderThemes() {
        const themes = [...new Set(QUIZ_DATA.map(q => q.theme))];
        const best = DolphinariumStorage.getBestScores();
        themesEl.innerHTML = '';
        themes.forEach(theme => {
            const count = QUIZ_DATA.filter(q => q.theme === theme).length;
            const b = best[theme];
            const btn = document.createElement('button');
            btn.className = 'quiz-theme-card';
            btn.innerHTML = '<span class="fact-icon">' + (THEME_ICONS[theme] || '🐬') + '</span>'
                + '<strong>' + theme + '</strong>'
                + '<span class="quiz-theme-meta">' + count + ' questions'
                + (b ? ' · meilleur : ' + b.score + '/' + b.total : ' · jamais joué') + '</span>';
            btn.addEventListener('click', () => startTheme(theme));
            themesEl.appendChild(btn);
        });
    }

    function renderHistory() {
        const history = DolphinariumStorage.getHistory().slice(0, 10);
        if (!history.length) {
            historyEl.innerHTML = '<li class="quiz-history-empty">Aucune partie pour l\'instant — à vous de plonger !</li>';
            return;
        }
        historyEl.innerHTML = '';
        history.forEach(h => {
            const li = document.createElement('li');
            const date = new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            li.innerHTML = '<strong>' + h.theme + '</strong> — ' + h.score + '/' + h.total + ' <span>' + date + '</span>';
            historyEl.appendChild(li);
        });
    }

    function refreshHome() {
        renderThemes();
        renderHistory();
    }

    function startTheme(theme) {
        currentTheme = theme;
        questions = shuffle(QUIZ_DATA.filter(q => q.theme === theme));
        index = 0;
        score = 0;
        show(gameView);
        renderQuestion();
    }

    function renderQuestion() {
        const q = questions[index];
        feedbackEl.hidden = true;
        feedbackEl.innerHTML = '';
        progressText.textContent = currentTheme + ' — question ' + (index + 1) + '/' + questions.length;
        progressBar.style.width = ((index) / questions.length * 100) + '%';
        typeBadge.textContent = q.type === 'qcm' ? 'QCM' : 'Vrai / Faux';
        questionEl.textContent = q.question;
        optionsEl.innerHTML = '';

        if (q.type === 'qcm') {
            // Mélange des choix en conservant la trace de la bonne réponse.
            const order = shuffle(q.choices.map((label, i) => ({ label, correct: i === q.answer })));
            order.forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = 'quiz-option';
                btn.innerHTML = '<span class="quiz-key">' + (i + 1) + '</span> ' + opt.label;
                btn.addEventListener('click', () => answer(opt.correct, btn));
                optionsEl.appendChild(btn);
            });
        } else {
            [true, false].forEach(val => {
                const btn = document.createElement('button');
                btn.className = 'quiz-option quiz-vf';
                btn.textContent = val ? 'Vrai' : 'Faux';
                btn.addEventListener('click', () => answer(val === q.answer, btn));
                optionsEl.appendChild(btn);
            });
        }
    }

    function answer(correct, pickedBtn) {
        const q = questions[index];
        [...optionsEl.children].forEach(b => { b.disabled = true; });
        if (correct) {
            score++;
            pickedBtn.classList.add('good');
        } else {
            pickedBtn.classList.add('bad');
            // Surligne la bonne réponse en QCM.
            if (q.type === 'qcm') {
                const goodLabel = q.choices[q.answer];
                const goodBtn = [...optionsEl.children].find(b => b.textContent.includes(goodLabel));
                if (goodBtn) goodBtn.classList.add('good');
            } else {
                const goodBtn = [...optionsEl.children].find(b => b.textContent === (q.answer ? 'Vrai' : 'Faux'));
                if (goodBtn) goodBtn.classList.add('good');
            }
        }
        progressBar.style.width = ((index + 1) / questions.length * 100) + '%';
        feedbackEl.innerHTML = '<p><strong>' + (correct ? '✅ Bonne réponse !' : '❌ Raté…') + '</strong> ' + q.explication + '</p>'
            + '<button class="btn btn-primary" id="quiz-next">' + (index + 1 < questions.length ? 'Question suivante →' : 'Voir mon score →') + '</button>';
        feedbackEl.hidden = false;
        document.getElementById('quiz-next').addEventListener('click', () => {
            index++;
            if (index < questions.length) renderQuestion();
            else finishTheme();
        });
        document.getElementById('quiz-next').focus();
    }

    // 🥚 Cinématiques de fin : une scène fullscreen par score (0 à 5).
    const CINEMA_TEXTS = {
        5: ['5 / 5', 'Récif en fête — Grand dauphin expert !'],
        4: ['4 / 5', 'Sauts vers l\u2019île déserte !'],
        3: ['3 / 5', 'Le grand bleu vous appelle…'],
        2: ['2 / 5', 'Seul dans le bleu…'],
        1: ['1 / 5', 'Coup de blues…'],
        0: ['0 / 5', 'Les abysses aussi ont leur beauté. Replongez !']
    };

    // Bande-son par scène (injectable pour tests : retourne la partition).
    function cinemaScore(mood) {
        if (mood === 5) return [523.25, 659.25, 783.99, 1046.5];       // fanfare
        if (mood === 4) return [523.25, 659.25, 783.99];                // clin d'œil joyeux
        if (mood === 3) return 'whistles';                              // sifflements de dauphins
        if (mood === 2) return [392.0];                                 // note douce unique
        if (mood === 1) return [330.0, 262.0];                          // descente feutrée
        return [110.0];                                                 // profondeur abyssale
    }

    function finishTheme() {
        DolphinariumStorage.saveResult({ theme: currentTheme, score, total: questions.length });
        scoreEl.textContent = score + ' / ' + questions.length;
        if (score === questions.length) scoreMsg.textContent = '🐬 Parfait ! Grand dauphin expert, rien ne vous échappe.';
        else if (score >= 3) scoreMsg.textContent = '👏 Bien joué ! Encore une plongée et ce sera parfait.';
        else scoreMsg.textContent = '🌊 À replonger ! Jetez un œil au Wiki puis retentez votre chance.';
        playCinema(score, () => showResult());
    }

    function showResult() {
        show(resultView);
        refreshHome();
    }

    /* Cinématique fullscreen : scène dédiée + bande-son, escamotable au clic. */
    const cinemaEl = document.getElementById('quiz-cinema');
    const cinemaText = document.getElementById('cinema-text');
    let cinemaTimer = null;

    function cinemaSound(mood) {
        try {
            const part = cinemaScore(mood);
            const Ctx = window.AudioContext || window.webkitAudioContext;
            const ctx = new Ctx();
            if (part === 'whistles') {
                // Deux sifflements glissants façon sonar lointain.
                [[900, 1900, 0], [1200, 800, 0.9]].forEach(([f0, f1, at]) => {
                    const t = ctx.currentTime + at + 0.1;
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(f0, t);
                    o.frequency.exponentialRampToValueAtTime(f1, t + 0.9);
                    g.gain.setValueAtTime(0.0001, t);
                    g.gain.exponentialRampToValueAtTime(0.1, t + 0.25);
                    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
                    o.connect(g).connect(ctx.destination);
                    o.start(t); o.stop(t + 1.05);
                });
                setTimeout(() => ctx.close(), 2500);
                return;
            }
            part.forEach((f, i) => {
                const t = ctx.currentTime + i * 0.22;
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = f;
                const vol = mood === 0 ? 0.07 : 0.14;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
                o.connect(g).connect(ctx.destination);
                o.start(t); o.stop(t + 0.75);
            });
            setTimeout(() => ctx.close(), 2500);
        } catch { /* silencieux : la cinématique reste visuelle */ }
    }

    function playCinema(score, done) {
        const key = Math.max(0, Math.min(5, score));
        cinemaEl.querySelectorAll('.cinema-scene').forEach(s => {
            s.hidden = s.dataset.scene !== String(key);
        });
        const [big, small] = CINEMA_TEXTS[key];
        cinemaText.innerHTML = big + '<br><span>' + small + '</span>';
        cinemaEl.hidden = false;
        // Relance les animations de la scène à chaque fois.
        const scene = cinemaEl.querySelector('.cinema-scene[data-scene="' + key + '"]');
        scene.style.animation = 'none';
        void scene.offsetWidth;
        scene.style.animation = '';
        cinemaSound(key);
        const finish = () => {
            clearTimeout(cinemaTimer);
            cinemaEl.hidden = true;
            cinemaEl.removeEventListener('click', finish);
            done();
        };
        cinemaEl.addEventListener('click', finish);
        cinemaTimer = setTimeout(finish, 4500);
    }

    replayBtn.addEventListener('click', () => startTheme(currentTheme));
    backBtn.addEventListener('click', () => { show(homeView); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    quitBtn.addEventListener('click', () => show(homeView));
    clearBtn.addEventListener('click', () => {
        DolphinariumStorage.clearHistory();
        refreshHome();
    });

    // Clavier : touches 1-4 pour répondre vite.
    document.addEventListener('keydown', (e) => {
        if (gameView.hidden || !feedbackEl.hidden) return;
        const n = parseInt(e.key, 10);
        const btns = [...optionsEl.children].filter(b => !b.disabled);
        if (n >= 1 && n <= btns.length) btns[n - 1].click();
    });

    refreshHome();
    show(homeView);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { cinemaScore, CINEMA_TEXTS };
    }
})();
