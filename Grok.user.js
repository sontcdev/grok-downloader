// ==UserScript==
// @name         Grok - Thời trang
// @namespace    https://github.com/ddtwp9z/grok-downloader
// @version      1.0.5
// @description  Auto create multiple videos from one image, upscale to HD and auto rename by image filename
// @match        https://grok.com/imagine*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=grok.com
// @grant        GM_download
// ==/UserScript==


(function () {
    'use strict';
    // 1️⃣ SILENCE AbortError (media bị unmount khi React rerender)
    window.addEventListener("unhandledrejection", e => {
        if (e.reason?.name === "AbortError") {
            e.preventDefault();
            return;
        }
    });

    // 2️⃣ Chặn video tự play lại khi DOM sắp bị remove
    const stopAllVideos = () => {
        document.querySelectorAll("video").forEach(v => {
            try {
                v.pause();
                v.removeAttribute("autoplay");
            } catch (_) { }
        });
    };
    // ===== CONFIG =====
    const PROMPT = `
                A 6-second professional product video. The hand gently glides a finger across the back of the phone case to showcase the material. The background and the environment must remain exactly as shown in the original image. The design, patterns, and details on the phone case must stay perfectly static, fixed, and unchanged throughout the movement. Soft cinematic lighting, 4k, smooth hand motion.

                A 6-second aesthetic showcase. The hand slowly tilts the phone from side to side to reveal its thickness and edges. The background and overall setting are kept identical to the reference image. Strictly no movement or distortion of the graphics/design on the case. High frame rate, realistic skin texture, professional product cinematography.

                A 6-second product advertisement video. The camera slowly zooms in from a medium shot to a close-up on the phone case. Maintain the exact background and atmosphere from the image. The pattern on the phone case must be a fixed print and must not move, change, or warp during the zoom. Smooth camera transition, high-end look, 4k.
                `;
    function splitPromptList(promptText) {
        return promptText
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(Boolean);
    }

    const PROMPT_LIST = splitPromptList(PROMPT);
    const VIDEO_COUNT_PER_IMAGE = 4;

    let IMAGE_QUEUE = [];
    let CURRENT_IMAGE_INDEX = 0;

    // ===== UTILS =====
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function waitForImageUploaded(timeout = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            // Kiểm tra nhiều dấu hiệu cho thấy ảnh đã upload xong
            const settingsBtn = document.querySelector('button[aria-label="Cài đặt"]');
            const imagePreview = document.querySelector('img[src*="blob:"]') ||
                               document.querySelector('img[src*="grok.com"]');
            const postPage = location.href.includes("/imagine/post/") ||
                           location.href.includes("/imagine/image/");

            if (settingsBtn || imagePreview || postPage) {
                console.log("✅ Phát hiện ảnh đã upload");
                return true;
            }
            await sleep(500);
        }
        return false;
    }

    function getPromptForVideo(videoIndex) {
        if (PROMPT_LIST.length === 0) {
            throw "❌ Prompt list rỗng";
        }

        if (videoIndex < PROMPT_LIST.length) {
            return PROMPT_LIST[videoIndex];
        }

        // nếu vượt quá số prompt → dùng prompt cuối
        return PROMPT_LIST[PROMPT_LIST.length - 1];
    }


    async function waitForPromptBox(timeout = 20000) {
        console.log("waitForPromptBox");
        const start = Date.now();

        while (Date.now() - start < timeout) {

            const editors = document.querySelectorAll(
                'div[contenteditable="true"].ProseMirror, div[contenteditable="true"].tiptap'
            );

            for (const el of editors) {
                const placeholder = el.querySelector('[data-placeholder]');
                if (
                    placeholder &&
                    placeholder.getAttribute("data-placeholder")?.includes("Nhập để Imagine, @ để tham chiếu hình ảnh") &&
                    el.offsetParent !== null
                ) {
                    console.log("Tìm thấy prompt box");
                    return el;
                }
            }

            await sleep(300);
        }
        console.log("Không tìm thấy prompt box");
        return null;
    }

    function setNativeValue(el, value) {
        const setter = Object.getOwnPropertyDescriptor(
            el.__proto__,
            "value"
        )?.set;
        setter.call(el, value);
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

    // ===== VIDEO ACTIONS =====
    async function fillPrompt(promptText) {
        const box = await waitForPromptBox();
        if (!box) throw "Không tìm thấy prompt box";

        // Focus vào box
        box.focus();
        await sleep(200);

        // Xóa nội dung cũ bằng cách select all và delete
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(200);

        // Nhập text bằng cách paste hoặc insertText
        const lines = promptText.split('\n');
        for (let i = 0; i < lines.length; i++) {
            document.execCommand('insertText', false, lines[i]);
            if (i < lines.length - 1) {
                // Thêm line break nếu không phải dòng cuối
                document.execCommand('insertLineBreak', false, null);
            }
        }

        // Trigger input event để React nhận biết
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.dispatchEvent(new Event('change', { bubbles: true }));

        await sleep(500);
        console.log("✅ Đã fill prompt:", promptText.substring(0, 50) + "...");
    }

    async function clickCreateVideo(timeout = 10000) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const btn = document.querySelector(
                'button[aria-label="Gửi"][type="submit"], button[aria-label="Submit"][type="submit"]'
            );

            if (btn && btn.offsetParent !== null && !btn.hasAttribute('disabled')) {
                // Chờ thêm 1 giây để đảm bảo prompt đã được xử lý hoàn toàn
                console.log("⏳ Nút Gửi đã enable, chờ thêm 2s để đảm bảo prompt được lưu...");
                await sleep(2000);
                console.log("✅ Click button Tạo video");
                humanClick(btn);
                return;
            }

            await sleep(300);
        }

        throw "❌ Không tìm thấy nút Tạo video hoặc nút bị disabled";
    }

    async function clickUpscaleMenu(timeout = 20000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const openMenu = document.querySelector(
                'div[role="menu"][data-state="open"]'
            );
            if (!openMenu) {
                await sleep(300);
                continue;
            }

            const items = [...openMenu.querySelectorAll('[role="menuitem"]')];
            const upscale = items.find(el => {
                const text = el.textContent?.trim();
                if (text !== "Nâng cấp video") return false;
                if (
                    el.getAttribute("aria-disabled") === "true" ||
                    el.classList.contains("opacity-50") ||
                    el.classList.contains("pointer-events-none")
                ) return false;
                return true;
            });

            if (upscale) {
                upscale.click();
                return true;
            }
            await sleep(300);
        }
        return false;
    }

    async function waitTaskReady(timeout = 120000) {
        const start = Date.now();

        while (Date.now() - start < timeout) {

            // 1️⃣ Nếu còn trạng thái "Đang tạo" → tiếp tục chờ
            const creating = [...document.querySelectorAll("span")]
                .find(el => el.textContent?.trim() === "Đang tạo");

            if (creating) {
                await sleep(800);
                continue;
            }

            // 2️⃣ Khi không còn "Đang tạo" → tìm nút More
            const moreBtn = document.querySelector(
                'button[aria-label="Tùy chọn khác"], button[aria-label="More"]'
            );

            if (
                moreBtn &&
                moreBtn.offsetParent !== null &&
                !moreBtn.closest(".pointer-events-none")
            ) {
                return moreBtn;
            }

            await sleep(400);
        }

        throw "⏰ Timeout: video chưa ready";
    }

    async function waitUpscaleFinishedByHD(timeout = 180000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const hd = [...document.querySelectorAll("div")]
                .find(el => el.textContent.trim() === "HD");
            if (hd) return true;
            await sleep(1500);
        }
        throw "⏰ Upscale chưa xong";
    }

    function isVideoAlreadyHD() {
        return [...document.querySelectorAll("div")]
            .some(el => el.textContent?.trim() === "HD");
    }

    // ===== IMAGE FLOW =====
    async function uploadSingleImage(file) {
        const input = document.querySelector('input[type="file"]');
        if (!input) throw "Không tìm thấy input upload";

        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function getCurrentVideoUrl() {

        // 1️⃣ Ưu tiên đúng video HD
        const hdVideo = document.querySelector('video#hd-video[src]');

        if (hdVideo && hdVideo.src && hdVideo.src.includes("_hd.mp4")) {
            return hdVideo.src.split("?")[0]; // bỏ query cache
        }

        // 2️⃣ Fallback: tìm bất kỳ video nào có _hd.mp4
        const fallback = [...document.querySelectorAll("video[src]")]
            .find(v => v.src.includes("_hd.mp4"));

        if (fallback) {
            return fallback.src.split("?")[0];
        }

        return null;
    }

    function downloadVideo(url, filename) {
        return new Promise((resolve, reject) => {
            GM_download({
                url,
                name: filename,
                saveAs: false,
                onload: resolve,
                onerror: reject
            });
        });
    }

    async function selectMultipleImages() {
        return new Promise(resolve => {
            const input = document.querySelector('input[type="file"]');
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

    // ===== NEW GROK UI FLOW =====
    async function openSettingMenu(timeout = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const btn = document.querySelector('button[aria-label="Cài đặt"]');
            if (btn && btn.offsetParent !== null) {
                humanClick(btn);
                await sleep(500);
                return true;
            }
            await sleep(300);
        }
        throw "❌ Không tìm thấy nút Cài đặt";
    }

    async function waitForMenuOpen(timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const menu = document.querySelector('div[role="menu"][data-state="open"]');
            if (menu) return menu;
            await sleep(300);
        }
        throw "❌ Menu không mở";
    }

    async function selectAspect916(menu) {
        console.log("selectAspect916");
        const btn = menu.querySelector('button[aria-label="9:16"]');
        if (!btn) throw "❌ Không tìm thấy nút 9:16";
        humanClick(btn);
        await sleep(300);
    }

    async function clickCreateVideoInMenu(menu) {
        console.log("clickCreateVideoInMenu");
        const create = [...menu.querySelectorAll('[role="menuitem"]')]
            .find(item =>
                item.querySelector('span') &&
                item.querySelector('span').textContent.trim().includes("Tạo video")
            );

        if (!create) throw "❌ Không tìm thấy menu Tạo video";
        humanClick(create);
        await sleep(800);
    }

    async function triggerCreateVideoFromImage() {
        await openSettingMenu();
        const menu = await waitForMenuOpen();
        await selectAspect916(menu);
        await clickCreateVideoInMenu(menu);
    }

    async function goBackToUpload() {
        const backBtn = document.querySelector('div[aria-label="Quay lại"]') ||
                       document.querySelector('button[aria-label="Quay lại"]') ||
                       document.querySelector('a[href="/imagine"]');
        if (!backBtn) throw "Không tìm thấy nút Quay lại";
        console.log("🔙 Click nút Quay lại");
        humanClick(backBtn);
        await sleep(2500);
    }

    async function processOneImage(file) {
        console.log("🖼 Xử lý ảnh:", file.name);

        for (let i = 0; i < PROMPT_LIST.length; i++) {
            console.log(`🎬 Video ${i + 1}/${PROMPT_LIST.length} cho ảnh ${file.name}`);

            const promptNow = PROMPT_LIST[i];
            console.log("📝 Prompt:", promptNow);

            // 1️⃣ upload ảnh
            let uploaded = false;

            for (let retry = 1; retry <= 3; retry++) {
                console.log(`🔁 Upload thử lần ${retry}:`, file.name);

                await uploadSingleImage(file);

                if (await waitForImageUploaded()) {
                    uploaded = true;
                    console.log("✅ Upload OK");
                    break;
                }

                console.warn("⚠ Không phát hiện ảnh đã upload, thử lại...");
                await goBackToUpload();
                await sleep(1500);
            }

            if (!uploaded) {
                throw "❌ Upload thất bại sau 3 lần";
            }

            await sleep(3000);

            // 2️⃣ fill prompt
            await fillPrompt(promptNow);

            // 3️⃣ tạo video
            await clickCreateVideo();

            // 4️⃣ chờ một chút để video bắt đầu xử lý
            await sleep(4000);

            // 5️⃣ quay về upload để làm video tiếp
            await goBackToUpload();
        }
    }


    // ===== MAIN =====
    async function run() {
        IMAGE_QUEUE = await selectMultipleImages();
        if (!IMAGE_QUEUE.length) return alert("❌ Không có ảnh");

        for (let i = 0; i < IMAGE_QUEUE.length; i++) {
            CURRENT_IMAGE_INDEX = i;
            try {
                await processOneImage(IMAGE_QUEUE[i]);
            } catch (e) {
                console.error("❌ Lỗi ảnh:", e);
            }
        }

        alert("🎉 DONE");
    }

    // ===== UI BUTTON =====
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
