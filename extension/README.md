# Grok Video Creator - Chrome Extension

Extension tự động tạo nhiều video từ một ảnh trên Grok.com với các prompt khác nhau.

## Tính năng

- Tự động upload ảnh và tạo video với nhiều prompt
- Cấu hình tốc độ xử lý phù hợp với máy (Nhanh/Trung bình/Chậm)
- Tùy chỉnh danh sách prompts
- Xử lý nhiều ảnh cùng lúc
- Retry tự động khi upload thất bại

## Cài đặt

### Bước 1: Tải extension

```bash
cd extension
```

### Bước 2: Cài đặt vào Chrome

1. Mở Chrome và truy cập `chrome://extensions/`
2. Bật "Developer mode" (góc trên bên phải)
3. Click "Load unpacked"
4. Chọn thư mục `extension`

### Bước 3: Tạo icons (tùy chọn)

Nếu bạn muốn icons đẹp hơn, tạo 3 file PNG trong thư mục `extension/icons/`:
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)  
- `icon128.png` (128x128px)

Hoặc mở file `extension/icons/create-icons.html` trong trình duyệt để tự động tạo icons.

## Sử dụng

1. Truy cập https://grok.com/imagine
2. Click nút "▶ Start" ở góc dưới bên phải
3. Chọn ảnh muốn tạo video
4. Extension sẽ tự động:
   - Upload ảnh
   - Tạo video với từng prompt
   - Quay lại để tạo video tiếp theo

## Cấu hình

Click vào icon extension trên thanh công cụ để:

### Chọn tốc độ xử lý

- **Nhanh**: Máy mạnh, xử lý nhanh
- **Trung bình**: Máy thường (mặc định)
- **Chậm**: Máy yếu, cần thời gian chờ lâu hơn

### Tùy chỉnh prompts

Nhập danh sách prompts, mỗi prompt cách nhau bởi một dòng trống. Extension sẽ tạo 1 video cho mỗi prompt.

Ví dụ:
```
A 6-second professional product video...

A 6-second aesthetic showcase...

A 6-second product advertisement video...
```

## So sánh với Userscript

| Tính năng | Userscript | Extension |
|-----------|------------|-----------|
| Cài đặt | Cần Tampermonkey | Cài trực tiếp vào Chrome |
| Cấu hình | Sửa code | Giao diện popup |
| Cập nhật | Sửa file | Lưu vào Chrome Storage |
| Tốc độ | Cố định trong code | Chọn trong popup |

## Cấu trúc thư mục

```
extension/
├── manifest.json          # Cấu hình extension
├── content.js            # Script chạy trên grok.com
├── popup/
│   ├── popup.html        # Giao diện cấu hình
│   ├── popup.css         # Style
│   └── popup.js          # Logic popup
└── icons/
    ├── icon16.png        # Icon 16x16
    ├── icon48.png        # Icon 48x48
    └── icon128.png       # Icon 128x128
```

## Troubleshooting

### Extension không hoạt động
- Kiểm tra đã bật extension trong `chrome://extensions/`
- Reload lại trang grok.com
- Mở Console (F12) để xem log lỗi

### Không thấy nút Start
- Đảm bảo đang ở trang https://grok.com/imagine*
- Reload extension và trang web

### Upload thất bại
- Thử chuyển sang chế độ "Chậm" trong cấu hình
- Kiểm tra kết nối internet
- Thử upload thủ công để đảm bảo Grok.com hoạt động bình thường

## Phát triển

### Chỉnh sửa code

1. Sửa file trong thư mục `extension/`
2. Vào `chrome://extensions/`
3. Click nút "Reload" trên extension
4. Reload trang grok.com

### Debug

Mở Console (F12) để xem logs:
- `✅` Upload thành công
- `🎬` Đang tạo video
- `❌` Lỗi

## License

MIT
