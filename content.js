// --- 1. Global Variables ---
let settings = {
    // ... (all settings)
    selfLimitType: 'time',
    scrollLimit: 50,
    parentalLimitType: 'time',
    parentalScrollLimit: 25
};
let tracking = {
    timeSpent: 0,
    lastTrackedDate: getTodayDateString(),
    limitReached: false,
    parentalSessionActive: false,
    parentalSessionTimeSpent: 0,
    // --- NEW ---
    parentalSessionScrolls: 0,
    selfScrollsToday: 0
};
let timerInterval = null; 
let domObserver = null; 
// --- NEW ---
let previousUrl = ""; // To track URL changes for scroll counting

// --- 2. Helper Functions (Unchanged) ---
function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function showBlockMessageAndRedirect(message, title = "Time's Up!") {
  if (document.getElementById('shorts-block-overlay')) return;
  if (timerInterval) clearInterval(timerInterval);
  if (domObserver) domObserver.disconnect(); 

  const overlay = document.createElement('div');
  overlay.id = 'shorts-block-overlay';
  const messageBox = document.createElement('div');
  messageBox.id = 'shorts-block-message';
  messageBox.innerHTML = `<h1>${title}</h1><p>${message}</p><p>Redirecting you to the homepage...</p>`;
  overlay.appendChild(messageBox);
  document.body.appendChild(overlay);
  const style = document.createElement('style');
  style.innerHTML = `
    #shorts-block-overlay {
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); z-index: 99998;
      display: flex; justify-content: center; align-items: center;
    }
    #shorts-block-message {
      background: white; padding: 40px; border-radius: 12px;
      text-align: center; font-family: Arial, sans-serif;
      z-index: 99999; color: #333;
    }
    #shorts-block-message h1 { color: #d93025; font-size: 2.5em; margin-top: 0; }
  `;
  document.head.appendChild(style);
  setTimeout(() => {
    window.location.href = 'https://www.youtube.com';
  }, 3000);
}


// --- 3. Hiding Functions (Unchanged) ---

function hideAllShortsElements() {
    const shelfSelectors = 'ytd-rich-section-renderer, ytd-reel-shelf-renderer';
    document.querySelectorAll(shelfSelectors).forEach(shelf => {
        if (shelf.tagName.toLowerCase() === 'ytd-reel-shelf-renderer') {
            if (shelf.style.display !== 'none') shelf.style.display = 'none';
            return; 
        }
        const titleElement = shelf.querySelector('#title-container');
        if (titleElement && titleElement.innerText.includes('Shorts')) {
            if (shelf.style.display !== 'none') shelf.style.display = 'none';
        }
    });
    document.querySelectorAll('ytd-mini-guide-entry-renderer').forEach(entry => {
        const link = entry.querySelector('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/shorts/')) {
                if (entry.style.display !== 'none') entry.style.display = 'none';
            }
        }
    });
    document.querySelectorAll('ytd-guide-entry-renderer').forEach(entry => {
        const link = entry.querySelector('a[title="Shorts"]');
        if (link) {
            if (entry.style.display !== 'none') entry.style.display = 'none';
        }
    });
    if (window.location.pathname.startsWith('/shorts/') && !document.getElementById('shorts-block-overlay')) {
        window.location.href = 'https://www.youtube.com';
    }
}

function hideNavigationElements() {
    document.querySelectorAll('ytd-mini-guide-entry-renderer').forEach(entry => {
        const link = entry.querySelector('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/shorts/')) {
                if (entry.style.display !== 'none') entry.style.display = 'none';
            }
        }
    });
    document.querySelectorAll('ytd-guide-entry-renderer').forEach(entry => {
        const link = entry.querySelector('a[title="Shorts"]');
        if (link) {
            if (entry.style.display !== 'none') entry.style.display = 'none';
        }
    });
}

