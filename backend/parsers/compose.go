package parsers

import (
	"fmt"
	"loomiss/domain"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type ComposeConfig struct {
	Services map[string]ComposeService `yaml:"services"`
}

type ComposeService struct {
	Image     string    `yaml:"image"`
	Ports     yaml.Node `yaml:"ports"`      // Nhận cả dạng list (80:80) và map nếu có
	DependsOn yaml.Node `yaml:"depends_on"` // Nhận cả dạng list string và map condition
}

// ParseDockerCompose phân tích cú pháp tệp docker-compose.yml
func ParseDockerCompose(filePath string) ([]domain.Node, []domain.Edge, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, nil, err
	}

	var config ComposeConfig
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal compose file: %w", err)
	}

	var nodes []domain.Node
	var edges []domain.Edge

	for name, service := range config.Services {
		// 1. Phân loại loại service (Gateway vs App vs Database/Cache)
		nodeType := "app"
		lowerName := strings.ToLower(name)
		lowerImage := strings.ToLower(service.Image)

		if isDatabase(lowerName, lowerImage) {
			nodeType = "database"
		} else if isGateway(lowerName, lowerImage) {
			nodeType = "gateway"
		}

		// 2. Trích xuất cổng ports
		ports := extractPorts(service.Ports)
		portsStr := strings.Join(ports, ", ")

		metadata := map[string]string{
			"image": service.Image,
			"ports": portsStr,
		}

		nodes = append(nodes, domain.Node{
			ID:       name,
			Label:    fmt.Sprintf("🐳 %s", name),
			Type:     nodeType,
			Status:   "active",
			Metadata: metadata,
			ParentID: "docker-compose-group",
		})

		// 3. Trích xuất dependencies (DependsOn)
		dependencies := extractDependsOn(service.DependsOn)
		for _, dep := range dependencies {
			edges = append(edges, domain.Edge{
				ID:     fmt.Sprintf("%s-%s", name, dep),
				Source: name,
				Target: dep,
				Label:  "Depends On",
			})
		}
	}

	if len(nodes) > 0 {
		nodes = append(nodes, domain.Node{
			ID:    "docker-compose-group",
			Label: "🐳 Docker Compose Stack",
			Type:  "group",
		})
	}

	return nodes, edges, nil
}

func isDatabase(name, image string) bool {
	dbKeywords := []string{"db", "postgres", "mysql", "mariadb", "mongo", "redis", "memcached", "sqlite", "cassandra", "elasticsearch"}
	for _, kw := range dbKeywords {
		if strings.Contains(name, kw) || strings.Contains(image, kw) {
			return true
		}
	}
	return false
}

func isGateway(name, image string) bool {
	gatewayKeywords := []string{"nginx", "gateway", "proxy", "caddy", "traefik", "kong", "envoy", "alb"}
	for _, kw := range gatewayKeywords {
		if strings.Contains(name, kw) || strings.Contains(image, kw) {
			return true
		}
	}
	return false
}

// extractPorts phân tích cổng từ yaml node
func extractPorts(node yaml.Node) []string {
	var ports []string
	if node.Kind == yaml.SequenceNode {
		for _, child := range node.Content {
			ports = append(ports, child.Value)
		}
	} else if node.Kind == yaml.ScalarNode {
		ports = append(ports, node.Value)
	}
	return ports
}

// extractDependsOn trích xuất tên dependencies từ yaml.Node của docker-compose
func extractDependsOn(node yaml.Node) []string {
	var deps []string
	if node.Kind == yaml.SequenceNode {
		// Dạng list: depends_on: [ db, cache ]
		for _, child := range node.Content {
			if child.Kind == yaml.ScalarNode {
				deps = append(deps, child.Value)
			}
		}
	} else if node.Kind == yaml.MappingNode {
		// Dạng map: depends_on: db: { condition: service_healthy }
		for i := 0; i < len(node.Content); i += 2 {
			if node.Content[i].Kind == yaml.ScalarNode {
				deps = append(deps, node.Content[i].Value)
			}
		}
	}
	return deps
}
