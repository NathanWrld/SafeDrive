export function initBurgerMenu() {

    const burgerBtn = document.getElementById('burgerBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const closeSidebarBtn = document.getElementById('closeSidebar');

    // Si no existe el layout, salir sin romper nada
    if (!burgerBtn || !sidebar || !overlay || !closeSidebarBtn) {
        return;
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        closeSidebarBtn.classList.remove('active');
    }

    burgerBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        closeSidebarBtn.classList.add('active');
    });

    overlay.addEventListener('click', closeSidebar);
    closeSidebarBtn.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidebar();
        }
    });

    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
}
