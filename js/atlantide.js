/* La Grande Bibliothèque engloutie — page secrète (hors navigation).
 * Étagères générées, livres volants en CSS, recherche plein-texte
 * dans les archives locales + renvoi Wikipédia si rien ne correspond. */
const AtlantidePure = (() => {
    const ARCHIVES = [
        { title: 'Le sifflement signature', tags: 'langage nom sifflement communication parler',
            text: 'Chaque dauphin invente son propre sifflement et s\u2019en sert comme d\u2019un prénom. Les mères sifflent le leur aux petits avant même leur naissance.' },
        { title: 'Le melon, lentille sonore', tags: 'echolocation melon sonar clics entendre voir',
            text: 'Le melon, cette masse graisseuse du front, focalise les clics comme une lentille. Les échos reviennent par la mâchoire inférieure. Voir avec les oreilles.' },
        { title: 'Dormir d\u2019un seul œil', tags: 'sommeil dormir cerveau nuit repos hemisphere',
            text: 'Un hémisphère dort pendant que l\u2019autre veille : le dauphin continue de respirer volontairement et de surveiller les requins. La sieste parfaite n\u2019existe pas ici.' },
        { title: 'Les éponges de Shark Bay', tags: 'eponge outil shark bay australie outil intelligence',
            text: 'À Shark Bay, des dauphins portent des éponges sur le rostre pour fouiller le sable sans se blesser. Une technique transmise de mère en fille.' },
        { title: 'L\u2019orque, un dauphin géant', tags: 'orque epaulard baleine delphinide espece',
            text: 'Malgré son surnom d\u2019épaulard, l\u2019orque est le plus grand des delphinidés. Pas une baleine : un dauphin de salon, en 9 mètres.' },
        { title: 'Douze lunes d\u2019attente', tags: 'bebe gestation reproduction naissance petit mere',
            text: 'La gestation dure environ douze mois. Le petit naît queue la première — pour prendre sa première respiration dès la sortie — puis tète un lait très gras pendant plus d\u2019un an.' },
        { title: 'La boule d\u2019appât', tags: 'chasse pod equipe bait ball poissons chasse',
            text: 'En équipe, les dauphins encerclent les bancs et les compactent en boule scintillante avant de se servir à tour de rôle. Banquet coordonné.' },
        { title: 'Un dialecte par pod', tags: 'dialecte langage accent pod groupe culture',
            text: 'Chaque pod possède ses variantes vocales, transmises socialement. Changez de baie, changez d\u2019accent.' },
        { title: 'Le miroir et la conscience', tags: 'miroir intelligence conscience soi test',
            text: 'Les dauphins réussissent le test du miroir : ils se reconnaissent et inspectent des marques sur leur propre corps. Club très fermé.' },
        { title: 'Dix minutes sans respirer', tags: 'apnee plongee profondeur record respirer event',
            text: 'Un grand dauphin tient 8 à 10 minutes en apnée. Avant de plonger, il vide ses poumons à 80 % pour éviter l\u2019ivresse des profondeurs.' },
        { title: 'Le sourire qui ment', tags: 'sourire heureux emotion machoire mythe',
            text: 'Le fameux sourire n\u2019est que la forme de la mâchoire : le dauphin sourit en dormant, malade ou de mauvaise humeur. Ne vous fiez pas aux apparences.' },
        { title: 'Le bruit qui tue', tags: 'bruit bateaux sonar pollution menace conservation',
            text: 'Sonars militaires et moteurs masquent clics et sifflements, vitaux pour chasser et se parler. L\u2019océan moderne est assourdissant.' }
    ];

    function normalize(s) {
        return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Score : titre compte double, puis tags, puis texte.
    function searchArchives(q) {
        const words = normalize(q).split(/[^a-z0-9]+/).filter(w => w.length > 2);
        if (!words.length) return [];
        return ARCHIVES
            .map(a => {
                const hayTitle = normalize(a.title);
                const hayTags = normalize(a.tags);
                const hayText = normalize(a.text);
                let score = 0;
                for (const w of words) {
                    if (hayTitle.includes(w)) score += 3;
                    if (hayTags.includes(w)) score += 2;
                    if (hayText.includes(w)) score += 1;
                }
                return { entry: a, score };
            })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(r => r.entry);
    }

    function randomManuscripts(n) {
        const pool = ARCHIVES.slice();
        const out = [];
        while (out.length < n && pool.length) {
            out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        return out;
    }

    return { ARCHIVES, normalize, searchArchives, randomManuscripts };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AtlantidePure;
}

if (typeof document !== 'undefined') (() => {
    const shelvesEl = document.getElementById('atlantide-shelves');
    const form = document.getElementById('atlantide-search');
    const input = document.getElementById('atlantide-input');
    const resultsEl = document.getElementById('atlantide-results');

    /* Étagères : travées de dos de livres aux teintes abyssales. */
    const SPINE_COLORS = ['#5b3a29', '#274156', '#1d6b41', '#6b2749', '#27436b', '#71602a', '#4a2b6b', '#7a3b2e'];
    (function renderShelves() {
        const rows = Math.max(3, Math.floor(window.innerHeight / 260));
        for (let r = 0; r < rows; r++) {
            const shelf = document.createElement('div');
            shelf.className = 'atlantide-shelf';
            const count = 18 + Math.floor(Math.random() * 10);
            for (let i = 0; i < count; i++) {
                const spine = document.createElement('span');
                spine.className = 'atlantide-spine';
                spine.style.height = (46 + Math.random() * 44) + 'px';
                spine.style.background = SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)];
                if (Math.random() < 0.12) spine.style.transform = 'rotate(-7deg)';
                shelf.appendChild(spine);
            }
            shelvesEl.appendChild(shelf);
        }
    })();

    function card(entry) {
        const article = document.createElement('article');
        article.className = 'atlantide-card';
        const h = document.createElement('h3');
        h.textContent = '📜 ' + entry.title;
        const p = document.createElement('p');
        p.textContent = entry.text;
        article.appendChild(h);
        article.appendChild(p);
        return article;
    }

    function renderList(list, head) {
        resultsEl.innerHTML = '';
        const h = document.createElement('p');
        h.className = 'atlantide-head';
        h.textContent = head;
        resultsEl.appendChild(h);
        list.forEach(e => resultsEl.appendChild(card(e)));
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) {
            renderList(AtlantidePure.randomManuscripts(3), 'Tirez trois manuscrits au hasard, voyageur :');
            return;
        }
        const found = AtlantidePure.searchArchives(q);
        if (found.length) {
            renderList(found.slice(0, 5), found.length + ' manuscrit(s) pour « ' + q + ' » :');
        } else {
            resultsEl.innerHTML = '';
            const h = document.createElement('p');
            h.className = 'atlantide-head';
            h.textContent = 'Aucun manuscrit sur « ' + q + ' ». Les archivistes vous orientent vers la surface :';
            const a = document.createElement('a');
            a.className = 'btn btn-primary';
            a.href = 'https://fr.wikipedia.org/w/index.php?search=' + encodeURIComponent(q);
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = 'Approfondir sur Wikipédia →';
            resultsEl.appendChild(h);
            resultsEl.appendChild(a);
        }
    });

    // À l'arrivée : trois manuscrits du jour.
    renderList(AtlantidePure.randomManuscripts(3), 'Manuscrits du jour, choisis par les archivistes :');
})();
