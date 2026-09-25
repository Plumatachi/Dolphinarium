/* Données de la carte Dolphinarium.
 * AQUARIUMS : coordonnées vérifiées via Nominatim (lieux réels présentant des dauphins).
 * ZONES_VIE & FLUX : contours SCHÉMATIQUES et pédagogiques, pas des données scientifiques brutes. */
const AQUARIUMS = [
    { nom: 'Planète Sauvage', ville: 'Port-Saint-Père', pays: 'France', lat: 47.1152, lng: -1.7647, especes: 'Grand dauphin', note: 'Dernier delphinarium de France métropolitaine.' },
    { nom: 'Boudewijn Seapark', ville: 'Bruges', pays: 'Belgique', lat: 51.1823, lng: 3.2149, especes: 'Grand dauphin', note: 'Spectacles pédagogiques sur la côte flamande.' },
    { nom: 'Dolfinarium Harderwijk', ville: 'Harderwijk', pays: 'Pays-Bas', lat: 52.3541, lng: 5.6172, especes: 'Grand dauphin, marsouin', note: 'Plus grand parc de mammifères marins des Pays-Bas.' },
    { nom: 'Loro Parque', ville: 'Puerto de la Cruz, Tenerife', pays: 'Espagne', lat: 28.4086, lng: -16.5643, especes: 'Grand dauphin, orque', note: 'Orques et dauphins, programme de recherche associé.' },
    { nom: 'Oceanogràfic', ville: 'Valence', pays: 'Espagne', lat: 39.453, lng: -0.3472, especes: 'Grand dauphin', note: 'Plus grand aquarium d\u2019Europe, delphinarium intégré.' },
    { nom: 'Zoomarine Roma', ville: 'Torvaianica', pays: 'Italie', lat: 41.634, lng: 12.4565, especes: 'Grand dauphin', note: 'Parc marin au sud de Rome.' },
    { nom: 'Oltremare', ville: 'Riccione', pays: 'Italie', lat: 43.9886, lng: 12.6453, especes: 'Grand dauphin', note: 'Lagune des dauphins sur la côte adriatique.' },
    { nom: 'Georgia Aquarium', ville: 'Atlanta', pays: 'États-Unis', lat: 33.7633, lng: -84.3951, especes: 'Grand dauphin', note: 'L\u2019un des plus grands aquariums du monde.' },
    { nom: 'SeaWorld Orlando', ville: 'Orlando', pays: 'États-Unis', lat: 28.411, lng: -81.4619, especes: 'Grand dauphin, orque (fin des spectacles)', note: 'Historique parc marin de Floride.' },
    { nom: 'National Aquarium', ville: 'Baltimore', pays: 'États-Unis', lat: 39.2848, lng: -76.6077, especes: 'Grand dauphin', note: 'Colonie de dauphins en projet de sanctuaire marin.' },
    { nom: 'Ocean Park', ville: 'Hong Kong', pays: 'Chine', lat: 22.2348, lng: 114.1708, especes: 'Grand dauphin de l\u2019Indo-Pacifique', note: 'Dauphins d\u2019Asie du Sud-Est.' },
    { nom: 'uShaka Sea World', ville: 'Durban', pays: 'Afrique du Sud', lat: -29.8675, lng: 31.046, especes: 'Grand dauphin', note: 'Spectacles face à l\u2019océan Indien.' }
];

const ZONES_VIE = [
    { nom: 'Méditerranée occidentale', especes: 'Grand dauphin (Tursiops truncatus)',
        desc: 'Population côtière sédentaire, suivie par les scientifiques.',
        coords: [[43.5, 3], [44, 8], [41.5, 10], [38.5, 10], [36.5, 5.5], [36.5, 0], [38, -2], [41, -1]] },
    { nom: 'Golfe de Gascogne', especes: 'Dauphin commun (Delphinus delphis)',
        desc: 'Immense zone d\u2019alimentation au large, déplacements saisonniers côte ↔ large.',
        coords: [[48.5, -5], [47, -2], [45.5, -2], [44, -4], [44, -9], [46, -10.5]] },
    { nom: 'Caraïbes & golfe du Mexique', especes: 'Dauphin tacheté, grand dauphin',
        desc: 'Eaux chaudes peu profondes, nurseries côtières.',
        coords: [[25, -85], [22, -80], [18, -76], [15, -71], [18, -65], [23, -70]] },
    { nom: 'Pacifique Est tropical', especes: 'Dauphin à long bec (Stenella longirostris)',
        desc: 'Grands pods pélagiques suivant les bancs de poissons.',
        coords: [[15, -110], [10, -100], [5, -90], [0, -85], [5, -95], [10, -105]] },
    { nom: 'Côte sud-africaine', especes: 'Grand dauphin de l\u2019Indo-Pacifique',
        desc: 'Suit la migration des sardines le long de la côte (sardine run).',
        coords: [[-29, 31], [-31, 28], [-34, 24], [-35, 27], [-32, 30]] },
    { nom: 'Atlantique Nord froid', especes: 'Orque (Orcinus orca)',
        desc: 'Groupes suivant les bancs de harengs entre Norvège et Islande.',
        coords: [[64, -20], [67, -12], [70, -2], [68, 8], [64, 5], [62, -10]] }
];

/* sens: 'aller' (orange — dispersion hors zone) / 'retour' (vert — retour vers la zone) */
const FLUX = [
    { nom: 'Gascogne, dispersion estivale', sens: 'aller', saison: 'Été', from: [45.5, -3], to: [46, -9], courbe: 0.25 },
    { nom: 'Gascogne, retour côtier', sens: 'retour', saison: 'Automne', from: [46, -9], to: [45.5, -3], courbe: 0.25 },
    { nom: 'Méditerranée, déplacement vers l\u2019est', sens: 'aller', saison: 'Printemps', from: [38, 0], to: [41, 9], courbe: 0.2 },
    { nom: 'Méditerranée, retour vers l\u2019ouest', sens: 'retour', saison: 'Automne', from: [41, 9], to: [38, 0], courbe: 0.2 },
    { nom: 'Floride → Caraïbes', sens: 'aller', saison: 'Hiver', from: [27, -80], to: [20, -72], courbe: 0.22 },
    { nom: 'Caraïbes → Floride', sens: 'retour', saison: 'Été', from: [20, -72], to: [27, -80], courbe: 0.22 },
    { nom: 'Sardine run (descente)', sens: 'aller', saison: 'Hiver austral', from: [-28, 32], to: [-33, 27], courbe: 0.3 },
    { nom: 'Sardine run (remontée)', sens: 'retour', saison: 'Printemps austral', from: [-33, 27], to: [-28, 32], courbe: 0.3 }
];

const FLUX_COLORS = { aller: '#ff9f1c', retour: '#06d68a' };
