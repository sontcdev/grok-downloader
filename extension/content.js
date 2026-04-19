(function () {
    'use strict';

    // ===== CONFIGURATION =====
    let SPEED_MODE = 'NORMAL'; // Sẽ được load từ chrome.storage
    
    const SPEED_PROFILES = {
        FAST: {
            TIMEOUTS: { IMAGE_UPLOAD: 15000, PROMPT_BOX: 20000, CREATE_BUTTON: 10000 },
            DELAYS: { POLL: 300, POLL_SLOW: 500, SHORT: 200, MEDIUM: 800, AFTER_UPLOAD: 3000, AFTER_BACK: 2500, BEFORE_CREATE: 2000, AFTER_FILL_PROMPT: 1000 }
        },
        NORMAL: {
            TIMEOUTS: { IMAGE_UPLOAD: 25000, PROMPT_BOX: 30000, CREATE_BUTTON: 15000 },
            DELAYS: { POLL: 500, POLL_SLOW: 800, SHORT: 500, MEDIUM: 1500, AFTER_UPLOAD: 5000, AFTER_BACK: 4000, BEFORE_CREATE: 3000, AFTER_FILL_PROMPT: 2000 }
        },
        SLOW: {
            TIMEOUTS: { IMAGE_UPLOAD: 40000, PROMPT_BOX: 45000, CREATE_BUTTON: 20000 },
            DELAYS: { POLL: 800, POLL_SLOW: 1200, SHORT: 800, MEDIUM: 2500, AFTER_UPLOAD: 8000, AFTER_BACK: 6000, BEFORE_CREATE: 5000, AFTER_FILL_PROMPT: 3000 }
        }
    };

    let CONFIG = {
        PROMPTS: `
            A 6-second professional product video. The hand gently glides a finger across the back of the phone case to showcase the material. The background and the environment must remain exactly as shown in the original image. The design, patterns, and details on the phone case must stay perfectly static, fixed, and unchanged throughout the movement. Soft cinematic lighting, 4k, smooth hand motion.

            A 6-second aesthetic showcase. The hand slowly tilts the phone from side to side to reveal its thickness and edges. The background and overall setting are kept identical to the reference image. Strictly no movement or distortion of the graphics/design on the case. High frame rate, realistic skin texture, professional product cinematography.

            A 6-second product advertisement video. The camera slowly zooms in from a medium shot to a close-up on the phone case. Maintain the exact background and atmosphere from the image. The pattern on the phone case must be a fixed print and must not move, change, or warp during the zoom. Smooth camera transition, high-end look, 4k.
        `,
        ...SPEED_PROFILES[SPEED_MODE],
        UPLOAD_RETRY: 3
    };

    // Load settings from storage
    chrome.storage.sync.get(['speedMode', 'customPrompts'], (result) => {
        if (result.speedMode) {
            SPEED_MODE = result.speedMode;
            Object.assign(CONFIG, SPEED_PROFILES[SPEED_MODE]);
        }
        if (result.customPrompts) {
            CONFIG.PROMPTS = result.customPrompts;
        }
    });

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.speedMode) {
            SPEED_MODE = changes.speedMode.newValue;
            Object.assign(CONFIG, SPEED_PROFILES[SPEED_MODE]);
            console.log('🔄 Đã cập nhật tốc độ:', SPEED_MODE);
        }
        if (changes.customPrompts) {
            CONFIG.PROMPTS = changes.customPrompts.newValue;
            console.log('🔄 Đã cập nhật prompts');
        }
    });

    // ===== PROGRESS UI =====
    let progressOverlay = null;
    let isCancelled = false;

    function createProgressUI() {
        const overlay = document.createElement('div');
        overlay.id = 'grok-progress-overlay';
        overlay.innerHTML = `
            <div class="progress-container">
                <div class="progress-header">
                    <h2>Đang tạo video...</h2>
                    <button class="cancel-btn" id="cancelBtn">✕ Hủy</button>
                </div>
                <div class="progress-info">
                    <div class="progress-stats">
                        <span id="currentProgress">0</span> / <span id="totalProgress">0</span> videos
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progressBar"></div>
                    </div>
                    <div class="progress-percentage" id="progressPercentage">0%</div>
                </div>
                <div class="progress-details">
                    <div class="detail-row">
                        <span class="label">Ảnh hiện tại:</span>
                        <span class="value" id="currentImage">-</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Prompt:</span>
                        <span class="value" id="currentPrompt">-</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Trạng thái:</span>
                        <span class="value status" id="currentStatus">Đang khởi động...</span>
                    </div>
                </div>
                <div class="progress-log" id="progressLog"></div>
            </div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            #grok-progress-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .progress-container {
                background: white;
                border-radius: 16px;
                padding: 30px;
                width: 600px;
                max-width: 90vw;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            .progress-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 25px;
            }
            .progress-header h2 {
                margin: 0;
                font-size: 24px;
                color: #333;
            }
            .cancel-btn {
                background: #ff5252;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background 0.2s;
            }
            .cancel-btn:hover {
                background: #ff1744;
            }
            .progress-info {
                margin-bottom: 25px;
            }
            .progress-stats {
                font-size: 18px;
                font-weight: 600;
                color: #00c853;
                margin-bottom: 12px;
                text-align: center;
            }
            .progress-bar-container {
                background: #e0e0e0;
                height: 12px;
                border-radius: 6px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            .progress-bar {
                background: linear-gradient(90deg, #00c853, #00e676);
                height: 100%;
                width: 0%;
                transition: width 0.3s ease;
                border-radius: 6px;
            }
            .progress-percentage {
                text-align: center;
                font-size: 14px;
                color: #666;
            }
            .progress-details {
                background: #f5f5f5;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #e0e0e0;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .detail-row .label {
                color: #888;
                font-size: 14px;
            }
            .detail-row .value {
                color: #333;
                font-weight: 500;
                font-size: 14px;
                max-width: 400px;
                text-align: right;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .detail-row .value.status {
                color: #00c853;
            }
            .progress-log {
                max-height: 150px;
                overflow-y: auto;
                background: #fafafa;
                border-radius: 8px;
                padding: 12px;
                font-size: 12px;
                color: #666;
                font-family: 'Courier New', monospace;
            }
            .log-entry {
                padding: 4px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            .log-entry:last-child {
                border-bottom: none;
            }
            .log-entry .time {
                color: #999;
                margin-right: 8px;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn hủy quá trình tạo video?')) {
                isCancelled = true;
                updateStatus('Đã hủy');
                addLog('Người dùng đã hủy quá trình');
            }
        });
        
        return overlay;
    }

    function updateProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        document.getElementById('currentProgress').textContent = current;
        document.getElementById('totalProgress').textContent = total;
        document.getElementById('progressBar').style.width = percentage + '%';
        document.getElementById('progressPercentage').textContent = percentage + '%';
    }

    function updateCurrentImage(imageName) {
        document.getElementById('currentImage').textContent = imageName;
    }

    function updateCurrentPrompt(prompt) {
        const shortPrompt = prompt.substring(0, 60) + (prompt.length > 60 ? '...' : '');
        document.getElementById('currentPrompt').textContent = shortPrompt;
    }

    function updateStatus(status) {
        document.getElementById('currentStatus').textContent = status;
    }

    function addLog(message) {
        const logContainer = document.getElementById('progressLog');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const time = new Date().toLocaleTimeString('vi-VN');
        entry.innerHTML = `<span class="time">[${time}]</span>${message}`;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    function showProgressUI() {
        if (!progressOverlay) {
            progressOverlay = createProgressUI();
        }
        progressOverlay.style.display = 'flex';
        isCancelled = false;
    }

    function hideProgressUI() {
        if (progressOverlay) {
            progressOverlay.style.display = 'none';
        }
    }

    // ===== UTILITIES =====
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function splitPromptList(promptText) {
        return promptText
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(Boolean);
    }

    function humanClick(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(type => {
            el.dispatchEvent(
                new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    button: 0
                })
            );
        });
    }

    // ===== ERROR HANDLING =====
    window.addEventListener('unhandledrejection', e => {
        if (e.reason?.name === 'AbortError') {
            e.preventDefault();
            return;
        }
    });

    // ===== IMAGE UPLOAD =====
    async function waitForImageUploaded(timeout = CONFIG.TIMEOUTS.IMAGE_UPLOAD) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const settingsBtn = document.querySelector('button[aria-label="Cài đặt"]');
            const imagePreview = document.querySelector('img[src*="blob:"]') ||
                               document.querySelector('img[src*="grok.com"]');
            const postPage = location.href.includes('/imagine/post/') ||
                           location.href.includes('/imagine/image/');

            if (settingsBtn || imagePreview || postPage) {
                console.log('✅ Phát hiện ảnh đã upload');
                return true;
            }
            await sleep(CONFIG.DELAYS.POLL_SLOW);
        }
        return false;
    }

    async function uploadSingleImage(file) {
        const input = document.querySelector('input[type="file"]');
        if (!input) throw '❌ Không tìm thấy input upload';

        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function selectMultipleImages() {
        return new Promise(resolve => {
            const input = document.querySelector('input[type="file"]');
            if (!input) return resolve([]);

            input.setAttribute('multiple', 'multiple');
            input.addEventListener(
                'change',
                () => resolve([...input.files]),
                { once: true }
            );
            input.click();
        });
    }

    // ===== PROMPT HANDLING =====
    async function waitForPromptBox(timeout = CONFIG.TIMEOUTS.PROMPT_BOX) {
        console.log('waitForPromptBox');
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const editors = document.querySelectorAll(
                'div[contenteditable="true"].ProseMirror, div[contenteditable="true"].tiptap'
            );

            for (const el of editors) {
                const placeholder = el.querySelector('[data-placeholder]');
                if (
                    placeholder &&
                    placeholder.getAttribute('data-placeholder')?.includes('Nhập để Imagine, @ để tham chiếu hình ảnh') &&
                    el.offsetParent !== null
                ) {
                    console.log('Tìm thấy prompt box');
                    return el;
                }
            }

            await sleep(CONFIG.DELAYS.POLL);
        }
        console.log('Không tìm thấy prompt box');
        return null;
    }

    async function fillPrompt(promptText) {
        const box = await waitForPromptBox();
        if (!box) throw '❌ Không tìm thấy prompt box';

        box.focus();
        await sleep(CONFIG.DELAYS.SHORT);

        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(CONFIG.DELAYS.SHORT);

        const lines = promptText.split('\n');
        for (let i = 0; i < lines.length; i++) {
            document.execCommand('insertText', false, lines[i]);
            if (i < lines.length - 1) {
                document.execCommand('insertLineBreak', false, null);
            }
        }

        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.dispatchEvent(new Event('change', { bubbles: true }));
        box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        
        box.blur();
        await sleep(CONFIG.DELAYS.SHORT);
        box.focus();
        await sleep(CONFIG.DELAYS.SHORT);

        await sleep(CONFIG.DELAYS.AFTER_FILL_PROMPT);
        console.log('✅ Đã fill prompt:', promptText.substring(0, 50) + '...');
    }

    // ===== VIDEO CREATION =====
    async function clickCreateVideo(timeout = CONFIG.TIMEOUTS.CREATE_BUTTON) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const btn = document.querySelector(
                'button[aria-label="Gửi"][type="submit"], button[aria-label="Submit"][type="submit"]'
            );

            if (btn && btn.offsetParent !== null && !btn.hasAttribute('disabled')) {
                console.log('⏳ Nút Gửi đã enable, chờ thêm để đảm bảo prompt được lưu...');
                await sleep(CONFIG.DELAYS.BEFORE_CREATE);
                console.log('✅ Click button Tạo video');
                humanClick(btn);
                return;
            }

            await sleep(CONFIG.DELAYS.POLL);
        }

        throw '❌ Không tìm thấy nút Tạo video hoặc nút bị disabled';
    }

    // ===== NAVIGATION =====
    async function goBackToUpload() {
        const backBtn = document.querySelector('div[aria-label="Quay lại"]') ||
                       document.querySelector('button[aria-label="Quay lại"]') ||
                       document.querySelector('a[href="/imagine"]');
        if (!backBtn) throw '❌ Không tìm thấy nút Quay lại';
        console.log('🔙 Click nút Quay lại');
        humanClick(backBtn);
        await sleep(CONFIG.DELAYS.AFTER_BACK);
    }

    // ===== MAIN WORKFLOW =====
    async function processOneImage(file, imageIndex, totalImages, promptList) {
        console.log('🖼 Xử lý ảnh:', file.name);
        updateCurrentImage(`${imageIndex}/${totalImages}: ${file.name}`);
        addLog(`Bắt đầu xử lý ảnh: ${file.name}`);

        for (let i = 0; i < promptList.length; i++) {
            if (isCancelled) {
                addLog('Đã dừng do người dùng hủy');
                throw 'CANCELLED';
            }

            const videoNumber = (imageIndex - 1) * promptList.length + i + 1;
            const totalVideos = totalImages * promptList.length;
            
            console.log(`🎬 Video ${videoNumber}/${totalVideos} cho ảnh ${file.name}`);
            updateProgress(videoNumber - 1, totalVideos);

            const promptNow = promptList[i];
            console.log('📝 Prompt:', promptNow);
            updateCurrentPrompt(promptNow);

            // Upload
            updateStatus('Đang upload ảnh...');
            addLog(`Upload ảnh (lần thử 1/${CONFIG.UPLOAD_RETRY})`);
            
            let uploaded = false;
            for (let retry = 1; retry <= CONFIG.UPLOAD_RETRY; retry++) {
                if (isCancelled) throw 'CANCELLED';
                
                console.log(`🔁 Upload thử lần ${retry}:`, file.name);

                await uploadSingleImage(file);

                if (await waitForImageUploaded()) {
                    uploaded = true;
                    console.log('✅ Upload OK');
                    addLog('Upload thành công');
                    break;
                }

                console.warn('⚠ Không phát hiện ảnh đã upload, thử lại...');
                addLog(`Upload thất bại, thử lại (${retry}/${CONFIG.UPLOAD_RETRY})`);
                await goBackToUpload();
                await sleep(CONFIG.DELAYS.MEDIUM * 2);
            }

            if (!uploaded) {
                addLog('❌ Upload thất bại sau 3 lần thử');
                throw '❌ Upload thất bại sau 3 lần';
            }

            await sleep(CONFIG.DELAYS.AFTER_UPLOAD);
            
            // Fill prompt
            updateStatus('Đang điền prompt...');
            addLog('Điền prompt vào form');
            await fillPrompt(promptNow);
            
            // Create video
            updateStatus('Đang tạo video...');
            addLog('Click nút tạo video');
            await clickCreateVideo();
            
            updateProgress(videoNumber, totalVideos);
            addLog(`✅ Hoàn thành video ${videoNumber}/${totalVideos}`);
            
            await sleep(CONFIG.DELAYS.AFTER_UPLOAD + 1000);
            
            // Go back
            updateStatus('Quay lại trang upload...');
            await goBackToUpload();
        }
    }

    async function run() {
        const images = await selectMultipleImages();
        if (!images.length) return alert('❌ Không có ảnh');

        const PROMPT_LIST = splitPromptList(CONFIG.PROMPTS);
        const totalVideos = images.length * PROMPT_LIST.length;
        
        showProgressUI();
        updateProgress(0, totalVideos);
        addLog(`Bắt đầu tạo ${totalVideos} videos từ ${images.length} ảnh`);
        addLog(`Mỗi ảnh sẽ tạo ${PROMPT_LIST.length} videos`);

        let completedVideos = 0;
        let hasError = false;

        for (let i = 0; i < images.length; i++) {
            if (isCancelled) {
                addLog('Quá trình đã bị hủy bởi người dùng');
                break;
            }

            try {
                await processOneImage(images[i], i + 1, images.length, PROMPT_LIST);
                completedVideos += PROMPT_LIST.length;
            } catch (e) {
                if (e === 'CANCELLED') {
                    break;
                }
                console.error('❌ Lỗi ảnh:', e);
                addLog(`❌ Lỗi khi xử lý ảnh ${images[i].name}: ${e}`);
                hasError = true;
            }
        }

        updateStatus('Hoàn thành!');
        addLog(`Đã tạo xong ${completedVideos}/${totalVideos} videos`);
        
        setTimeout(() => {
            hideProgressUI();
            if (isCancelled) {
                alert(`Đã hủy. Tạo được ${completedVideos}/${totalVideos} videos`);
            } else if (hasError) {
                alert(`Hoàn thành với lỗi. Tạo được ${completedVideos}/${totalVideos} videos`);
            } else {
                alert('🎉 Hoàn thành tất cả videos!');
            }
        }, 2000);
    }

    // ===== UI BUTTON =====
    const btn = document.createElement('button');
    btn.textContent = '▶ Start';
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 99999,
        padding: '10px 14px',
        background: '#00c853',
        color: '#000',
        fontWeight: 'bold',
        borderRadius: '8px',
        cursor: 'pointer',
        border: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    });
    btn.onclick = run;
    document.body.appendChild(btn);

})();