// --- NEW: This function REVERSES hiding ---
function showAllShortsElements() {
    // 1. Show Shelves
    const shelfSelectors = 'ytd-rich-section-renderer, ytd-reel-shelf-renderer';
    document.querySelectorAll(shelfSelectors).forEach(shelf => {
        // Find shelves that *we* hid and reset them
        if (shelf.style.display === 'none') {
            if (shelf.tagName.toLowerCase() === 'ytd-reel-shelf-renderer') {
                shelf.style.display = ''; // Reset style
            }
            const titleElement = shelf.querySelector('#title-container');
            if (titleElement && titleElement.innerText.includes('Shorts')) {
                shelf.style.display = ''; // Reset style
            }
        }
    });

    // 2. Show Mini-Guide Buttons
    document.querySelectorAll('ytd-mini-guide-entry-renderer').forEach(entry => {
        const link = entry.querySelector('a');
        if (link && link.getAttribute('href')?.startsWith('/shorts/')) {
            if (entry.style.display === 'none') {
                entry.style.display = ''; // Reset style
            }
        }
    });

    // 3. Show Full-Guide Button
    document.querySelectorAll('ytd-guide-entry-renderer').forEach(entry => {
        const link = entry.querySelector('a[title="Shorts"]');
        if (link) {
            if (entry.style.display === 'none') {
                entry.style.display = ''; // Reset style
            }
        }
    });
}

// --- 4. Logic Loops (HEAVILY UPDATED) ---

// Hiding logic (Unchanged from refactor)
function runHidingLogic() {
  // First, check if the limit has *already* been reached for the day
  if (tracking.limitReached) {
    hideAllShortsElements(); // Just hide everything and stop
    return;
  }

  // If limit is not reached, proceed with mode logic
  switch (settings.mode) {
    case 'hide':
      hideAllShortsElements();
      break;

    case 'self_control':
      // In this mode, we *only* hide nav buttons (if time isn't up)
      hideNavigationElements();
      break;

    case 'parental_control':
      if (tracking.parentalSessionActive) {
        // *** THE FIX ***
        // Session is active, UN-HIDE everything!
        showAllShortsElements();
      } else {
        // Session is NOT active. This is the default locked state.
        hideAllShortsElements();
      }
      break;
    
    default:
      hideAllShortsElements();
  }
}

// --- RENAMED & UPDATED: This function now checks limits (Time OR Scroll) ---
function runLimitChecks() {
  const today = getTodayDateString();
  if (tracking.lastTrackedDate !== today) {
    tracking.timeSpent = 0;
    tracking.lastTrackedDate = today;
    tracking.limitReached = false; 
    tracking.selfScrollsToday = 0; // Reset daily scrolls
    // Note: parental session is not reset by day
  }

  // --- NEW: Scroll detection logic ---
  let currentUrl = window.location.href;
  let newShortViewed = false;
  if (currentUrl !== previousUrl && currentUrl.includes("/shorts/")) {
      newShortViewed = true; // We've just scrolled to a new Short!
  }
  previousUrl = currentUrl; // Update for next check

  // --- Mode-Based Limit Checks ---
  switch (settings.mode) {
    
    case 'self_control':
      if (tracking.limitReached) return; // Day is done

      if (settings.selfLimitType === 'time') {
        // --- TIME LIMIT LOGIC (existing) ---
        if (window.location.pathname.startsWith('/shorts/')) {
            tracking.timeSpent += 1; // 1 second has passed
            chrome.storage.sync.set({ tracking: tracking });

            if (tracking.timeSpent >= settings.timeLimit * 60) {
                tracking.limitReached = true;
                chrome.storage.sync.set({ tracking: tracking }); 
                showBlockMessageAndRedirect("Your daily time limit for YouTube Shorts is finished.");
            }
        }
      } else {
        // --- SCROLL LIMIT LOGIC (new) ---
        if (newShortViewed) {
            tracking.selfScrollsToday += 1;
            chrome.storage.sync.set({ tracking: tracking });

            if (tracking.selfScrollsToday > settings.scrollLimit) {
                tracking.limitReached = true;
                chrome.storage.sync.set({ tracking: tracking });
                showBlockMessageAndRedirect("Your daily scroll limit for YouTube Shorts is finished.");
            }
        }
      }
      break;

    case 'parental_control':
      if (!tracking.parentalSessionActive) return; // No session, do nothing

      if (settings.parentalLimitType === 'time') {
        // --- TIME LIMIT LOGIC (existing) ---
        if (window.location.pathname.startsWith('/shorts/')) {
            tracking.parentalSessionTimeSpent += 1; // 1 second has passed
            chrome.storage.sync.set({ tracking: tracking });

            if (tracking.parentalSessionTimeSpent >= settings.parentalTimeLimit * 60) {
                tracking.parentalSessionActive = false;
                tracking.parentalSessionTimeSpent = 0;
                tracking.parentalSessionScrolls = 0;
                chrome.storage.sync.set({ tracking: tracking }); 
                showBlockMessageAndRedirect("Your unlocked session has ended.", "Session Locked");
            }
        }
      } else {
        // --- SCROLL LIMIT LOGIC (new) ---
        if (newShortViewed) {
            tracking.parentalSessionScrolls += 1;
            chrome.storage.sync.set({ tracking: tracking });

            if (tracking.parentalSessionScrolls > settings.parentalScrollLimit) {
                tracking.parentalSessionActive = false;
                tracking.parentalSessionTimeSpent = 0;
                tracking.parentalSessionScrolls = 0;
                chrome.storage.sync.set({ tracking: tracking });
                showBlockMessageAndRedirect("Your unlocked session has ended.", "Session Locked");
            }
        }
      }
      break;
  }
}

