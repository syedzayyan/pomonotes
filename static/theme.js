// Add this to your script.js file or create a new theme.js file
document.addEventListener("DOMContentLoaded", () => {
  // Get theme toggle element
  const themeToggle = document.getElementById("theme-toggle");
  
  // Check for saved theme preference or use default
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  // Set initial theme based on saved preference or system preference
  if (savedTheme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    themeToggle.checked = true;
  } else if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.checked = false;
  } else if (prefersDark) {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.checked = false;
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    themeToggle.checked = true;
  }
  
  // Add event listener for theme toggle
  themeToggle.addEventListener("change", function() {
    if (this.checked) {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    }
  });
});
