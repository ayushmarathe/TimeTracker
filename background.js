/* Constants */
const LOG_PREFIX = "⏱️";
const STORAGE_KEY_ACTIVE_SESSION = "activeSession";
const ALARM_NAME_PERIODIC_SAVE = "periodicSave";

/* Utility Functions */
function getDomain(url) {
    if (!url || !url.startsWith('http')) return null;
    try { return new URL(url).hostname; } 
    catch (error) { return null; }
}

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function saveActiveSession() {
    const { activeSession } = await chrome.storage.local.get(STORAGE_KEY_ACTIVE_SESSION);
    if (!activeSession || !activeSession.domain || !activeSession.startTime) {
        return;
    }
    const timeSpent = Math.floor((Date.now() - activeSession.startTime) / 1000);
    if (timeSpent <= 0) return;

    const dateKey = getLocalDateKey();
    const { [dateKey]: todaysData = {} } = await chrome.storage.local.get(dateKey);

    const previousTime = todaysData[activeSession.domain] || 0;
    todaysData[activeSession.domain] = previousTime + timeSpent;

    await chrome.storage.local.set({ [dateKey]: todaysData });
    console.log(`${LOG_PREFIX} Saved: +${timeSpent}s for ${activeSession.domain}`);
}

async function startNewSession(tab) {
    const { activeSession } = await chrome.storage.local.get(STORAGE_KEY_ACTIVE_SESSION);
    if (activeSession && activeSession.startTime) {
        const sessionDateKey = getLocalDateKey(new Date(activeSession.startTime));
        const todayKey = getLocalDateKey();

        if (sessionDateKey === todayKey) {
            // If the session is from today, it's valid. Save it.
            await saveActiveSession();
        } else {
            // If the session is from a previous day, it's stale. Discard it.
            console.log(`${LOG_PREFIX} Discarding stale session from ${sessionDateKey}`);
        }
    }
    // --- END OF FIX ---

    const domain = tab ? getDomain(tab.url) : null;
    if (domain) {
        const newSession = { domain: domain, startTime: Date.now() };
        await chrome.storage.local.set({ [STORAGE_KEY_ACTIVE_SESSION]: newSession });
    } else {
        await chrome.storage.local.remove(STORAGE_KEY_ACTIVE_SESSION);
    }
}

/* Event Listeners */
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME_PERIODIC_SAVE, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME_PERIODIC_SAVE) {
        // We call startNewSession which now contains the logic to handle stale sessions
        const { activeSession } = await chrome.storage.local.get(STORAGE_KEY_ACTIVE_SESSION);
        if (activeSession) {
            startNewSession({ url: `http://${activeSession.domain}` });
        }
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    startNewSession(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.url) {
        startNewSession(tab);
    }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        await saveActiveSession();
        await chrome.storage.local.remove(STORAGE_KEY_ACTIVE_SESSION);
    } else {
        const [tab] = await chrome.tabs.query({ active: true, windowId: windowId });
        startNewSession(tab);
    }
});