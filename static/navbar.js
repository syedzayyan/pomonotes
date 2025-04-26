// navbar.js
document.addEventListener('DOMContentLoaded', function() {
    // Load the navbar content
    fetch('/static/navbar.html')
        .then(response => response.text())
        .then(html => {
            // Insert the navbar at the placeholder location
            document.getElementById('navbar-placeholder').innerHTML = html;
            
            // Determine current page and set active class
            const currentPath = window.location.pathname;
            let activeNavId = '';
            
            if (currentPath === '/' || currentPath.startsWith('/index')) {
                activeNavId = 'nav-timer';
            } else if (currentPath.startsWith('/history')) {
                activeNavId = 'nav-history';
            } else if (currentPath.startsWith('/notes')) {
                activeNavId = 'nav-notes';
            } else if (currentPath.startsWith('/activities')) {
                activeNavId = 'nav-activities';
            }
            
            // Set active class if an element was found
            if (activeNavId) {
                const activeElement = document.getElementById(activeNavId);
                if (activeElement) {
                    activeElement.classList.add('active');
                }
            }
            
            // Initialize theme toggle if it exists
            initThemeToggle();
        })
        .catch(error => {
            console.error('Error loading navbar:', error);
        });
});

// Initialize theme toggle
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    
    // Check current theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    themeToggle.checked = currentTheme === 'light';
    
    // Set up event listener
    themeToggle.addEventListener('change', function() {
        const newTheme = this.checked ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}
