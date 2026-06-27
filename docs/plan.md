## 1. Ý tưởng cốt lõi của dự án Loomiss

**Loomiss** là một công cụ giám sát kiến trúc động (Dynamic Architecture Visualizer), hoạt động như một tiến trình chạy ngầm độc lập (Standalone CLI Tool) và cung cấp giao thức giao tiếp thời gian thực.

Thay vì bắt người dùng tự vẽ sơ đồ mạng, Loomiss tự động phân tích cú pháp tĩnh các tệp cấu hình hệ thống (như `docker-compose.yml`, `nginx.conf`, Terraform) để trích xuất sơ đồ hạ tầng. Đặc biệt, thông qua việc tích hợp giao thức MCP (Model Context Protocol) và File Watcher, Loomiss có khả năng "lắng nghe" các thao tác thay đổi mã nguồn của AI Coding Agents (như Cursor, Devin) hoặc con người. Mỗi sự thay đổi về port, luồng định tuyến (routing) hay kết nối mới đều được phản hồi ngay lập tức lên giao diện Web UI dưới dạng các node và luồng sáng chuyển động (pulsing animations), giúp trực quan hóa toàn bộ bức tranh kiến trúc hệ thống theo thời gian thực.

---

## 2. Nỗi đau của thị trường (The Pain Points)

Sự ra đời của các AI Agent đang thay đổi hoàn toàn cách phần mềm được viết, nhưng đồng thời tạo ra những "điểm mù" vô cùng nguy hiểm cho các kỹ sư DevOps và System Admin. Loomiss được sinh ra để giải quyết 3 nỗi đau chí mạng sau:

### Nỗi đau 1: Sự "mù bối cảnh" khi AI tự động sửa code trên diện rộng

Khi giao việc cho AI Agent, chúng có thể đồng thời can thiệp vào hàng chục file khác nhau—từ file logic ở Backend, file giao diện ở Frontend, cho đến các file cấu hình môi trường. Người đánh giá (reviewer) buộc phải đọc các file diff một cách máy móc và rời rạc. Việc chỉ nhìn vào những dòng text bị gạch xóa khiến kỹ sư không thể hình dung được **"bức tranh toàn cảnh" (Big Picture)**, dẫn đến việc mất kiểm soát luồng đi của dữ liệu và hệ quả của những thay đổi đó lên toàn bộ dự án.

### Nỗi đau 2: Rủi ro an ninh mạng và sai lệch cấu hình hạ tầng

Khi triển khai các bài toán hệ thống thực tế—như cấu hình VPC, chia Subnet, thiết lập các instance EC2 hay định tuyến luồng traffic qua Application Load Balancer—việc cấu hình sai là cực kỳ nguy hiểm. AI Agent đôi khi bị "ảo giác" (hallucinate) hoặc thiếu ngữ cảnh bảo mật, dẫn đến việc vô tình mở toang port của Database (như 3306 hay 5432) ra mạng public, hoặc trỏ sai luồng của Reverse Proxy. Nếu chỉ kiểm tra các file cấu hình dạng text khô khan, những rủi ro này rất dễ bị bỏ lọt cho đến khi hệ thống thực sự sập hoặc bị tấn công.

### Nỗi đau 3: Các công cụ sơ đồ hiện tại quá tĩnh và thụ động

Hiện nay, để nắm bắt kiến trúc dự án, các đội ngũ kỹ thuật thường phải tự vẽ sơ đồ bằng tay hoặc dùng các công cụ "Diagram as Code". Tuy nhiên, những bức ảnh tĩnh này nhanh chóng trở nên lỗi thời ngay khi dòng code tiếp theo được commit. Việc đọc lý thuyết hay xem video luồng dữ liệu không mang lại cảm giác thực chiến. Thị trường đang hoàn toàn vắng bóng một công cụ có khả năng biến mã nguồn đang được chỉnh sửa thành một thực thể "sống", chuyển động realtime ngay trên màn hình.

---

## 3. Lý do thực hiện dự án (Why Loomiss?)

Từ những bối cảnh trên, **Loomiss** được phát triển nhằm mục tiêu:

