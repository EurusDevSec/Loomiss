# Phase 2: Tích Hợp Parsers Thuần Go

## 1. Mục tiêu (Goals)
*   Xây dựng cấu trúc dữ liệu đồ thị chuẩn (JSON Graph Schema) để trao đổi thông tin giữa Backend và Frontend.
*   Phân tích cấu hình Docker-compose bằng thư viện YAML thuần Go.
*   Phân tích cấu hình hạ tầng Terraform bằng thư viện HCL v2 của HashiCorp.
*   Phân tích định tuyến Reverse Proxy của Nginx bằng parser Go thuần.
*   Biên dịch thông tin từ các tệp cấu hình khác nhau thành một sơ đồ hợp nhất.

---

## 2. Kiến trúc & Stack kỹ thuật (Tech Stack)
*   **YAML Parser:** Thư viện `gopkg.in/yaml.v3` (Pure Go).
*   **HCL Parser:** Thư viện `github.com/hashicorp/hcl/v2` (Pure Go).
*   **Nginx Parser:** Custom lexer/parser bằng Go hoặc dùng thư viện phân tích cấu hình Nginx thuần Go.

---

## 3. Các bước triển khai chi tiết (Implementation Steps)

### Bước 1: Thiết kế Graph Schema thống nhất
Định nghĩa các struct Go dùng để tuần tự hóa thành JSON gửi lên UI qua WebSocket:
*   **Node Struct:**
    ```go
    type Node struct {
        ID       string            `json:"id"`
        Label    string            `json:"label"`
        Type     string            `json:"type"`     // "gateway", "app", "database", "network"
        Status   string            `json:"status"`   // "active", "error"
        Metadata map[string]string `json:"metadata"` // ports, environment variables, image
    }
    ```
*   **Edge Struct:**
    ```go
    type Edge struct {
        ID     string `json:"id"`
        Source string `json:"source"`
        Target string `json:"target"`
        Label  string `json:"label"` // Port hoặc giao thức (e.g., "3306/tcp")
    }
    ```
*   **Graph Struct:** chứa `[]Node` và `[]Edge`.

### Bước 2: Viết YAML Parser (Docker-compose)
1. Tải thư viện YAML: `go get gopkg.in/yaml.v3`.
2. Định nghĩa cấu trúc struct ánh xạ tệp `docker-compose.yml` (chú trọng lấy `services`, `ports`, `depends_on`, `networks`).
3. Viết hàm phân tích:
   * Trích xuất các service thành các Node loại `"app"` hoặc `"database"` (dựa trên tên service hoặc image như mysql, postgres, redis).
   * Tạo các Edge kết nối dựa trên cổng expose (`ports`) và dependency kết nối giữa các container (`depends_on` hoặc `links`).

### Bước 3: Viết HCL Parser (Terraform)
1. Tải thư viện HCL v2: `go get github.com/hashicorp/hcl/v2`.
2. Viết parser duyệt qua các file `.tf`:
   * Tìm các block `resource "aws_instance"` (EC2) để trích xuất thành Node loại `"app"`.
   * Tìm các block `resource "aws_db_instance"` (RDS) để trích xuất thành Node loại `"database"`.
   * Tìm Application Load Balancer (`aws_lb`) và Security Groups để trích xuất luồng định tuyến của traffic và tạo ra các Edge kết nối tương ứng.

### Bước 4: Viết Nginx Config Parser
1. Viết một parser đơn giản phân tích tệp `nginx.conf`:
   * Quét các block `server` và các thuộc tính `listen` (cổng nhận).
   * Tìm các directive `proxy_pass http://...` hoặc `fastcgi_pass` để xác định đích định tuyến của traffic.
   * Chuyển các chỉ thị này thành các Node (Reverse Proxy) và Edge (Traffic link) trỏ tới service tương ứng.

### Bước 5: Hợp nhất đồ thị (Graph Compiling)
Viết hàm `CompileGraph(workspacePath string)` duyệt qua thư mục chỉ định, gọi các parser tương ứng nếu tìm thấy tệp cấu hình, sau đó hợp nhất các Node/Edge trùng nhau (dựa trên IP/Port/Service Name) để tạo thành một Graph thống nhất cuối cùng.

---

## 4. Kịch bản kiểm thử & Xác thực (Verification Plan)
*   **Chuẩn bị Mock Project:** Tạo một thư mục kiểm thử chứa đồng thời:
    *   File `docker-compose.yml` định nghĩa service `web` kết nối tới `db` (Postgres) và `cache` (Redis).
    *   File `nginx.conf` định nghĩa reverse proxy định tuyến từ port 80 vào service `web` trên port 8080.
*   **Chạy Unit Test:** Viết và chạy các unit test bằng Go (`go test ./backend/parsers/...`) để kiểm tra tính chính xác của hàm parse.
*   **Tiêu chuẩn đạt (Definition of Done):**
    1. Hàm `CompileGraph` xuất ra chuỗi JSON Graph Schema hợp lệ, nhận diện đúng 4 nodes (`nginx`, `web`, `db`, `cache`) và 3 Edges liên kết tương ứng.
    2. Không có bất kỳ CGO dependencies nào được sử dụng trong mã nguồn parser.
