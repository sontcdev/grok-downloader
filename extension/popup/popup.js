const DEFAULT_PROMPTS = `A 6-second professional product video. The hand gently glides a finger across the back of the phone case to showcase the material. The background and the environment must remain exactly as shown in the original image. The design, patterns, and details on the phone case must stay perfectly static, fixed, and unchanged throughout the movement. Soft cinematic lighting, 4k, smooth hand motion.

A 6-second aesthetic showcase. The hand slowly tilts the phone from side to side to reveal its thickness and edges. The background and overall setting are kept identical to the reference image. Strictly no movement or distortion of the graphics/design on the case. High frame rate, realistic skin texture, professional product cinematography.

A 6-second product advertisement video. The camera slowly zooms in from a medium shot to a close-up on the phone case. Maintain the exact background and atmosphere from the image. The pattern on the phone case must be a fixed print and must not move, change, or warp during the zoom. Smooth camera transition, high-end look, 4k.`;

// Load saved settings
chrome.storage.sync.get(['speedMode', 'customPrompts'], (result) => {
    document.getElementById('speedMode').value = result.speedMode || 'NORMAL';
    document.getElementById('prompts').value = result.customPrompts || DEFAULT_PROMPTS;
});

// Save button
document.getElementById('save').addEventListener('click', () => {
    const speedMode = document.getElementById('speedMode').value;
    const customPrompts = document.getElementById('prompts').value.trim();

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
        document.getElementById('prompts').value = DEFAULT_PROMPTS;
        
        chrome.storage.sync.set({ 
            speedMode: 'NORMAL', 
            customPrompts: DEFAULT_PROMPTS 
        }, () => {
            showStatus('Đã khôi phục cài đặt mặc định', 'success');
        });
    }
});

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status show ${type}`;
    
    setTimeout(() => {
        status.classList.remove('show');
    }, 3000);
}
