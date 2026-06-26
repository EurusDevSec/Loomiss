# 🛑 Anti-Rationalization Guardrails for Antigravity Agent (Loomiss)
> *Adapted to enforce production-grade discipline for Go-based single binary visualizers.*

AI coding agents often fail not due to coding ability, but due to **cognitive shortcutting (rationalization)**—skipping critical planning, testing, multi-platform verification, or robust error handling. 

This document lists the common excuses you (the Agent) might make during this Loomiss development sprint, and the strict realities/quality gates you must follow instead.

---

## 🛡️ Architecture & CGO Rationalizations

| Rationalization (The Agent's Excuse) | Reality (The Corrective Engineering Standard) |
| :--- | :--- |
| *"I will use `go-tree-sitter` just for now to parse because it is easy, and remove CGO dependencies later."* | **Strictly Forbidden.** Introducing CGO even temporarily breaks the zero-config cross-compilation target. Once you import a CGO package, Windows users without gcc will fail to compile. All parsers must be pure Go (`yaml.v3` for yaml, `hcl/v2` for HCL) from the start. |
| *"The single binary with `go:embed` is hard to debug during development, so I will write separate code paths for local development and build mode."* | **No.** Maintain a unified code path. Use Go's `http.FS` and `os.DirFS` to swap the files dynamically based on a `--dev` command-line flag. This ensures the exact same asset loading logic is tested. |
| *"I don't need to test cross-compilation since Go handles it automatically."* | **Incorrect.** Some files, path structures, or libraries behave differently under Windows vs. Linux/macOS (e.g. file watchers and slash/backslash pathing). Periodically test builds on target architectures using `GOOS` and `GOARCH` environments. |

---

## 💻 Visualizer & Web UI Rationalizations

| Rationalization (The Agent's Excuse) | Reality (The Corrective Engineering Standard) |
| :--- | :--- |
| *"I'll let the user arrange the nodes manually because writing auto-layout logic is complex."* | **Forbidden.** A real-time visualizer that drops all services at coordinates (0,0) is unusable. You must integrate a layout engine (like Dagre) to compute coordinates programmatically before rendering. |
| *"When a config file has syntax errors, I'll just clear the screen or print the parse error."* | **No.** A flickering UI that whites out whenever the user type-saves a half-written file is extremely annoying. You must implement the **LKG (Last Known Good)** fallback: retain the last valid graph state, show a warning, and debounce file changes by `1500ms`. |
| *"The rendering loop is fine, we don't need to worry about React Flow performance."* | **Incorrect.** React Flow can cause infinite re-render loops if node/edge states are updated incorrectly in `useEffect`. Always memoize custom node components and use functional state updates. |

---

## 👥 MCP Server & Multi-IDE Rationalizations

| Rationalization (The Agent's Excuse) | Reality (The Corrective Engineering Standard) |
| :--- | :--- |
| *"Testing the MCP server only in Cursor is enough since MCP is standard."* | **Incorrect.** Different IDE clients (Antigravity IDE, Cursor, Windsurf, Cline) spin up subprocesses differently and handle standard input/output with slight buffering differences. Test stdio MCP in at least **Antigravity IDE** and Cursor. |
| *"Since VSCode with GitHub Copilot doesn't support MCP, we can ignore VSCode users."* | **Forbidden.** You must ensure VSCode compatibility via the **File Watcher (`fsnotify`) fallback**. Any edit and save in VSCode must trigger the daemon watcher to parse and push updates to the browser. |