* **Lấy lại quyền kiểm soát (Trust & Control):** Biến hộp đen thao tác của AI thành một luồng dữ liệu trong suốt. Thay vì phấp phỏng chờ đợi AI chạy xong lệnh để kiểm tra mã nguồn, kỹ sư có thể vừa uống cà phê vừa nhìn các cụm vi dịch vụ (microservices), các port và network link tự động hình thành hoặc báo lỗi ngay trên màn hình.
* **Tạo ra một công cụ Debug và Review kiến trúc độc bản:** Cung cấp trải nghiệm thực chiến cao nhất. Việc nhìn thấy rõ luồng dữ liệu chạy từ User vào Nginx qua Port 3000, rẽ nhánh vào Redis và lưu xuống Database mang lại giá trị giám sát vượt trội so với việc mò mẫm trong console log.
* **Tài liệu hóa sống động (Live Documentation):** Xóa bỏ hoàn toàn gánh nặng phải cập nhật sơ đồ hệ thống. Bản thân quá trình code (dù là người hay AI) chính là quá trình cập nhật tài liệu kiến trúc.

---

## BẢN KẾ HOẠCH TRIỂN KHAI TỐI ƯU (OPTIMIZED IMPLEMENTATION PLAN)

### I. Kiến trúc Lõi & Tech Stack (The Blueprint)

Hệ thống hoạt động như một CLI Tool chạy ngầm (Daemon), kết hợp cơ chế liên lạc nội bộ (IPC) để đồng bộ trạng thái giữa các dòng AI Agent khác nhau và giao diện Web UI trên Trình duyệt. 

Dự án tuân thủ nghiêm ngặt mô hình **Kiến trúc Sạch (Clean Architecture)** được đặc tả trong [docs/architecture.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/architecture.md) để ngăn ngừa spaghetti code, phân tách rạch ròi giữa logic nghiệp vụ, parsers cấu hình, giao tiếp MCP/WebSockets và tầng cơ sở dữ liệu lưu trữ.

1. **Core CLI & Backend:** `Go (Golang)`. Đóng gói thành Single Binary bằng `go:embed`. Không sử dụng CGO để đảm bảo khả năng cross-compile dễ dàng cho Windows, macOS và Linux.
2. **Frontend (Web UI):** `React.js` (Vite) + `React Flow` + `@reactflow/dagre` (Layout Engine tự động sắp xếp node) + `TailwindCSS` (hỗ trợ Dark Mode neon cao cấp).
3. **Local Parsers (Pure Go):**
   * **YAML/Docker-compose:** Sử dụng `gopkg.in/yaml.v3` thuần Go.
   * **Terraform/HCL:** Sử dụng `github.com/hashicorp/hcl/v2` chính thức từ HashiCorp.
   * **Nginx Configuration:** Viết parser/lexer thuần Go hoặc sử dụng thư viện thuần Go giúp phân tích định tuyến reverse proxy.
4. **Event Bridge:** `gorilla/websocket` (Go) để đẩy sự kiện thay đổi kiến trúc thời gian thực lên Web UI.
5. **AI Integration & IPC:** Giao thức **MCP (Model Context Protocol)** hỗ trợ cả 2 dạng kết nối `stdio` (cho Antigravity IDE, Cursor, Windsurf, Cline/Claude Dev) và `SSE/HTTP`. Tiến trình MCP độc lập chạy song song và giao tiếp với Daemon chính thông qua HTTP IPC cục bộ. Đối với các IDE không hỗ trợ MCP (như VSCode với GitHub Copilot tiêu chuẩn), Loomiss tự động đồng bộ khi lưu file thông qua File Watcher.
6. **Semantic Cache & Persistent Memory Layer:** Sử dụng CGO-free SQLite (`modernc.org/sqlite`) để lưu trữ dữ liệu bền vững và chỉ số tương đồng vector (Vector Index) thuần Go dựa trên thuật toán Cosine Similarity kết hợp với Gemini Embedding API.

---

### II. Phản biện & Quyết định Thiết kế Tối ưu (Design Decisions)

