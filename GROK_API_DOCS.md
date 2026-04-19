# Grok API Documentation

Phân tích reverse engineering API của Grok.com để tích hợp vào web của bạn.

## API Endpoints Chính

### 1. Upload Ảnh

**Endpoint:** `POST https://grok.com/rest/app-chat/upload-file`

**Headers:**
```javascript
{
  "Content-Type": "multipart/form-data",
  "traceparent": "00-{trace-id}-{span-id}-00",
  "x-xai-request-id": "{uuid}",
  "sentry-trace": "{sentry-trace-id}",
  "Cookie": "..." // Session cookies từ grok.com
}
```

**Request:** FormData với file ảnh

**Response:**
```json
{
  "fileMetadataId": "96d22d3b-dc61-409d-8c46-6dca8948bb70",
  "fileMimeType": "image/png",
  "fileName": "a9.png",
  "fileUri": "users/{userId}/{fileId}/content",
  "createTime": "2026-04-19T09:58:00.745960Z",
  "fileSource": "SELF_UPLOAD_FILE_SOURCE"
}
```

### 2. Tạo Post từ Ảnh

**Endpoint:** `POST https://grok.com/rest/media/post/create`

**Headers:** Giống như upload

**Request Body:**
```json
{
  "mediaType": "MEDIA_POST_TYPE_IMAGE",
  "mediaUrl": "https://assets.grok.com/users/{userId}/{fileId}/content"
}
```

**Response:**
```json
{
  "post": {
    "id": "96d22d3b-dc61-409d-8c46-6dca8948bb70",
    "userId": "71023083-aa63-490f-810b-8e4c745f0bc5",
    "createTime": "2026-04-19T09:58:03.167725958Z",
    "prompt": "",
    "mediaType": "MEDIA_POST_TYPE_IMAGE",
    "mediaUrl": "https://assets.grok.com/...",
    "resolution": {
      "width": 1536,
      "height": 2752
    },
    "availableActions": [],
    "isRootUserUploaded": true
  }
}
```

### 3. WebSocket - Nhận Updates Real-time

**URL:** `wss://grok.com/ws/imagine/listen`

**Protocol:** WebSocket với JSON messages

Dùng để nhận thông báo khi video được tạo xong.

### 4. Lấy Danh Sách Assets

**Endpoint:** `GET https://grok.com/rest/assets`

**Query Parameters:**
```
pageSize=24
mimeTypes=image/jpeg
mimeTypes=image/jpg
mimeTypes=image/png
mimeTypes=image/webp
orderBy=ORDER_BY_LAST_USE_TIME
source=SOURCE_UPLOADED
includeImagineFiles=true
```

### 5. Lấy Danh Sách Posts

**Endpoint:** `POST https://grok.com/rest/media/post/list`

**Request Body:** (cần phân tích thêm từ data capture)

## Authentication

Grok sử dụng **session-based authentication** với cookies:

1. User phải đăng nhập vào grok.com trước
2. Browser lưu session cookies
3. Mọi API request cần gửi kèm cookies này

**Cookies quan trọng:**
- Session cookie từ grok.com
- CSRF token (nếu có)

## Headers Bắt Buộc

Mọi request cần có:

```javascript
{
  "traceparent": "00-{32-hex-trace-id}-{16-hex-span-id}-00",
  "x-xai-request-id": "{uuid-v4}",
  "sentry-trace": "{sentry-trace-id}-{span-id}-{sampled}",
  "baggage": "sentry-environment=production,sentry-release=...",
  "Cookie": "..." // Session cookies
}
```

## Workflow Tạo Video

```
1. Upload ảnh
   POST /rest/app-chat/upload-file
   → Nhận fileMetadataId và mediaUrl

2. Tạo post từ ảnh
   POST /rest/media/post/create
   Body: { mediaType, mediaUrl }
   → Nhận post.id

3. Kết nối WebSocket
   wss://grok.com/ws/imagine/listen
   → Lắng nghe updates về video

4. (Có thể) Gửi prompt để tạo video
   (Cần capture thêm API này)

5. Nhận thông báo qua WebSocket khi video xong
```

## Hạn Chế

1. **CORS**: API chỉ chấp nhận requests từ grok.com domain
2. **Authentication**: Cần session cookies hợp lệ
3. **Rate Limiting**: Chưa rõ giới hạn requests
4. **API không public**: Có thể thay đổi bất cứ lúc nào

## Giải Pháp Tích Hợp

### Option 1: Browser Extension
- Chạy trong context của grok.com
- Có quyền truy cập cookies
- Không bị CORS

### Option 2: Proxy Server
- User đăng nhập vào grok.com
- Extension/script gửi cookies về server của bạn
- Server của bạn gọi API thay user
- **Rủi ro**: Vi phạm ToS của Grok

### Option 3: Puppeteer/Playwright
- Tự động hóa browser
- Đăng nhập và lấy cookies
- Gọi API như user thật
- **Nhược điểm**: Tốn tài nguyên

## Cần Capture Thêm

Để có API đầy đủ, cần capture thêm:

1. **API tạo video từ ảnh + prompt**
   - Endpoint nào được gọi khi click "Create video"?
   - Request body chứa gì?
   
2. **WebSocket messages format**
   - Message nào báo video đã xong?
   - Làm sao lấy URL video?

3. **API download video**
   - Endpoint để lấy video đã tạo?

## Next Steps

Bạn muốn tôi:
1. Tạo wrapper class để gọi các API này?
2. Tạo proxy server để bypass CORS?
3. Capture thêm API khi tạo video với prompt?
4. Tạo demo tích hợp vào web của bạn?
