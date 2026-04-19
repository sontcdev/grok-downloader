const DEFAULT_PROMPTS = `A 6-second professional product video. The hand gently glides a finger across the back of the phone case to showcase the material. The background and the environment must remain exactly as shown in the original image. The design, patterns, and details on the phone case must stay perfectly static, fixed, and unchanged throughout the movement. Soft cinematic lighting, 4k, smooth hand motion.

A 6-second aesthetic showcase. The hand slowly tilts the phone from side to side to reveal its thickness and edges. The background and overall setting are kept identical to the reference image. Strictly no movement or distortion of the graphics/design on the case. High frame rate, realistic skin texture, professional product cinematography.

A 6-second product advertisement video. The camera slowly zooms in from a medium shot to a close-up on the phone case. Maintain the exact background and atmosphere from the image. The pattern on the phone case must be a fixed print and must not move, change, or warp during the zoom. Smooth camera transition, high-end look, 4k.`;

const SPEED_PROFILES = {
    FAST: { uploadTimeout: '15s', afterUploadDelay: '3s' },
    NORMAL: { uploadTimeout: '25s', afterUploadDelay: '5s' },
    SLOW: { uploadTimeout: '40s', afterUploadDelay: '8s' }
};

// Display current version
const manifest = chrome.runtime.getManifest();
document.getElementById('currentVersion').textContent = manifest.version;

// Tab navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.dataset.tab;
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        
        item.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

// Load settings
chrome.storage.sync.get(['speedMode', 'customPrompts'], (result) => {
    const speedMode = result.speedMode || 'NORMAL';
    document.getElementById('speedMode').value = speedMode;
    document.getElementById('promptsTextarea').value = result.customPrompts || DEFAULT_PROMPTS;
    
    updateSpeedInfo(speedMode);
    updatePromptCount();
});

// Speed mode change
document.getElementById('speedMode').addEventListener('change', (e) => {
    updateSpeedInfo(e.target.value);
});

// Prompt textarea change
document.getElementById('promptsTextarea').addEventListener('input', updatePromptCount);

// Preview prompts
document.getElementById('previewPrompts').addEventListener('click', () => {
    const prompts = splitPrompts(document.getElementById('promptsTextarea').value);
    const preview = document.getElementById('promptPreview');
    const list = document.getElementById('promptList');
    
    list.innerHTML = prompts.map(p => `<li>${escapeHtml(p.substring(0, 100))}${p.length > 100 ? '...' : ''}</li>`).join('');
    preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
});

// Save button
document.getElementById('save').addEventListener('click', () => {
    const speedMode = document.getElementById('speedMode').value;
    const customPrompts = document.getElementById('promptsTextarea').value.trim();

    if (!customPrompts) {
        showStatus('Vui lòng nhập ít nhất một prompt', 'error');
        return;
    }

    chrome.storage.sync.set({ speedMode, customPrompts }, () => {
        showStatus('Đã lưu cài đặt thành công!', 'success');
    });
});

// Reset button
document.getElementById('reset').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn khôi phục cài đặt mặc định?')) {
        document.getElementById('speedMode').value = 'NORMAL';
        document.getElementById('promptsTextarea').value = DEFAULT_PROMPTS;
        
        updateSpeedInfo('NORMAL');
        updatePromptCount();
        
        chrome.storage.sync.set({ 
            speedMode: 'NORMAL', 
            customPrompts: DEFAULT_PROMPTS 
        }, () => {
            showStatus('Đã khôi phục cài đặt mặc định', 'success');
        });
    }
});

// Check update button
document.getElementById('checkUpdate').addEventListener('click', () => {
    const btn = document.getElementById('checkUpdate');
    btn.textContent = 'Đang kiểm tra...';
    btn.disabled = true;
    
    chrome.runtime.sendMessage({ action: 'checkUpdate' }, (response) => {
        btn.textContent = 'Kiểm tra ngay';
        btn.disabled = false;
        
        if (response && response.available) {
            showUpdateNotification(response);
        } else if (response && response.error) {
            showStatus('Lỗi khi kiểm tra cập nhật: ' + response.error, 'error');
        } else {
            showStatus('Bạn đang sử dụng phiên bản mới nhất', 'success');
        }
    });
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

// Helper functions
function updateSpeedInfo(mode) {
    document.getElementById('currentMode').textContent = 
        mode === 'FAST' ? 'Nhanh' : mode === 'SLOW' ? 'Chậm' : 'Trung bình';
    document.getElementById('uploadTimeout').textContent = SPEED_PROFILES[mode].uploadTimeout;
    document.getElementById('afterUploadDelay').textContent = SPEED_PROFILES[mode].afterUploadDelay;
}

function updatePromptCount() {
    const prompts = splitPrompts(document.getElementById('promptsTextarea').value);
    document.getElementById('promptCount').textContent = prompts.length;
}

function splitPrompts(text) {
    return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showUpdateNotification(versionInfo) {
    const notification = document.getElementById('updateNotification');
    const versionEl = notification.querySelector('.update-version');
    const changelogEl = notification.querySelector('.update-changelog');
    
    versionEl.textContent = `Phiên bản ${versionInfo.version} đã có sẵn`;
    
    if (versionInfo.changelog && versionInfo.changelog.length > 0) {
        changelogEl.innerHTML = '<strong>Có gì mới:</strong><ul>' + 
            versionInfo.changelog.map(item => `<li>${escapeHtml(item)}</li>`).join('') + 
            '</ul>';
    } else {
        changelogEl.innerHTML = '';
    }
    
    notification.style.display = 'block';
    chrome.storage.local.set({ updateDismissed: false });
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status show ${type}`;
    
    setTimeout(() => {
        status.classList.remove('show');
    }, 3000);
}