* **Loại bỏ Tree-sitter (CGO):** Do Tree-sitter yêu cầu CGO, nó cản trở khả năng tự động build cross-platform của Go. Sử dụng các parser thuần Go giúp quá trình biên dịch chéo sang mọi hệ điều hành trở nên cực kỳ đơn giản và file thực thi nhẹ hơn nhiều.
* **Tích hợp Auto-layout (Dagre):** React Flow không tự động sắp xếp node. Báo cáo này bổ sung thư viện Dagre ở Frontend để tự động bố trí các thành phần hệ thống ngăn nắp ngay khi phân tích xong, tránh hiện tượng các node đè lên nhau.
* **Hỗ trợ Đa IDE & Universal Fallback (Antigravity IDE, Kiro, VSCode/Copilot):** 
  * Với các IDE hỗ trợ MCP (Antigravity IDE, Cursor, Windsurf), AI Agent có thể truy vấn sơ đồ kiến trúc trực tiếp và gửi các tín hiệu chỉnh sửa thời gian thực kể cả trước khi lưu file.
  * Với các IDE/Extension chưa hỗ trợ MCP (như GitHub Copilot trên VSCode/Kiro), **File Watcher (`fsnotify`)** đóng vai trò là cơ chế fallback phổ quát. Mọi thay đổi cấu hình sau khi lưu file (Save) đều lập tức phản ánh lên Web UI mà không bị gián đoạn.
* **Giao tiếp IPC cho MCP Server:** Tách biệt luồng xử lý: Daemon chính theo dõi file cục bộ và chạy Web UI, còn tiến trình MCP của Cursor/Antigravity IDE đóng vai trò client bắn tín hiệu thông qua HTTP POST nội bộ về Daemon chính khi AI Agent thực hiện thay đổi.
* **Cơ chế chịu lỗi LKG (Last Known Good):** Khi lập trình viên đang gõ dở code cấu hình làm lỗi cú pháp tạm thời, hệ thống sẽ trì hoãn parse (Debounce 1.5s) và giữ lại trạng thái sơ đồ hợp lệ gần nhất (LKG) kèm cảnh báo lỗi, thay vì xóa trắng sơ đồ.
* **Tích hợp Semantic Caching & Persistent Memory (Tối ưu hóa bộ nhớ Agent):**
  * **Semantic Caching:** Lấy cảm hứng từ các dự án lớn như **GPTCache** (zilliztech/GPTCache - 10k+ Stars) và **Upstash Semantic Cache** (upstash/semantic-cache), Loomiss tích hợp một lớp cache thông minh dựa trên độ tương đồng ngữ nghĩa của prompt / truy vấn cấu trúc của Agent. Nếu AI Agent hỏi lại một câu tương tự hoặc yêu cầu sơ đồ cấu trúc của cùng một folder trạng thái, cache sẽ phản hồi lập tức mà không cần gọi LLM API hoặc parse lại từ đầu, tiết kiệm tới 80% tokens và thời gian trễ.
  * **Persistent Memory:** Tương tự mô hình của **Mem0** (mem0ai/mem0 - 20k+ Stars) và **Engram** (Gentleman-Programming/engram - bộ nhớ SQLite MCP thuần Go), Loomiss lưu trữ các "quy tắc thiết kế", "phán đoán kiến trúc" và "tùy chỉnh của người dùng" vào một DB SQLite nội bộ. Khi AI Agent tương tác, nó có thể tra cứu nhanh các quyết định kiến trúc từ trước đó để giữ tính nhất quán, tránh việc lặp đi lặp lại phân tích.

---

### III. Lộ trình Thực chiến (5 Giai đoạn)

#### Phase 1: Xây dựng Khung xương & Single Binary (Tuần 1) - [Specs](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/phases/phase1_skeleton.md)
* **Setup Frontend:** Khởi tạo project React bằng Vite. Sử dụng React Flow vẽ hệ thống mẫu. Tích hợp thư viện `@reactflow/dagre` để tính toán tọa độ tự động. Thiết kế giao diện Dark Mode neon sang trọng (neon stroke, glassmorphism panel).
* **Setup Backend:** Viết HTTP Server bằng Go.
* **Tích hợp `go:embed`:** Build frontend ra thư mục `dist`, dùng Go gộp thẳng thư mục này vào trong file binary để phân phối độc lập.

