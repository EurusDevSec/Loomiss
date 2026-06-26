# Phase 5: Semantic Caching & Persistent Memory (Nâng cao)

## 1. Mục tiêu (Goals)
*   Tích hợp hệ thống cơ sở dữ liệu SQLite cục bộ (CGO-free) để lưu trữ cấu trúc bền vững.
*   Xây dựng thuật toán so sánh độ tương đồng Vector (Cosine Similarity) thuần Go để tìm kiếm ngữ nghĩa.
*   Tích hợp Gemini Embedding API để vector hóa các truy vấn và thông tin của AI Agent.
*   Cài đặt Middleware Semantic Caching chặn trước các truy vấn để trả về kết quả nhanh, tiết kiệm tối đa token.
*   Triển khai bộ công cụ ghi nhớ dữ liệu kiến trúc (Persistent Memory) cho Agent.

---

## 2. Kiến trúc & Stack kỹ thuật (Tech Stack)
*   **Database:** `modernc.org/sqlite` (Pure Go driver cho SQLite, không cần gcc, không cần CGO).
*   **Vector Embeddings:** Google Gemini Embedding API.
*   **Vector Engine:** Hàm tính Cosine Similarity viết bằng Go thuần.

---

## 3. Các bước triển khai chi tiết (Implementation Steps)

### Bước 1: Khởi tạo SQLite thuần Go và Database Schema
1. Tải thư viện driver: `go get modernc.org/sqlite`.
2. Tạo file DB cục bộ tại thư mục `.loomiss/memory.db`.
3. Định nghĩa cấu trúc bảng:
   * **Bảng `prompt_cache`**: Lưu trữ cache truy vấn.
     * `id`: TEXT (Primary Key)
     * `prompt`: TEXT (Câu lệnh của Agent)
     * `embedding`: BLOB (Dữ liệu Vector 1536 float32)
     * `response`: TEXT (Kết quả JSON Graph Schema trả về)
     * `created_at`: DATETIME
   * **Bảng `memories`**: Lưu trữ các rule/fact kiến trúc bền vững.
     * `id`: TEXT
     * `fact`: TEXT (Ví dụ: "Port 3306 chỉ được nhận kết nối từ web container, cấm mở ra public")
     * `embedding`: BLOB
     * `created_at`: DATETIME

### Bước 2: Tích hợp Gemini Embedding API
1. Viết client kết nối API:
   * Gọi model `text-embedding-004` (hoặc model embedding mới nhất của Google) qua HTTP.
   * Gửi chuỗi text cần vector hóa, nhận về mảng float32.
   * Lưu trữ mảng float32 vào cột `embedding` của SQLite dưới dạng mảng byte nhị phân (`encoding/binary`).

### Bước 3: Thuật toán Cosine Similarity thuần Go
Viết hàm tính toán độ tương đồng giữa 2 vector $A$ và $B$:
$$\text{Similarity}(A, B) = \frac{A \cdot B}{\|A\| \|B\|} = \frac{\sum_{i=1}^{n} A_i B_i}{\sqrt{\sum_{i=1}^{n} A_i^2} \sqrt{\sum_{i=1}^{n} B_i^2}}$$
Hàm tính toán trong Go duyệt qua mảng float32, chạy cực nhanh offline mà không cần cài đặt cơ sở dữ liệu Vector chuyên dụng nào ngoài file SQLite.

### Bước 4: Triển khai Semantic Caching Middleware
1. Khi AI Agent gọi công cụ `get_architecture_schema` kèm theo một câu lệnh mô tả (prompt):
   * Chuyển đổi prompt thành vector thông qua Gemini Embedding API.
   * Chạy câu truy vấn SQLite lấy toàn bộ vector trong bảng `prompt_cache`.
   * So sánh Cosine Similarity của prompt mới với các prompt đã lưu.
   * Nếu tìm thấy prompt có độ tương đồng **> 0.90**:
     * Trả về ngay lập tức giá trị trong cột `response`.
     * Ghi nhận log: `"Cache Hit! Saved LLM Tokens"`.
   * Nếu không khớp (Cache Miss):
     * Thực hiện quét thư mục và phân tích cú pháp tĩnh bình thường.
     * Lưu kết quả mới và vector vào bảng `prompt_cache`.

### Bước 5: Triển khai Persistent Memory Tools cho AI Agent
Cung cấp các công cụ MCP mới:
*   `add_architectural_memory`: Cho phép AI Agent tự ghi nhận một quy tắc hoặc thông tin mới (Ví dụ: *"Nginx đang dùng port 80 để proxy vào port 3000"*). Dữ liệu này được vector hóa và lưu vào bảng `memories`.
*   `get_architectural_memory`: Cho phép AI Agent tra cứu nhanh các quy tắc đã học trước đây thông qua so sánh tương đồng vector để đảm bảo code mới viết ra không vi phạm thiết kế cũ.

---

## 4. Kịch bản kiểm thử & Xác thực (Verification Plan)
*   **Chạy thử Cache:**
    1. Gửi lệnh yêu cầu phân tích sơ đồ: *"Vẽ lại sơ đồ mạng của docker-compose"*. Hệ thống sẽ parse và mất khoảng 1-2 giây.
    2. Gửi tiếp câu lệnh tương tự: *"Cho tôi xem sơ đồ mạng docker-compose"* hoặc *"Vẽ sơ đồ mạng compose"*.
    3. *Kỳ vọng:* Hệ thống trả về kết quả lập tức (< 50ms) và ghi nhận log `Cache Hit` trong tệp log daemon.
*   **Chạy thử Memory:**
    1. Yêu cầu AI ghi nhớ: *"Hãy nhớ là container database MySQL chỉ được chạy trong mạng subnet nội bộ."*
    2. Hỏi lại AI: *"Subnet nội bộ có những lưu ý gì về bảo mật?"*
    3. *Kỳ vọng:* AI Agent gọi tool `get_architectural_memory`, tìm thấy fact đã lưu và phản hồi chính xác quy tắc thiết kế của hệ thống.
