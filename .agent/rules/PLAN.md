# 🎯 PLAN.md — Loomiss 5-Phase Implementation Roadmap
> *Last updated: 2026-06-26 | Duration: 5 Weeks*

---

## 👥 Roles & Development Plan

- **Harness & Client Compatibility**: Support Antigravity IDE, Cursor, Windsurf, Cline (via stdio/SSE MCP), and VSCode/Kiro + GitHub Copilot (via File Watcher fallback).
- **Core Strategy**: Keep code modular. Backend handles OS events, parsing, and MCP. Frontend handles visualization, auto-layout, and premium micro-animations.

---

## 📅 IMPLEMENTATION STATUS & ROADMAP

### Phase 0: Plan Review & Feasibility Analysis (Completed)
- [x] Analyze `docs/plan.md` for potential architectural risks.
- [x] Create [docs/evaluation_report.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/evaluation_report.md) proposing Pure Go parsers, Dagre Auto-layout, IPC for MCP, and LKG mechanisms.
- [x] Merge optimizations back into [docs/plan.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/docs/plan.md).
- [x] Initialize Loomiss `.agent` context rules, skills, and workflows.

### Phase 1: Skeleton & Single Binary (Week 1)
- [ ] Initialize Vite + React frontend with Tailwind CSS and React Flow.
- [ ] Integrate `@reactflow/dagre` for automated node layout positioning.
- [ ] Setup basic Go backend HTTP server.
- [ ] Implement `go:embed` to package Vite static assets (`dist/`) directly inside the Go binary.
- [ ] **Verification**: Running `go run main.go` compiles correctly and starts the server, serving the static React UI.

### Phase 2: Pure Go Infrastructure Parsers (Week 2)
- [ ] Integrate `gopkg.in/yaml.v3` parser to parse `docker-compose.yml` configs.
- [ ] Integrate `github.com/hashicorp/hcl/v2` to parse Terraform configs.
- [ ] Write a basic Nginx config parser/lexer in pure Go.
- [ ] Build a unified Graph Schema (JSON) containing Nodes (Service, DB, Gateway, ALB) and Edges (port connections, routing pathways).
- [ ] **Verification**: Run parsers against real-world configs (like a mock Sneaker World app) and verify correct graph schema generation.

### Phase 3: Realtime Engine & Animations (Week 3)
- [ ] Implement local File Watcher (`fsnotify`) to detect file changes in the workspace.
- [ ] Code a Go channel debounce mechanism (1.5s delay) to avoid multiple parses while typing.
- [ ] Setup WebSocket server in Go and client in React Flow for real-time synchronization.
- [ ] Add CSS Tailwind pulsing lines (`stroke-dasharray` animations) and ripple circles for modified nodes.
- [ ] Implement the LKG (Last Known Good) fallback state when parser encounters syntax errors.
- [ ] **Verification**: Editing a docker-compose port maps updates the React Flow graph in real-time.

### Phase 4: MCP Server & Multi-IDE Harness (Week 4)
- [ ] Implement Go MCP server handler using stdio/SSE.
- [ ] Create a local HTTP endpoint (`POST /api/agent-activity`) in the Go daemon for IPC.
- [ ] Implement MCP tools allowing AI Agents to fetch current architecture schema and report intent.
- [ ] Configure and test the MCP connection inside **Antigravity IDE** and Cursor settings.
- [ ] Verify VSCode + GitHub Copilot fallback updates the UI successfully upon file saves.
- [ ] **Verification**: Issuing natural language commands to the AI Agent modifies the visualizer graph in real-time.

### Phase 5: Semantic Caching & Persistent Memory (Week 5 - Advanced)
- [ ] Setup local CGO-free SQLite DB using `modernc.org/sqlite`.
- [ ] Implement Cosine Similarity vector indexing algorithm in pure Go.
- [ ] Integrate Gemini Embedding API to embed prompts and architectural facts.
- [ ] Add MCP Memory tools (`get_architectural_memory`, `add_architectural_memory`) to retrieve/store facts.
- [ ] Build a middleware in MCP server that intercepts requests and checks `prompt_cache` for hits.
- [ ] **Verification**: Sending semantic duplicate queries fetches instantly from cache, avoiding downstream parser/LLM execution and saving 60%+ tokens.