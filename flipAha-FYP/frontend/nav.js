// Navigation helper - update active nav button based on current page
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navButtons = document.querySelectorAll('.nav-button');
    
    navButtons.forEach(btn => {
        const href = btn.getAttribute('href');
        const btnPage = href.split('/').pop() || 'index.html';
        
        if (btnPage === currentPage || (currentPage === '' && btnPage === 'index.html')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
});
