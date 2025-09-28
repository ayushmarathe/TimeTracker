let activeTabId = null;
let activeDomain = null;
let startTime = null;

function getDomain(url) {
    try{
        return new URL(url).hostname;
    }catch{
        return null
    }
}

function updateTime() {
    if(activeDomain && startTime){
        const timeSpent = Math.floor((Date.now() - startTime) / 1000); //seconds
        chrome.storage.local.get([activeDomain] , (result) => {
            const prev = result[activeDomain] || 0;
            chrome.storage.local.set({[activeDomain] : prev + timeSpent});
        });
    }
    startTime = Date.now();
}

chrome.tabs.onActivated.addListener((activeInfo) => {
    updateTime();
    chrome.tabs.get(activeInfo.tabId , (tab) => {
        activeTabId = activeInfo.tabId;
        activeDomain = getDomain(tab.url);
        startTime = Date.now();
    })
});

chrome.tabs.onUpdated.addListener((tabId , changeInfo , tab) => {
    if(tabId == activeTabId && changeInfo.url){
        updateTime();
        activeDomain = getDomain(changeInfo.url);
        startTime = Date.now();
    }
});

chrome.windows.onFocusChanged.addListener((windowId) =>{
    updateTime();
    if(windowId == chrome.windows.WINDOW_ID_NONE) {
        activeDomain = null;
    }else{
        chrome.tabs.query({active : true , windowId} , (tabs) => {
            if(tabs[0]) {
                activeDomain = getDomain(tabs[0].url);
                startTime = Date.now();
            }
        });
    }
});



setInterval(updateTime , 60000);