#### Phase 2: Tích hợp Parsers thuần Go (Tuần 2) - [Specs](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/phases/phase2_parsers.md)
* **Tích hợp Parsers:** Nhúng `gopkg.in/yaml.v3` và `github.com/hashicorp/hcl/v2` vào Go backend.
* **Xây dựng Graph Schema:** Thiết kế cấu trúc dữ liệu chung biểu diễn các node (Service, Database, Reverse Proxy) và các edge kết nối (port, route).
* **Quét thực tế:** Chạy thử nghiệm quét các dự án thực tế chứa tệp `docker-compose.yml` phức tạp để kiểm chứng khả năng trích xuất chính xác các node và liên kết mạng.

#### Phase 3: Bắt mạch Thời gian thực & Animation (Tuần 3) - [Specs](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/phases/phase3_realtime.md)
* **File Watcher:** Dùng `fsnotify` theo dõi thư mục. Áp dụng cơ chế debouncing bằng Goroutines và Channels trong Go để trì hoãn quét (chờ 1.5 giây sau khi ngừng gõ phím).
* **Cơ chế chịu lỗi LKG:** Nếu file bị lỗi cú pháp khi đang sửa, backend vẫn phản hồi trạng thái sơ đồ tốt gần nhất lên UI và hiển thị cảnh báo nhỏ.
* **WebSocket & Animation:** Kết nối hai chiều. Cài đặt các class CSS Tailwind tạo hiệu ứng pulsing line (đường truyền sáng nhấp nháy) và ripple circle (vòng tròn lan tỏa) trên các node được thay đổi.

#### Phase 4: Tích hợp MCP & "Cấp mắt" cho AI Agent (Tuần 4) - [Specs](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/phases/phase4_mcp.md)
* **Triển khai MCP Server:** Sử dụng Go để viết một MCP Server chạy qua stdio (hoặc SSE).
* **Thiết lập IPC:** Cài đặt endpoint API nội bộ (ví dụ: `POST /api/agent-activity`) trên CLI Daemon chính. Khi AI Agent gọi tool qua MCP, tiến trình MCP sẽ bắn request này để Web UI nháy sáng node tương ứng tức thì.
* **Cấu hình & Test trên Antigravity IDE / Cursor:** Khai báo MCP server cục bộ trong cài đặt của Antigravity IDE và Cursor. AI Agent có thể truy cập các công cụ để tự nhận biết sơ đồ kiến trúc hiện tại.
* **Kiểm thử chế độ Fallback:** Thực hiện kiểm thử trên VSCode bằng cách chỉnh sửa trực tiếp các tệp cấu hình qua GitHub Copilot; Web UI phải tự động cập nhật ngay lập tức dựa trên cơ chế File Watcher sau khi tệp được lưu.

#### Phase 5: Semantic Caching & Persistent Memory (Tuần 5 - Nâng cao) - [Specs](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/phases/phase5_memory_caching.md)
* **Xây dựng SQLite Schema & Vector Index:** Tạo tệp DB SQLite cục bộ sử dụng driver Go thuần (`modernc.org/sqlite`). Định nghĩa bảng lưu trữ các sự kiện/facts kiến trúc (`memories`) và bảng lưu trữ cache prompt (`prompt_cache`).
* **Tích hợp Gemini Embedding API:** Viết module kết nối với API tạo vector embeddings để chuyển các prompt/truy vấn của Agent thành vector.
* **Thuật toán So sánh Vector (Cosine Similarity):** Tự triển khai phép so sánh Cosine Similarity trong Go để tìm kiếm các prompt có độ tương đồng > 0.90 trong database SQLite.
* **Triển khai MCP Memory Tools:** 
  * Cung cấp các công cụ: `get_architectural_memory` (đọc bộ nhớ kiến trúc), `add_architectural_memory` (AI Agent ghi lại phát hiện mới về hệ thống).
  * Viết middleware kiểm tra cache: khi Agent gửi yêu cầu phân tích thông qua MCP, Loomiss sẽ tra cứu trong `prompt_cache` trước, nếu trùng khớp sẽ trả về kết quả ngay lập tức để tiết kiệm token tối đa.

