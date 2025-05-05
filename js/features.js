document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const prayerTimesContainer = document.getElementById('prayer-times-container');
    const nextPrayerInfoContainer = document.getElementById('next-prayer-info');
    const prayerSection = document.getElementById('prayer-times-section');

    // --- State ---
    let prayerTimesData = {};
    let locationData = { city: null, country: null, timezone: null, latitude: null, longitude: null };
    let countdownInterval;
    let currentConfig = { method: 3, school: 0 };
    let isFetching = false;

    // --- Configuration ---
    const LOCATION_STORAGE_KEY = 'islamShine_prayerLocation';
    const MAX_SUGGESTIONS = 3; // Limit displayed suggestions

    // --- API Keys & Endpoints ---
    const GEOAPIFY_API_KEY = 'a92c347118214c38be19a415e6586cbf'; // <<< PASTE YOUR KEY HERE
    const IP_API_URL = 'https://ip-api.com/json/?fields=status,message,country,city,lat,lon,timezone';
    const ALADHAN_TIMINGS_URL = 'https://api.aladhan.com/v1/timings/';
    const GEOAPIFY_AUTOCOMPLETE_URL = `https://api.geoapify.com/v1/geocode/autocomplete?apiKey=${GEOAPIFY_API_KEY}&limit=5&text=`; // Fetch 5, display 3
    const GEOAPIFY_SEARCH_URL = `https://api.geoapify.com/v1/geocode/search?limit=1&apiKey=${GEOAPIFY_API_KEY}&text=`;

    // --- Prayer Name to Icon Mapping ---
    const prayerIcons = { /* ... unchanged ... */
        Fajr: 'fas fa-cloud-moon', Sunrise: 'fas fa-sun', Dhuhr: 'fas fa-sun',
        Asr: 'fas fa-cloud-sun', Maghrib: 'fas fa-cloud-moon', Isha: 'fas fa-moon',
    };

    // --- Helper: Show/Hide Skeleton Loading ---
    function showSkeletonLoading() {
        if (!prayerSection || !prayerTimesContainer) return;
        // Don't hide overlay if it's active for manual input triggered by 'change location'
        if (!prayerSection.classList.contains('location-error-active')) {
            hideLocationErrorOverlay();
        }
        prayerSection.classList.add('loading');
        prayerTimesContainer.innerHTML = Array(6).fill('<div class="prayer-time-item"><span></span></div>').join('');
        if (nextPrayerInfoContainer) nextPrayerInfoContainer.innerHTML = '';
        const existingLocationDisplay = prayerSection.querySelector('#location-display');
        if (existingLocationDisplay) existingLocationDisplay.innerHTML = '';
    }
    function hideSkeletonLoading() {
        if (!prayerSection) return;
        prayerSection.classList.remove('loading');
    }

    // --- Location Functions ---
    async function getIPLocation() { /* ... unchanged ... */ console.log("Attempting IP..."); const r=await fetch(IP_API_URL); if(!r.ok)throw new Error(`IP Err: ${r.status}`); const d=await r.json(); if(d.status!=='success')throw new Error(`IP Fail: ${d.message||'?'}`); console.log("IP OK:",d); return {latitude:d.lat, longitude:d.lon, city:d.city, country:d.country, timezone:d.timezone}; }
    async function getCoordsByGeoapify(query) { /* ... unchanged ... */ console.log(`Geoapify search: ${query}`); const r=await fetch(`${GEOAPIFY_SEARCH_URL}${encodeURIComponent(query)}`); if(!r.ok)throw new Error(`Geoapify Err: ${r.status}`); const d=await r.json(); if(d.features?.length>0){ const p=d.features[0].properties; return {latitude:p.lat, longitude:p.lon, city:p.city||p.town||p.village||p.county||p.state, country:p.country||null, timezone:p.timezone?.name||null}; } else { throw new Error(`Geoapify couldn't find: "${query}".`); } }
    async function getCitySuggestions(query) { /* ... unchanged ... */ if (!query || query.length < 2 || !GEOAPIFY_API_KEY || GEOAPIFY_API_KEY === 'YOUR_GEOAPIFY_API_KEY_HERE') { hideSuggestions(); return []; } try { const r = await fetch(`${GEOAPIFY_AUTOCOMPLETE_URL}${encodeURIComponent(query)}`); if (!r.ok) throw new Error(`Suggest Err: ${r.status}`); const d = await r.json(); return d.features?.map(f=>({text: f.properties.formatted, lat: f.properties.lat, lon: f.properties.lon, city: f.properties.city, country: f.properties.country, timezone: f.properties.timezone?.name })) || []; } catch (e) { console.error("Suggest fetch err:", e); return []; } }

    // --- Function to Display Suggestions (Limit Added) ---
    function displaySuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('location-suggestions');
        if (!suggestionsContainer) return;
        suggestionsContainer.innerHTML = '';

        // Limit the number of suggestions displayed
        const limitedSuggestions = suggestions.slice(0, MAX_SUGGESTIONS);

        if (limitedSuggestions.length === 0) {
            suggestionsContainer.style.display = 'none';
            return;
        }

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
        suggestionsContainer.style.display = 'block'; // Show dropdown
    }

    // --- Function to Show Location Error/Input Overlay (Close Button Added) ---
    function showLocationErrorOverlay(message = "Enter City, Address, or Postcode:") {
        if (!prayerSection) return;
        // Don't hide skeleton if it's already showing (e.g., from manual search)
        // hideSkeletonLoading();

        let overlay = prayerSection.querySelector('.location-error-overlay');
        let inputField, suggestionsContainer;

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.classList.add('location-error-overlay');
            overlay.innerHTML = `
                <button class="close-overlay-button" title="Close" type="button">×</button>
                <p class="error-message">${message}</p>
                <div class="search-container">
                    <form class="location-search-form" id="manual-location-form" autocomplete="off" novalidate>
                        <input type="search" id="manual-location-input" placeholder="e.g., London, Mecca, SW1A..." required autocomplete="off" name="location-search-${Date.now()}">
                        <button type="submit" id="manual-location-button" title="Search Location"><i class="fas fa-search"></i></button>
                    </form>
                    <div id="location-suggestions"></div>
                </div>
            `;
            prayerSection.prepend(overlay);

            // --- Add Listeners (Only Once When Overlay Created) ---
            const form = overlay.querySelector('#manual-location-form');
            inputField = overlay.querySelector('#manual-location-input');
            suggestionsContainer = overlay.querySelector('#location-suggestions');
            const closeButton = overlay.querySelector('.close-overlay-button');

            if(closeButton) {
                closeButton.addEventListener('click', hideLocationErrorOverlay);
            }
            if (form) {
                form.addEventListener('submit', handleManualLocationSearch);
            }
            if (inputField) {
                inputField.setAttribute('autocomplete', 'off');
                const clearAndHide = () => { if (inputField.value !== '') { inputField.value = ''; } hideSuggestions(suggestionsContainer); };
                inputField.addEventListener('focus', clearAndHide);
                inputField.addEventListener('click', clearAndHide);
                inputField.addEventListener('input', handleSuggestionInput);
                 document.addEventListener('click', (event) => {
                     const searchContainer = overlay?.querySelector('.search-container'); // Check if overlay still exists
                     // Hide suggestions if click is outside search container AND overlay is active
                     if (prayerSection.classList.contains('location-error-active') && suggestionsContainer && !searchContainer?.contains(event.target)) {
                         hideSuggestions(suggestionsContainer);
                     }
                 }, true); // Use capture phase to catch clicks earlier
            }
        } else {
            // Overlay exists, just update message
            const msgElement = overlay.querySelector('.error-message');
            inputField = overlay.querySelector('#manual-location-input');
            suggestionsContainer = overlay.querySelector('#location-suggestions');
            if (msgElement) msgElement.textContent = message;
        }

        // Focus input, clear value, hide suggestions
        if (inputField) {
            inputField.value = '';
            setTimeout(() => inputField.focus(), 50);
        }
        hideSuggestions(suggestionsContainer); // Ensure hidden
        prayerSection.classList.add('location-error-active'); // Activate overlay CSS
    }

    // --- Function to Hide Suggestions (Unchanged) ---
    function hideSuggestions(container = document.getElementById('location-suggestions')) { if (container) { container.style.display = 'none'; container.innerHTML = ''; } }

    // --- Function to Handle Suggestion Input (Unchanged from previous) ---
    async function handleSuggestionInput(event) { /* ... unchanged instant fetch ... */ const query = event.target.value; if (query.length < 2) { hideSuggestions(); return; } const suggestions = await getCitySuggestions(query); displaySuggestions(suggestions); }

    // --- Function to Hide Location Error Overlay (Unchanged) ---
    function hideLocationErrorOverlay() { if (!prayerSection) return; prayerSection.classList.remove('location-error-active'); hideSuggestions(); }

    // --- Handler for Manual Location Search Form (Unchanged) ---
    async function handleManualLocationSearch(event) { /* ... unchanged ... */ event.preventDefault(); const input = document.getElementById('manual-location-input'); if (!input || isFetching) return; const query = input.value.trim(); if (!query) return; console.log(`Manual search: "${query}"`); hideSuggestions(); showSkeletonLoading(); try { const manualLocation = await getCoordsByGeoapify(query); locationData = { ...locationData, ...manualLocation }; locationData.timezone = manualLocation.timezone || locationData.timezone; currentConfig.latitude = manualLocation.latitude; currentConfig.longitude = manualLocation.longitude; input.value = ''; saveLocationToStorage(locationData); fetchPrayerTimes(); } catch (error) { console.error("Manual search error:", error); hideSkeletonLoading(); showLocationErrorOverlay(`Could not find: "${query}". Please be more specific.`); } }

    // --- Function to Construct API Endpoint URL (Unchanged) ---
    function getApiEndpoint(config) { /* ... unchanged ... */ const t=new Date(),y=t.getFullYear(),m=String(t.getMonth()+1).padStart(2,'0'),d=String(t.getDate()).padStart(2,'0'); if(config.latitude!=null&&config.longitude!=null){ console.log(`API Params: Lat=${config.latitude}, Lon=${config.longitude}, Method=${config.method}, School=${config.school}`); return `${ALADHAN_TIMINGS_URL}${d}-${m}-${y}?latitude=${config.latitude}&longitude=${config.longitude}&method=${config.method}&school=${config.school}`; } else return null; }

    // --- Function to Fetch Prayer Times (Unchanged) ---
    async function fetchPrayerTimes() { /* ... unchanged ... */ if (isFetching || !prayerTimesContainer || currentConfig.latitude === null) return; isFetching = true; hideLocationErrorOverlay(); showSkeletonLoading(); const sM=localStorage.getItem('prayerMethod'); const sS=localStorage.getItem('prayerSchool'); if(sM!=null) currentConfig.method=parseInt(sM,10); if(sS!=null) currentConfig.school=parseInt(sS,10); const apiEndpoint=getApiEndpoint(currentConfig); if(!apiEndpoint){ console.error("Cannot fetch: Missing coords."); hideSkeletonLoading(); showLocationErrorOverlay("Location coordinates missing."); isFetching=false; return; } console.log("Fetching:", apiEndpoint); try { const r=await fetch(apiEndpoint); if(!r.ok) throw new Error(`API Err: ${r.status} ${r.statusText}`); const d=await r.json(); if(d.code===200){ prayerTimesData=d.data.timings; locationData.timezone=d.data.meta.timezone||locationData.timezone; locationData.method=d.data.meta.method.name; locationData.school=d.data.meta.method?.params?.Asr==='Hanafi'?1:0; locationData.latitude=d.data.meta.latitude; locationData.longitude=d.data.meta.longitude; locationData.city=locationData.city||'Unknown City'; locationData.country=locationData.country||'Unknown Country'; console.log("Data Loaded:", prayerTimesData); console.log("Using Loc/Method:", locationData); saveLocationToStorage(locationData); hideSkeletonLoading(); displayPrayerTimes(); displayLocationInfo(); updateDynamicBackground(); startCountdown(); } else { throw new Error(`API returned err: ${d.status}`); } } catch(e){ console.error('Fetch err:',e); hideSkeletonLoading(); showLocationErrorOverlay(`Could not load times. ${e.message}`); } finally { isFetching=false; } }

    // --- Function to Display Prayer Times (Unchanged) ---
    function displayPrayerTimes() { /* ... unchanged ... */ if(!prayerTimesContainer) return; prayerTimesContainer.innerHTML=''; const R=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha']; R.forEach(p=>{ const t=prayerTimesData[p]; if(t){ const i=document.createElement('div'); i.classList.add('prayer-time-item'); i.dataset.prayer=p; const c=prayerIcons[p]||'fas fa-clock'; i.innerHTML=`<i class="${c}"></i><span class="prayer-name">${p}</span><span class="prayer-time">${formatTime(t)}</span>`; prayerTimesContainer.appendChild(i);}}); }

    // --- Function to Display Location Info (Modified Change Button Action) ---
    function displayLocationInfo() {
        if (!prayerSection || !nextPrayerInfoContainer) return;
        const existingLocationDisplay = prayerSection.querySelector('#location-display');
        if (existingLocationDisplay) existingLocationDisplay.remove();

        const locationDiv = document.createElement('div');
        locationDiv.id = 'location-display';
        let locationText = 'Location Unknown';
        if (locationData.city && locationData.country) {
            locationText = `Times for: ${locationData.city}, ${locationData.country}`;
        } else if (locationData.latitude && locationData.longitude) {
            locationText = `Times for: Lat ${locationData.latitude.toFixed(2)}, Lon ${locationData.longitude.toFixed(2)}`;
        }
        const textNode = document.createTextNode(locationText + ' ');
        locationDiv.appendChild(textNode);

        const changeButton = document.createElement('button');
        changeButton.id = 'change-location-button';
        changeButton.innerHTML = '<i class="fas fa-edit"></i>';
        changeButton.title = 'Change Location';
        changeButton.type = 'button';
        changeButton.addEventListener('click', () => {
            // Show overlay with a prompt, NOT an error message
            showLocationErrorOverlay("Enter New Location:");
        });
        locationDiv.appendChild(changeButton);

        nextPrayerInfoContainer.parentNode.insertBefore(locationDiv, nextPrayerInfoContainer.nextSibling);
    }

    // --- Function to Format Time ---
    function formatTime(time24) { if(!time24)return'N/A';try{const[h,m]=time24.split(':');const i=parseInt(h,10);if(isNaN(i)||isNaN(parseInt(m,10)))return'Invalid';const s=i>=12?'PM':'AM';const H=i%12||12;return`${H}:${m} ${s}`; }catch(e){return"Error";} }

    // --- Function to Get Today's Date String ---
    function getTodayDateString() { const t=new Date();return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; }

    // --- Function to Start Countdown ---
    function startCountdown() { if(!nextPrayerInfoContainer||Object.keys(prayerTimesData).length===0)return;if(countdownInterval)clearInterval(countdownInterval);function u(){const n=new Date();const d=getTodayDateString();let N=null,T=null,m=Infinity;const o=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];for(const p of o){const s=prayerTimesData[p];if(!s)continue;try{const D=new Date(`${d}T${s}:00`);const f=D-n;if(f>0&&f<m){m=f;N=p;T=D;}}catch(e){console.error("Err parsing date",p,s,e);}}if(!N){const F=prayerTimesData['Fajr'];if(F){try{const w=new Date(n);w.setDate(n.getDate()+1);const S=`${w.getFullYear()}-${String(w.getMonth()+1).padStart(2,'0')}-${String(w.getDate()).padStart(2,'0')}`;T=new Date(`${S}T${F}:00`);const g=T-n;if(g>0){m=g;N='Fajr';}}catch(e){console.error("Err parsing date tmrw",F,e);}}}document.querySelectorAll('.prayer-time-item').forEach(i=>i.classList.remove('next-prayer'));if(N&&T&&m!==Infinity){const e=prayerTimesContainer?.querySelector(`[data-prayer="${N}"]`);if(e)e.classList.add('next-prayer');const h=Math.floor(m/(36e5));const M=Math.floor((m%(36e5))/(6e4));const S=Math.floor((m%(6e4))/1000);let r='';if(h>0)r+=`${h}h `;if(M>0||h>0)r+=`${M}m `;r+=`${S}s`;nextPrayerInfoContainer.innerHTML=`Next Prayer: <strong>${N}</strong> in ${r}`;if(m<=1000){console.log(`${N} time. Refreshing...`);clearInterval(countdownInterval);setTimeout(()=>fetchPrayerTimes(),3000);}}else{nextPrayerInfoContainer.textContent='Could not determine next prayer.';}}u();countdownInterval=setInterval(u,1000); }

    // --- Function to Update Dynamic Background ---
    function updateDynamicBackground() { if(!prayerSection||Object.keys(prayerTimesData).length===0)return;const n=new Date();let t='weather-day';try{const f=prayerTimesData.Fajr?new Date(getTodayDateString()+'T'+prayerTimesData.Fajr+':00'):null;const m=prayerTimesData.Maghrib?new Date(getTodayDateString()+'T'+prayerTimesData.Maghrib+':00'):null;if(f&&m){if(n<f||n>=m)t='weather-night';}else{if(n.getHours()<5||n.getHours()>=19)t='weather-night';}}catch(e){console.error("Err calc day/night",e);if(n.getHours()<5||n.getHours()>=19)t='weather-night';}const c="clear";let w='';prayerSection.classList.remove('weather-day','weather-night','weather-rain','weather-snow');prayerSection.classList.add(t);if(w)prayerSection.classList.add(w); }

     // --- Function to Save/Load Location to/from localStorage ---
     function saveLocationToStorage(locData) { /* ... unchanged ... */ if(!locData||locData.latitude==null||locData.longitude==null)return;try{const d={latitude:locData.latitude,longitude:locData.longitude,city:locData.city,country:locData.country,};localStorage.setItem(LOCATION_STORAGE_KEY,JSON.stringify(d));console.log("Loc saved:",d);}catch(e){console.error("Err saving loc:",e);} }
     function loadLocationFromStorage() { /* ... unchanged ... */ try{const s=localStorage.getItem(LOCATION_STORAGE_KEY);if(s){const p=JSON.parse(s);if(p&&p.latitude!=null&&p.longitude!=null){console.log("Loc loaded:",p);return p;}}}catch(e){console.error("Err loading loc:",e);}return null; }

    // --- Initial Load Logic ---
    async function initializePrayerTimes() { /* ... unchanged ... */ if(!prayerTimesContainer||!prayerSection)return;showSkeletonLoading();const s=loadLocationFromStorage();if(s){console.log("Using saved loc.");locationData={...locationData,...s};currentConfig.latitude=s.latitude;currentConfig.longitude=s.longitude;fetchPrayerTimes();return;}console.log("No saved loc, trying IP.");try{const i=await getIPLocation();locationData={...locationData,...i};currentConfig.latitude=i.latitude;currentConfig.longitude=i.longitude;saveLocationToStorage(locationData);fetchPrayerTimes();}catch(e){console.error(`Init failed: ${e.message}`);hideSkeletonLoading();showLocationErrorOverlay(`Could not get location. Please search manually:`);} }

    // --- Start Initialization ---
    initializePrayerTimes();

}); // End DOMContentLoaded