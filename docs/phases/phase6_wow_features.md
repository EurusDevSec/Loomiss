# Phase 6: Interactive Real-time Metrics, Traffic Simulation & AI Architecture Auditor (WOW Features)

## 1. Mục tiêu (Goals)
*   **Live Resource Monitoring**: Giám sát chỉ số tài nguyên (CPU, RAM, Network I/O) của các container đang chạy trong thời gian thực và hiển thị trực quan dạng neon bar dưới mỗi Node.
*   **Dynamic Traffic Flow Simulation**: Mô phỏng luồng dữ liệu (traffic) chảy dọc theo các Edges với tốc độ hạt sáng tỷ lệ thuận với băng thông/traffic và nhấp nháy đỏ khi độ trễ cao hoặc mất kết nối.
*   **AI System Design Auditor**: Cho phép AI Agent tự động rà soát, đánh giá toàn bộ kiến trúc để phát hiện các điểm nghẽn Single Point of Failure (SPOF) hoặc cấu hình sai quy định bảo mật.
*   **Interactive Topology Editor & Write-back**: Hỗ trợ người dùng kéo nối các thành phần hoặc sửa tham số trực tiếp trên Web UI, sau đó đồng bộ ghi ngược lại (write-back) file cấu hình gốc (`docker-compose.yml`, `.env`, `nginx.conf`).
*   **Interactive Terminal & Log Stream**: Tích hợp log viewer và terminal giả lập vào panel bên phải của mỗi Node để theo dõi `docker logs -f` và thực hiện nhanh các lệnh Start/Stop/Restart container.

---

## 2. Kiến trúc & Stack kỹ thuật (Tech Stack)
*   **Docker Daemon API Connection**: Sử dụng Docker SDK cho Go (`github.com/docker/docker/client`) để giao tiếp trực tiếp với Docker Socket cục bộ (`//./pipe/docker_engine` trên Windows hoặc `/var/run/docker.sock` trên Linux).
*   **WebSocket Push Engine**: Sử dụng WebSocket Server của Loomiss Daemon đẩy metric thời gian thực lên giao diện mỗi 1-2 giây.
*   **React Flow custom edge render**: Sử dụng `@xyflow/react` kết hợp với SVG animations (`SVGAnimateElement` hoặc CSS keyframes chạy dọc SVG path) để tạo luồng hạt sáng động.
*   **AI Reasoning Layer**: Sử dụng Vector Similarity Search của Phase 5 để đối soát kiến trúc hiện tại với danh mục rule-set chuẩn mực của ByteByteGo và đưa ra báo cáo.

---

## 3. Các bước triển khai chi tiết (Implementation Steps)

### Bước 1: Live Resource Monitoring (Giám sát thời gian thực)
1.  **Backend Docker Stream**:
    *   Sử dụng Go Docker SDK kết nối cục bộ để lấy chỉ số thống kê của từng container (`cli.ContainerStats`).
    *   Tính toán tỷ lệ sử dụng CPU & RAM của container và gửi qua kênh WebSocket của `Hub` định kỳ mỗi 1.5 giây.
2.  **Frontend Neon Indicators**:
    *   Thêm thanh hiển thị độ tải CPU/RAM siêu nhỏ phát sáng dưới nhãn Node trong `ArchitectureNode.tsx`.
    *   Tự động đổi màu viền Node sang màu đỏ neon và phát hoạt ảnh rung nếu CPU > 90% hoặc RAM > 85%.

### Bước 2: Dynamic Traffic Flow Simulation (Mô phỏng luồng dữ liệu)
1.  **SVG Path Animation**:
    *   Tạo Custom Edge (`TrafficEdge.tsx`) mở rộng từ `smoothstep` hoặc `bezier` của React Flow.
    *   Sử dụng thẻ `<circle>` chạy dọc theo SVG path bằng cách dùng thuộc tính CSS `offset-path: path(...)` và `animation: moveParticle 2s linear infinite`.
2.  **Traffic Control**:
    *   Dựa vào lưu lượng I/O hoặc số byte truyền nhận (Network I/O) từ Docker API, frontend sẽ điều chỉnh tốc độ chuyển động (`animation-duration`) và mật độ của hạt sáng.
    *   Nếu một kết nối bị lỗi hoặc mất gói tin (ví dụ: Service database bị sập), đường truyền sẽ chuyển thành màu đỏ nhấp nháy cảnh báo.

### Bước 3: AI System Design Auditor (Đánh giá kiến trúc)
1.  **Architectural Rules Engine**:
    *   Xây dựng danh mục các quy chuẩn thiết kế hệ thống tối ưu dạng text embeddings trong SQLite (ví dụ: *"Các database như Postgres/MySQL không nên map cổng ra ngoài public internet"*, *"Phải có Load Balancer đứng trước cụm backend"*).
2.  **System Audit Call**:
    *   Nút bấm **"Audit Architecture"** trên toolbar gọi API `/api/audit`.
    *   Backend chuyển đổi Graph Schema hiện tại thành văn bản mô tả kiến trúc kết nối.
    *   Thực hiện truy vấn so khớp Vector ngữ nghĩa với SQLite để tìm các lỗi/vi phạm thiết kế.
    *   Trả về báo cáo chi tiết kèm mức độ cảnh báo (High, Medium, Low) hiển thị dạng Modal cực đẹp trên giao diện.

