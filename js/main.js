// js/main.js

// --- Theme Logic ---
const body = document.body;

// Function to APPLY theme class to body and SAVE preference
function applyThemeClassAndSave(theme) {
    if (theme === 'dark') {
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else { // 'light' or any other case defaults to light
        body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
}

// Function to UPDATE the toggle button icon and ARIA label
function updateThemeToggleButtonState() {
    const themeToggleButton = document.getElementById('theme-toggle');
    const icon = themeToggleButton?.querySelector('i');

    if (icon && themeToggleButton) { // Only proceed if button and icon exist
        if (body.classList.contains('dark-mode')) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            themeToggleButton.setAttribute('aria-label', 'Switch to light mode');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            themeToggleButton.setAttribute('aria-label', 'Switch to dark mode');
        }
    } else {
       // Button/icon not loaded yet, state will be set when navbar.js calls this later
       // console.log("updateThemeToggleButtonState: Button or icon not found yet."); // Optional debug
    }
}

// --- Initial Theme Application (Runs immediately on script load) ---
// 1. Determine initial theme
let initialTheme = localStorage.getItem('theme');
if (!initialTheme) { // If no preference saved, check system
    initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
// 2. Apply theme class to body IMMEDIATELY
applyThemeClassAndSave(initialTheme);
// 3. Attempt to update button state (might succeed or wait for later call)
// It's okay if this doesn't find the button yet.
updateThemeToggleButtonState();


// --- Global function to set up the CLICK listener ---
// This is called from navbar.js AFTER the button is loaded.
function setupThemeToggle() {
    const button = document.getElementById('theme-toggle');
    if (button) {
        button.addEventListener('click', () => {
            // Determine the NEW theme based on the CURRENT body class
            const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
            // Apply the new theme class and save it
            applyThemeClassAndSave(newTheme);
            // Update the button's visual state
            updateThemeToggleButtonState();
        });
    } else {
        console.warn("Theme toggle button not found when setting up listener.");
    }
}


// --- Other Main JS Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Main script loaded.");
    // Theme class on body is already set.
    // Theme button state *might* be set, will be correctly set when navbar.js calls updateThemeToggleButtonState.
    // Theme toggle click listener is set up via setupThemeToggle() called from navbar.js.

    // Example: Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId.length > 1) {
                 const targetElement = document.querySelector(targetId);
                 if(targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                 }
            }
        });
    });

}); // End DOMContentLoaded