#### Phase 6: Infrastructure Digital Twin & Shift-Left Guardrails (Tuần 6 - Nâng cao - ĐÃ HOÀN THÀNH) - [Specs](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/phases/phase6_digital_twin.md)
* **Time Travel Slider (Git History)**: Tích hợp thanh kéo thời gian ở chân trang Web UI. Go Backend chạy các lệnh `git log` và `git show <commit>:<file>` để trích xuất và dựng lại sơ đồ lịch sử mà không cần checkout đĩa thật, hiển thị trực quan các cấu hình bị thay đổi hoặc đứt gãy.
* **Live-Shadow Observability (TCP/HTTP Probing)**: Bổ sung Goroutine chạy ngầm thực hiện health check định kỳ (TCP/HTTP) tới các cổng dịch vụ nội bộ đang hoạt động. Node offline sẽ nhấp nháy đỏ rực, hiện cảnh báo "OFFLINE" và đổi màu luồng sáng của Edge kết nối.
* **Agentic Advisor (Shift-Left Guardrails)**: Sử dụng GraphRAG và LLM API để đánh giá tác động ngay khi chỉnh sửa file dở dang. Hiển thị thông báo Warning cảnh báo nếu thay đổi làm đứt gãy luồng kết nối của các microservices phụ thuộc.
* **LLM-Guided Packet Trace Simulation (Network Sandbox)**: Giả lập đường đi của request từ người dùng đến cơ sở dữ liệu trên canvas bằng các chấm sáng chuyển động. Sử dụng LLM phân tích cấu hình định tuyến (như proxy headers, firewall rules) để đưa ra dự đoán kết quả định tuyến ảo.
* **Kubernetes Manifest Parser**: Hỗ trợ phân tích cú pháp tĩnh YAML Kubernetes (Deployments, Services, StatefulSets) và tự động nhận diện phụ thuộc mạng.
* **Multilanguage Scanner**: Hỗ trợ quét mã nguồn Python, Java, C# để nhận diện logo và phân loại công nghệ.
* **Smart Edges (A\* Pathfinder & Spacing)**: Tích hợp thuật toán A\* để định tuyến đường đi bo vòng tránh các Node, tự động chuẩn hóa tọa độ tuyệt đối, hỗ trợ highlight khi di chuột (Hover Highlight) và làm mờ các kết nối không liên quan khi chọn Node (Focus Fading). Giãn rộng lưới bố cục (`colWidth = 360`, `rowHeight = 180`) để loại bỏ chồng lấn nhãn.

---

### IV. Tiêu chuẩn Đầu ra (Definition of Done)

* **Gọn nhẹ & Tốc độ:** Toàn bộ công cụ chạy ngầm không tiêu tốn quá 100MB RAM. Thời gian phân tích và cập nhật sơ đồ dưới 500ms (sau debounce).
* **Khả năng chịu lỗi:** Không làm sập ứng dụng hay mất sơ đồ khi cấu hình bị sai cú pháp. Hiển thị trạng thái lỗi trực quan trên UI.
* **Hỗ trợ đa IDE:** Đã kiểm thử và chạy thành công trên Antigravity IDE (thông qua MCP Server stdio), Cursor (qua MCP Server stdio), và VSCode/Kiro (thông qua File Watcher khi lưu file).
* **Tính năng Thông minh:** Tích hợp thành công bộ nhớ SQLite và so sánh tương đồng vector. Đạt tỷ lệ Cache Hit > 70% đối với các truy vấn trùng lặp của Agent và giảm trung bình 60% lượng token tiêu thụ cho mỗi phiên làm việc.
* **Đóng gói chuẩn DevOps:** Biên dịch chéo trực tiếp trên CI/CD sang các file binary cho Windows, macOS (Intel & Apple Silicon), và Linux không phụ thuộc vào bất cứ compiler C bên ngoài nào.