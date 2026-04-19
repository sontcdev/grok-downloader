// Background service worker for update checking

const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/sontcdev/grok-downloader/main/extension/version.json';
const CHECK_INTERVAL = 24 * 60; // Check every 24 hours (in minutes)

// Check for updates on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
    checkForUpdates();
    
    // Set up periodic update checks
    chrome.alarms.create('updateCheck', { periodInMinutes: CHECK_INTERVAL });
});

// Listen for alarm to check updates
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateCheck') {
        checkForUpdates();
    }
});

// Manual update check from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkUpdate') {
        checkForUpdates().then(sendResponse);
        return true; // Keep channel open for async response
    }
});

async function checkForUpdates() {
    try {
        const response = await fetch(UPDATE_CHECK_URL);
        if (!response.ok) throw new Error('Failed to fetch version info');
        
        const remoteVersion = await response.json();
        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;
        
        console.log('Current version:', currentVersion);
        console.log('Remote version:', remoteVersion.version);
        
        if (compareVersions(remoteVersion.version, currentVersion) > 0) {
            // New version available
            await chrome.storage.local.set({
                updateAvailable: true,
                latestVersion: remoteVersion
            });
            
            // Show badge
            chrome.action.setBadgeText({ text: 'NEW' });
            chrome.action.setBadgeBackgroundColor({ color: '#00c853' });
            
            console.log('Update available:', remoteVersion.version);
            return {
                available: true,
                version: remoteVersion.version,
                changelog: remoteVersion.changelog,
                downloadUrl: remoteVersion.download_url
            };
        } else {
            // No update
            await chrome.storage.local.set({ updateAvailable: false });
            chrome.action.setBadgeText({ text: '' });
            
            console.log('No update available');
            return { available: false };
        }
    } catch (error) {
        console.error('Update check failed:', error);
        return { available: false, error: error.message };
    }
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }
    
    return 0;
}
