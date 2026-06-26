package parsers

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"loomiss/domain"
)

// AppLevelParser scans project for package.json, composer.json, go.mod and .env configurations
type AppLevelParser struct{}

func (p *AppLevelParser) Name() string { return "AppLevel" }

func (p *AppLevelParser) CanParse(workspacePath string) bool {
	found := false
	_ = filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if shouldSkipDir(path, info, workspacePath) {
				return filepath.SkipDir
			}
			if info.Name() == ".github" {
				workflowsPath := filepath.Join(path, "workflows")
				if subInfo, subErr := os.Stat(workflowsPath); subErr == nil && subInfo.IsDir() {
					found = true
					return filepath.SkipDir
				}
			}
			if strings.ToLower(info.Name()) == "grafana" {
				found = true
				return filepath.SkipDir
			}
			return nil
		}
		nameLower := strings.ToLower(info.Name())
		if info.Name() == "package.json" || info.Name() == "composer.json" || info.Name() == "go.mod" || info.Name() == "Jenkinsfile" || nameLower == "prometheus.yml" || nameLower == "prometheus.yaml" || nameLower == "grafana.ini" {
			found = true
			return filepath.SkipDir
		}
		return nil
	})
	return found
}

type PackageJSON struct {
	Name            string            `json:"name"`
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
	Scripts         map[string]string `json:"scripts"`
}

type ComposerJSON struct {
	Name    string            `json:"name"`
	Require map[string]string `json:"require"`
}

type DirContext struct {
	Path         string
	HasComposer  bool
	HasPackage   bool
	HasGoMod     bool
	EnvPath      string
	PackagePath  string
	ComposerPath string
	GoModPath    string
}

