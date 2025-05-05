document.addEventListener('DOMContentLoaded', () => {
    const prayerTimesContainer = document.getElementById('prayer-times-container');
    const nextPrayerInfoContainer = document.getElementById('next-prayer-info');
    const prayerSection = document.getElementById('prayer-times-section');
    let prayerTimesData = {}; // Store fetched prayer times
    let locationData = {}; // Store location info
    let countdownInterval; // Stores the interval ID for the countdown

    // --- Configuration ---
    const config = {
        latitude: 51.5074, // London example
        longitude: -0.1278,
        city: "London",    // Fallback city
        country: "UK",     // Fallback country
        method: 2,         // ISNA method
        apiEndpoint: function() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            // Prefer lat/lon if available
            if (this.latitude && this.longitude) {
                 return `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${this.latitude}&longitude=${this.longitude}&method=${this.method}`;
            } else {
                return `https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}?city=${this.city}&country=${this.country}&method=${this.method}`;
            }
        }
    };

    // --- Prayer Name to Icon Mapping (Font Awesome) ---
    const prayerIcons = {
        Fajr: 'fas fa-cloud-moon',
        Sunrise: 'fas fa-sun',
        Dhuhr: 'fas fa-sun',
        Asr: 'fas fa-cloud-sun',
        Maghrib: 'fas fa-cloud-moon',
        Isha: 'fas fa-moon',
    };

    // --- Function to Fetch Prayer Times ---
    async function fetchPrayerTimes() {
        if (!prayerTimesContainer) return; // Exit if container doesn't exist
        prayerTimesContainer.innerHTML = '<p class="loading-text">Fetching prayer times...</p>';
        try {
            const response = await fetch(config.apiEndpoint());
            if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
            const data = await response.json();

            if (data.code === 200) {
                prayerTimesData = data.data.timings;
                locationData = { city: config.city, country: config.country, method: data.data.meta.method.name };
                displayPrayerTimes();
                updateDynamicBackground(); // Set initial background
                startCountdown();          // Start countdown
            } else {
                throw new Error(`API returned error: ${data.status}`);
            }
        } catch (error) {
            console.error('Error fetching prayer times:', error);
            if (prayerTimesContainer) prayerTimesContainer.innerHTML = `<p class="loading-text" style="color: red;">Could not load prayer times. ${error.message}</p>`;
            if (nextPrayerInfoContainer) nextPrayerInfoContainer.innerHTML = '';
        }
    }

    // --- Function to Display Prayer Times ---
    function displayPrayerTimes() {
        if (!prayerTimesContainer) return;
        prayerTimesContainer.innerHTML = ''; // Clear loading/previous
        const relevantPrayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        relevantPrayers.forEach(prayerName => {
            const time = prayerTimesData[prayerName];
            if (time) {
                const item = document.createElement('div');
                item.classList.add('prayer-time-item');
                item.setAttribute('data-prayer', prayerName);

                const iconClass = prayerIcons[prayerName] || 'fas fa-clock';

                // Use textContent for security and performance
                const iconEl = document.createElement('i');
                iconEl.className = iconClass; // Use className

                const nameEl = document.createElement('span');
                nameEl.className = 'prayer-name';
                nameEl.textContent = prayerName;

                const timeEl = document.createElement('span');
                timeEl.className = 'prayer-time';
                timeEl.textContent = formatTime(time);

                item.appendChild(iconEl);
                item.appendChild(nameEl);
                item.appendChild(timeEl);
                prayerTimesContainer.appendChild(item);
            }
        });
    }

    // --- Function to Format Time ---
    function formatTime(time24) {
        if (!time24) return 'N/A';
        try {
            const [hours, minutes] = time24.split(':');
            const hoursInt = parseInt(hours, 10);
            if (isNaN(hoursInt) || isNaN(parseInt(minutes, 10))) return 'Invalid'; // Basic validation
            const suffix = hoursInt >= 12 ? 'PM' : 'AM';
            const hours12 = hoursInt % 12 || 12;
            return `${hours12}:${minutes} ${suffix}`;
        } catch (e) {
            console.error("Error formatting time:", time24, e);
            return "Error";
        }
    }

     // --- Function to Get Today's Date String ---
     function getTodayDateString() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    // --- Function to Find Next Prayer and Start Countdown ---
    function startCountdown() {
        if (!nextPrayerInfoContainer || Object.keys(prayerTimesData).length === 0) return; // Don't run if no container or data

        if (countdownInterval) clearInterval(countdownInterval); // Clear existing interval

        function update() {
            const now = new Date();
            const todayStr = getTodayDateString();
            let nextPrayerName = null;
            let nextPrayerTime = null;
            let minDiff = Infinity;
            const prayerOrder = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

            // Find next prayer today
            for (const prayerName of prayerOrder) {
                const prayerTimeStr = prayerTimesData[prayerName];
                if (!prayerTimeStr) continue;
                try {
                     const prayerDateTime = new Date(`${todayStr}T${prayerTimeStr}:00`);
                     const diff = prayerDateTime - now;
                     if (diff > 0 && diff < minDiff) {
                        minDiff = diff;
                        nextPrayerName = prayerName;
                        nextPrayerTime = prayerDateTime;
                    }
                } catch(e) { console.error("Error parsing date for", prayerName, prayerTimeStr, e); }
            }

             // If none today, check Fajr tomorrow
             if (!nextPrayerName) {
                const fajrTomorrowStr = prayerTimesData['Fajr'];
                if (fajrTomorrowStr) {
                    try {
                        const tomorrow = new Date(now);
                        tomorrow.setDate(now.getDate() + 1);
                        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
                        nextPrayerTime = new Date(`${tomorrowStr}T${fajrTomorrowStr}:00`);
                        const diff = nextPrayerTime - now;
                         if (diff > 0) {
                             minDiff = diff;
                             nextPrayerName = 'Fajr';
                         }
                    } catch(e) { console.error("Error parsing date for tomorrow's Fajr", fajrTomorrowStr, e); }
                }
             }

            // Update UI
            document.querySelectorAll('.prayer-time-item').forEach(item => item.classList.remove('next-prayer'));

            if (nextPrayerName && nextPrayerTime && minDiff !== Infinity) {
                const nextPrayerElement = prayerTimesContainer?.querySelector(`[data-prayer="${nextPrayerName}"]`);
                if (nextPrayerElement) nextPrayerElement.classList.add('next-prayer');

                const hoursLeft = Math.floor(minDiff / (1000 * 60 * 60));
                const minutesLeft = Math.floor((minDiff % (1000 * 60 * 60)) / (1000 * 60));
                const secondsLeft = Math.floor((minDiff % (1000 * 60)) / 1000);
                 let timeRemainingStr = '';
                 if(hoursLeft > 0) timeRemainingStr += `${hoursLeft}h `;
                 if(minutesLeft > 0 || hoursLeft > 0) timeRemainingStr += `${minutesLeft}m `;
                 timeRemainingStr += `${secondsLeft}s`;

                 // Use innerHTML carefully or construct with textContent
                 nextPrayerInfoContainer.innerHTML = `Next Prayer: <strong>${nextPrayerName}</strong> in ${timeRemainingStr}`;

                 if (minDiff <= 1000) { // Refresh slightly before or at 0
                      console.log(`${nextPrayerName} time approaching/arrived. Refreshing...`);
                      clearInterval(countdownInterval);
                      setTimeout(fetchPrayerTimes, 3000); // Wait 3 seconds
                 }

            } else {
                 nextPrayerInfoContainer.textContent = 'Could not determine next prayer.'; // Use textContent
            }
        }

        update(); // Run immediately
        countdownInterval = setInterval(update, 1000); // Update every second
    }

    // --- Function to Update Dynamic Background Based on Time ---
    function updateDynamicBackground() {
        if (!prayerSection || Object.keys(prayerTimesData).length === 0) return; // Need section and data

        const now = new Date();
        const currentHour = now.getHours();
        let timeOfDayClass = 'weather-day'; // Default

         try {
            // Use prayer times for accuracy
            const fajrTime = prayerTimesData.Fajr ? new Date(getTodayDateString() + 'T' + prayerTimesData.Fajr + ':00') : null;
            const maghribTime = prayerTimesData.Maghrib ? new Date(getTodayDateString() + 'T' + prayerTimesData.Maghrib + ':00') : null;

            if (fajrTime && maghribTime) {
                // It's night if current time is before Fajr OR after Maghrib
                if (now < fajrTime || now >= maghribTime) {
                    timeOfDayClass = 'weather-night';
                }
            } else { // Fallback to simple hours if times aren't parsed
                 if (currentHour < 5 || currentHour >= 19) { // Example hours
                     timeOfDayClass = 'weather-night';
                 }
            }
         } catch (e) {
             console.error("Error calculating day/night from prayer times, falling back to hours", e);
              if (currentHour < 5 || currentHour >= 19) { timeOfDayClass = 'weather-night'; }
         }


        // Weather condition (Placeholder - Needs Weather API)
        const weatherCondition = "clear";
        let weatherClass = '';
        // switch (weatherCondition) { case 'rain': weatherClass = 'weather-rain'; break; ... }

        // Apply classes
        prayerSection.classList.remove('weather-day', 'weather-night', 'weather-rain', 'weather-snow');
        prayerSection.classList.add(timeOfDayClass);
        if (weatherClass) prayerSection.classList.add(weatherClass);
    }

    // --- Initial Fetch ---
    fetchPrayerTimes();

     // Optional: Re-fetch periodically
     // setInterval(fetchPrayerTimes, 1000 * 60 * 60); // Hourly
     // setInterval(updateDynamicBackground, 1000 * 60 * 5); // Check background every 5 mins

}); // End DOMContentLoaded