// --- 5. Initialization and Storage Listeners (UPDATED) ---

function startObserver() {
    if (domObserver) domObserver.disconnect(); 
    domObserver = new MutationObserver((mutations) => {
        runHidingLogic();
    });
    domObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function loadDataAndStart() {
  if (timerInterval) clearInterval(timerInterval);
  if (domObserver) domObserver.disconnect();

  // --- NEW: Load all keys ---
  const keysToGet = [
    'mode', 
    'selfLimitType', 'timeLimit', 'scrollLimit',
    'parentalLimitType', 'parentalTimeLimit', 'parentalScrollLimit',
    'pin', 'tracking'
  ];

  chrome.storage.sync.get(keysToGet, (data) => {
    
    // --- NEW: Load all settings ---
    settings = {
        mode: data.mode || 'hide',
        selfLimitType: data.selfLimitType || 'time',
        timeLimit: data.timeLimit || 30,
        scrollLimit: data.scrollLimit || 50,
        parentalLimitType: data.parentalLimitType || 'time',
        parentalTimeLimit: data.parentalTimeLimit || 10,
        parentalScrollLimit: data.parentalScrollLimit || 25,
        pin: data.pin || ''
    };
    
    // --- NEW: Load all tracking data ---
    tracking = data.tracking || {
      timeSpent: 0,
      lastTrackedDate: getTodayDateString(),
      limitReached: false,
      parentalSessionActive: false,
      parentalSessionTimeSpent: 0,
      parentalSessionScrolls: 0,
      selfScrollsToday: 0
    };
    // Add new keys if old tracking data exists
    if (typeof tracking.parentalSessionScrolls === 'undefined') tracking.parentalSessionScrolls = 0;
    if (typeof tracking.selfScrollsToday === 'undefined') tracking.selfScrollsToday = 0;


    checkAndResetDailyLimit(); 

    runHidingLogic();
    startObserver();
    
    // --- RENAMED: Start the lightweight limit-checking loop ---
    timerInterval = setInterval(runLimitChecks, 1000); 
  });
}

// --- UPDATED: Also resets daily scrolls ---
function checkAndResetDailyLimit() {
  const today = getTodayDateString();
  if (tracking.lastTrackedDate !== today) {
    console.log('New day, resetting self-control timers.');
    tracking.timeSpent = 0;
    tracking.lastTrackedDate = today;
    tracking.limitReached = false;
    tracking.selfScrollsToday = 0; // Reset scroll count
    chrome.storage.sync.set({ tracking: tracking });
  }
}

// --- UPDATED: Listens for all new keys ---
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    // Check if any key we care about has changed
    const relevantChange = Object.keys(changes).some(key => [
        'mode', 'selfLimitType', 'timeLimit', 'scrollLimit',
        'parentalLimitType', 'parentalTimeLimit', 'parentalScrollLimit',
        'pin', 'tracking'
    ].includes(key));

    if (relevantChange) {
        console.log('Settings or tracking data changed. Reloading...');
        loadDataAndStart();
    }
  }
});

// Initial run
loadDataAndStart();
console.log('YouTube Shorts Control (Optimized, w/ Scroll) is active.');