func (p *AppLevelParser) Parse(workspacePath string) ([]domain.Node, []domain.Edge, error) {
	var nodes []domain.Node
	var edges []domain.Edge

	var hasGithubActions bool
	var hasJenkins bool
	var hasPrometheus bool
	var hasGrafana bool

	// Map to collect context for each directory
	dirMap := make(map[string]*DirContext)

	err := filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		nameLower := strings.ToLower(info.Name())

		if info.IsDir() {
			if shouldSkipDir(path, info, workspacePath) {
				return filepath.SkipDir
			}
			if info.Name() == ".github" {
				workflowsPath := filepath.Join(path, "workflows")
				if subInfo, subErr := os.Stat(workflowsPath); subErr == nil && subInfo.IsDir() {
					hasGithubActions = true
				}
			}
			if nameLower == "grafana" {
				hasGrafana = true
			}
			return nil
		}

		if info.Name() == "Jenkinsfile" {
			hasJenkins = true
		}
		if nameLower == "prometheus.yml" || nameLower == "prometheus.yaml" {
			hasPrometheus = true
		}
		if nameLower == "grafana.ini" {
			hasGrafana = true
		}

		// Collect project configuration files
		dir := filepath.Dir(path)
		ctx, exists := dirMap[dir]
		if !exists {
			ctx = &DirContext{Path: dir}
			dirMap[dir] = ctx
		}

		if info.Name() == "composer.json" {
			ctx.HasComposer = true
			ctx.ComposerPath = path
		} else if info.Name() == "package.json" {
			ctx.HasPackage = true
			ctx.PackagePath = path
		} else if info.Name() == "go.mod" {
			ctx.HasGoMod = true
			ctx.GoModPath = path
		} else if strings.HasPrefix(info.Name(), ".env") {
			// Prioritize shorter env files (e.g. .env or .env.local over others)
			if ctx.EnvPath == "" || len(info.Name()) < len(filepath.Base(ctx.EnvPath)) {
				ctx.EnvPath = path
			}
		}

		return nil
	})

	// Process each directory context to create nodes and edges
	for dir, ctx := range dirMap {
		folderName := filepath.Base(dir)
		if folderName == "." || folderName == "/" || folderName == "" || folderName == filepath.Base(workspacePath) {
			folderName = "root"
		}

		// Prioritize Composer (PHP/Laravel) over package.json (Vite assets runner)
		if ctx.HasComposer {
			cNodes, cEdges := parseComposerJSON(ctx.ComposerPath, dir, folderName, ctx.EnvPath)
			nodes = append(nodes, cNodes...)
			edges = append(edges, cEdges...)
		} else if ctx.HasGoMod {
			gNodes, gEdges := parseGoMod(ctx.GoModPath, dir, folderName, ctx.EnvPath)
			nodes = append(nodes, gNodes...)
			edges = append(edges, gEdges...)
		} else if ctx.HasPackage {
			pNodes, pEdges := parsePackageJSON(ctx.PackagePath, dir, folderName, ctx.EnvPath)
			nodes = append(nodes, pNodes...)
			edges = append(edges, pEdges...)
		}
	}

	hasApps := false
	for _, n := range nodes {
		if n.Type != "group" {
			hasApps = true
			break
		}
	}

	if hasApps {
		nodes = append(nodes, domain.Node{
			ID:    "app-workspace-group",
			Label: "📦 Local Applications Tier",
			Type:  "group",
		})
	}

	if hasGithubActions || hasJenkins || hasPrometheus || hasGrafana {
		nodes = append(nodes, domain.Node{
			ID:    "devops-monitoring-group",
			Label: "🛠️ DevOps & Observability Tier",
			Type:  "group",
		})

		if hasGithubActions {
			nodes = append(nodes, domain.Node{
				ID:       "github-actions",
				Label:    "🐙 GitHub Actions CI/CD",
				Type:     "app",
				Status:   "active",
				ParentID: "devops-monitoring-group",
			})
		}
		if hasJenkins {
			nodes = append(nodes, domain.Node{
				ID:       "jenkins",
				Label:    "🧓 Jenkins Pipelines",
				Type:     "app",
				Status:   "active",
				ParentID: "devops-monitoring-group",
			})
		}
		if hasPrometheus {
			nodes = append(nodes, domain.Node{
				ID:       "prometheus",
				Label:    "🔥 Prometheus Server",
				Type:     "database",
				Status:   "active",
				Metadata: map[string]string{"ports": "9090"},
				ParentID: "devops-monitoring-group",
			})
		}
		if hasGrafana {
			nodes = append(nodes, domain.Node{
				ID:       "grafana",
				Label:    "📊 Grafana Dashboards",
				Type:     "app",
				Status:   "active",
				Metadata: map[string]string{"ports": "3000"},
				ParentID: "devops-monitoring-group",
			})
		}
	}

	// Add decoupling edges if both frontend and backend are found
	var hasFrontend bool
	var frontendID string
	var hasBackend bool
	var backendID string
	var soketiID string

	for _, n := range nodes {
		if n.Type == "app" {
			idLower := strings.ToLower(n.ID)
			labelLower := strings.ToLower(n.Label)
			if strings.Contains(idLower, "frontend") || strings.Contains(labelLower, "frontend") {
				hasFrontend = true
				frontendID = n.ID
			} else if idLower == "laravel" || idLower == "backend" || strings.Contains(labelLower, "backend") {
				hasBackend = true
				backendID = n.ID
			}
		}
		if strings.Contains(strings.ToLower(n.ID), "soketi") {
			soketiID = n.ID
		}
	}

	if hasFrontend && hasBackend {
		edges = append(edges, domain.Edge{
			ID:     fmt.Sprintf("%s-%s", frontendID, backendID),
			Source: frontendID,
			Target: backendID,
			Label:  "HTTP API",
		})
	}
	if hasFrontend && soketiID != "" {
		edges = append(edges, domain.Edge{
			ID:     fmt.Sprintf("%s-%s", frontendID, soketiID),
			Source: frontendID,
			Target: soketiID,
			Label:  "WebSockets",
		})
	}

	return nodes, edges, err
}

