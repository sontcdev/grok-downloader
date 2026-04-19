// ==UserScript==
// @name         Grok - Thời trang
// @namespace    https://github.com/sontcdev/grok-downloader
// @version      2.4.0
// @description  Auto create multiple product videos from phone case images with detailed logging
// @match        https://grok.com/imagine*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=grok.com
// @grant        none
// @updateURL    https://raw.githubusercontent.com/sontcdev/grok-downloader/main/Grok.user.js
// @downloadURL  https://raw.githubusercontent.com/sontcdev/grok-downloader/main/Grok.user.js
// ==/UserScript==


(function () {
    'use strict';
    
    // ===== ERROR HANDLING =====
    window.addEventListener("unhandledrejection", e => {
        if (e.reason?.name === "AbortError") {
            e.preventDefault();
        }
    });
    
    // ===== CONFIG =====
    const PROMPT = `
                A 1-year-old baby sitting close to father, softly turning head toward him and gently babbling as if talking, tiny lips moving naturally, calm eye contact, slight smile, one of father's shoulders partially visible and out of focus, no full face shown, warm natural daylight, handheld father POV, shallow depth of field, ultra realistic baby behavior, micro facial movements, 4K cinematic

                A 1-year-old baby looking away, then slowly turning back toward father's voice with a soft shy smile, eyes bright but calm, father only visible as a very small blurred cheek edge in extreme foreground, no full face visible, no mirrors, no reflections, no reflective surfaces, no glass reflections, clean matte background, natural indoor lighting, minimal environment, gentle handheld motion, shallow depth of field, ultra realistic baby behavior, micro facial movements, 4K

                A 1-year-old baby gently reaching out to touch father's face, tiny fingers softly touching nose area, father's face barely visible and blurred, only partial feature shown, baby focused and curious expression, slow delicate movement, warm light, cinematic close-up, 4K, natural interaction
                `;
    
    const SELECTORS = {
        promptBox: 'div.tiptap.ProseMirror[contenteditable="true"]',
        placeholders: {
            beforeUpload: "Gõ để tưởng tượng",
            afterUpload: "Nhập để Imagine"
        },
        submitButton: 'button[type="submit"][aria-label="Gửi"]',
        submitButtonEnabled: 'button[type="submit"][aria-label="Gửi"]:not([disabled])',
        statusCreating: 'span.animate-pulse',
        backButton: 'a[href="/imagine"]',
        fileInput: 'input[type="file"]',
        video: 'video[src*=".mp4"]'
    };
    
    let IMAGE_QUEUE = [];
    let cachedFileInput = null;
    
    // ===== UTILS =====
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    
    function splitPromptList(promptText) {
        return promptText
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(Boolean);
    }
    
    const PROMPT_LIST = splitPromptList(PROMPT);
    const VIDEO_COUNT_PER_IMAGE = PROMPT_LIST.length; // Tự động dựa vào số lượng prompts
    
    function getPromptForVideo(videoIndex) {
        if (PROMPT_LIST.length === 0) {
            throw "❌ Prompt list rỗng";
        }
        
        if (videoIndex < PROMPT_LIST.length) {
            return PROMPT_LIST[videoIndex];
        }
        
        return PROMPT_LIST[PROMPT_LIST.length - 1];
    }
    
    function isVisible(el) {
        return el && el.offsetParent !== null;
    }
    
    function isButtonEnabled(btn) {
        return btn && !btn.hasAttribute('disabled') && isVisible(btn);
    }
    
    function getFileInput() {
        if (!cachedFileInput || !document.contains(cachedFileInput)) {
            cachedFileInput = document.querySelector(SELECTORS.fileInput);
        }
        return cachedFileInput;
    }
    
    function humanClick(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        ["pointerdown", "mousedown", "mouseup", "click"].forEach(type => {
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
    
    // ===== WAIT HELPERS =====
    async function waitForElement(selector, options = {}) {
        const { 
            timeout = 10000, 
            validator = null,
            checkInterval = 100,
            logName = selector
        } = options;
        
        log(`⏳ Đang đợi: ${logName}`);
        
        return new Promise((resolve, reject) => {
            const check = () => {
                const el = document.querySelector(selector);
                if (el && (!validator || validator(el))) {
                    return el;
                }
                return null;
            };
            
            const existing = check();
            if (existing) {
                log(`✅ Tìm thấy ngay: ${logName}`);
                return resolve(existing);
            }
            
            let timeoutId, intervalId, observer;
            
            const cleanup = () => {
                if (observer) observer.disconnect();
                if (timeoutId) clearTimeout(timeoutId);
                if (intervalId) clearInterval(intervalId);
            };
            
            timeoutId = setTimeout(() => {
                cleanup();
                log(`❌ Timeout: ${logName}`);
                reject(new Error(`Timeout: ${selector}`));
            }, timeout);
            
            observer = new MutationObserver(() => {
                const el = check();
                if (el) {
                    cleanup();
                    log(`✅ Tìm thấy: ${logName}`);
                    resolve(el);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['disabled', 'class', 'data-placeholder']
            });
            
            intervalId = setInterval(() => {
                const el = check();
                if (el) {
                    cleanup();
                    log(`✅ Tìm thấy: ${logName}`);
                    resolve(el);
                }
            }, checkInterval);
        });
    }
    
    async function waitForPromptBox(context = 'afterUpload', timeout = 20000) {
        const expectedPlaceholder = SELECTORS.placeholders[context];
        
        return waitForElement(SELECTORS.promptBox, {
            timeout,
            logName: `Prompt box (${context})`,
            validator: (el) => {
                const p = el.querySelector('p[data-placeholder]');
                const placeholder = p?.getAttribute('data-placeholder');
                return placeholder?.includes(expectedPlaceholder) && isVisible(el);
            }
        });
    }
    
    async function waitForSubmitEnabled(timeout = 10000) {
        return waitForElement(SELECTORS.submitButtonEnabled, {
            timeout,
            logName: 'Nút Gửi enabled',
            validator: isButtonEnabled
        });
    }
    
    async function waitForVideoReady(timeout = 120000) {
        log('⏳ Đang đợi video được tạo...');
        
        return new Promise((resolve, reject) => {
            let timeoutId, intervalId, observer;
            let lastStatus = null;
            
            const cleanup = () => {
                if (observer) observer.disconnect();
                if (timeoutId) clearTimeout(timeoutId);
                if (intervalId) clearInterval(intervalId);
            };
            
            timeoutId = setTimeout(() => {
                cleanup();
                log('❌ Timeout: video chưa ready sau 120s');
                reject(new Error("⏰ Timeout: video chưa ready"));
            }, timeout);
            
            const checkReady = () => {
                const creating = document.querySelector(SELECTORS.statusCreating);
                const isCreating = creating?.textContent?.trim() === "Đang tạo";
                
                if (isCreating && lastStatus !== 'creating') {
                    log('🎬 Đang tạo video...');
                    lastStatus = 'creating';
                }
                
                if (isCreating) {
                    return false;
                }
                
                const video = document.querySelector(SELECTORS.video);
                if (video?.src) {
                    cleanup();
                    log('✅ Video đã sẵn sàng');
                    resolve(video);
                    return true;
                }
                return false;
            };
            
            if (checkReady()) return;
            
            observer = new MutationObserver(checkReady);
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
            
            intervalId = setInterval(checkReady, 500);
        });
    }
    
    // ===== ACTIONS =====
    async function uploadSingleImage(file) {
        log('📤 Đang upload ảnh...', file.name);
        const input = getFileInput();
        if (!input) {
            log('❌ Không tìm thấy input upload');
            throw "Không tìm thấy input upload";
        }
        
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        log('✅ Upload thành công');
    }
    
    async function fillPrompt(promptBox, promptText) {
        log('✍️ Đang điền prompt...');
        promptBox.focus();
        await sleep(50);
        
        promptBox.innerHTML = "<p></p>";
        promptBox.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(50);
        
        promptBox.innerHTML = `<p>${promptText.replace(/\n/g, "<br>")}</p>`;
        promptBox.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(100); // Tăng từ 50ms lên 100ms để đảm bảo DOM update
        log('✅ Đã điền prompt');
    }
    
    async function validatePromptFilled(promptBox, expectedText, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            log(`⏳ Đang validate prompt (lần thử ${attempt}/${maxRetries})...`);
            
            await sleep(100); // Đợi DOM update
            
            // 1. Kiểm tra DOM state
            if (promptBox.getAttribute('contenteditable') !== 'true') {
                log('❌ Validate fail: promptBox không editable');
                if (attempt < maxRetries) {
                    log('🔄 Thử điền lại prompt...');
                    await fillPrompt(promptBox, expectedText);
                    continue;
                }
                throw new Error('Prompt box không editable sau ' + maxRetries + ' lần thử');
            }
            
            // 2. Kiểm tra nội dung không rỗng
            const content = promptBox.textContent.trim();
            if (content.length === 0) {
                log('❌ Validate fail: Prompt rỗng');
                if (attempt < maxRetries) {
                    log('🔄 Thử điền lại prompt...');
                    await fillPrompt(promptBox, expectedText);
                    continue;
                }
                throw new Error('Prompt vẫn rỗng sau ' + maxRetries + ' lần thử');
            }
            
            // 3. Kiểm tra độ dài tối thiểu
            if (content.length < 10) {
                log(`❌ Validate fail: Prompt quá ngắn (${content.length} ký tự)`);
                if (attempt < maxRetries) {
                    log('🔄 Thử điền lại prompt...');
                    await fillPrompt(promptBox, expectedText);
                    continue;
                }
                throw new Error('Prompt quá ngắn sau ' + maxRetries + ' lần thử');
            }
            
            // Success
            log('✅ Prompt đã được validate');
            return true;
        }
    }
    
    async function clickSubmit() {
        const btn = await waitForSubmitEnabled();
        log('🖱️ Click nút Gửi');
        humanClick(btn);
    }
    
    async function clickBack() {
        log('🔙 Click nút Quay lại');
        const link = document.querySelector(SELECTORS.backButton);
        if (!link) {
            log('❌ Không tìm thấy nút Quay lại');
            throw "Không tìm thấy nút Quay lại";
        }
        humanClick(link);
        log('✅ Đã quay lại trang upload');
    }
    
    // ===== LOGGING =====
    function log(message, data = null) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        if (data) {
            console.log(`[${timestamp}] ${message}`, data);
        } else {
            console.log(`[${timestamp}] ${message}`);
        }
    }
    
    async function selectMultipleImages() {
        return new Promise(resolve => {
            const input = getFileInput();
            if (!input) return resolve([]);
            
            input.setAttribute("multiple", "multiple");
            input.addEventListener(
                "change",
                () => resolve([...input.files]),
                { once: true }
            );
            input.click();
        });
    }
    
    // ===== MAIN FLOW =====
    async function processOneImage(file) {
        log('═══════════════════════════════════════');
        log(`🖼️ BẮT ĐẦU XỬ LÝ ẢNH: ${file.name}`);
        log('═══════════════════════════════════════');
        
        for (let i = 0; i < VIDEO_COUNT_PER_IMAGE; i++) {
            log('');
            log(`━━━ Video ${i + 1}/${VIDEO_COUNT_PER_IMAGE} ━━━`);
            
            const promptNow = getPromptForVideo(i);
            const startTime = Date.now();
            
            try {
                // BƯỚC 1: Upload ảnh
                log(`[Bước 1/5] Upload ảnh`);
                await uploadSingleImage(file);
                await sleep(500);
                
                // BƯỚC 2: Đợi prompt box xuất hiện
                log(`[Bước 2/5] Đợi prompt box`);
                const promptBox = await waitForPromptBox('afterUpload', 10000);
                
                // BƯỚC 3: Điền prompt
                log(`[Bước 3/6] Điền prompt`);
                await fillPrompt(promptBox, promptNow);
                
                // BƯỚC 4: Validate prompt
                log(`[Bước 4/6] Validate prompt`);
                await validatePromptFilled(promptBox, promptNow, 3);
                
                // BƯỚC 5: Đợi nút enabled và click submit
                log(`[Bước 5/6] Click nút Gửi`);
                await clickSubmit();
                
                // BƯỚC 6: Đợi video xong
                log(`[Bước 6/6] Đợi video hoàn thành`);
                await waitForVideoReady();
                
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                log(`✅ HOÀN THÀNH video ${i + 1} trong ${elapsed}s`);
                
                // Chờ 2s trước khi quay lại
                await sleep(2000);
                
                // Quay lại
                await clickBack();
                await sleep(500);
                
            } catch (e) {
                log(`❌ LỖI video ${i + 1}: ${e.message || e}`);
                console.error('Chi tiết lỗi:', e);
                
                try {
                    log('🔄 Thử quay lại trang upload...');
                    await clickBack();
                    await sleep(1000);
                } catch (_) {
                    log('⚠️ Không quay lại được, reload page...');
                    location.href = '/imagine';
                    await sleep(2000);
                }
            }
        }
        
        log('');
        log(`✅ HOÀN THÀNH TẤT CẢ ${VIDEO_COUNT_PER_IMAGE} VIDEO CHO: ${file.name}`);
    }
    
    async function run() {
        log('🚀 BẮT ĐẦU CHƯƠNG TRÌNH');
        
        IMAGE_QUEUE = await selectMultipleImages();
        if (!IMAGE_QUEUE.length) {
            log('❌ Không có ảnh được chọn');
            return alert("❌ Không có ảnh");
        }
        
        log(`📋 Đã chọn ${IMAGE_QUEUE.length} ảnh`);
        log(`📊 Tổng cộng sẽ tạo ${IMAGE_QUEUE.length * VIDEO_COUNT_PER_IMAGE} videos`);
        
        const totalStartTime = Date.now();
        
        for (let i = 0; i < IMAGE_QUEUE.length; i++) {
            log('');
            log(`📸 Ảnh ${i + 1}/${IMAGE_QUEUE.length}`);
            try {
                await processOneImage(IMAGE_QUEUE[i]);
            } catch (e) {
                log(`❌ LỖI NGHIÊM TRỌNG khi xử lý ảnh ${i + 1}: ${e.message || e}`);
                console.error("Chi tiết lỗi:", e);
            }
        }
        
        const totalElapsed = ((Date.now() - totalStartTime) / 1000 / 60).toFixed(1);
        log('');
        log('═══════════════════════════════════════');
        log(`🎉 HOÀN THÀNH TẤT CẢ!`);
        log(`⏱️ Tổng thời gian: ${totalElapsed} phút`);
        log('═══════════════════════════════════════');
        
        alert(`🎉 DONE!\nĐã xử lý ${IMAGE_QUEUE.length} ảnh trong ${totalElapsed} phút`);
    }
    
    // ===== UI =====
    const btn = document.createElement("button");
    btn.textContent = "▶ Start";
    Object.assign(btn.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 99999,
        padding: "10px 14px",
        background: "#00c853",
        color: "#000",
        fontWeight: "bold",
        borderRadius: "8px",
        cursor: "pointer"
    });
    btn.onclick = run;
    document.body.appendChild(btn);

})();
