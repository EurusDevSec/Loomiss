---
name: save_checkpoint
description: Compress current session memory, optimize token footprint, and output a high-fidelity context handover state for a fresh chat session.
---

# 💾 Skill: Context Checkpointing & Memory Compaction

Khi cuộc trò chuyện kéo dài, bộ nhớ ngữ cảnh (Context Window) sẽ bị phình to dẫn đến **tăng độ trễ, lãng phí token và gây ảo giác (hallucination)** cho Agent. Skill này giúp đóng gói toàn bộ "tinh túy" (Core Context) của phiên hiện tại vào file lưu trữ để phiên sau có thể tiếp nhận ngay lập tức với chi phí token tối thiểu.

---

## 🛠️ Quy trình thực hiện (Step-by-Step)

Mỗi khi người dùng yêu cầu lưu checkpoint (`save_checkpoint`), bạn phải thực hiện các bước sau:

### Bước 1: Tổng hợp & Nén ngữ cảnh vào `session_memory.md`
Cập nhật file [session_memory.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/.agent/workflows/session_memory.md) theo mẫu nén tối ưu:

```markdown
# 💾 SESSION MEMORY — Loomiss Project
> Last Checkpoint: [YYYY-MM-DD] | Status: [Tóm tắt ngắn gọn trạng thái]

---

## ⚡ Active Tasks Completed (Những việc ĐÃ HOÀN THÀNH trong session)
*   **[Component / Module]:**
    *   Mô tả chi tiết giải pháp kỹ thuật đã làm.
    *   Đường dẫn cụ thể đến các file mới/file sửa đổi để agent sau đọc trực tiếp.

## 🧠 Semantic Context Essence (Tinh túy kiến thức & Quyết định thiết kế)
*   *Lưu lại lý do tại sao làm vậy để tránh Agent sau đổi ngược lại:*
    *   **Quyết định A:** Tại sao lại chọn parser này?
    *   **Cơ chế WebSockets:** Thiết kế kết nối và đồng bộ.

## 🔜 Next Steps (3 hành động kỹ thuật trực tiếp kế tiếp)
- [ ] **Step 1:** [Hành động cụ thể 1]
- [ ] **Step 2:** [Hành động cụ thể 2]
- [ ] **Step 3:** [Hành động cụ thể 3]
```

### Bước 2: Đồng bộ hóa kế hoạch tổng thể
1. Cập nhật các ô tích chọn (`[x]`) cho các tác vụ đã hoàn thành trong file [PLAN.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/.agent/rules/PLAN.md).
2. Nếu có thay đổi về hạ tầng hay tính năng, cập nhật trực tiếp vào [CONTEXT.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/.agent/rules/CONTEXT.md).

### Bước 3: Dọn dẹp & Xác thực
1. Kiểm tra code đảm bảo biên dịch thành công (`go build` backend và build frontend).
2. Commit toàn bộ thay đổi còn lại vào Git.

### Bước 4: Tạo "Handover Prompt" cho người dùng
Xuất ra màn hình một đoạn Prompt ngắn gọn để người dùng sao chép (copy) và dán (paste) khi mở phiên chat mới. Định dạng mẫu:

> **📋 [Handover Prompt cho Session mới]**
> *"Tôi muốn bắt đầu một session mới. Vui lòng đọc file [session_memory.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/.agent/workflows/session_memory.md), [CONTEXT.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/.agent/rules/CONTEXT.md) và [PLAN.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/.agent/rules/PLAN.md) để nắm toàn bộ kiến thức và tiếp tục triển khai các bước tiếp theo trong mục Next Steps."*
