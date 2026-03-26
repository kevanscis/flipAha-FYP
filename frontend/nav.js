// Navigation helper - update active nav button based on current page
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navButtons = document.querySelectorAll('.nav-button');
    
    navButtons.forEach(btn => {
        const href = btn.getAttribute('href');
        if (!href) {
            return;
        }
        const btnPage = href.split('/').pop() || 'index.html';
        
        if (btnPage === currentPage || (currentPage === '' && btnPage === 'index.html')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const mobileMenus = [];
    document.querySelectorAll('.mobile-menu-toggle').forEach((toggle) => {
        const targetId = toggle.getAttribute('aria-controls');
        const headerNav = targetId
            ? document.getElementById(targetId)
            : toggle.closest('header')?.querySelector('.header-nav');

        if (!headerNav) {
            return;
        }

        const closeMenu = () => {
            headerNav.classList.remove('mobile-open');
            toggle.setAttribute('aria-expanded', 'false');
        };

        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = headerNav.classList.toggle('mobile-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        headerNav.querySelectorAll('a.nav-button, button.nav-button').forEach((item) => {
            item.addEventListener('click', () => {
                closeMenu();
            });
        });

        mobileMenus.push({ toggle, headerNav, closeMenu });
    });

    if (!mobileMenus.length) {
        return;
    }

    document.addEventListener('click', (event) => {
        mobileMenus.forEach(({ toggle, headerNav, closeMenu }) => {
            if (!headerNav.contains(event.target) && !toggle.contains(event.target)) {
                closeMenu();
            }
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            mobileMenus.forEach(({ closeMenu }) => closeMenu());
        }
    });
});
