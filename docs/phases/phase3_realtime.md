# Phase 3: Bắt Mạch Thời Gian Thực & Hiệu Ứng Animation

## 1. Mục tiêu (Goals)
*   Theo dõi sự thay đổi của các file cấu hình trong thư mục làm việc thời gian thực.
*   Cài đặt cơ chế hoãn xử lý (Debouncing) để tránh parse dồn dập khi lập trình viên đang nhập văn bản.
*   Thiết lập kết nối WebSocket hai chiều để truyền tải sơ đồ mạng thời gian thực.
*   Triển khai hiệu ứng pulsing/glow trên giao diện Web UI và cơ chế chịu lỗi LKG (Last Known Good).

---

## 2. Kiến trúc & Stack kỹ thuật (Tech Stack)
*   **File Watcher:** Thư viện `github.com/fsnotify/fsnotify` (Pure Go).
*   **WebSocket Server:** Thư viện `github.com/gorilla/websocket` (Pure Go).
*   **Frontend UI:** CSS Tailwind, React Flow Edges customization (SVG-based styling).

---

## 3. Các bước triển khai chi tiết (Implementation Steps)

### Bước 1: Cài đặt File Watcher và cơ chế Debouncing
1. Tải thư viện: `go get github.com/fsnotify/fsnotify`.
2. Tạo watcher giám sát thư mục hiện tại:
   * Lọc và chỉ quan tâm đến các sự kiện thay đổi (`Write`, `Create`, `Remove`) của các tệp có đuôi `.yml`, `.yaml`, `.tf`, `.conf`.
3. Viết cơ chế **Debouncing** bằng Go Channels:
   * Khi nhận được sự kiện từ watcher, không parse ngay.
   * Sử dụng một Go Timer (ví dụ: `time.AfterFunc` hoặc vòng lặp select channel) đặt thời gian chờ `1500ms`.
   * Nếu có sự kiện mới trong khoảng thời gian này, reset timer. Chỉ thực thi việc biên dịch sơ đồ khi timer thực sự hết hạn (người dùng đã ngừng gõ phím).

### Bước 2: Triển khai WebSocket Server
1. Tải thư viện: `go get github.com/gorilla/websocket`.
2. Viết module WebSocket trong Go daemon:
   * Cấu hình nâng cấp kết nối HTTP thông thường thành WebSocket (`Upgrader`).
   * Quản lý danh sách các connection của Client đang mở trình duyệt.
   * Viết goroutine gửi nhịp tim định kỳ (Ping/Pong) cứ mỗi 30 giây để tránh trình duyệt ngắt kết nối tự động.
3. Khi hàm `CompileGraph` chạy xong sau bước debouncing, đẩy dữ liệu Graph Schema dưới dạng JSON qua WebSocket tới tất cả các client đang kết nối.

### Bước 3: Cơ chế chịu lỗi LKG (Last Known Good)
1. Trong quá trình parse, nếu gặp lỗi cú pháp (do tệp đang viết dở dang):
   * Không gửi sơ đồ trống hoặc báo lỗi sập hệ thống lên Client.
   * Giữ lại trạng thái Graph hợp lệ gần nhất trong RAM.
   * Gửi một JSON event dạng:
     ```json
     {
       "type": "PARSE_ERROR",
       "message": "Syntax error in docker-compose.yml at line 12",
       "graph": <LKG_Graph_Data>
     }
     ```
2. Frontend nhận event `PARSE_ERROR` sẽ giữ nguyên sơ đồ cũ, đồng thời hiển thị một banner thông báo màu đỏ ở góc trên màn hình cho người dùng biết.

### Bước 4: Thiết kế hiệu ứng chuyển động trên Frontend
1. Tải dữ liệu từ WebSocket client trong React.
2. Tùy chỉnh các đường kết nối (Edges) trong React Flow:
   * Sử dụng thuộc tính `style: { strokeDasharray: '5', animation: 'dash 1s linear infinite' }`.
   * Viết keyframe CSS `dash` trong file CSS chính để tạo hiệu ứng luồng sáng chuyển động dọc theo sợi dây kết nối.
3. Khi một Node mới được thêm vào hoặc thay đổi:
   * Kích hoạt hiệu ứng ripple (vòng tròn đồng tâm lan tỏa) và đổi màu border sang xanh lá sáng để thu hút sự chú ý.

---

## 4. Kịch bản kiểm thử & Xác thực (Verification Plan)
*   **Chạy Daemon:** Chạy `loomiss.exe` trên thư mục mock.
*   **Chỉnh sửa trực tiếp:**
    *   Mở tệp `docker-compose.yml`, sửa cổng `3306:3306` thành `5432:5432` và bấm Save.
    *   *Kỳ vọng:* Web UI tự động cập nhật đổi nhãn kết nối thành port `5432` sau 1.5 giây mà không cần F5 trình duyệt.
    *   Xóa một dòng cấu hình làm lỗi cú pháp và bấm Save.
    *   *Kỳ vọng:* Sơ đồ giữ nguyên, xuất hiện banner lỗi cú pháp màu đỏ ở góc màn hình. Sửa lại đúng cú pháp, banner lỗi biến mất và sơ đồ cập nhật.