func parseComposerJSON(path, dir, folderName, envPath string) ([]domain.Node, []domain.Edge) {
	var nodes []domain.Node
	var edges []domain.Edge

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil
	}

	var comp ComposerJSON
	_ = json.Unmarshal(data, &comp)

	label := "🐘 PHP Backend"
	nodeType := "app"

	if comp.Require != nil {
		for req := range comp.Require {
			if tech := DetectTechnology(req); tech != nil {
				label = fmt.Sprintf("%s %s %s", tech.Emoji, tech.Name, GetReadableType(tech.Type))
				break
			}
		}
	}

	id := comp.Name
	if id == "" {
		id = folderName
	}
	if strings.Contains(id, "/") {
		parts := strings.Split(id, "/")
		id = parts[len(parts)-1]
	}

	var envMetadata map[string]string
	var envEdges []domain.Edge
	var envDBNodes []domain.Node
	if envPath != "" {
		envMetadata, envEdges, envDBNodes = parseEnvFileAtPath(envPath, id, "app-workspace-group")
	}

	metadata := map[string]string{
		"path": path,
	}
	for k, v := range envMetadata {
		metadata[k] = v
	}

	rrYaml := filepath.Join(dir, ".rr.yaml")
	if _, err := os.Stat(rrYaml); err == nil {
		metadata["server"] = "RoadRunner (Go)"
	}

	appNode := domain.Node{
		ID:       id,
		Label:    fmt.Sprintf("%s (%s)", label, id),
		Type:     nodeType,
		Status:   "active",
		Metadata: metadata,
		ParentID: "app-workspace-group",
	}

	nodes = append(nodes, appNode)
	nodes = append(nodes, envDBNodes...)
	edges = append(edges, envEdges...)

	return nodes, edges
}

func parsePackageJSON(path, dir, folderName, envPath string) ([]domain.Node, []domain.Edge) {
	var nodes []domain.Node
	var edges []domain.Edge

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil
	}

	var pkg PackageJSON
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, nil
	}

	label := "📦 Node.js App"
	nodeType := "app"

	foundTech := false
	for dep := range pkg.Dependencies {
		if tech := DetectTechnology(dep); tech != nil {
			label = fmt.Sprintf("%s %s %s", tech.Emoji, tech.Name, GetReadableType(tech.Type))
			foundTech = true
			break
		}
	}
	if !foundTech {
		for dep := range pkg.DevDependencies {
			if tech := DetectTechnology(dep); tech != nil {
				label = fmt.Sprintf("%s %s %s", tech.Emoji, tech.Name, GetReadableType(tech.Type))
				foundTech = true
				break
			}
		}
	}

	id := pkg.Name
	if id == "" {
		id = folderName
	}
	id = strings.ReplaceAll(id, "@", "")
	id = strings.ReplaceAll(id, "/", "-")

	var envMetadata map[string]string
	var envEdges []domain.Edge
	var envDBNodes []domain.Node
	if envPath != "" {
		envMetadata, envEdges, envDBNodes = parseEnvFileAtPath(envPath, id, "app-workspace-group")
	}

	metadata := map[string]string{
		"path": path,
	}
	for k, v := range envMetadata {
		metadata[k] = v
	}

	appNode := domain.Node{
		ID:       id,
		Label:    fmt.Sprintf("%s (%s)", label, id),
		Type:     nodeType,
		Status:   "active",
		Metadata: metadata,
		ParentID: "app-workspace-group",
	}

	nodes = append(nodes, appNode)
	nodes = append(nodes, envDBNodes...)
	edges = append(edges, envEdges...)

	return nodes, edges
}

func parseGoMod(path, dir, folderName, envPath string) ([]domain.Node, []domain.Edge) {
	var nodes []domain.Node
	var edges []domain.Edge

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil
	}

	content := string(data)
	lines := strings.Split(content, "\n")
	moduleName := folderName
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "module ") {
			moduleName = strings.TrimSpace(strings.TrimPrefix(line, "module "))
			parts := strings.Split(moduleName, "/")
			moduleName = parts[len(parts)-1]
			break
		}
	}

	id := moduleName
	if id == "" {
		id = folderName
	}

	var envMetadata map[string]string
	var envEdges []domain.Edge
	var envDBNodes []domain.Node
	if envPath != "" {
		envMetadata, envEdges, envDBNodes = parseEnvFileAtPath(envPath, id, "app-workspace-group")
	}

	metadata := map[string]string{
		"path": path,
	}
	for k, v := range envMetadata {
		metadata[k] = v
	}

	appNode := domain.Node{
		ID:       id,
		Label:    fmt.Sprintf("🐹 Go Backend (%s)", id),
		Type:     "app",
		Status:   "active",
		Metadata: metadata,
		ParentID: "app-workspace-group",
	}

	nodes = append(nodes, appNode)
	nodes = append(nodes, envDBNodes...)
	edges = append(edges, envEdges...)

	return nodes, edges
}

