# 📸 ShutterFilter by Tandev.foto

> **Ứng dụng Desktop lọc & phân loại ảnh chuyên nghiệp theo danh sách tên file & định dạng dành cho Nhiếp ảnh gia, Studio & Chuyên viên hậu kỳ ảnh.**

![Version](https://img.shields.io/badge/version-1.0.0-amber?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey?style=for-the-badge)
![Performance](https://img.shields.io/badge/scalability-10%2C000%2B%20images-success?style=for-the-badge)
![Theme](https://img.shields.io/badge/theme-Dark%20%26%20Light%20Mode-purple?style=for-the-badge)

---

## 🌟 Giới Thiệu (Overview)

**ShutterFilter** là công cụ chuyên dụng được xây dựng nhằm giải quyết bài toán phân loại hàng nghìn ảnh RAW/JPEG tốc độ cao cho các Nhiếp ảnh gia và Studio chụp ảnh chuyên nghiệp. 

Khi khách hàng chọn danh sách ảnh (qua tên file), việc tìm kiếm và lọc thủ công 1,000 - 10,000+ file ảnh trong thư mục chứa hàng chục GB dung lượng thường tốn rất nhiều thời gian. **ShutterFilter** giúp tự động hóa quy trình này chỉ trong vài giây với giao diện hiện đại, mượt mà 60fps và hiệu năng vượt trội.

---

## 🚀 Tính Năng Nổi Bật (Key Features)

### 1. ⚡ Xử Lý 10,000+ Ảnh Không Giật Lag (High Scalability)
- Tối ưu bộ nhớ với cơ chế phân trang động (Windowed Pagination) 50/100/250/500 dòng trên trang.
- Quét nhanh và xem trước theo thời gian thực (Real-time Preview) không gây đóng băng ứng dụng.

### 2. 🎯 Quy Trình Lọc Chuẩn Xác Theo Tên Ảnh
- **Lọc theo danh sách dán**: Dán danh sách tên ảnh (Mỗi dòng 1 tên: `DTT00970`, `DTT00971`,...) ➔ Hệ thống lập tức khớp và hiển thị đúng số lượng ảnh tương ứng.
- **Tự động nhận diện định dạng**: Nhận diện tất cả các đuôi ảnh có trong thư mục nguồn (`.JPG`, `.CR3`, `.ARW`, `.NEF`, `.DNG`,...).
- **Định dạng mặc định Tắt mờ (`[]`)**: Mặc định nhận diện tất cả các định dạng ảnh của danh sách tên đã dán. Người dùng có thể chủ động click chọn riêng định dạng mong muốn.

### 3. 🛡️ Bảo Vệ An Toàn & Loại Bỏ Video
- Loại bỏ triệt để tệp video (`.mp4`, `.mov`, `.avi`, `.mkv`), chỉ tập trung xử lý các định dạng hình ảnh và tệp RAW chụp ảnh.

### 4. 🎨 Giao Diện Đôi Dark Mode 🌙 & Light Mode ☀️
- Nút chuyển đổi giao diện nhanh ở góc trên bên phải.
- **Studio Matte Dark**: Tông màu tối chuyên nghiệp cho phòng dựng.
- **Clean Studio Light**: Tông màu sáng thanh lịch, tinh tế chuẩn Studio.
- Tự động ghi nhớ chế độ giao diện yêu thích cho các lần sử dụng sau.

### 5. ⚡ Chuyển Động 60FPS Mượt Mà & Nhạy Tác Vụ
- Hiệu ứng phản hồi lực bấm (`active:scale-95`), spring-physics modal popup, hover highlight mịn màng với tăng tốc card đồ họa (GPU Layer).

### 6. ↩️ Lịch Sử Chi Tiết & Hoàn Tác (Undo) 1-Click
- Ghi nhận chi tiết từng lượt lọc (Run Log): số file đã copy/move, số file trùng, file lỗi.
- Hỗ trợ nút **Undo** 1-click để khôi phục tệp về vị trí ban đầu an toàn tuyệt đối.

### 7. 🖌️ Tích Hợp Trực Tiếp Adobe Photoshop
- Mở nhanh thư mục lưu ảnh đã lọc hoặc nạp thẳng danh sách ảnh đã chọn vào Adobe Photoshop chỉ với 1 click.

### 📦 8. Đóng Gói 1 Tệp `.exe` Duy Nhất (Single-File Executable)
- Mã nguồn React/Electron được mã hóa & nén minified chống soi code.
- Đóng gói thành **1 tệp duy nhất `ShutterFilter_SingleFile.exe`** nhúng sẵn biểu tượng Studio Amber Gold Camera Icon, có thể mang đi sử dụng ở bất kỳ máy tính Windows nào mà không cần cài đặt.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

* **Core Framework**: Electron 33, Node.js
* **Frontend**: React 18, TypeScript, TailwindCSS v4, Lucide Icons
* **Build System**: Vite 6, Esbuild (Code Mangling & Obfuscation)
* **Testing**: Vitest (Unit & E2E Integration Tests)
* **Single-File Packaging**: C# .NET 4.0 Compiler (`csc.exe`) Launcher + ResEdit PE Resource Patcher

---

## 💻 Hướng Dẫn Sử Dụng (Quick Start)

1. **Chọn Thư mục Nguồn (Ảnh gốc)**: Bấm `Duyệt` để chọn folder chứa ảnh nguyên bản.
2. **Chọn Thư mục Đích (Nơi lưu)**: Bấm `Duyệt` để chọn folder lưu kết quả ảnh được lọc.
3. **Dán Danh sách Tên Ảnh**: Dán danh sách tên tệp ảnh (mỗi dòng 1 tên) vào ô `DANH SÁCH TÊN FILE`.
4. **Tùy Chọn Định Dạng (Nếu cần)**: Mặc định các nút định dạng sẽ tắt mờ (quét tất cả định dạng ảnh). Bạn có thể bấm chọn riêng `.JPG` hoặc `.ARW` nếu muốn.
5. **Chọn Chế độ**:
   - `Copy (Sao chép)`: An toàn, giữ nguyên ảnh gốc.
   - `Move (Di chuyển)`: Chuyển ảnh sang thư mục đích.
6. **Bấm `▶ Chạy Lọc Ảnh`**: Tiến trình sẽ tự động thực thi và hiển thị thông báo hoàn tất.

---

## 🔧 Hướng Dẫn Biên Dịch Từ Mã Nguồn (Build from Source)

### 1. Cài Đặt Thư Viện (Install Dependencies)
```bash
npm install
```

### 2. Chạy Ứng Dụng Chế Độ Developer (Run Dev)
```bash
npm run dev
```

### 3. Kiểm Thử Tự Động (Run Tests)
```bash
npm test
```

### 4. Đóng Gói 1 File `.exe` Duy Nhất (Build Single Executable)
```bash
npm run build:single
```
*Kết quả tệp chạy duy nhất sẽ được tạo tại: `release/ShutterFilter_SingleFile.exe`*

---

## 📜 Giấy Phép & Tác Giả (License & Credits)

- **Phát triển bởi**: **Tandev.foto**
- **Bản quyền**: © 2026 Tandev.foto. All rights reserved.
- **Giấy phép**: MIT License
