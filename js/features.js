document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const prayerTimesContainer = document.getElementById('prayer-times-container');
    const nextPrayerInfoContainer = document.getElementById('next-prayer-info');
    const prayerSection = document.getElementById('prayer-times-section'); // Section element

    // --- State ---
    let prayerTimesData = {};
    let locationData = { city: null, country: null, timezone: null, latitude: null, longitude: null };
    let countdownInterval;
    let currentConfig = { method: 3, school: 0, latitude: null, longitude: null };
    let isFetching = false;

    // --- Configuration ---
    const LOCATION_STORAGE_KEY = 'islamShine_prayerLocation';
    const MAX_SUGGESTIONS = 3;
    // REMOVED COUNTDOWN_SHOW_SECONDS_THRESHOLD

    // --- API Keys & Endpoints ---
    const GEOAPIFY_API_KEY = 'a92c347118214c38be19a415e6586cbf'; // Replace if needed
    const IP_API_URL = 'https://ip-api.com/json/?fields=status,message,country,city,lat,lon,timezone';
    const ALADHAN_TIMINGS_URL = 'https://api.aladhan.com/v1/timings/';
    const GEOAPIFY_AUTOCOMPLETE_URL = `https://api.geoapify.com/v1/geocode/autocomplete?apiKey=${GEOAPIFY_API_KEY}&limit=5&type=city&text=`;
    const GEOAPIFY_SEARCH_URL = `https://api.geoapify.com/v1/geocode/search?limit=1&apiKey=${GEOAPIFY_API_KEY}&text=`;

    // --- Prayer Name to Icon Mapping ---
    const prayerIcons = { Fajr: 'fas fa-cloud-moon', Sunrise: 'fas fa-sun', Dhuhr: 'fas fa-sun', Asr: 'fas fa-cloud-sun', Maghrib: 'fas fa-cloud-moon', Isha: 'fas fa-moon', };

    // --- Helper: Show/Hide Skeleton Loading ---
    function showSkeletonLoading() {
        if (!prayerSection || !prayerTimesContainer) return;
        if (!prayerSection.classList.contains('location-error-active')) { hideLocationErrorOverlay(); }
        prayerSection.classList.add('loading');
        const locationDisplay = prayerSection.querySelector('#location-display');
        if (locationDisplay) locationDisplay.innerHTML = '';
        prayerTimesContainer.innerHTML = Array(6).fill('<div class="prayer-time-item"><span></span></div>').join('');
        if (nextPrayerInfoContainer) nextPrayerInfoContainer.innerHTML = '';
    }
    function hideSkeletonLoading() { if (!prayerSection) return; prayerSection.classList.remove('loading'); }

    // --- Location Functions ---
    async function getIPLocation() { console.log("Attempting IP..."); const r=await fetch(IP_API_URL); if(!r.ok)throw new Error(`IP Err: ${r.status}`); const d=await r.json(); if(d.status!=='success')throw new Error(`IP Fail: ${d.message||'?'}`); console.log("IP OK:",d); return {latitude:d.lat, longitude:d.lon, city:d.city, country:d.country, timezone:d.timezone}; }
    async function getCoordsByGeoapify(query) { console.log(`Geoapify search: ${query}`); const r=await fetch(`${GEOAPIFY_SEARCH_URL}${encodeURIComponent(query)}`); if(!r.ok)throw new Error(`Geoapify Err: ${r.status}`); const d=await r.json(); if(d.features?.length>0){ const p=d.features[0].properties; return {latitude:p.lat, longitude:p.lon, city:p.city||p.town||p.village||p.county||p.state, country:p.country||null, timezone:p.timezone?.name||null}; } else { throw new Error(`Geoapify couldn't find: "${query}".`); } }
    async function getCitySuggestions(query) { if (!query || query.length < 2 || !GEOAPIFY_API_KEY || GEOAPIFY_API_KEY === 'YOUR_GEOAPIFY_API_KEY_HERE') { hideSuggestions(); return []; } try { const r = await fetch(`${GEOAPIFY_AUTOCOMPLETE_URL}${encodeURIComponent(query)}`); if (!r.ok) throw new Error(`Suggest Err: ${r.status}`); const d = await r.json(); return d.features?.map(f=>({text: f.properties.formatted, lat: f.properties.lat, lon: f.properties.lon, city: f.properties.city, country: f.properties.country, timezone: f.properties.timezone?.name })) || []; } catch (e) { console.error("Suggest fetch err:", e); return []; } }

    // --- UI Update Functions ---
    function displaySuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('location-suggestions');
        if (!suggestionsContainer) return;
        suggestionsContainer.innerHTML = '';
        const limitedSuggestions = suggestions.slice(0, MAX_SUGGESTIONS);
        if (limitedSuggestions.length === 0) { suggestionsContainer.style.display = 'none'; return; }
        limitedSuggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = suggestion.text;
            button.addEventListener('click', () => {
                 console.log("Suggestion selected:", suggestion);
                 const inputField = document.getElementById('manual-location-input');
                 if(inputField) inputField.value = suggestion.text;
                 hideSuggestions(suggestionsContainer);
                 showSkeletonLoading();
                 locationData = { city: suggestion.city, country: suggestion.country, timezone: suggestion.timezone || locationData.timezone, latitude: suggestion.lat, longitude: suggestion.lon };
                 currentConfig.latitude = suggestion.lat; currentConfig.longitude = suggestion.lon;
                 saveLocationToStorage(locationData);
                 fetchPrayerTimes();
            });
            suggestionsContainer.appendChild(button);
        });
        suggestionsContainer.style.display = 'block';
    }

    function showLocationErrorOverlay(message = "Enter City, Address, or Postcode:") {
        if (!prayerSection) return;
        console.log("Showing location overlay..."); // Debug log
        let overlay = prayerSection.querySelector('.location-error-overlay');
        let inputField, suggestionsContainer;
        if (!overlay) {
            console.log("Creating new overlay element..."); // Debug log
            overlay = document.createElement('div');
            overlay.classList.add('location-error-overlay');
            // Ensure form and suggestions div are direct children or properly nested for flex centering
            overlay.innerHTML = `
                <button class="close-overlay-button" title="Close" type="button">×</button>
                <div class="location-error-content"> <!-- Added wrapper for content centering -->
                    <p class="error-message">${message}</p>
                    <div class="search-container">
                        <form class="location-search-form" id="manual-location-form" autocomplete="off" novalidate>
                            <input type="search" id="manual-location-input" placeholder="e.g., London, Mecca, SW1A..." required autocomplete="off" name="location-search-${Date.now()}">
                            <button type="submit" id="manual-location-button" title="Search Location"><i class="fas fa-search"></i></button>
                        </form>
                        <div id="location-suggestions"></div>
                    </div>
                </div>
            `;
            prayerSection.prepend(overlay); // Prepend to ensure it's within the section

            // Add Listeners (Only Once)
            const form = overlay.querySelector('#manual-location-form');
            inputField = overlay.querySelector('#manual-location-input');
            suggestionsContainer = overlay.querySelector('#location-suggestions');
            const closeButton = overlay.querySelector('.close-overlay-button');

            if(closeButton) {
                closeButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering other clicks
                    hideLocationErrorOverlay();
                });
            }
            if (form) { form.addEventListener('submit', handleManualLocationSearch); }
            if (inputField) {
                inputField.setAttribute('autocomplete', 'off');
                const handleInputFocusOrClick = () => { hideSuggestions(suggestionsContainer); };
                inputField.addEventListener('focus', handleInputFocusOrClick);
                inputField.addEventListener('click', handleInputFocusOrClick);
                inputField.addEventListener('input', handleSuggestionInput);
                // Global click listener to hide suggestions (ensure it checks if overlay is active)
                 document.addEventListener('click', (event) => {
                     const searchContainer = overlay?.querySelector('.search-container');
                     // Hide suggestions ONLY if the overlay is active and the click is outside the search container
                     if (prayerSection.classList.contains('location-error-active') && suggestionsContainer?.style.display === 'block' && !searchContainer?.contains(event.target)) {
                         hideSuggestions(suggestionsContainer);
                     }
                 }, true);
            }
        } else {
             console.log("Overlay exists, updating message..."); // Debug log
            const msgElement = overlay.querySelector('.error-message');
            inputField = overlay.querySelector('#manual-location-input');
            suggestionsContainer = overlay.querySelector('#location-suggestions');
            if (msgElement) msgElement.textContent = message;
        }

        if (inputField) { inputField.value = ''; setTimeout(() => inputField.focus(), 50); }
        hideSuggestions(suggestionsContainer); // Ensure suggestions are hidden initially
        prayerSection.classList.add('location-error-active'); // Activate overlay CSS AFTER ensuring element exists
        console.log("Overlay should be active now."); // Debug log
    }
    function hideSuggestions(container = document.getElementById('location-suggestions')) { if (container) { container.style.display = 'none'; container.innerHTML = ''; } }
    function hideLocationErrorOverlay() {
        if (!prayerSection) return;
        console.log("Hiding location overlay..."); // Debug log
        prayerSection.classList.remove('location-error-active');
        // Also remove the overlay element itself if it exists, to ensure clean state? No, keep it for reuse.
        hideSuggestions();
    }
    async function handleSuggestionInput(event) { const query = event.target.value; if (query.length < 2) { hideSuggestions(); return; } const suggestions = await getCitySuggestions(query); displaySuggestions(suggestions); }
    async function handleManualLocationSearch(event) { event.preventDefault(); const input = document.getElementById('manual-location-input'); if (!input || isFetching) return; const query = input.value.trim(); if (!query) return; console.log(`Manual search: "${query}"`); hideSuggestions(); showSkeletonLoading(); try { const manualLocation = await getCoordsByGeoapify(query); locationData = { ...locationData, ...manualLocation }; locationData.timezone = manualLocation.timezone || locationData.timezone; currentConfig.latitude = manualLocation.latitude; currentConfig.longitude = manualLocation.longitude; input.value = ''; saveLocationToStorage(locationData); fetchPrayerTimes(); } catch (error) { console.error("Manual search error:", error); hideSkeletonLoading(); showLocationErrorOverlay(`Could not find: "${query}". Please be more specific.`); } }

    // --- Core Logic ---
    function getApiEndpoint(config) { const t=new Date(),y=t.getFullYear(),m=String(t.getMonth()+1).padStart(2,'0'),d=String(t.getDate()).padStart(2,'0'); if(config.latitude!=null&&config.longitude!=null){ console.log(`API Params: Lat=${config.latitude}, Lon=${config.longitude}, Method=${config.method}, School=${config.school}`); return `${ALADHAN_TIMINGS_URL}${d}-${m}-${y}?latitude=${config.latitude}&longitude=${config.longitude}&method=${config.method}&school=${config.school}`; } else return null; }
    async function fetchPrayerTimes() { /* ... No changes needed in fetch logic itself ... */ if (isFetching || !prayerTimesContainer || currentConfig.latitude === null) { console.warn("Fetch prerequisites not met."); if (!prayerTimesContainer) console.error("Prayer times container not found."); if (currentConfig.latitude === null) console.error("Latitude is null."); if(currentConfig.latitude === null && !loadLocationFromStorage() && !prayerSection.classList.contains('loading') && !prayerSection.classList.contains('location-error-active')) { showLocationErrorOverlay("Location needed to fetch prayer times."); } return; } isFetching = true; hideLocationErrorOverlay(); showSkeletonLoading(); const storedMethod = localStorage.getItem('prayerMethod'); const storedSchool = localStorage.getItem('prayerSchool'); if(storedMethod != null) currentConfig.method = parseInt(storedMethod, 10); if(storedSchool != null) currentConfig.school = parseInt(storedSchool, 10); const apiEndpoint = getApiEndpoint(currentConfig); if (!apiEndpoint) { console.error("Cannot fetch: Missing coords."); hideSkeletonLoading(); showLocationErrorOverlay("Location coordinates missing."); isFetching = false; return; } console.log("Fetching:", apiEndpoint); try { const response = await fetch(apiEndpoint); if (!response.ok) throw new Error(`API Err: ${response.status} ${response.statusText}`); const data = await response.json(); if (data.code === 200) { prayerTimesData = data.data.timings; locationData.timezone = data.data.meta.timezone || locationData.timezone; locationData.method = data.data.meta.method.name; locationData.school = data.data.meta.method?.params?.Shafaq === 'general' ? 0 : (data.data.meta.method?.params?.Asr === 'Hanafi' ? 1 : 0); locationData.latitude = data.data.meta.latitude; locationData.longitude = data.data.meta.longitude; locationData.city = locationData.city || data.data.meta.timezone?.split('/')[1]?.replace('_', ' ') || 'Unknown City'; locationData.country = locationData.country || data.data.meta.timezone?.split('/')[0]?.replace('_', ' ') || 'Unknown Country'; console.log("Data Loaded:", prayerTimesData); console.log("Using Loc/Method:", locationData); saveLocationToStorage(locationData); hideSkeletonLoading(); displayPrayerTimes(); displayLocationInfo(); updateDynamicBackground(); startCountdown(); } else { throw new Error(`API returned err: ${data.status}`); } } catch(error) { console.error('Fetch err:', error); hideSkeletonLoading(); showLocationErrorOverlay(`Could not load times. ${error.message}`); } finally { isFetching = false; } }
    function displayPrayerTimes() { /* ... No changes ... */ if(!prayerTimesContainer) return; prayerTimesContainer.innerHTML=''; const relevantPrayers = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha']; relevantPrayers.forEach(prayerName => { const prayerTime = prayerTimesData[prayerName]; if(prayerTime){ const item = document.createElement('div'); item.classList.add('prayer-time-item'); item.dataset.prayer = prayerName; const iconClass = prayerIcons[prayerName] || 'fas fa-clock'; item.innerHTML = `<i class="${iconClass}"></i><span class="prayer-name">${prayerName}</span><span class="prayer-time">${formatTime(prayerTime)}</span>`; prayerTimesContainer.appendChild(item); }}); }

    // --- MODIFIED: Location Display + Click Listener ---
    function displayLocationInfo() {
        if (!prayerSection) return;
        const existingLocationDisplay = prayerSection.querySelector('#location-display');
        if (existingLocationDisplay) existingLocationDisplay.remove();

        const locationDiv = document.createElement('div');
        locationDiv.id = 'location-display';

        let locationText = 'Unknown Location';
        if (locationData.city && locationData.country) {
            locationText = `${locationData.city}, ${locationData.country}`;
        } else if (locationData.latitude && locationData.longitude) {
            locationText = `Lat ${locationData.latitude.toFixed(2)}, Lon ${locationData.longitude.toFixed(2)}`;
        }

        // Add clickable span for text
        locationDiv.innerHTML = `
            <span class="location-text" role="button" tabindex="0" title="Change Location">${locationText}</span>
            <button id="change-location-button" title="Change Location" type="button">
                <i class="fas fa-edit"></i>
            </button>
        `;

        // Add listener to BOTH the text span and the button
        const locationTextSpan = locationDiv.querySelector('.location-text');
        const changeButton = locationDiv.querySelector('#change-location-button');
        const openOverlayAction = () => showLocationErrorOverlay("Enter New Location:");

        if (locationTextSpan) {
            locationTextSpan.addEventListener('click', openOverlayAction);
            // Add keyboard accessibility
            locationTextSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault(); // Prevent space bar scrolling
                    openOverlayAction();
                }
            });
        }
        if (changeButton) {
            changeButton.addEventListener('click', openOverlayAction);
        }

        prayerSection.prepend(locationDiv);
    }

    function formatTime(time24) { if(!time24)return'N/A';try{const[h,m]=time24.split(':');const hourInt=parseInt(h,10);if(isNaN(hourInt)||isNaN(parseInt(m,10)))return'Invalid';const suffix=hourInt>=12?'PM':'AM';const hour12=hourInt%12||12;return`${hour12}:${m} ${suffix}`; }catch(e){console.error("Time Format Err:",e);return"Error";} }
    function getTodayDateString() { const t=new Date();return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; }

    // --- MODIFIED: Countdown Logic (Always Show Seconds) ---
    function startCountdown() {
        if (!nextPrayerInfoContainer || Object.keys(prayerTimesData).length === 0) return;
        if (countdownInterval) clearInterval(countdownInterval);

        function updateCountdownDisplay() {
            const now = new Date();
            const todayStr = getTodayDateString();
            let nextPrayerName = null;
            let nextPrayerTime = null;
            let minDiff = Infinity;
            const prayerOrder = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

            for (const prayerName of prayerOrder) { /* Find next prayer today */ const timeStr = prayerTimesData[prayerName]; if (!timeStr) continue; try { const prayerDateTime = new Date(`${todayStr}T${timeStr}:00`); const diff = prayerDateTime - now; if (diff > 0 && diff < minDiff) { minDiff = diff; nextPrayerName = prayerName; nextPrayerTime = prayerDateTime; } } catch (e) { console.error("Err parse date", prayerName, timeStr, e); } }
            if (!nextPrayerName) { /* Find Fajr tomorrow */ const fajrTimeStr = prayerTimesData['Fajr']; if (fajrTimeStr) { try { const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`; nextPrayerTime = new Date(`${tomorrowStr}T${fajrTimeStr}:00`); const diff = nextPrayerTime - now; if (diff > 0) { minDiff = diff; nextPrayerName = 'Fajr'; } } catch (e) { console.error("Err parse date tmrw", fajrTimeStr, e); } } }

            document.querySelectorAll('.prayer-time-item.next-prayer').forEach(item => item.classList.remove('next-prayer'));

            if (nextPrayerName && nextPrayerTime && minDiff !== Infinity) {
                const nextPrayerElement = prayerTimesContainer?.querySelector(`[data-prayer="${nextPrayerName}"]`);
                if (nextPrayerElement) nextPrayerElement.classList.add('next-prayer');

                const totalSecondsRemaining = Math.floor(minDiff / 1000);
                const hours = Math.floor(totalSecondsRemaining / 3600);
                const minutes = Math.floor((totalSecondsRemaining % 3600) / 60);
                const seconds = totalSecondsRemaining % 60;

                // ALWAYS SHOW H, M, S
                const remainingString = `${hours}h ${minutes}m ${seconds}s`;

                nextPrayerInfoContainer.innerHTML = `<strong>${nextPrayerName}</strong> in ${remainingString}`;

                if (minDiff <= 1000) { console.log(`${nextPrayerName} time. Refreshing...`); clearInterval(countdownInterval); setTimeout(() => fetchPrayerTimes(), 3000); }
            } else { nextPrayerInfoContainer.textContent = 'Could not determine next prayer.'; }
        }
        updateCountdownDisplay();
        countdownInterval = setInterval(updateCountdownDisplay, 1000);
    } // --- End startCountdown ---

    function updateDynamicBackground() { /* ... No changes ... */ if (!prayerSection || Object.keys(prayerTimesData).length === 0) return; const now = new Date(); let baseClass = 'weather-day'; try { const fajrTime = prayerTimesData.Fajr ? new Date(getTodayDateString() + 'T' + prayerTimesData.Fajr + ':00') : null; const maghribTime = prayerTimesData.Maghrib ? new Date(getTodayDateString() + 'T' + prayerTimesData.Maghrib + ':00') : null; if (fajrTime && maghribTime) { if (now < fajrTime || now >= maghribTime) { baseClass = 'weather-night'; } } else { const currentHour = now.getHours(); if (currentHour < 5 || currentHour >= 19) { baseClass = 'weather-night'; } } } catch (e) { console.error("Err calc day/night", e); const currentHour = now.getHours(); if (currentHour < 5 || currentHour >= 19) { baseClass = 'weather-night'; } } const weatherConditionClass = ""; prayerSection.classList.remove('weather-day', 'weather-night', 'weather-rain', 'weather-snow'); prayerSection.classList.add('weather-dynamic-bg', baseClass); if (weatherConditionClass) { prayerSection.classList.add(weatherConditionClass); } }
    function saveLocationToStorage(locData) { /* ... No changes ... */ if(!locData||locData.latitude==null||locData.longitude==null)return;try{const d={latitude:locData.latitude,longitude:locData.longitude,city:locData.city,country:locData.country,};localStorage.setItem(LOCATION_STORAGE_KEY,JSON.stringify(d));console.log("Loc saved:",d);}catch(e){console.error("Err saving loc:",e);} }
    function loadLocationFromStorage() { /* ... No changes ... */ try{const s=localStorage.getItem(LOCATION_STORAGE_KEY);if(s){const p=JSON.parse(s);if(p&&p.latitude!=null&&p.longitude!=null){console.log("Loc loaded:",p);return p;}}}catch(e){console.error("Err loading loc:",e);}return null; }
    async function initializePrayerTimes() { /* ... No changes ... */ if (!prayerTimesContainer || !prayerSection) { console.error("Init failed: Required elements missing."); return; } showSkeletonLoading(); const savedLocation = loadLocationFromStorage(); if (savedLocation) { console.log("Using saved loc."); locationData = { ...locationData, ...savedLocation }; currentConfig.latitude = savedLocation.latitude; currentConfig.longitude = savedLocation.longitude; fetchPrayerTimes(); return; } console.log("No saved loc, trying IP."); try { const ipLocation = await getIPLocation(); locationData = { ...locationData, ...ipLocation }; currentConfig.latitude = ipLocation.latitude; currentConfig.longitude = ipLocation.longitude; saveLocationToStorage(locationData); fetchPrayerTimes(); } catch (error) { console.error(`Init failed: ${error.message}`); hideSkeletonLoading(); showLocationErrorOverlay(`Could not get location automatically. Please search manually:`); } }

    // --- Start Initialization ---
    initializePrayerTimes();

}); // End DOMContentLoaded