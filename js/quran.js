document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const surahListContainer = document.getElementById('surah-list-container');
    const surahDisplayContainer = document.getElementById('surah-display-container');
    const searchInput = document.getElementById('surah-search');
    const clearSearchButton = document.getElementById('clear-search');
    const quranPlaceholder = document.querySelector('.quran-placeholder');

    // --- API Endpoint ---
    const API_BASE_URL = 'https://api.alquran.cloud/v1';

    // --- State ---
    let allSurahsMeta = []; // To store metadata for all surahs for searching
    let currentTranslation = 'en.sahih'; // Default translation identifier

    // --- Function to fetch Surah List (Metadata) ---
    async function fetchSurahList() {
        try {
            const response = await fetch(`${API_BASE_URL}/meta`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.code === 200 && data.data && data.data.surahs && data.data.surahs.references) {
                allSurahsMeta = data.data.surahs.references; // Store for searching
                displaySurahList(allSurahsMeta); // Display the full list initially
            } else {
                throw new Error('Invalid metadata format received from API.');
            }
        } catch (error) {
            console.error('Error fetching Surah list:', error);
            if (surahListContainer) surahListContainer.innerHTML = `<p class="error-text">Failed to load Surah list. ${error.message}</p>`;
        }
    }

    // --- Function to display Surah List in Sidebar ---
    function displaySurahList(surahs) {
        if (!surahListContainer) return;
        surahListContainer.innerHTML = ''; // Clear previous list or loading message

        if (surahs.length === 0) {
            surahListContainer.innerHTML = '<p class="loading-text">No Surahs found.</p>';
            return;
        }

        surahs.forEach(surah => {
            const link = document.createElement('a');
            link.classList.add('surah-list-item');
            link.href = `#surah-${surah.number}`; // Use hash for navigation state (optional)
            link.dataset.surahNumber = surah.number; // Store number for fetching

            link.innerHTML = `
                <div class="surah-info">
                    <div>
                        <span class="surah-number">${surah.number}.</span>
                        <span class="surah-name-en">${surah.englishName}</span>
                        <span class="surah-verses">(${surah.numberOfAyahs} Ayahs)</span>
                    </div>
                    <span class="surah-name-ar">${surah.name}</span>
                </div>
            `;

            // Add click listener to each Surah link
            link.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default hash jump initially
                const surahNumber = e.currentTarget.dataset.surahNumber;
                fetchAndDisplaySurah(surahNumber);
                // Update URL hash (optional, good for sharing/bookmarking)
                // window.location.hash = `surah-${surahNumber}`;
            });

            surahListContainer.appendChild(link);
        });
    }

    // --- Function to fetch and display a specific Surah ---
    async function fetchAndDisplaySurah(surahNumber) {
        if (!surahDisplayContainer) return;
        // Show loading state
        surahDisplayContainer.innerHTML = '<p class="loading-text">Loading Surah...</p>';
        if (quranPlaceholder) quranPlaceholder.style.display = 'none'; // Hide placeholder

        // Highlight active link in sidebar
        document.querySelectorAll('.surah-list-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.surahNumber === surahNumber) {
                item.classList.add('active');
            }
        });

        try {
            // Fetch Surah data including Arabic text and selected translation
            // Example: https://api.alquran.cloud/v1/surah/1/editions/quran-uthmani,en.sahih
            const response = await fetch(`${API_BASE_URL}/surah/${surahNumber}/editions/quran-uthmani,${currentTranslation}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.code === 200 && data.data && data.data.length >= 2) {
                 // Assuming data.data[0] is Arabic (quran-uthmani) and data.data[1] is translation
                const surahArabic = data.data[0];
                const surahTranslation = data.data[1];

                // Check if editions match expectations
                if (surahArabic.edition.identifier !== 'quran-uthmani' || surahTranslation.edition.identifier !== currentTranslation) {
                     console.warn("API returned editions in unexpected order.");
                     // Add logic here to find the correct editions if needed
                }

                displaySurahContent(surahArabic, surahTranslation);
            } else {
                throw new Error('Invalid Surah data format received from API.');
            }

        } catch (error) {
            console.error(`Error fetching Surah ${surahNumber}:`, error);
            if (surahDisplayContainer) surahDisplayContainer.innerHTML = `<p class="error-text">Failed to load Surah ${surahNumber}. ${error.message}</p>`;
        }
    }

    // --- Function to display the fetched Surah content ---
    function displaySurahContent(surahArabic, surahTranslation) {
        if (!surahDisplayContainer) return;
        surahDisplayContainer.innerHTML = ''; // Clear loading message

        // --- Create Surah Header ---
        const headerDiv = document.createElement('div');
        headerDiv.classList.add('surah-header');

        const titleEn = document.createElement('h3');
        titleEn.textContent = `${surahArabic.number}. ${surahArabic.englishName} (${surahArabic.englishNameTranslation})`;
        headerDiv.appendChild(titleEn);

        const titleAr = document.createElement('div');
        titleAr.classList.add('arabic-name');
        titleAr.textContent = surahArabic.name;
        headerDiv.appendChild(titleAr);

        const revelationType = document.createElement('p');
        revelationType.textContent = `Revelation: ${surahArabic.revelationType} - Ayahs: ${surahArabic.numberOfAyahs}`;
        headerDiv.appendChild(revelationType);

        // Add Bismillah (except for Surah 1 - Fatiha and Surah 9 - Tawbah)
        if (surahArabic.number !== 1 && surahArabic.number !== 9) {
            const bismillah = document.createElement('div');
            bismillah.classList.add('bismillah');
            // Bismillah text in Arabic
            bismillah.textContent = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
            headerDiv.appendChild(bismillah);
        }
        surahDisplayContainer.appendChild(headerDiv);

        // --- Display Ayahs ---
        for (let i = 0; i < surahArabic.ayahs.length; i++) {
            const ayahAr = surahArabic.ayahs[i];
            const ayahTr = surahTranslation.ayahs[i]; // Assumes ayahs arrays are aligned

            // Skip Bismillah if it's included in Ayah 1 (for Surahs other than 1 & 9)
            if (surahArabic.number !== 1 && surahArabic.number !== 9 && i === 0 && ayahAr.text.startsWith('بِسۡمِ ٱللَّهِ')) {
                 continue; // Already added header Bismillah
            }

            const ayahContainer = document.createElement('div');
            ayahContainer.classList.add('ayah-container');

            const arabicText = document.createElement('p');
            arabicText.classList.add('ayah-text-ar');
            arabicText.innerHTML = `<span class="ayah-number">${ayahAr.numberInSurah}</span> ${ayahAr.text}`; // Combine number and text
            ayahContainer.appendChild(arabicText);

            if (ayahTr) { // Check if translation exists for this ayah
                const translationText = document.createElement('p');
                translationText.classList.add('ayah-text-en');
                translationText.textContent = ayahTr.text;
                ayahContainer.appendChild(translationText);
            }

            surahDisplayContainer.appendChild(ayahContainer);
        }
    }


    // --- Function to filter Surah list based on search input ---
    function filterSurahList() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const filteredSurahs = allSurahsMeta.filter(surah => {
            const nameEnLower = surah.englishName.toLowerCase();
            const nameAr = surah.name; // Keep original Arabic for potential inclusion
            const numberStr = String(surah.number);
            const translationLower = surah.englishNameTranslation.toLowerCase();

            return nameEnLower.includes(searchTerm) ||
                   numberStr.includes(searchTerm) ||
                   translationLower.includes(searchTerm) ||
                   nameAr.includes(searchTerm); // Basic Arabic search
        });
        displaySurahList(filteredSurahs);
    }

    // --- Event Listeners ---
    // Search input listener
    if (searchInput) {
        searchInput.addEventListener('input', filterSurahList);
    }

    // Clear search button listener
    if (clearSearchButton && searchInput) {
        clearSearchButton.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.focus();
            filterSurahList(); // Display full list again
        });
    }

    // --- Initial Load ---
    fetchSurahList();

}); // End DOMContentLoaded