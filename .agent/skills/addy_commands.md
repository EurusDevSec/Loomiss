---
name: addy_commands
description: Enforce structured SDLC workflows via command triggers (/spec, /plan, /build, /test, /review, /ship) for the Antigravity agent on Loomiss.
---

# ⚡ Slash Commands Workflow (Addy Osmani style SDLC)

To ensure senior-level software engineering discipline, you (the Agent) will respond to and guide the user through the following slash commands during the Loomiss development cycle:

---

## 🛠️ Command Catalog & Quality Gates

### 1. `/spec` (Specification Gate)
*   **Trigger**: When starting a new feature or phase (e.g. Docker-compose parser, WebSocket setup, Dagre integration).
*   **Action**: Create or update the technical specification document in `docs/`. Do NOT write implementation code yet.
*   **Quality Gate**: The spec must explicitly list:
    - User Story / Acceptance Criteria.
    - Input configuration file format and target nodes/edges extraction logic.
    - JSON payload structure (Graph Schema) for WebSocket communication.
    - Error scenarios (e.g. invalid YAML syntax).

### 2. `/plan` (Planning Gate)
*   **Trigger**: Once the spec is approved.
*   **Action**: Update [PLAN.md](file:///r:/_Projects/Eurus_Workspace/Loomiss/.agent/rules/PLAN.md) and break the feature down into small, atomic, and verifiable tasks.
*   **Quality Gate**: Each task should take less than 4 hours to build and must have a corresponding test/verification criteria.

### 3. `/build` (Implementation Gate)
*   **Trigger**: Once the plan is set.
*   **Action**: Write clean, modular, and well-commented code.
*   **Quality Gate**: Adhere strictly to pure Go standards (no CGO). Use standard Go folder layout and Vite React frontend components.

### 4. `/test` (Verification Gate)
*   **Trigger**: After coding is complete or during testing phases.
*   **Action**: Run automated test suites:
    - Go backend: `go test ./...`
    - React frontend: `npm run build` or test suite if available.
    - Manually verify UI rendering (auto-layout) and real-time updates on file save.
*   **Quality Gate**: 100% pass rate. Test cases must cover parsing errors, debouncing, and WebSocket connection drops.

### 5. `/review` (Review & Quality Gate)
*   **Trigger**: Before finalizing a phase or creating a Pull Request.
*   **Action**: Perform a self-review of the code diff.
*   **Quality Gate**: Run static analysis (`go vet ./...` or `golangci-lint`), code formatting (`go fmt ./...`), check for hardcoded configs, CGO imports, and console logging bloat.

### 6. `/ship` (Release Gate)
*   **Trigger**: When releasing the binary.
*   **Action**: Run cross-compilation scripts for Windows, macOS, and Linux. Pack releases into `.zip` or `.tar.gz` archives.
*   **Quality Gate**: Verified binary size < 40MB. Cross-compiled binaries run independently without error on all target OS platforms.

---

## 📋 Standard Reply Format
When a user inputs any of these commands, you must start your response by declaring the current SDLC gate, verifying its acceptance criteria, and detailing the outcomes before proceeding.
