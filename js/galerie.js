// ---------- Lightbox (délégation : fonctionne pour les photos API) ----------
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const lightboxCaption = document.getElementById('lightbox-caption');
        const closeBtn = document.getElementById('lightbox-close');

        function openLightbox(item) {
            const img = item.querySelector('img');
            const cap = item.querySelector('.photo-caption');
            if (!img) return;
            lightboxImg.src = item.dataset.full || img.src;
            lightboxImg.alt = img.alt;
            lightboxCaption.textContent = cap ? cap.textContent : img.alt;
            lightbox.classList.add('open');
            lightbox.setAttribute('aria-hidden', 'false');
        }

        document.addEventListener('click', (e) => {
            const item = e.target.closest('.photo-item');
            if (item) openLightbox(item);
        });
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('photo-item')) {
                e.preventDefault();
                openLightbox(e.target);
            }
        });

        const close = () => {
            lightbox.classList.remove('open');
            lightbox.setAttribute('aria-hidden', 'true');
            lightboxImg.src = '';
        };
        closeBtn.addEventListener('click', close);
        lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

        // ---------- Wikimedia Commons API (gratuit, sans clé, CORS ok) ----------
        const remoteGrid = document.getElementById('remote-grid');
        const statusEl = document.getElementById('api-status');
        const loaderEl = document.getElementById('loader');
        const loadMoreBtn = document.getElementById('load-more');
        const chips = document.querySelectorAll('.gallery-controls .chip');

        let currentQuery = document.querySelector('.gallery-controls .chip.active')?.dataset.q || 'Tursiops truncatus jumping';
        let gsroffset = 0;
        let loading = false;

        function cleanTitle(fileTitle) {
            return fileTitle
                .replace(/^File:/, '')
                .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')
                .replace(/_/g, ' ')
                .slice(0, 80);
        }

        function buildApiUrl(query, offset) {
            const q = encodeURIComponent(query + ' filetype:bitmap -emulator -logo -dead -map -chart');
            let url = 'https://commons.wikimedia.org/w/api.php'
                + '?action=query&format=json&origin=*'
                + '&generator=search&gsrnamespace=6&gsrlimit=12'
                + '&gsrsearch=' + q
                + '&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata'
                + '&iiurlwidth=800&iiextmetadatafilter=Artist%7CLicenseShortName';
            if (offset) url += '&gsroffset=' + offset;
            return url;
        }

        const BTN_DEFAULT = 'Charger plus de dauphins';

        function setBtnLoading(on) {
            if (on) {
                loadMoreBtn.classList.add('loading');
                loadMoreBtn.disabled = true;
                loadMoreBtn.setAttribute('aria-busy', 'true');
                loadMoreBtn.innerHTML = '<span class="btn-dolphin" aria-hidden="true">🐬</span> Plongée en cours…';
            } else {
                loadMoreBtn.classList.remove('loading');
                loadMoreBtn.disabled = false;
                loadMoreBtn.removeAttribute('aria-busy');
                loadMoreBtn.innerHTML = '<span class="btn-label">' + BTN_DEFAULT + '</span>';
            }
        }

        async function loadDolphins(reset = false) {
            if (loading) return;
            loading = true;
            const t0 = Date.now();
            loaderEl.classList.add('show');
            setBtnLoading(true);
            if (reset) { remoteGrid.innerHTML = ''; gsroffset = 0; }

            try {
                const res = await fetch(buildApiUrl(currentQuery, gsroffset));
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                const pages = data.query?.pages ? Object.values(data.query.pages) : [];

                if (!pages.length && gsroffset === 0) {
                    statusEl.textContent = 'Aucun résultat Wikimedia pour cette recherche.';
                    return;
                }

                let added = 0;
                pages.forEach(p => {
                    const info = p.imageinfo?.[0];
                    if (!info?.thumburl) return;
                    const title = cleanTitle(p.title);
                    const artist = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').slice(0, 60) || 'Wikimedia Commons';
                    const filePage = 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title);

                    const div = document.createElement('div');
                    div.className = 'photo-item';
                    div.tabIndex = 0;
                    div.dataset.full = info.url;
                    div.innerHTML =
                        '<img loading="lazy" src="' + info.thumburl + '" alt="' + title.replace(/"/g, '&quot;') + '">'
                        + '<div class="photo-caption">' + title
                        + '<span class="credit">📷 ' + artist + ' — <a href="' + filePage + '" target="_blank" rel="noopener">source</a></span></div>';
                    remoteGrid.appendChild(div);
                    added++;
                });

                if (data.continue?.gsroffset !== undefined) {
                    gsroffset = data.continue.gsroffset;
                    loadMoreBtn.style.display = '';
                } else {
                    loadMoreBtn.style.display = 'none';
                }

                const total = remoteGrid.children.length;
                statusEl.innerHTML = total
                    ? total + ' photo(s) Wikimedia chargée(s) — <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>, vérifiez la licence avant réutilisation.'
                    : 'API joignable mais sans vignette exploitable pour cette recherche.';
            } catch (err) {
                console.warn('Wikimedia API:', err);
                statusEl.textContent = '⚠️ API Wikimedia injoignable (hors-ligne ?). Réessayez avec « Charger plus ».';
            } finally {
                // Temps mini d'animation pour que la nage du dauphin soit perceptible
                const wait = Math.max(0, 700 - (Date.now() - t0));
                await new Promise(r => setTimeout(r, wait));
                loaderEl.classList.remove('show');
                setBtnLoading(false);
                loading = false;
            }
        }

        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentQuery = chip.dataset.q;
                statusEl.textContent = 'Chargement : ' + chip.textContent + '…';
                loadDolphins(true);
            });
        });

        loadMoreBtn.addEventListener('click', () => loadDolphins(false));

        // Chargement initial
        loadDolphins(true);
