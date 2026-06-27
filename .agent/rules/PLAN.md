# 🎯 PLAN.md — Loomiss Implementation Roadmap
> *Last updated: 2026-06-27 | Status: Phases 1-7 Fully Completed*

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

### Phase 1: Skeleton & Single Binary (Completed)
- [x] Initialize Vite + React frontend with Tailwind CSS and React Flow.
- [x] Integrate `@reactflow/dagre` for automated node layout positioning.
- [x] Setup basic Go backend HTTP server.
- [x] Implement `go:embed` to package Vite static assets (`dist/`) directly inside the Go binary.
- [x] **Verification**: Running `go run main.go` compiles correctly and starts the server, serving the static React UI.

### Phase 2: Pure Go Infrastructure Parsers (Completed)
- [x] Integrate `gopkg.in/yaml.v3` parser to parse `docker-compose.yml` configs.
- [x] Integrate `github.com/hashicorp/hcl/v2` to parse Terraform configs.
- [x] Write a basic Nginx config parser/lexer in pure Go.
- [x] Build a unified Graph Schema (JSON) containing Nodes (Service, DB, Gateway, ALB) and Edges (port connections, routing pathways).
- [x] **Verification**: Run parsers against real-world configs (like a mock Sneaker World app) and verify correct graph schema generation.

### Phase 3: Realtime Engine & Animations (Completed)
- [x] Implement local File Watcher (`fsnotify`) to detect file changes in the workspace.
- [x] Code a Go channel debounce mechanism (1.5s delay) to avoid multiple parses while typing.
- [x] Setup WebSocket server in Go and client in React Flow for real-time synchronization.
- [x] Add CSS Tailwind pulsing lines (`stroke-dasharray` animations) and ripple circles for modified nodes.
- [x] Implement the LKG (Last Known Good) fallback state when parser encounters syntax errors.
- [x] **Verification**: Editing a docker-compose port maps updates the React Flow graph in real-time.

### Phase 4: MCP Server & Multi-IDE Harness (Completed)
- [x] Implement Go MCP server handler using stdio/SSE.
- [x] Create a local HTTP endpoint (`POST /api/agent-activity`) in the Go daemon for IPC.
- [x] Implement MCP tools allowing AI Agents to fetch current architecture schema and report intent.
- [x] Configure and test the MCP connection inside **Antigravity IDE** and Cursor settings.
- [x] Verify VSCode + GitHub Copilot fallback updates the UI successfully upon file saves.
- [x] **Verification**: Issuing natural language commands to the AI Agent modifies the visualizer graph in real-time.

### Phase 5: Semantic Caching & Persistent Memory (Completed)
- [x] Setup local CGO-free SQLite DB using `modernc.org/sqlite`.
- [x] Implement Cosine Similarity vector indexing algorithm in pure Go.
- [x] Integrate Gemini Embedding API to embed prompts and architectural facts.
- [x] Add MCP Memory tools (`get_architectural_memory`, `add_architectural_memory`) to retrieve/store facts.
- [x] Build a middleware in MCP server that intercepts requests and checks `prompt_cache` for hits.
- [x] **Verification**: Sending semantic duplicate queries fetches instantly from cache, avoiding downstream parser/LLM execution and saving 60%+ tokens.

### Phase 6: Infrastructure Digital Twin & Shift-Left Guardrails (Completed)
- [x] **Time Travel Slider (Git History)**: Slide back through Git history using `git show` to rebuild architecture at previous commits.
- [x] **Live-Shadow Observability (TCP/HTTP Probing)**: Background Goroutine pings exposed ports, rendering offline nodes in pulsing red and updating traffic routes.
- **Advanced Graph Resolution & Layout Improvements**:
  - [x] **Kubernetes YAML manifest parsing**: Added native Go scanner decoding multi-document deployments/services.
  - [x] **Multilanguage technology scan**: Parsed requirements.txt, pyproject.toml, pom.xml, gradle, .csproj to display language icons (Go, Node.js, Python, Java, C#) with AWS/Java CDN Devicon fallbacks.
  - [x] **Smart A* Edge Routing**: Integrated `@jalez/react-flow-smart-edge` to draw obstacle-avoiding connections.
  - [x] **Absolute Coordinate Normalization**: Recursively added parent node coordinates to map child elements correctly on the absolute canvas.
  - [x] **Interactive Hover Highlight**: Glowing Neon Cyan color and enlarged flow speed when hovering over connections.
  - [x] **Selected-Node Focus Fading**: Clicked nodes keep 100% path opacity while fading unrelated edges to 15% opacity.
  - [x] **Expanded Layout Spacing**: Increased horizontal/vertical spacing (`colWidth = 360`, `rowHeight = 180`) to ensure 120px gap for "Depends On" labels.

### Phase 7: Advanced Agentic AI Copilot & Generative UI (Completed)
- [x] Structured Output: Configuration audit schemas mapped directly to visual alerts on the canvas.
- [x] Local RAG Memory: SQLite indexing logs and facts with vector search.
- [x] Agentic Tool Use: Enable config writing/patching and docker command runners.