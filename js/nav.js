/* Burger auto (<=860px via CSS) : bascule .nav-open sur le header.
 * Ferme au clic sur un lien, à Échap et au retour en desktop. */
(() => {
    const header = document.querySelector('.site-header');
    const burger = header ? header.querySelector('.nav-burger') : null;
    if (!header || !burger) return;
    const nav = header.querySelector('nav');

    function set(open) {
        header.classList.toggle('nav-open', open);
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
        burger.textContent = open ? '✕' : '☰';
    }

    burger.addEventListener('click', () => set(!header.classList.contains('nav-open')));
    nav.addEventListener('click', (e) => {
        if (e.target.closest('a')) set(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') set(false);
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 860) set(false);
    });
})();