### Bước 4: Interactive Topology Editor & Write-back (Chỉnh sửa hai chiều)
1.  **UI Interaction**:
    *   Hỗ trợ kéo và thả các đường Edges mới để kết nối các Node ngay trên canvas.
    *   Khi có Edge mới (ví dụ: `app` kéo sang `redis`), một popup sẽ hiện ra hỏi port kết nối và cấu hình mong muốn.
2.  **Configuration Write-back**:
    *   Backend nhận sự kiện chỉnh sửa kết nối qua API.
    *   Sử dụng thư viện `yaml.v3` để phân tích tệp `docker-compose.yml` gốc, tự động cập nhật hoặc chèn thêm biến môi trường `REDIS_HOST=redis` vào cấu hình của service `app`.
    *   File watcher phát hiện sự thay đổi, tự động cập nhật lại sơ đồ mà không gây mất đồng bộ dữ liệu.

### Bước 5: Interactive Terminal & Log Stream (Bảng điều khiển tích hợp)
1.  **Docker Log Stream**:
    *   Khi click vào Node, một panel trượt (Drawer) sử dụng glassmorphism sẽ xuất hiện từ cạnh phải màn hình.
    *   Kết nối WebSocket stream trực tiếp từ lệnh `docker logs --tail 100 -f [container]` thông qua backend để hiển thị log cuộn thời gian thực dạng terminal đen mờ.
2.  **Quick Service Actions**:
    *   Cung cấp 3 nút bấm tương tác nhanh: **Restart**, **Stop**, và **Start** cho container đó.
    *   Khi click, Web UI gọi API tương ứng gửi lệnh đến Docker API để điều khiển vòng đời container ngay lập tức.

### Bước 6: Smart Edge Routing & Layout Spacing (Gỡ rối đường nối & Tối ưu bố cục)
1. **Thuật toán Dò đường A\* (A-Star Pathfinding)**:
   * Tích hợp thư viện `@jalez/react-flow-smart-edge` nhằm tính toán đường đi vuông góc cho Edges bo vòng tránh các Node.
   * Loại bỏ các parent group nodes ra khỏi danh sách chướng ngại vật để cho phép vẽ đường đi nội bộ giữa các service con bên trong một cách mượt mà.
   * **Chuẩn hóa tọa độ đệ quy (Coordinate Normalization)**: Tự động tính toán cộng dồn offset của node cha để chuyển đổi hệ tọa độ tương đối của node con thành hệ tọa độ tuyệt đối chuẩn xác trên canvas, giúp thuật toán dò đường phát hiện đúng vị trí thực tế của chướng ngại vật.
2. **Nhấn mạnh đường nối khi tương tác (Hover Highlight)**:
   * Bắt sự kiện `MouseEnter`/`MouseLeave` trên từng đường nối: Khi di chuột qua, đường nối sẽ sáng màu Neon Cyan (`#06b6d4`), tăng độ dày lên `4.5px` và phóng to hạt chuyển động biểu diễn dòng traffic để dễ dàng truy vết tuyến truyền dẫn.
3. **Fading tập trung kết nối (Selected-Node Focus)**:
   * Khi người dùng click chọn bất kỳ Node nào trên sơ đồ, toàn bộ các Edges không liên quan trực tiếp đến Node đó sẽ tự động mờ đi (độ mờ giảm còn `15%` opacity), giữ nguyên độ sáng $100\%$ cho các luồng giao tiếp trực tiếp để triệt tiêu nhiễu thị giác trên đồ thị dày đặc.
4. **Giản cách lưới trực quan (Layout Grid Spacing)**:
   * Điều chỉnh hằng số layout trong `layout.ts` với `colWidth = 360` và `rowHeight = 180`.
   * Tăng khoảng cách trống chiều ngang giữa các Node lên **120px**, tạo không gian hoàn hảo ở giữa cho các nhãn chỉ dẫn (như `"Depends On"`) hiển thị tự nhiên mà không bao giờ bị đè lấn lên các cổng kết nối (Handles) hay biên Node.

---

## 4. Kịch bản kiểm thử & Xác thực (Verification Plan)
*   **Xác thực Live Metrics & Dynamic Flow**:
    *   Chạy công cụ benchmark/stress test vào server backend (ví dụ dùng `ab` hoặc `k6`).
    *   *Kỳ vọng:* Trên sơ đồ, Node Backend sẽ chuyển viền neon từ xanh sang vàng/đỏ, các chấm sáng di chuyển cực kỳ nhanh trên đường kết nối biểu thị lượng traffic lớn.
*   **Kiểm thử Write-back**:
    *   Kéo dây kết nối từ một web app sang container database mới tạo.
    *   *Kỳ vọng:* Mở file `docker-compose.yml` ra kiểm tra, cấu hình môi trường của web app tự động được bổ sung thông số cấu hình database chính xác.
