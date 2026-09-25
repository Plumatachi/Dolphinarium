/* Darwin — petit bot dauphin façon SeaQuest (traducteur de bord du seaQuest).
 * Widget flottant global : répond par règles (zéro backend), blagues et
 * aiguillage vers les pages. Cerveau pur testable (DarwinPure.reply). */
const DarwinPure = (() => {
    const INTENTS = [
        { match: ['bonjour', 'salut', 'hello', 'coucou', 'bonsoir'],
            replies: ['Salut, moussaillon ! Moi c\u2019est Darwin, ex-traducteur de bord du seaQuest. Que veux-tu savoir sur les dauphins ?',
                'Salut salut ! Installe-toi, l\u2019eau est bonne. Une question ?'] },
        { match: ['qui es', 'ton nom', 'presente', 'seaquest', 'darwin'],
            replies: ['Darwin, dauphin traducteur : autrefois je parlais aux humains pour le seaQuest, maintenant je parle aux visiteurs du Dolphinarium. Même job, moins de paperasse.'] },
        { match: ['dormir', 'dors', 'sommeil', 'nuit', 'reve'],
            replies: ['Je dors d\u2019un seul hémisphère à la fois ! L\u2019autre moitié reste éveillée pour respirer et guetter. Essaie de faire pareil en réunion.'] },
        { match: ['manger', 'mange', 'repas', 'poisson', 'nourriture'],
            replies: ['Poissons, calmars et crustacés, gobés entiers — pas de couverts sous l\u2019eau. Un grand dauphin avale 10 à 25 kg par jour !'] },
        { match: ['vitesse', 'vite', 'nager', 'course', 'record'],
            replies: ['En pointe, on file à 40 km/h ! Et dans la Nage du site, l\u2019étoile Dolphin\u2019s Grace te donne un vrai coup de nageoire.'] },
        { match: ['intelligent', 'cerveau', 'malin', 'reflechir'],
            replies: ['On se reconnaît dans un miroir, on a chacun notre sifflement-prénom et des dialectes par pod. Le quiz « Communication » te mettra à l\u2019épreuve !'] },
        { match: ['blague', 'drole', 'rire', 'marrant'],
            replies: ['Que dit un dauphin pressé ? « Faut que je me grouille… je suis à la bourre ! »',
                'Pourquoi les dauphins ne jouent jamais à cache-cache ? Parce qu\u2019ils se font toujours repérer au sonar.',
                'C\u2019est l\u2019histoire d\u2019un poisson-clown… mais elle ne me fait plus rire depuis que je travaille avec des humains.'] },
        { match: ['jeu', 'jouer', 'flappy', 'arcade'],
            replies: ['Direction la salle d\u2019arcade : Sauts périlleux, Descente abyssale et Concours de sauts. Mon record au Flappy ? Je ne compte plus les tonneaux.'] },
        { match: ['galerie', 'photo', 'image'],
            replies: ['La galerie pioche en direct dans Wikimedia Commons. Et avec 1 chance sur 8, une photo légendaire au cadre doré… chut.'] },
        { match: ['wiki', 'apprendre', 'savoir', 'espece'],
            replies: ['Le wiki puise dans Wikipédia en direct. Et si tu cherches « atlantide »… non, je n\u2019ai rien dit.'] },
        { match: ['zen', 'calme', 'detendre', 'relax', 'stress'],
            replies: ['File en mode zen : vagues et sifflements générés en direct. Et si tu restes assez longtemps… un ballet pourrait passer.'] },
        { match: ['carte', 'aquarium', 'ou voir', 'lieu', 'endroit'],
            replies: ['La carte montre 12 aquariums vérifiés, les zones de vie et les flux saisonniers. Et 5 clics dans l\u2019océan… essaie, tu verras.'] },
        { match: ['quiz', 'question', 'test', 'score'],
            replies: ['6 thèmes, 5 questions, QCM et Vrai/Faux. Fais un sans-faute et regarde bien l\u2019écran… chaque score a sa cinématique.'] },
        { match: ['merci', 'cool', 'genial', 'top'],
            replies: ['Avec plaisir ! Un petit poisson pour la route ? … Non ? Bon, je le garde.'] },
        { match: ['au revoir', 'bye', 'adieu', 'quitter'],
            replies: ['So long, and thanks for all the fish ! … Pardon, vieux réflexe du Guide. À bientôt !'] }
    ];

    const FALLBACKS = [
        'Hmm, mon traducteur fait des bulles… Essaie « blague », « dormir », « vitesse » ou « quiz ».',
        'Je n\u2019ai pas la traduction pour ça. Par contre, je sais où sont les poissons. Intéressé ?',
        'Bip… clic… désolé, interférences sonar. Reformule, moussaillon !'
    ];

    const QUICK = ['Qui es-tu ?', 'Raconte une blague', 'Tu dors comment ?', 'Où jouer ?'];

    function normalize(s) {
        return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Retourne { text, suggestions? } — roll injectable pour les tests.
    function reply(question, roll) {
        const q = normalize(question || '');
        for (const intent of INTENTS) {
            if (intent.match.some(k => q.includes(k))) {
                const r = typeof roll === 'function' ? roll() : Math.random();
                return { text: intent.replies[Math.floor(r * intent.replies.length)] };
            }
        }
        const r = typeof roll === 'function' ? roll() : Math.random();
        return { text: FALLBACKS[Math.floor(r * FALLBACKS.length)], suggestions: QUICK.slice(0, 3) };
    }

    return { INTENTS, FALLBACKS, QUICK, normalize, reply };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DarwinPure;
}

if (typeof document !== 'undefined') (() => {
    // Bulle flottante + panneau.
    const fab = document.createElement('button');
    fab.id = 'darwin-fab';
    fab.textContent = '🐬';
    fab.setAttribute('aria-label', 'Discuter avec Darwin, le dauphin traducteur');
    fab.setAttribute('aria-expanded', 'false');
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'darwin-panel';
    panel.hidden = true;
    panel.innerHTML = '<div class="darwin-head"><strong>🐬 Darwin</strong><span>traducteur de bord</span>'
        + '<button id="darwin-close" aria-label="Fermer">✕</button></div>'
        + '<div class="darwin-msgs" id="darwin-msgs" aria-live="polite"></div>'
        + '<div class="darwin-quick" id="darwin-quick"></div>'
        + '<form id="darwin-form"><input id="darwin-input" placeholder="Écris à Darwin…" aria-label="Message pour Darwin" autocomplete="off" maxlength="200">'
        + '<button type="submit" aria-label="Envoyer">➤</button></form>';
    document.body.appendChild(panel);

    const msgs = panel.querySelector('#darwin-msgs');
    const quick = panel.querySelector('#darwin-quick');
    const form = panel.querySelector('#darwin-form');
    const input = panel.querySelector('#darwin-input');
    let greeted = false;

    function bubble(text, me) {
        const p = document.createElement('p');
        p.className = me ? 'darwin-me' : 'darwin-bot';
        p.textContent = text;
        msgs.appendChild(p);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function showQuick(items) {
        quick.innerHTML = '';
        (items || DarwinPure.QUICK).forEach(q => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = q;
            b.addEventListener('click', () => { input.value = q; form.requestSubmit(); });
            quick.appendChild(b);
        });
    }

    function ask(text) {
        const q = text.trim();
        if (!q) return;
        bubble(q, true);
        input.value = '';
        const thinking = document.createElement('p');
        thinking.className = 'darwin-bot darwin-thinking';
        thinking.textContent = '…';
        msgs.appendChild(thinking);
        msgs.scrollTop = msgs.scrollHeight;
        setTimeout(() => {
            thinking.remove();
            const ans = DarwinPure.reply(q);
            bubble(ans.text, false);
            showQuick(ans.suggestions);
        }, 500 + Math.random() * 700);
    }

    function toggle(open) {
        const willOpen = open !== undefined ? open : panel.hidden;
        panel.hidden = !willOpen;
        fab.setAttribute('aria-expanded', String(willOpen));
        if (willOpen && !greeted) {
            greeted = true;
            setTimeout(() => {
                bubble('Salut, moussaillon ! Moi c\u2019est Darwin, ex-traducteur de bord du seaQuest. Pose-moi tes questions sur les dauphins… ou demande-moi une blague. 😏', false);
                showQuick();
            }, 350);
        }
        if (willOpen) setTimeout(() => input.focus(), 60);
    }

    fab.addEventListener('click', () => toggle());
    panel.querySelector('#darwin-close').addEventListener('click', () => toggle(false));
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        ask(input.value);
    });
})();
