document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const surahListContainer = document.getElementById('surah-list-container');
    const surahDisplayContainer = document.getElementById('surah-display-container');
    const ayahListContainer = document.getElementById('ayah-list-container');
    const searchInput = document.getElementById('surah-search');
    const clearSearchButton = document.getElementById('clear-search');
    const quranContentArea = document.querySelector('.quran-content-area'); // For scroll listening
    const surahNavigationContainer = document.getElementById('surah-navigation-buttons');
    const audioPlayerContainer = document.getElementById('quran-audio-player');
    const audioElement = document.getElementById('quran-audio-element');
    const playPauseButton = document.getElementById('audio-play-pause');
    const playPauseIcon = playPauseButton?.querySelector('i');
    const audioCurrentSurahSpan = document.getElementById('audio-current-surah');
    const audioCurrentAyahSpan = document.getElementById('audio-current-ayah');

    // --- API Endpoint ---
    const API_BASE_URL = 'https://api.alquran.cloud/v1';
    const LAST_SURAH_KEY = 'islamShine_lastReadSurah';

    // --- State ---
    let allSurahsMeta = [];
    let currentSurahData = null;
    let currentTranslation = 'en.sahih';
    let currentAudioEdition = 'ar.alafasy'; // Example audio edition
    let isLoadingSurah = false;
    let intersectionObserver; // For scroll highlighting Ayahs

    // --- Functions ---

    async function fetchSurahList() {
        try {
            const response = await fetch(`${API_BASE_URL}/meta`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.code === 200 && data.data?.surahs?.references) {
                allSurahsMeta = data.data.surahs.references;
                displaySurahList(allSurahsMeta);
                loadInitialSurah();
            } else { throw new Error('Invalid metadata format received.'); }
        } catch (error) {
            console.error('Error fetching Surah list:', error);
            if (surahListContainer) surahListContainer.innerHTML = `<p class="error-text">Failed to load Surah list.</p>`;
            if (surahDisplayContainer) surahDisplayContainer.innerHTML = `<p class="error-text">Failed to load Surah list.</p>`;
        }
    }

    function displaySurahList(surahs) {
        if (!surahListContainer) return;
        surahListContainer.innerHTML = '';
        if (surahs.length === 0) { surahListContainer.innerHTML = '<p class="loading-text">No Surahs found.</p>'; return; }
        surahs.forEach(surah => {
            const link = document.createElement('a');
            link.classList.add('surah-list-item');
            link.href = `#surah-${surah.number}`;
            link.dataset.surahNumber = surah.number;
            // Updated HTML structure to match CSS better
            link.innerHTML = `
                <div class="surah-info">
                    <div>
                        <span class="surah-number">${surah.number}.</span>
                        <span class="surah-name-en">${surah.englishName}</span>
                    </div>
                    <span class="surah-name-ar">${surah.name}</span>
                </div>
                <div class="surah-verses-container"> <!-- Wrapper for styling -->
                     <span class="surah-verses">${surah.numberOfAyahs} Ayahs</span>
                </div>`;
            link.addEventListener('click', handleSurahLinkClick);
            surahListContainer.appendChild(link);
        });
    }

    function handleSurahLinkClick(e) {
        e.preventDefault();
        if (isLoadingSurah) return;
        const surahNumber = e.currentTarget.dataset.surahNumber;
        if (surahNumber) { fetchAndDisplaySurah(surahNumber); }
    }

    async function fetchAndDisplaySurah(surahNumber) {
        if (!surahDisplayContainer || !ayahListContainer || isLoadingSurah) return;
        isLoadingSurah = true;
        surahNumber = parseInt(surahNumber, 10);

        surahDisplayContainer.innerHTML = '<p class="loading-text">Loading Surah...</p>';
        ayahListContainer.innerHTML = '<p class="loading-text">Loading Ayahs...</p>';
        surahNavigationContainer.innerHTML = '';
        audioPlayerContainer.style.display = 'none';
        resetAudioPlayer();
        highlightActiveSurahLink(surahNumber);

        try {
            // --- API Suggestion for Word Timings ---
            // Finding a FREE API with reliable word-by-word timings is hard.
            // Options to explore (might have costs or limitations):
            // 1. Quran.com API (v4): https://quran.com/docs/api/words - Often requires specific reciters. Check their terms.
            // 2. Other specialized Quran APIs: Search for "Quran API word timings".
            //
            // For now, we fetch text and basic audio.
            const editions = `quran-uthmani,${currentTranslation},${currentAudioEdition}`;
            const response = await fetch(`${API_BASE_URL}/surah/${surahNumber}/editions/${editions}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.code === 200 && data.data && data.data.length >= 2) {
                const arabicEdition = data.data.find(ed => ed.edition.identifier === 'quran-uthmani');
                const translationEdition = data.data.find(ed => ed.edition.identifier === currentTranslation);
                const audioEditionData = data.data.find(ed => ed.edition.identifier === currentAudioEdition);

                if (!arabicEdition || !translationEdition) { throw new Error('Required text editions not found.'); }

                currentSurahData = { arabic: arabicEdition, translation: translationEdition, audio: audioEditionData };

                displaySurahContent(currentSurahData.arabic, currentSurahData.translation);
                displayAyahList(currentSurahData.arabic.ayahs);
                setupSurahNavigation(currentSurahData.arabic.number);
                setupAudioPlayer(currentSurahData.audio, currentSurahData.arabic.number);
                saveLastSurah(surahNumber);
                setupIntersectionObserver(); // Re-setup observer for new content

            } else { throw new Error('Invalid Surah data format received.'); }
        } catch (error) {
            console.error(`Error fetching Surah ${surahNumber}:`, error);
            surahDisplayContainer.innerHTML = `<p class="error-text">Failed to load Surah ${surahNumber}. ${error.message}</p>`;
            ayahListContainer.innerHTML = `<p class="error-text">Error</p>`;
        } finally { isLoadingSurah = false; }
    }

    function highlightActiveSurahLink(surahNumber) {
        document.querySelectorAll('.surah-list-item').forEach(item => {
            item.classList.remove('active');
            if (parseInt(item.dataset.surahNumber, 10) === surahNumber) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    function displaySurahContent(surahArabic, surahTranslation) {
        if (!surahDisplayContainer) return;
        surahDisplayContainer.innerHTML = '';

        const headerDiv = document.createElement('div');
        headerDiv.classList.add('surah-header');
        headerDiv.innerHTML = `...`; // Same header structure as before
        headerDiv.innerHTML = `
            <h3>${surahArabic.number}. ${surahArabic.englishName} (${surahArabic.englishNameTranslation})</h3>
            <div class="arabic-name">${surahArabic.name}</div>
            <p>Revelation: ${surahArabic.revelationType} - Ayahs: ${surahArabic.numberOfAyahs}</p>
            ${(surahArabic.number !== 1 && surahArabic.number !== 9) ? `<div class="bismillah">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>` : ''}
        `;
        surahDisplayContainer.appendChild(headerDiv);

        surahArabic.ayahs.forEach((ayahAr, index) => {
            const ayahTr = surahTranslation.ayahs[index];
             if (surahArabic.number !== 1 && surahArabic.number !== 9 && ayahAr.numberInSurah === 1 && ayahAr.text.startsWith('بِسۡمِ ٱللَّهِ')) { return; }

            const ayahContainer = document.createElement('div');
            ayahContainer.classList.add('ayah-container');
            ayahContainer.id = `ayah-${surahArabic.number}-${ayahAr.numberInSurah}`;
            ayahContainer.dataset.ayahRef = `${surahArabic.number}:${ayahAr.numberInSurah}`;

            const arabicText = document.createElement('p');
            arabicText.classList.add('ayah-text-ar');
            // Basic structure - adding spans around words for future highlighting is complex without timing data
            arabicText.innerHTML = `<span class="ayah-number">${ayahAr.numberInSurah}</span> ${ayahAr.text}`;
            ayahContainer.appendChild(arabicText);

            if (ayahTr) {
                const translationText = document.createElement('p');
                translationText.classList.add('ayah-text-en');
                translationText.textContent = ayahTr.text;
                ayahContainer.appendChild(translationText);
            }
            surahDisplayContainer.appendChild(ayahContainer);
        });
    }

    function displayAyahList(ayahs) {
        if (!ayahListContainer) return;
        ayahListContainer.innerHTML = '';
        if (!ayahs || ayahs.length === 0) { ayahListContainer.innerHTML = '<p class="loading-text">No Ayahs</p>'; return; }

        ayahs.forEach(ayah => {
             if (currentSurahData.arabic.number !== 1 && currentSurahData.arabic.number !== 9 && ayah.numberInSurah === 1 && ayah.text.startsWith('بِسۡمِ ٱللَّهِ')) { return; }
            const link = document.createElement('a');
            link.classList.add('ayah-list-item');
            link.href = `#ayah-${currentSurahData.arabic.number}-${ayah.numberInSurah}`;
            link.dataset.ayahNumberInSurah = ayah.numberInSurah;
            link.textContent = `Ayah ${ayah.numberInSurah}`;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = `ayah-${currentSurahData.arabic.number}-${ayah.numberInSurah}`;
                const targetElement = document.getElementById(targetId);
                if (targetElement) { targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            });
            ayahListContainer.appendChild(link);
        });
    }

    function highlightActiveAyahLink(ayahNumber) {
        document.querySelectorAll('.ayah-list-item').forEach(item => {
            item.classList.remove('active');
             if (parseInt(item.dataset.ayahNumberInSurah, 10) === ayahNumber) {
                item.classList.add('active');
                 item.scrollIntoView({ block: 'nearest' });
             }
        });
        if (audioCurrentAyahSpan) { audioCurrentAyahSpan.textContent = `Ayah: ${ayahNumber || '-'}`; }
    }

    function setupIntersectionObserver() {
         if (intersectionObserver) { intersectionObserver.disconnect(); }
         const options = { root: null, rootMargin: '-40% 0px -60% 0px', threshold: 0 }; // Use viewport root
         intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const ayahContainer = entry.target; // The ayah-container div
                if (entry.isIntersecting) {
                    const ayahRef = ayahContainer.dataset.ayahRef;
                    if (ayahRef) {
                        const [surah, ayah] = ayahRef.split(':');
                        highlightActiveAyahLink(parseInt(ayah, 10));
                        ayahContainer.classList.add('active-ayah'); // Add highlight to content
                        if (audioCurrentAyahSpan) audioCurrentAyahSpan.textContent = `Ayah: ${ayah}`;
                    }
                } else {
                    ayahContainer.classList.remove('active-ayah'); // Remove highlight when not centered
                }
            });
         }, options);
         document.querySelectorAll('.ayah-container').forEach(el => { intersectionObserver.observe(el); });
    }

    function setupAudioPlayer(audioData, surahNumber) {
        if (!audioElement || !audioPlayerContainer || !playPauseButton || !playPauseIcon) return;
        // Using a known CDN source for full surah audio
        const surahAudioUrl = `https://cdn.islamic.network/quran/audio-surah/128/${currentAudioEdition}/${surahNumber}.mp3`;
        console.log("Setting audio source:", surahAudioUrl);
        audioElement.src = surahAudioUrl;
        audioElement.load();

        if (audioCurrentSurahSpan) audioCurrentSurahSpan.textContent = `Surah: ${surahNumber}`;
        if (audioCurrentAyahSpan) audioCurrentAyahSpan.textContent = `Ayah: -`;
        audioPlayerContainer.style.display = 'flex';

        playPauseIcon.classList.remove('fa-pause'); playPauseIcon.classList.add('fa-play');
        playPauseButton.setAttribute('aria-label', 'Play');

        // Re-attach listeners cleanly
        playPauseButton.replaceWith(playPauseButton.cloneNode(true));
        const newPlayPauseButton = document.getElementById('audio-play-pause');
        const newPlayPauseIcon = newPlayPauseButton?.querySelector('i');

        if (newPlayPauseButton && newPlayPauseIcon) {
             newPlayPauseButton.addEventListener('click', () => {
                 if (audioElement.paused || audioElement.ended) { audioElement.play().catch(e => console.error("Audio play failed:", e)); }
                 else { audioElement.pause(); }
             });
             audioElement.onplay = () => { newPlayPauseIcon.classList.replace('fa-play', 'fa-pause'); newPlayPauseButton.setAttribute('aria-label', 'Pause'); };
             audioElement.onpause = () => { newPlayPauseIcon.classList.replace('fa-pause', 'fa-play'); newPlayPauseButton.setAttribute('aria-label', 'Play'); };
             audioElement.onended = () => { newPlayPauseIcon.classList.replace('fa-pause', 'fa-play'); newPlayPauseButton.setAttribute('aria-label', 'Play'); if (audioCurrentAyahSpan) audioCurrentAyahSpan.textContent = `Ayah: -`; };

             // TODO: Add timeupdate listener here for word highlighting IF you get timing data
             // audioElement.ontimeupdate = () => { highlightWordBasedOnTime(audioElement.currentTime); };

        } else { console.error("Failed to re-attach listener to cloned audio button"); }
    }

    function resetAudioPlayer() { /* ... unchanged ... */ if (audioElement) { audioElement.pause(); audioElement.removeAttribute('src'); audioElement.load(); } if (playPauseIcon) { playPauseIcon.classList.replace('fa-pause', 'fa-play'); } if (playPauseButton) playPauseButton.setAttribute('aria-label', 'Play'); if (audioCurrentSurahSpan) audioCurrentSurahSpan.textContent = `Surah: -`; if (audioCurrentAyahSpan) audioCurrentAyahSpan.textContent = `Ayah: -`; if (audioPlayerContainer) audioPlayerContainer.style.display = 'none'; }
    function setupSurahNavigation(currentSurahNumber) { /* ... unchanged ... */ if (!surahNavigationContainer) return; surahNavigationContainer.innerHTML = ''; const hasPrevious = currentSurahNumber > 1; const hasNext = currentSurahNumber < 114; if (hasPrevious) { const prevButton = document.createElement('button'); prevButton.classList.add('surah-nav-button'); prevButton.innerHTML = `<i class="fas fa-chevron-left"></i> Prev Surah`; prevButton.addEventListener('click', () => { if (!isLoadingSurah) fetchAndDisplaySurah(currentSurahNumber - 1); }); surahNavigationContainer.appendChild(prevButton); } else { surahNavigationContainer.appendChild(document.createElement('div')); } if (hasNext) { const nextButton = document.createElement('button'); nextButton.classList.add('surah-nav-button'); nextButton.innerHTML = `Next Surah <i class="fas fa-chevron-right"></i>`; nextButton.addEventListener('click', () => { if (!isLoadingSurah) fetchAndDisplaySurah(currentSurahNumber + 1); }); surahNavigationContainer.appendChild(nextButton); } else { surahNavigationContainer.appendChild(document.createElement('div')); } }
    function saveLastSurah(surahNumber) { try { localStorage.setItem(LAST_SURAH_KEY, surahNumber); } catch (e) { console.error("Failed to save last surah:", e); } }
    function loadLastSurah() { try { return localStorage.getItem(LAST_SURAH_KEY); } catch (e) { console.error("Failed to load last surah:", e); return null; } }
    function loadInitialSurah() { const lastSurah = loadLastSurah(); const initialSurah = lastSurah ? parseInt(lastSurah, 10) : 1; if (initialSurah >= 1 && initialSurah <= 114) { fetchAndDisplaySurah(initialSurah); } else { fetchAndDisplaySurah(1); } }
    function filterSurahList() { /* ... unchanged ... */ const searchTerm = searchInput.value.toLowerCase().trim(); if (!allSurahsMeta || allSurahsMeta.length === 0) return; const filteredSurahs = allSurahsMeta.filter(surah => { const nameEnLower = surah.englishName.toLowerCase(); const nameAr = surah.name; const numberStr = String(surah.number); const translationLower = surah.englishNameTranslation.toLowerCase(); return nameEnLower.includes(searchTerm) || numberStr.includes(searchTerm) || translationLower.includes(searchTerm) || nameAr.includes(searchTerm); }); displaySurahList(filteredSurahs); }

    // --- Event Listeners ---
    if (searchInput) searchInput.addEventListener('input', filterSurahList);
    if (clearSearchButton && searchInput) { clearSearchButton.addEventListener('click', () => { searchInput.value = ''; searchInput.focus(); filterSurahList(); }); }

    // --- Start ---
    fetchSurahList();

}); // End DOMContentLoaded