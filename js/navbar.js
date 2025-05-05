document.addEventListener('DOMContentLoaded', () => {
    const navbarContainer = document.getElementById('navbar-container');
    const header = document.querySelector('header');
    const navbarPath = 'components/navbar.html';
    // const homePageName = 'home.html'; // No longer needed for active link logic

    let mobileMenuContainer = null;

    fetch(navbarPath)
        .then(response => response.ok ? response.text() : Promise.reject(`HTTP error! status: ${response.status}`))
        .then(html => {
            if (!navbarContainer) return;
            navbarContainer.innerHTML = html;
            createMobileMenuContainer();

            // Theme Button Setup
            if (typeof updateThemeToggleButtonState === 'function') {
                updateThemeToggleButtonState();
            } else { console.error("updateThemeToggleButtonState function not found."); }
            if (typeof setupThemeToggle === 'function') {
                setupThemeToggle();
            } else { console.error("setupThemeToggle function not found."); }

            setupMobileToggle();
            // setActiveNavLink(homePageName); // REMOVED call to active link function
        })
        .catch(error => {
            console.error('Error fetching navbar:', error);
            if (navbarContainer) navbarContainer.innerHTML = '<p style="color: red; text-align: center;">Error loading navigation.</p>';
        });

    function createMobileMenuContainer() {
        if (!header) {
            console.error("Header element not found, cannot append mobile menu.");
            return;
        }
        if (document.getElementById('mobile-menu-container')) return;

        mobileMenuContainer = document.createElement('div');
        mobileMenuContainer.id = 'mobile-menu-container';
        const mobileMenuUl = document.createElement('ul');
        const desktopLinks = navbarContainer?.querySelectorAll('.navbar-links li');
        if (!desktopLinks || desktopLinks.length === 0) {
            console.error("Could not find desktop links to clone for mobile menu.");
            return;
        }
        const mobileLinkOrder = [];
        desktopLinks.forEach(linkLi => {
            mobileLinkOrder.push(linkLi.cloneNode(true));
        });
        mobileLinkOrder.forEach(item => {
            mobileMenuUl.appendChild(item);
        });
        mobileMenuContainer.appendChild(mobileMenuUl);
        header.appendChild(mobileMenuContainer);
    }

    function setupMobileToggle() {
        const toggleButton = navbarContainer?.querySelector('.navbar-toggle');
        const icon = toggleButton?.querySelector('i');
        if (!mobileMenuContainer) {
             setTimeout(() => { // Retry logic
                 if (!mobileMenuContainer) {
                     console.error("Mobile menu container not available for toggle setup even after delay.");
                     return;
                 }
                 setupMobileToggle();
             }, 100);
             return;
        }
        if (toggleButton && icon) {
            toggleButton.addEventListener('click', (event) => {
                event.stopPropagation();
                mobileMenuContainer.classList.toggle('active');
                if (mobileMenuContainer.classList.contains('active')) {
                    icon.classList.replace('fa-bars', 'fa-times');
                    toggleButton.setAttribute('aria-expanded', 'true');
                } else {
                    icon.classList.replace('fa-times', 'fa-bars');
                    toggleButton.setAttribute('aria-expanded', 'false');
                }
            });
            mobileMenuContainer.querySelectorAll('a').forEach(link => {
                 if (link.dataset.mobileLinkListenerAttached) return;
                 link.dataset.mobileLinkListenerAttached = 'true';
                 link.addEventListener('click', () => {
                    if (mobileMenuContainer.classList.contains('active')) {
                        mobileMenuContainer.classList.remove('active');
                        const currentIcon = toggleButton?.querySelector('i');
                        if (currentIcon) currentIcon.classList.replace('fa-times', 'fa-bars');
                        if (toggleButton) toggleButton.setAttribute('aria-expanded', 'false');
                    }
                });
            });
        } else {
            console.error("Mobile toggle button or its icon not found inside navbar container.");
        }
    }

    // Close mobile menu if clicking outside
    document.addEventListener('click', (event) => {
        if (!mobileMenuContainer || !mobileMenuContainer.classList.contains('active')) {
            return;
        }
        const isClickInsideNavbar = navbarContainer?.contains(event.target);
        const isClickInsideMobileMenu = mobileMenuContainer.contains(event.target);
        if (!isClickInsideNavbar && !isClickInsideMobileMenu) {
            mobileMenuContainer.classList.remove('active');
            const toggleButton = navbarContainer?.querySelector('.navbar-toggle');
            const icon = toggleButton?.querySelector('i');
            if (icon) icon.classList.replace('fa-times', 'fa-bars');
            if (toggleButton) toggleButton.setAttribute('aria-expanded', 'false');
        }
    });


    // REMOVED setActiveNavLink function entirely
    /*
    function setActiveNavLink(homeFilename = 'index.html') {
        // ... logic removed ...
    }
    */

}); // End DOMContentLoaded