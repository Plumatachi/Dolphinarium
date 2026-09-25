/* Carte Dolphinarium (Leaflet) : aquariums, zones de vie schématiques, flux saisonniers.
 * Dépendances globales : L (CDN Leaflet), AQUARIUMS / ZONES_VIE / FLUX / FLUX_COLORS (carte-data.js). */
(() => {
    const mapEl = document.getElementById('carte-map');
    const statusEl = document.getElementById('carte-status');

    if (typeof L === 'undefined') {
        statusEl.textContent = '⚠️ Carte indisponible : la librairie Leaflet n\u2019a pas pu être chargée (hors-ligne ?). Reconnectez-vous puis rechargez la page.';
        mapEl.classList.add('carte-offline');
        return;
    }

    const map = L.map('carte-map', { worldCopyJump: true, minZoom: 2 }).setView([28, -10], 2);
    L.control.scale({ imperial: false }).addTo(map);

    /* ----- Fond unique : satellite Esri (testé 200 OK, sans clé).
     * Esri Ocean : 404 (service retiré). OSM direct : 403 (politique d'usage).
     * CARTO : mentions "API Key required" — écarté. Satellite seul, validé lisible. */
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, attribution: 'Imagerie : Esri, Maxar, Earthstar Geographics'
    }).addTo(map);

    /* ----- 1. Aquariums : pastilles dauphin ----- */
    const aquariumsLayer = L.layerGroup();
    AQUARIUMS.forEach(a => {
        const icon = L.divIcon({ className: 'aqua-pin', html: '<span>🐬</span>', iconSize: [34, 34], iconAnchor: [17, 28], popupAnchor: [0, -26] });
        L.marker([a.lat, a.lng], { icon, title: a.nom })
            .bindPopup('<strong>' + a.nom + '</strong><br>' + a.ville + ' — ' + a.pays
                + '<br>🔹 ' + a.especes + '<br><em>' + a.note + '</em>')
            .addTo(aquariumsLayer);
    });
    aquariumsLayer.addTo(map);

    /* ----- 2. Zones de vie : aplats bleu clair ----- */
    const zonesLayer = L.layerGroup();
    ZONES_VIE.forEach(z => {
        L.polygon(z.coords, { color: '#90e0ef', weight: 2, fillColor: '#90e0ef', fillOpacity: 0.35 })
            .bindPopup('<strong>' + z.nom + '</strong><br>🔹 ' + z.especes + '<br>' + z.desc
                + '<br><em>Zone schématique et pédagogique.</em>')
            .bindTooltip(z.nom, { sticky: true })
            .addTo(zonesLayer);
    });

    /* ----- 3. Flux : courbes de Bézier + flèches ----- */
    function courbe(from, to, courbure) {
        // Courbe quadratique : point de contrôle décalé perpendiculairement au segment.
        const mx = (from[0] + to[0]) / 2;
        const my = (from[1] + to[1]) / 2;
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const len = Math.hypot(dx, dy) || 1;
        const cx = mx - (dy / len) * len * courbure;
        const cy = my + (dx / len) * len * courbure;
        const pts = [];
        for (let i = 0; i <= 32; i++) {
            const t = i / 32;
            pts.push([
                (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * cx + t * t * to[0],
                (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * cy + t * t * to[1]
            ]);
        }
        return pts;
    }

    function capAngle(p1, p2) {
        // Angle d'arrivée (degrés, 0 = nord) en compensant la longitude par cos(latitude).
        const lat = (p1[0] + p2[0]) / 2 * Math.PI / 180;
        const dx = (p2[1] - p1[1]) * Math.cos(lat);
        const dy = p2[0] - p1[0];
        return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    }

    const fluxLayer = L.layerGroup();
    FLUX.forEach(f => {
        const color = FLUX_COLORS[f.sens];
        const pts = courbe(f.from, f.to, f.courbe);
        L.polyline(pts, { color, weight: 3, opacity: 0.9 })
            .bindPopup('<strong>' + f.nom + '</strong><br>'
                + (f.sens === 'aller' ? '🟠 Dispersion hors zone' : '🟢 Retour vers la zone')
                + ' — ' + f.saison + '<br><em>Déplacement saisonnier schématique.</em>')
            .addTo(fluxLayer);
        const angle = capAngle(pts[pts.length - 3], pts[pts.length - 1]);
        const arrow = L.divIcon({
            className: 'flow-arrow-wrap',
            html: '<div class="flow-arrow" style="transform: rotate(' + angle + 'deg); border-top-color: ' + color + '"></div>',
            iconSize: [18, 18], iconAnchor: [9, 9]
        });
        L.marker(f.to, { icon: arrow, interactive: false }).addTo(fluxLayer);
    });

    /* ----- Contrôle des couches + légende ----- */
    L.control.layers(null, {
        '🐬 Aquariums avec dauphins': aquariumsLayer,
        '🩵 Zones de vie (schématique)': zonesLayer,
        '➡️ Flux saisonniers (schématique)': fluxLayer
    }, { collapsed: window.innerWidth < 768 }).addTo(map);

    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'carte-legend');
        div.innerHTML = '<strong>Légende</strong>'
            + '<p><span>🐬</span> Aquarium avec dauphins</p>'
            + '<p><span class="lg-zone"></span> Zone de vie (approx.)</p>'
            + '<p><span class="lg-flow aller"></span> Flux aller (dispersion)</p>'
            + '<p><span class="lg-flow retour"></span> Flux retour (vers zone)</p>';
        return div;
    };
    legend.addTo(map);

    const counts = AQUARIUMS.length + ' aquariums · ' + ZONES_VIE.length + ' zones · ' + FLUX.length + ' flux';
    statusEl.textContent = 'Carte chargée : ' + counts + '. Zones et flux schématiques — coordonnées aquariums vérifiées.';
})();
