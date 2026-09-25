const ORDER = [
            'Dauphin',
            'Grand dauphin',
            'Dauphin commun',
            'Dauphin bleu et blanc',
            'Dauphin de Risso',
            'Orque',
            'Écholocalisation',
            'Intelligence des cétacés'
        ];

        const cache = new Map();
        const treeBtns = [...document.querySelectorAll('.wiki-tree button')];
        const breadcrumb = document.getElementById('breadcrumb');
        const loader = document.getElementById('wiki-loader');
        const content = document.getElementById('wiki-content');
        const titleEl = document.getElementById('wiki-title');
        const thumbEl = document.getElementById('wiki-thumb');
        const extractEl = document.getElementById('wiki-extract');
        const linkEl = document.getElementById('wiki-link');
        const errorEl = document.getElementById('wiki-error');
        const prevEl = document.getElementById('wiki-prev');
        const nextEl = document.getElementById('wiki-next');
        const form = document.getElementById('wiki-search');
        const input = document.getElementById('wiki-input');

        let current = 'Grand dauphin';

        function showLoading() {
            loader.classList.add('show');
            content.hidden = true;
            errorEl.hidden = true;
        }

        function showError(title) {
            loader.classList.remove('show');
            content.hidden = true;
            errorEl.hidden = false;
            const searchUrl = 'https://fr.wikipedia.org/w/index.php?search=' + encodeURIComponent(title);
            errorEl.innerHTML = 'Article « ' + title + ' » introuvable. '
                + '<a href="' + searchUrl + '" target="_blank" rel="noopener">Chercher sur Wikipédia →</a>';
            breadcrumb.textContent = 'Wiki › introuvable';
        }

        function render(title, page) {
            loader.classList.remove('show');
            errorEl.hidden = true;
            content.hidden = false;

            titleEl.textContent = page.title || title;
            breadcrumb.textContent = 'Wiki › ' + (page.title || title);

            if (page.thumbnail?.source) {
                thumbEl.src = page.thumbnail.source;
                thumbEl.alt = 'Illustration : ' + (page.title || title);
                thumbEl.hidden = false;
            } else {
                thumbEl.hidden = true;
                thumbEl.removeAttribute('src');
            }

            const paras = (page.extract || 'Résumé indisponible pour cet article.')
                .split('\n').filter(p => p.trim());
            extractEl.innerHTML = paras.map(p => '<p>' + p + '</p>').join('');
            linkEl.href = 'https://fr.wikipedia.org/wiki/' + encodeURIComponent((page.title || title).replace(/ /g, '_'));

            treeBtns.forEach(b => b.classList.toggle('active', b.dataset.title.toLowerCase() === (page.title || title).toLowerCase()
                || b.dataset.title === current));

            const i = ORDER.findIndex(t => t.toLowerCase() === current.toLowerCase());
            if (i >= 0) {
                prevEl.style.visibility = i > 0 ? '' : 'hidden';
                nextEl.style.visibility = i < ORDER.length - 1 ? '' : 'hidden';
                prevEl.dataset.title = ORDER[i - 1] || '';
                nextEl.dataset.title = ORDER[i + 1] || '';
            } else {
                prevEl.style.visibility = 'hidden';
                nextEl.style.visibility = 'hidden';
            }
        }

        // 🥚 Mot secret : cap vers la Grande Bibliothèque engloutie (page cachée).
        function isAtlantis(title) {
            return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'atlantide';
        }

        async function loadArticle(title) {
            current = title;
            showLoading();
            if (isAtlantis(title)) { window.location.href = 'atlantide.html'; return; }
            if (cache.has(title)) { render(title, cache.get(title)); return; }
            try {
                const url = 'https://fr.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1'
                    + '&prop=extracts%7Cpageimages&exintro=1&explaintext=1'
                    + '&pips=thumbnail&pithumbsize=800&titles=' + encodeURIComponent(title);
                const res = await fetch(url);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                const pages = Object.values(data.query?.pages || []);
                const page = pages[0];
                if (!page || page.missing || !page.extract) { showError(title); return; }
                cache.set(title, page);
                render(title, page);
            } catch (e) {
                console.warn('Wikipedia API:', e);
                showError(title);
            }
        }

        treeBtns.forEach(b => b.addEventListener('click', () => loadArticle(b.dataset.title)));
        prevEl.addEventListener('click', (e) => { e.preventDefault(); if (prevEl.dataset.title) loadArticle(prevEl.dataset.title); });
        nextEl.addEventListener('click', (e) => { e.preventDefault(); if (nextEl.dataset.title) loadArticle(nextEl.dataset.title); });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = input.value.trim();
            if (q) loadArticle(q);
        });

        loadArticle(current);
