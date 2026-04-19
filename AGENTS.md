# Agent Instructions

## Project Overview

Single-file userscript that automates video generation on grok.com/imagine. Uploads images and creates multiple videos per image using predefined prompts.

## Key Facts

- **Language**: Vanilla JavaScript (ES6+), no build step
- **Entry point**: `Grok.user.js` (Tampermonkey/Greasemonkey userscript)
- **Target site**: https://grok.com/imagine*
- **Vietnamese UI**: All console logs and user-facing text are in Vietnamese

## Configuration

The `CONFIG` object (lines 15-38) controls all behavior:
- `PROMPTS`: Multi-line string with 3 video generation prompts (separated by blank lines)
- `TIMEOUTS`: Max wait times for DOM elements
- `DELAYS`: Sleep durations between actions
- `UPLOAD_RETRY`: Number of upload attempts (default: 3)

## DOM Interaction Quirks

- Uses `humanClick()` helper that dispatches full mouse event sequence (pointerdown → mousedown → mouseup → click) to bypass React event handlers
- Prompt box selector: `div[contenteditable="true"].ProseMirror` or `.tiptap` with specific Vietnamese placeholder text
- Uses `document.execCommand()` for text insertion (legacy API but required for this site)
- Must wait for elements with `offsetParent !== null` check (visibility detection)

## Workflow

1. User clicks "Start" button → file picker opens (multi-select enabled)
2. For each image × each prompt:
   - Upload image (retry up to 3 times)
   - Wait for upload confirmation (checks for settings button, blob preview, or URL change)
   - Fill prompt using execCommand
   - Click submit button (waits for it to be enabled)
   - Navigate back to upload page
3. Alert "DONE" when complete

## Testing

No automated tests. Manual testing required:
1. Install in Tampermonkey/Greasemonkey
2. Navigate to https://grok.com/imagine
3. Click green "Start" button (bottom-right)
4. Select test images
5. Verify videos are queued with correct prompts

## Common Issues

- If upload detection fails: Check if grok.com changed their DOM structure (lines 92-96)
- If prompt box not found: Verify Vietnamese placeholder text still matches (line 146)
- If submit button not clickable: Check aria-label hasn't changed (line 192)
