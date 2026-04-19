// Display current version
const manifest = chrome.runtime.getManifest();
document.getElementById('currentVersion').textContent = `v${manifest.version}`;

// Load and display current settings
chrome.storage.sync.get(['speedMode', 'customPrompts'], (result) => {
    const speedMode = result.speedMode || 'NORMAL';
    const speedText = speedMode === 'FAST' ? 'Nhanh' : speedMode === 'SLOW' ? 'Chậm' : 'Trung bình';
    document.getElementById('speedModeDisplay').textContent = speedText;
    
    const prompts = splitPrompts(result.customPrompts || '');
    document.getElementById('promptCountDisplay').textContent = prompts.length;
});

// Open settings page
document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// Download update
document.getElementById('downloadUpdate').addEventListener('click', () => {
    chrome.storage.local.get(['latestVersion'], (result) => {
        if (result.latestVersion && result.latestVersion.download_url) {
            chrome.tabs.create({ url: result.latestVersion.download_url });
        }
    });
});

// Dismiss update
document.getElementById('dismissUpdate').addEventListener('click', () => {
    document.getElementById('updateNotification').style.display = 'none';
    chrome.storage.local.set({ updateDismissed: true });
});

// Check for update notification on load
chrome.storage.local.get(['updateAvailable', 'latestVersion', 'updateDismissed'], (result) => {
    if (result.updateAvailable && !result.updateDismissed && result.latestVersion) {
        showUpdateNotification(result.latestVersion);
    }
});

function splitPrompts(text) {
    return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

function showUpdateNotification(versionInfo) {
    const notification = document.getElementById('updateNotification');
    const versionEl = notification.querySelector('.update-version');
    
    versionEl.textContent = `Phiên bản ${versionInfo.version} đã có sẵn`;
    notification.style.display = 'block';
    chrome.storage.local.set({ updateDismissed: false });
}
