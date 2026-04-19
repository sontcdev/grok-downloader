// ==UserScript==
// @name         Grok - Thời trang
// @namespace    https://github.com/ddtwp9z/grok-downloader
// @version      1.1.0
// @description  Auto create multiple videos from one image, upscale to HD and auto rename by image filename
// @match        https://grok.com/imagine*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=grok.com
// @grant        GM_download
// ==/UserScript==

(function () {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        PROMPTS: `
            A 6-second professional product video. The hand gently glides a finger across the back of the phone case to showcase the material. The background and the environment must remain exactly as shown in the original image. The design, patterns, and details on the phone case must stay perfectly static, fixed, and unchanged throughout the movement. Soft cinematic lighting, 4k, smooth hand motion.

            A 6-second aesthetic showcase. The hand slowly tilts the phone from side to side to reveal its thickness and edges. The background and overall setting are kept identical to the reference image. Strictly no movement or distortion of the graphics/design on the case. High frame rate, realistic skin texture, professional product cinematography.

            A 6-second product advertisement video. The camera slowly zooms in from a medium shot to a close-up on the phone case. Maintain the exact background and atmosphere from the image. The pattern on the phone case must be a fixed print and must not move, change, or warp during the zoom. Smooth camera transition, high-end look, 4k.
        `,
        TIMEOUTS: {
            IMAGE_UPLOAD: 15000,
            PROMPT_BOX: 20000,
            CREATE_BUTTON: 10000
        },
        DELAYS: {
            POLL: 300,
            POLL_SLOW: 500,
            SHORT: 200,
            MEDIUM: 800,
            AFTER_UPLOAD: 3000,
            AFTER_BACK: 2500,
            BEFORE_CREATE: 2000
        },
        UPLOAD_RETRY: 3
    };

    // ===== UTILITIES =====
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function splitPromptList(promptText) {
        return promptText
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(Boolean);
    }

    const PROMPT_LIST = splitPromptList(CONFIG.PROMPTS);

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

    const stopAllVideos = () => {
        document.querySelectorAll('video').forEach(v => {
            try {
                v.pause();
                v.removeAttribute('autoplay');
            } catch (_) { }
        });
    };

    // ===== IMAGE UPLOAD (GIỮ NGUYÊN LOGIC GỐC) =====
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

    // ===== PROMPT HANDLING (GIỮ NGUYÊN LOGIC GỐC) =====
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

        await sleep(CONFIG.DELAYS.POLL_SLOW);
        console.log('✅ Đã fill prompt:', promptText.substring(0, 50) + '...');
    }

    // ===== VIDEO CREATION (GIỮ NGUYÊN LOGIC GỐC) =====
    async function clickCreateVideo(timeout = CONFIG.TIMEOUTS.CREATE_BUTTON) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const btn = document.querySelector(
                'button[aria-label="Gửi"][type="submit"], button[aria-label="Submit"][type="submit"]'
            );

            if (btn && btn.offsetParent !== null && !btn.hasAttribute('disabled')) {
                console.log('⏳ Nút Gửi đã enable, chờ thêm 2s để đảm bảo prompt được lưu...');
                await sleep(CONFIG.DELAYS.BEFORE_CREATE);
                console.log('✅ Click button Tạo video');
                humanClick(btn);
                return;
            }

            await sleep(CONFIG.DELAYS.POLL);
        }

        throw '❌ Không tìm thấy nút Tạo video hoặc nút bị disabled';
    }

    // ===== NAVIGATION (GIỮ NGUYÊN LOGIC GỐC) =====
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
    async function processOneImage(file) {
        console.log('🖼 Xử lý ảnh:', file.name);

        for (let i = 0; i < PROMPT_LIST.length; i++) {
            console.log(`🎬 Video ${i + 1}/${PROMPT_LIST.length} cho ảnh ${file.name}`);

            const promptNow = PROMPT_LIST[i];
            console.log('📝 Prompt:', promptNow);

            // 1. Upload ảnh
            let uploaded = false;
            for (let retry = 1; retry <= CONFIG.UPLOAD_RETRY; retry++) {
                console.log(`🔁 Upload thử lần ${retry}:`, file.name);

                await uploadSingleImage(file);

                if (await waitForImageUploaded()) {
                    uploaded = true;
                    console.log('✅ Upload OK');
                    break;
                }

                console.warn('⚠ Không phát hiện ảnh đã upload, thử lại...');
                await goBackToUpload();
                await sleep(CONFIG.DELAYS.MEDIUM * 2);
            }

            if (!uploaded) {
                throw '❌ Upload thất bại sau 3 lần';
            }

            await sleep(CONFIG.DELAYS.AFTER_UPLOAD);

            // 2. Fill prompt
            await fillPrompt(promptNow);

            // 3. Tạo video
            await clickCreateVideo();

            // 4. Chờ một chút để video bắt đầu xử lý
            await sleep(CONFIG.DELAYS.AFTER_UPLOAD + 1000);

            // 5. Quay về upload để làm video tiếp
            await goBackToUpload();
        }
    }

    async function run() {
        const images = await selectMultipleImages();
        if (!images.length) return alert('❌ Không có ảnh');

        for (let i = 0; i < images.length; i++) {
            try {
                await processOneImage(images[i]);
            } catch (e) {
                console.error('❌ Lỗi ảnh:', e);
            }
        }

        alert('🎉 DONE');
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
