/* Couche de persistance du Dolphinarium.
 * Aujourd'hui : localStorage (perso, dans le navigateur, gratuit, offline).
 * Demain : brancher Supabase derrière la MÊME interface (scores partagés,
 * mode contributeur) sans toucher aux pages/jeux/quiz.
 * Important file:// : chaque fichier est une origine opaque, localStorage y est
 * bloqué (erreur console même attrapée). On bascule alors sur un repli mémoire :
 * scores valides pour la session, persistés dès que le site est servi en http(s).
 * Interface quiz : saveResult({theme, score, total}) / getHistory() / getBestScores() / clearHistory()
 * Interface jeux : saveGameScore({game, score}) / getBestGameScores() / clearGameScores()
 * Primitives : getItem(key) / setItem(key, value) / removeItem(key) */
const DolphinariumStorage = (() => {
    const KEY = 'dolphinarium_scores_v1';
    const GAMES_KEY = 'dolphinarium_jeux_v1';
    const MAX_ENTRIES = 100;

    const memory = {};
    const useMemory = typeof location !== 'undefined' && location.protocol === 'file:';

    function rawGet(k) {
        if (useMemory) return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null;
        try { return localStorage.getItem(k); } catch { return null; }
    }

    function rawSet(k, v) {
        if (useMemory) { memory[k] = String(v); return true; }
        try { localStorage.setItem(k, v); return true; } catch { return false; }
    }

    function rawRemove(k) {
        if (useMemory) { delete memory[k]; return; }
        try { localStorage.removeItem(k); } catch { /* noop */ }
    }

    function readJson(key) {
        try {
            const raw = rawGet(key);
            if (!raw) return [];
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    return {
        getItem(key) { return rawGet(key); },
        setItem(key, value) { return rawSet(key, value); },
        removeItem(key) { rawRemove(key); },
        isPersistent() { return !useMemory; },
        saveResult({ theme, score, total }) {
            const entries = readJson(KEY);
            entries.push({ theme, score, total, date: new Date().toISOString() });
            rawSet(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
        },
        getHistory() {
            return readJson(KEY).slice().reverse();
        },
        getBestScores() {
            // Meilleur score par thématique : { [theme]: { score, total, date } }
            const best = {};
            for (const e of readJson(KEY)) {
                const prev = best[e.theme];
                if (!prev || e.score > prev.score || (e.score === prev.score && e.date > prev.date)) {
                    best[e.theme] = e;
                }
            }
            return best;
        },
        clearHistory() {
            rawRemove(KEY);
        },
        saveGameScore({ game, score }) {
            const entries = readJson(GAMES_KEY);
            entries.push({ game, score, date: new Date().toISOString() });
            rawSet(GAMES_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
        },
        getBestGameScores() {
            // Meilleur score par jeu : { [game]: { score, date } }
            const best = {};
            for (const e of readJson(GAMES_KEY)) {
                const prev = best[e.game];
                if (!prev || e.score > prev.score) best[e.game] = e;
            }
            return best;
        },
        clearGameScores() {
            rawRemove(GAMES_KEY);
        }
    };
})();