func parseEnvFileAtPath(envPath string, parentID string, parentGroupID string) (map[string]string, []domain.Edge, []domain.Node) {
	metadata := make(map[string]string)
	var edges []domain.Edge
	var nodes []domain.Node

	envData, err := os.ReadFile(envPath)
	if err != nil {
		return metadata, nil, nil
	}

	lines := strings.Split(string(envData), "\n")
	envMap := make(map[string]string)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			v = strings.Trim(v, `"'`)
			envMap[k] = v
		}
	}

	if port, ok := envMap["PORT"]; ok {
		metadata["ports"] = port
	} else if appUrl, ok := envMap["APP_URL"]; ok {
		if strings.Contains(appUrl, ":") {
			parts := strings.Split(appUrl, ":")
			last := parts[len(parts)-1]
			portVal := ""
			for _, char := range last {
				if char >= '0' && char <= '9' {
					portVal += string(char)
				}
			}
			if portVal != "" {
				metadata["ports"] = portVal
			}
		}
	}

	// 1. Detect Relational / Main Database
	mainDbType := ""
	mainDbHost := ""
	mainDbPort := ""
	mainDbName := ""

	// Check DB_CONNECTION directly first
	if conn, ok := envMap["DB_CONNECTION"]; ok {
		conn = strings.ToLower(conn)
		if conn == "pgsql" || conn == "postgres" || conn == "postgresql" {
			mainDbType = "postgres"
		} else if conn == "mysql" {
			mainDbType = "mysql"
		} else if conn == "sqlite" {
			mainDbType = "sqlite"
		} else if conn == "mongodb" || conn == "mongo" {
			mainDbType = "mongodb"
		}
	}

	// Fallback/additional database URL/URI checks
	if mainDbType == "" {
		if urlVal, ok := envMap["DATABASE_URL"]; ok {
			urlVal = strings.ToLower(urlVal)
			if strings.HasPrefix(urlVal, "postgres") || strings.HasPrefix(urlVal, "postgresql") {
				mainDbType = "postgres"
			} else if strings.HasPrefix(urlVal, "mysql") {
				mainDbType = "mysql"
			}
		} else if _, ok := envMap["MONGO_URI"]; ok {
			mainDbType = "mongodb"
		}
	}

	// Check environment keys for DB details
	for k, v := range envMap {
		kLower := strings.ToLower(k)
		if strings.Contains(kLower, "db_host") || strings.Contains(kLower, "database_host") {
			mainDbHost = v
		}
		if strings.Contains(kLower, "db_port") || strings.Contains(kLower, "database_port") {
			mainDbPort = v
		}
		if strings.Contains(kLower, "db_name") || strings.Contains(kLower, "database_name") || strings.Contains(kLower, "db_database") {
			mainDbName = v
		}

		// Fallback detection of main DB type from keys
		if mainDbType == "" {
			if strings.Contains(kLower, "postgres") || strings.Contains(kLower, "pg") {
				mainDbType = "postgres"
			} else if strings.Contains(kLower, "mysql") {
				mainDbType = "mysql"
			} else if strings.Contains(kLower, "mongo") {
				mainDbType = "mongodb"
			}
		}
	}

	// Default port for main DB types if not specified
	if mainDbPort == "" {
		switch mainDbType {
		case "postgres":
			mainDbPort = "5432"
		case "mysql":
			mainDbPort = "3306"
		case "mongodb":
			mainDbPort = "27017"
		}
	}

	// 2. Detect Redis Cache / Queue
	hasRedis := false
	redisHost := ""
	redisPort := ""

	for k, v := range envMap {
		kLower := strings.ToLower(k)
		if strings.Contains(kLower, "redis") {
			hasRedis = true
			if strings.Contains(kLower, "host") {
				redisHost = v
			} else if strings.Contains(kLower, "port") {
				redisPort = v
			}
		}
	}
	if _, ok := envMap["REDIS_URL"]; ok {
		hasRedis = true
	}
	if q, ok := envMap["QUEUE_CONNECTION"]; ok && strings.ToLower(q) == "redis" {
		hasRedis = true
	}
	if c, ok := envMap["CACHE_STORE"]; ok && strings.ToLower(c) == "redis" {
		hasRedis = true
	}

	if hasRedis {
		if redisHost == "" {
			redisHost = "redis"
		}
		if redisPort == "" {
			redisPort = "6379"
		}
	}

	// 3. Detect Soketi / WebSockets
	hasSoketi := false
	soketiHost := ""
	soketiPort := ""

	for k, v := range envMap {
		kLower := strings.ToLower(k)
		if strings.Contains(kLower, "pusher_host") || strings.Contains(kLower, "soketi_host") {
			hasSoketi = true
			soketiHost = v
		}
		if strings.Contains(kLower, "pusher_port") || strings.Contains(kLower, "soketi_port") {
			soketiPort = v
		}
	}
	if b, ok := envMap["BROADCAST_CONNECTION"]; ok && (strings.ToLower(b) == "pusher" || strings.ToLower(b) == "soketi") {
		hasSoketi = true
	}

	if hasSoketi {
		if soketiHost == "" {
			soketiHost = "soketi"
		}
		if soketiPort == "" {
			soketiPort = "6001"
		}
	}

	// Add main DB node and edge
	if mainDbType != "" {
		dbID := parentID + "-" + mainDbType
		dbLabel := ""
		switch mainDbType {
		case "postgres":
			dbLabel = "🐘 PostgreSQL DB"
		case "mysql":
			dbLabel = "🐬 MySQL DB"
		case "sqlite":
			dbLabel = "💾 SQLite DB"
		case "mongodb":
			dbLabel = "🍃 MongoDB"
		default:
			dbLabel = "🗄️ " + strings.Title(mainDbType) + " Database"
		}

		dbMetadata := map[string]string{
			"type": mainDbType,
		}
		if mainDbHost != "" {
			dbMetadata["host"] = mainDbHost
		}
		if mainDbPort != "" {
			dbMetadata["ports"] = mainDbPort
		}
		if mainDbName != "" {
			dbMetadata["database_name"] = mainDbName
		}

		nodes = append(nodes, domain.Node{
			ID:       dbID,
			Label:    dbLabel,
			Type:     "database",
			Status:   "active",
			Metadata: dbMetadata,
			ParentID: parentGroupID,
		})

		edgeLabel := "Connects"
		if mainDbPort != "" {
			edgeLabel = fmt.Sprintf("Connects (%s)", mainDbPort)
		}

		edges = append(edges, domain.Edge{
			ID:     fmt.Sprintf("%s-%s", parentID, dbID),
			Source: parentID,
			Target: dbID,
			Label:  edgeLabel,
		})
	}

	// Add Redis node and edge
	if hasRedis {
		redisID := parentID + "-redis"
		redisMetadata := map[string]string{
			"type": "redis",
		}
		if redisHost != "" {
			redisMetadata["host"] = redisHost
		}
		if redisPort != "" {
			redisMetadata["ports"] = redisPort
		}

		nodes = append(nodes, domain.Node{
			ID:       redisID,
			Label:    "❤️ Redis Cache",
			Type:     "database",
			Status:   "active",
			Metadata: redisMetadata,
			ParentID: parentGroupID,
		})

		edges = append(edges, domain.Edge{
			ID:     fmt.Sprintf("%s-%s", parentID, redisID),
			Source: parentID,
			Target: redisID,
			Label:  fmt.Sprintf("Connects (%s)", redisPort),
		})
	}

	// Add Soketi node and edge
	if hasSoketi {
		soketiID := parentID + "-soketi"
		soketiMetadata := map[string]string{
			"type": "soketi",
		}
		if soketiHost != "" {
			soketiMetadata["host"] = soketiHost
		}
		if soketiPort != "" {
			soketiMetadata["ports"] = soketiPort
		}

		nodes = append(nodes, domain.Node{
			ID:       soketiID,
			Label:    "📡 Soketi WebSockets",
			Type:     "app",
			Status:   "active",
			Metadata: soketiMetadata,
			ParentID: parentGroupID,
		})

		edges = append(edges, domain.Edge{
			ID:     fmt.Sprintf("%s-%s", parentID, soketiID),
			Source: parentID,
			Target: soketiID,
			Label:  fmt.Sprintf("Connects (%s)", soketiPort),
		})
	}

	return metadata, edges, nodes
}
