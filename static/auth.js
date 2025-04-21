// Authentication helper functions
document.addEventListener('DOMContentLoaded', () => {
    // Skip auth check on login page
    if (window.location.pathname === '/login') {
        return;
    }
    
    // Check authentication status
    checkAuthStatus();
    
    // Modal for session expiration
    createAuthModal();
    
    // Add logout button to nav if we're on a protected page
    addLogoutButton();
});

// Check if the user is authenticated
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.authenticated) {
            // If not authenticated, redirect to login
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        // On error, assume not authenticated and redirect
        window.location.href = '/login';
    }
}

// Create authentication modal for session expiration
function createAuthModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('auth-modal')) {
        const modal = document.createElement('dialog');
        modal.id = 'auth-modal';
        
        modal.innerHTML = `
            <article>
                <header>
                    <h3>Session Expired</h3>
                </header>
                <p>Your session has expired. Please log in again to continue.</p>
                <footer>
                    <button id="auth-modal-login" class="primary">Login</button>
                </footer>
            </article>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener to login button
        document.getElementById('auth-modal-login').addEventListener('click', () => {
            window.location.href = '/login';
        });
    }
}

// Show auth modal when session expires
function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.showModal();
    }
}

// Add logout button to navigation
function addLogoutButton() {
    const navUl = document.querySelector('nav ul:last-child');
    
    if (navUl) {
        // Create logout list item
        const logoutLi = document.createElement('li');
        const logoutBtn = document.createElement('a');
        logoutBtn.href = '#';
        logoutBtn.textContent = 'Logout';
        logoutBtn.className = 'logout-btn';
        logoutBtn.onclick = logout;
        
        logoutLi.appendChild(logoutBtn);
        navUl.appendChild(logoutLi);
    }
}

// Logout function
function logout() {
    // Clear auth cookie
    document.cookie = 'auth_token=; path=/; max-age=0';
    
    // Redirect to login page
    window.location.href = '/login';
}

// Intercept 401 responses globally
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    
    // If we get a 401 Unauthorized, show auth modal
    if (response.status === 401) {
        // Clear auth cookie
        document.cookie = 'auth_token=; path=/; max-age=0';
        
        // Show auth modal
        showAuthModal();
    }
    
    return response;
};
