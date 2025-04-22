// Enhanced theme handling for all pages
document.addEventListener("DOMContentLoaded", () => {
  // Get theme toggle element
  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return; // Exit if not on a page with theme toggle
  
  // Check for saved theme preference or use default
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  // Apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeToggle) {
      themeToggle.checked = (theme === "light");
    }
  }
  
  // Set initial theme based on saved preference or system preference
  if (savedTheme === "light") {
    applyTheme("light");
  } else if (savedTheme === "dark") {
    applyTheme("dark");
  } else if (prefersDark) {
    applyTheme("dark");
  } else {
    applyTheme("light");
  }
  
  // Add event listener for theme toggle
  themeToggle.addEventListener("change", function() {
    const newTheme = this.checked ? "light" : "dark";
    applyTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  });
  
  // Add theme toggle to all pages if it doesn't exist
  const addThemeToggleToNav = () => {
    const nav = document.querySelector('nav ul:last-child');
    if (!nav || document.querySelector('.theme-switcher')) return;
    
    const themeItem = document.createElement('li');
    themeItem.className = 'theme-switcher';
    themeItem.innerHTML = `
      <label class="theme-toggle">
        <input type="checkbox" id="theme-toggle-added">
        <span class="theme-slider">
          <span class="sun-icon"></span>
          <span class="moon-icon"></span>
        </span>
      </label>
    `;
    
    nav.appendChild(themeItem);
    
    // Set the correct initial state
    const addedToggle = document.getElementById('theme-toggle-added');
    if (addedToggle) {
      addedToggle.checked = document.documentElement.getAttribute('data-theme') === 'light';
      
      // Add event listener
      addedToggle.addEventListener('change', function() {
        const newTheme = this.checked ? "light" : "dark";
        applyTheme(newTheme);
        localStorage.setItem("theme", newTheme);
      });
    }
  };
  
  // Call the function to add theme toggle to all pages
  addThemeToggleToNav();
});
