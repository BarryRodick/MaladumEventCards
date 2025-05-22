document.addEventListener('DOMContentLoaded', () => {
    loadHTMLPartials();
});

async function loadHTMLPartials() {
    await loadHeader(); // This will also trigger loading BMC button into the header
    await loadCampaignModal();
    await loadNotesSection();
}

async function fetchHTML(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            console.error(`Failed to fetch ${filePath}: ${response.status} ${response.statusText}`);
            return null; 
        }
        return await response.text();
    } catch (error) {
        console.error(`Error fetching partial ${filePath}:`, error);
        return null;
    }
}

async function loadHeader() {
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) return;

    const headerHTML = await fetchHTML('_header.html');
    if (headerHTML) {
        headerContainer.innerHTML = headerHTML; // Replace content of placeholder div

        // Customize header based on page type (data attributes on header-container)
        const pageType = headerContainer.dataset.pageType;
        const pageTitle = headerContainer.dataset.pageTitle || 'Maladum Event Cards'; // Default title
        const headerTitleTextEl = document.getElementById('header-title-text');
        const headerLinkEl = document.getElementById('header-link'); // The <a> tag wrapping logo and title
        const headerLogoEl = document.getElementById('header-logo');
        const campaignManagerLinkEl = document.getElementById('campaign-manager-link');
        const headerTitleIconEl = document.getElementById('header-title-icon');


        if (headerTitleTextEl) {
            headerTitleTextEl.textContent = pageTitle;
        }

        if (pageType === 'index') {
            if (campaignManagerLinkEl) campaignManagerLinkEl.style.display = 'flex';
            // For index page, the main link shouldn't navigate, or should go to '#'
            if (headerLinkEl) headerLinkEl.href = '#'; // Or removeAttribute('href') if preferred
            if (headerLogoEl) headerLogoEl.style.display = 'inline-block'; // Show logo
            if (headerTitleIconEl) headerTitleIconEl.style.display = 'none'; // Hide scroll icon
        } else if (pageType === 'campaign') {
            if (headerLinkEl) headerLinkEl.href = 'index.html'; // Link back to index
            if (headerLogoEl) headerLogoEl.style.display = 'none'; // Hide logo on campaign pages for cleaner title
            if (headerTitleIconEl) headerTitleIconEl.style.display = 'inline-block'; // Show scroll icon next to title
            if (campaignManagerLinkEl) campaignManagerLinkEl.style.display = 'none'; // Hide campaign manager link
        }
        
        // After header HTML is loaded, load the BMC button into its placeholder
        await loadBmcButton();
    }
}

async function loadBmcButton() {
    const bmcPlaceholder = document.getElementById('bmc-button-container-placeholder');
    if (!bmcPlaceholder) {
        // console.log("BMC placeholder not found in header after loading.");
        return;
    }

    const bmcHTML = await fetchHTML('_bmc_button.html');
    if (bmcHTML) {
        bmcPlaceholder.innerHTML = bmcHTML; // Replace content of placeholder div
        
        // Re-evaluate the BMC script tag
        const scriptTag = bmcPlaceholder.querySelector('script[src*="buymeacoffee"]');
        if (scriptTag) {
            const newScript = document.createElement('script');
            // Copy all attributes from the original script tag to the new one
            for (let i = 0; i < scriptTag.attributes.length; i++) {
                const attr = scriptTag.attributes[i];
                newScript.setAttribute(attr.name, attr.value);
            }
            // The script needs to be re-appended to the DOM to execute
            scriptTag.parentNode.replaceChild(newScript, scriptTag);
        }
    }
}

async function loadCampaignModal() {
    const campaignModalContainer = document.getElementById('campaign-modal-container');
    if (!campaignModalContainer) return; // Only index.html will have this

    const campaignModalHTML = await fetchHTML('_campaign_modal.html');
    if (campaignModalHTML) {
        campaignModalContainer.innerHTML = campaignModalHTML; // Replace content of placeholder div
    }
}

async function loadNotesSection() {
    const notesContainer = document.getElementById('notes-container');
    if (!notesContainer) return; // Only campaign pages will have this

    const notesHTML = await fetchHTML('_notes_section.html');
    if (notesHTML) {
        notesContainer.innerHTML = notesHTML; // Replace content of placeholder div
        // Page-specific JavaScript in dungeons_of_enveron.html and forbidden_creed.html
        // should attach event listeners to #notesHeaderToggle for their specific saveState() functions.
        // This loader will not add a generic toggle listener for notes.
    }
}
