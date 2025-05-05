document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const hadithDisplay = document.getElementById('hadith-display');
    const randomHadithButton = document.getElementById('random-hadith-button');

    // --- Data Source Configuration ---
    // Using data from fawazahmed0/hadith-api via jsDelivr CDN
    // We'll fetch the English translation of Sahih al-Bukhari
    const COLLECTION_SLUG = 'eng-bukhari'; // Identifier for Bukhari English
    const HADITH_DATA_URL = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${COLLECTION_SLUG}.min.json`;

    // --- State ---
    let hadithCollection = []; // To store the fetched hadith data
    let isLoading = false; // Flag to prevent multiple fetches

    // --- Function to fetch the entire Hadith collection ---
    async function fetchHadithCollection() {
        // Exit if already loading, or if the display element isn't on the page
        if (isLoading || !hadithDisplay) return;
        isLoading = true;
        hadithDisplay.innerHTML = `<p class="loading-text">Loading Hadith Data...</p>`;
        if (randomHadithButton) randomHadithButton.disabled = true;

        try {
            console.log(`Fetching hadith data from: ${HADITH_DATA_URL}`);
            const response = await fetch(HADITH_DATA_URL);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            // The data structure is { hadiths: [...] }
            if (data && data.hadiths && Array.isArray(data.hadiths)) {
                hadithCollection = data.hadiths;
                console.log(`Successfully loaded ${hadithCollection.length} hadiths from ${COLLECTION_SLUG}.`);
                // Display a random one immediately after loading
                displayRandomHadith();
            } else {
                throw new Error("Invalid data format received.");
            }

        } catch (error) {
            console.error('Error fetching Hadith collection:', error);
            if (hadithDisplay) hadithDisplay.innerHTML = `<p class="error-text">Could not load Hadith data. ${error.message}</p>`;
        } finally {
            isLoading = false;
            if (randomHadithButton) randomHadithButton.disabled = false;
        }
    }

    // --- Function to display a random Hadith from the loaded collection ---
    function displayRandomHadith() {
        // Exit if the display element isn't on the page
        if (!hadithDisplay) return;

        if (hadithCollection.length === 0) {
            hadithDisplay.innerHTML = '<p class="error-text">No Hadith data available to display. Try reloading.</p>';
            console.log("Attempted to display random hadith, but collection is empty.");
            return;
        }

        // Select a random hadith object from the array
        const randomIndex = Math.floor(Math.random() * hadithCollection.length);
        const hadith = hadithCollection[randomIndex];

        // --- Display the Hadith ---
        hadithDisplay.innerHTML = ''; // Clear previous/loading

        if (!hadith || !hadith.text || !hadith.reference) {
             hadithDisplay.innerHTML = '<p class="error-text">Selected Hadith data is incomplete.</p>';
             console.error("Incomplete hadith data:", hadith);
             return;
        }

        const textElement = document.createElement('p');
        textElement.classList.add('hadith-text');
        textElement.textContent = hadith.text; // Assumes 'text' field has the English text

        const referenceElement = document.createElement('p');
        referenceElement.classList.add('hadith-reference');
        // Construct reference string - checking for variations in the JSON structure
        let refText = `<strong>${hadith.reference?.book ? 'Book ' + hadith.reference.book : 'Sahih al-Bukhari'}</strong>`; // Default to Bukhari if no book ref
        if(hadith.reference?.hadith) {
            refText += `, Hadith ${hadith.reference.hadith}`;
        } else if (hadith.hadithnumber) { // Check top-level hadithnumber
            refText += `, Hadith ${hadith.hadithnumber}`;
        }
        // Add chapter if available (might need further refinement based on exact JSON)
        // if (hadith.reference?.chapter) refText += `, Ch. ${hadith.reference.chapter}`;

        referenceElement.innerHTML = refText;

        hadithDisplay.appendChild(textElement);
        hadithDisplay.appendChild(referenceElement);
    }

    // --- Event Listeners ---
    if (randomHadithButton) {
        randomHadithButton.addEventListener('click', () => {
            // Only display if data is loaded, otherwise the fetch is still running
            if (hadithCollection.length > 0 && !isLoading) {
                displayRandomHadith();
            } else if (!isLoading) {
                // If not loading and no data, maybe try fetching again?
                console.log("No hadith data loaded, attempting fetch again.");
                fetchHadithCollection();
            }
        });
    } else {
        // console.log("Random hadith button not found."); // Optional debug
    }

    // --- Initial Load ---
    // Check if the hadith display element actually exists on the current page
    // before trying to fetch data for it. This prevents errors on other pages.
    if (hadithDisplay) {
        fetchHadithCollection(); // Fetch the collection when the page loads
    }

}); // End DOMContentLoaded