document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Get All Elements ---
    const views = document.querySelectorAll('.view-container');
    const settingsView = document.getElementById('settings-view');
    const unlockView = document.getElementById('parental-unlock-view');
    const sessionView = document.getElementById('parental-session-view');
    
    const settingsFieldset = document.getElementById('settings-fieldset'); // Get fieldset
    const modeHide = document.getElementById('mode-hide');
    const modeSelf = document.getElementById('mode-self');
    const modeParental = document.getElementById('mode-parental');
    
    // Self-Control Settings
    const selfSettings = document.getElementById('self-control-settings');
    const selfLimitTimeRadio = document.getElementById('self-limit-time');
    const selfLimitScrollRadio = document.getElementById('self-limit-scroll');
    const selfTimeLimitRow = document.getElementById('self-time-limit-row');
    const selfScrollLimitRow = document.getElementById('self-scroll-limit-row');
    const timeLimitInput = document.getElementById('time-limit');
    const scrollLimitInput = document.getElementById('scroll-limit');
    // --- NEW: Self-Control Status Elements ---
    const selfStatusView = document.getElementById('self-control-status');
    const selfTimerDisplay = selfStatusView.querySelector('.timer-display');
    const selfTimeRemaining = document.getElementById('self-time-remaining');
    const selfScrollDisplay = selfStatusView.querySelector('.scroll-display');
    const selfScrollsRemaining = document.getElementById('self-scrolls-remaining');


    // Parental Control Settings
    const parentalSettings = document.getElementById('parental-control-settings');
    const parentalLimitTimeRadio = document.getElementById('parental-limit-time');
    const parentalLimitScrollRadio = document.getElementById('parental-limit-scroll');
    const parentalTimeLimitRow = document.getElementById('parental-time-limit-row');
    const parentalScrollLimitRow = document.getElementById('parental-scroll-limit-row');
    const parentalTimeInput = document.getElementById('parental-time-limit');
    const parentalScrollLimitInput = document.getElementById('parental-scroll-limit');
    const pinInput = document.getElementById('pin-input');
    
    const saveButton = document.getElementById('save-button');

    // Unlock View Elements
    const unlockPinInput = document.getElementById('unlock-pin');
    const unlockButton = document.getElementById('unlock-button');
    const settingsButton = document.getElementById('settings-button');

    // Session View Elements
    const parentalTimerDisplay = sessionView.querySelector('.timer-display');
    const parentalTimeRemaining = document.getElementById('time-remaining');
    const parentalScrollDisplay = sessionView.querySelector('.scroll-display');
    const parentalScrollsRemaining = document.getElementById('scrolls-remaining');
    const lockNowButton = document.getElementById('lock-now-button');

    // Universal
    const statusMessage = document.getElementById('status-message');

    // Global state
    let settings = {};
    let tracking = {};
    let liveUpdateInterval = null; 

    // --- 2. Hashing Function (Unchanged) ---
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    // --- 3. View Management (Unchanged) ---
    function showView(viewId) {
        if (liveUpdateInterval) clearInterval(liveUpdateInterval); 
        views.forEach(view => view.style.display = 'none'); 
        document.getElementById(viewId).style.display = 'flex'; 
    }

    // --- 4. UI Logic ---
    function updateSettingsVisibility() {
        selfSettings.style.display = modeSelf.checked ? 'block' : 'none';
        parentalSettings.style.display = modeParental.checked ? 'block' : 'none';

        if (modeSelf.checked) {
            selfTimeLimitRow.style.display = selfLimitTimeRadio.checked ? 'flex' : 'none';
            selfScrollLimitRow.style.display = selfLimitScrollRadio.checked ? 'flex' : 'none';
        }
        
        if (modeParental.checked) {
            parentalTimeLimitRow.style.display = parentalLimitTimeRadio.checked ? 'flex' : 'none';
            parentalScrollLimitRow.style.display = parentalLimitScrollRadio.checked ? 'flex' : 'none';
        }
    }

    // --- UPDATED: Generic Live Timer for Parental ---
    function startLiveParentalTimer(totalSessionSeconds) {
        if (liveUpdateInterval) clearInterval(liveUpdateInterval); 
        parentalTimerDisplay.style.display = 'flex';
        parentalScrollDisplay.style.display = 'none';

        liveUpdateInterval = setInterval(() => {
            chrome.storage.sync.get('tracking', (data) => {
                if (!data.tracking.parentalSessionActive) {
                    clearInterval(liveUpdateInterval);
                    showView('parental-unlock-view'); 
                    return;
                }
                let timeSpent = data.tracking.parentalSessionTimeSpent || 0;
                let remaining = Math.max(0, totalSessionSeconds - timeSpent);
                let mins = Math.floor(remaining / 60);
                let secs = Math.floor(remaining % 60); 
                parentalTimeRemaining.textContent = 
                    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            });
        }, 1000); 
    }
    
    // --- UPDATED: Generic Live Scroller for Parental ---
    function startLiveParentalScroller(totalSessionScrolls) {
        if (liveUpdateInterval) clearInterval(liveUpdateInterval); 
        parentalTimerDisplay.style.display = 'none';
        parentalScrollDisplay.style.display = 'flex';

        liveUpdateInterval = setInterval(() => {
            chrome.storage.sync.get('tracking', (data) => {
                if (!data.tracking.parentalSessionActive) {
                    clearInterval(liveUpdateInterval);
                    showView('parental-unlock-view');
                    return;
                }
                let scrollsDone = data.tracking.parentalSessionScrolls || 0;
                let remaining = Math.max(0, totalSessionScrolls - scrollsDone);
                parentalScrollsRemaining.textContent = remaining;
            });
        }, 1000);
    }
    
    // --- NEW: Live Timer for Self-Control ---
    function startLiveSelfTimer(totalSeconds) {
        if (liveUpdateInterval) clearInterval(liveUpdateInterval); 
        
        selfStatusView.style.display = 'block';
        selfTimerDisplay.style.display = 'flex';
        selfScrollDisplay.style.display = 'none';

        liveUpdateInterval = setInterval(() => {
            chrome.storage.sync.get('tracking', (data) => {
                let timeSpent = data.tracking.timeSpent || 0;
                let remaining = Math.max(0, totalSeconds - timeSpent);
                let mins = Math.floor(remaining / 60);
                let secs = Math.floor(remaining % 60); 
                selfTimeRemaining.textContent = 
                    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            });
        }, 1000); 
    }
    
    // --- NEW: Live Scroller for Self-Control ---
    function startLiveSelfScroller(totalScrolls) {
        if (liveUpdateInterval) clearInterval(liveUpdateInterval); 
        
        selfStatusView.style.display = 'block';
        selfTimerDisplay.style.display = 'none';
        selfScrollDisplay.style.display = 'flex';

        liveUpdateInterval = setInterval(() => {
            chrome.storage.sync.get('tracking', (data) => {
                let scrollsDone = data.tracking.selfScrollsToday || 0;
                let remaining = Math.max(0, totalScrolls - scrollsDone);
                selfScrollsRemaining.textContent = remaining;
            });
        }, 1000);
    }


    // --- 5. Event Listeners (All logic is the same, just updated) ---
    modeHide.addEventListener('change', updateSettingsVisibility);
    modeSelf.addEventListener('change', updateSettingsVisibility);
    modeParental.addEventListener('change', updateSettingsVisibility);
    selfLimitTimeRadio.addEventListener('change', updateSettingsVisibility);
    selfLimitScrollRadio.addEventListener('change', updateSettingsVisibility);
    parentalLimitTimeRadio.addEventListener('change', updateSettingsVisibility);
    parentalLimitScrollRadio.addEventListener('change', updateSettingsVisibility);

    saveButton.addEventListener('click', async () => {
        let mode = 'hide';
        if (modeSelf.checked) mode = 'self_control';
        if (modeParental.checked) mode = 'parental_control';

        const newPassword = pinInput.value;
        if (mode === 'parental_control' && (newPassword.length > 0 && newPassword.length < 4)) {
            statusMessage.textContent = 'Password must be at least 4 characters.';
            statusMessage.style.color = 'red';
            return;
        }
        
        settings = {
            mode: mode,
            selfLimitType: selfLimitTimeRadio.checked ? 'time' : 'scroll',
            timeLimit: parseInt(timeLimitInput.value, 10),
            scrollLimit: parseInt(scrollLimitInput.value, 10),
            parentalLimitType: parentalLimitTimeRadio.checked ? 'time' : 'scroll',
            parentalTimeLimit: parseInt(parentalTimeInput.value, 10),
            parentalScrollLimit: parseInt(parentalScrollLimitInput.value, 10),
            pin: settings.pin 
        };
        
        if (mode === 'parental_control' && newPassword.length >= 4) {
            settings.pin = await hashPassword(newPassword); 
            pinInput.value = ''; 
        }

        chrome.storage.sync.set(settings, () => {
            statusMessage.textContent = 'Settings saved!';
            statusMessage.style.color = 'green';
            setTimeout(() => { statusMessage.textContent = ''; }, 2000);
            loadDataAndShowView();
        });
    });

    unlockButton.addEventListener('click', async () => {
        const enteredPassword = unlockPinInput.value;
        const hashedInput = await hashPassword(enteredPassword);

        if (hashedInput === settings.pin) {
            statusMessage.textContent = ''; 
            tracking.parentalSessionActive = true;
            tracking.parentalSessionTimeSpent = 0; 
            tracking.parentalSessionScrolls = 0;
            
            chrome.storage.sync.set({ tracking: tracking }, () => {
                showView('parental-session-view');
                if (settings.parentalLimitType === 'time') {
                    startLiveParentalTimer(settings.parentalTimeLimit * 60);
                } else {
                    startLiveParentalScroller(settings.parentalScrollLimit);
                }
            });
        } else {
            statusMessage.textContent = 'Incorrect Password.';
            statusMessage.style.color = 'red';
        }
        unlockPinInput.value = '';
    });
    
    lockNowButton.addEventListener('click', () => {
        tracking.parentalSessionActive = false;
        tracking.parentalSessionTimeSpent = 0;
        tracking.parentalSessionScrolls = 0;
        chrome.storage.sync.set({ tracking: tracking }, () => {
            showView('parental-unlock-view');
        });
    });

    settingsButton.addEventListener('click', async () => {
        const pin = prompt('Enter Password to manage settings:');
        if (pin) {
            const hashedInput = await hashPassword(pin);
            if (hashedInput === settings.pin) {
                showView('settings-view');
            } else {
                alert('Incorrect Password.');
            }
        }
    });

    // --- 6. Initialization Function (HEAVILY UPDATED) ---
    function loadDataAndShowView() {
        const keysToGet = [
            'mode', 
            'selfLimitType', 'timeLimit', 'scrollLimit',
            'parentalLimitType', 'parentalTimeLimit', 'parentalScrollLimit',
            'pin', 'tracking'
        ];
        
        chrome.storage.sync.get(keysToGet, (data) => {
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
            
            tracking = data.tracking || {
                timeSpent: 0,
                lastTrackedDate: getTodayDateString(),
                limitReached: false,
                parentalSessionActive: false,
                parentalSessionTimeSpent: 0,
                parentalSessionScrolls: 0,
                selfScrollsToday: 0
            };
            if (typeof tracking.parentalSessionScrolls === 'undefined') tracking.parentalSessionScrolls = 0;
            if (typeof tracking.selfScrollsToday === 'undefined') tracking.selfScrollsToday = 0;

            // ---- Main router logic (UPDATED) ----
            
            // Clear any old UI state
            selfStatusView.style.display = 'none';
            settingsFieldset.disabled = false;
            
            if (settings.mode === 'parental_control') {
                if (settings.pin.length === 0) { 
                    statusMessage.textContent = 'Please set a Password for Parental Control.';
                    statusMessage.style.color = 'red';
                    showView('settings-view');
                } else if (tracking.parentalSessionActive) {
                    showView('parental-session-view');
                    if (settings.parentalLimitType === 'time') {
                        startLiveParentalTimer(settings.parentalTimeLimit * 60);
                    } else {
                        startLiveParentalScroller(settings.parentalScrollLimit);
                    }
                } else {
                    showView('parental-unlock-view');
                }
            } else if (settings.mode === 'self_control') {
                // --- NEW SELF-CONTROL LOGIC ---
                showView('settings-view'); // Always show settings view
                if (tracking.limitReached) {
                    // Limit is reached! Show a message and disable settings.
                    selfStatusView.style.display = 'none';
                    statusMessage.textContent = 'Daily limit reached. Resets at midnight.';
                    statusMessage.style.color = 'red';
                    settingsFieldset.disabled = true; // Disable all settings
                } else {
                    // Limit not reached, show the dashboard
                    selfStatusView.style.display = 'block';
                    if (settings.selfLimitType === 'time') {
                        startLiveSelfTimer(settings.timeLimit * 60);
                    } else {
                        startLiveSelfScroller(settings.scrollLimit);
                    }
                }
            } else {
                // Mode is 'hide', just show settings
                showView('settings-view');
            }
            
            // --- Populate the settings view (always) ---
            if (settings.mode === 'self_control') modeSelf.checked = true;
            else if (settings.mode === 'parental_control') modeParental.checked = true;
            else modeHide.checked = true;
            
            selfLimitTimeRadio.checked = settings.selfLimitType === 'time';
            selfLimitScrollRadio.checked = settings.selfLimitType === 'scroll';
            timeLimitInput.value = settings.timeLimit;
            scrollLimitInput.value = settings.scrollLimit;

            parentalLimitTimeRadio.checked = settings.parentalLimitType === 'time';
            parentalLimitScrollRadio.checked = settings.parentalLimitType === 'scroll';
            parentalTimeInput.value = settings.parentalTimeLimit;
            parentalScrollLimitInput.value = settings.parentalScrollLimit;
            pinInput.value = ''; 
            
            updateSettingsVisibility();
        });
    }

    // Initial run
    loadDataAndShowView();
});