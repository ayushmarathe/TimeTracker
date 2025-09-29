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

function getCurrentDateKey() {
    return new Date().toISOString().split('T')[0];
}

async function saveActiveSession() {
    const { activeSession } = await chrome.storage.local.get(STORAGE_KEY_ACTIVE_SESSION);

    if (!activeSession || !activeSession.domain || !activeSession.startTime) {
        return;
    }

    const timeSpent = Math.floor((Date.now() - activeSession.startTime) / 1000);
    if (timeSpent <= 0) return;

    const dateKey = getCurrentDateKey();
    const { [dateKey]: todaysData = {} } = await chrome.storage.local.get(dateKey);

    const previousTime = todaysData[activeSession.domain] || 0;
    todaysData[activeSession.domain] = previousTime + timeSpent;

    await chrome.storage.local.set({ [dateKey]: todaysData });
    console.log(`${LOG_PREFIX} Saved: +${timeSpent}s for ${activeSession.domain}`);
}

async function startNewSession(tab) {
    await saveActiveSession();
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