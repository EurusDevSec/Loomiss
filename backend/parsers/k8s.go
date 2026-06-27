package parsers

import (
	"fmt"
	"loomiss/domain"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// K8sHeader trích xuất thông tin loại tài nguyên Kubernetes
type K8sHeader struct {
	ApiVersion string `yaml:"apiVersion"`
	Kind       string `yaml:"kind"`
}

// K8sDeployment đại diện cho apps/v1 Deployment
type K8sDeployment struct {
	Metadata struct {
		Name   string            `yaml:"name"`
		Labels map[string]string `yaml:"labels"`
	} `yaml:"metadata"`
	Spec struct {
		Template struct {
			Metadata struct {
				Labels map[string]string `yaml:"labels"`
			} `yaml:"metadata"`
			Spec struct {
				Containers []struct {
					Name  string `yaml:"name"`
					Image string `yaml:"image"`
					Ports []struct {
						ContainerPort int `yaml:"containerPort"`
					} `yaml:"ports"`
					Env []struct {
						Name  string `yaml:"name"`
						Value string `yaml:"value"`
					} `yaml:"env"`
				} `yaml:"containers"`
			} `yaml:"spec"`
		} `yaml:"template"`
	} `yaml:"spec"`
}

// K8sService đại diện cho v1 Service
type K8sService struct {
	Metadata struct {
		Name   string            `yaml:"name"`
		Labels map[string]string `yaml:"labels"`
	} `yaml:"metadata"`
	Spec struct {
		Ports []struct {
			Port       int       `yaml:"port"`
			TargetPort yaml.Node `yaml:"targetPort"`
		} `yaml:"ports"`
		Selector map[string]string `yaml:"selector"`
	} `yaml:"spec"`
}

type KubernetesParser struct{}

func (p *KubernetesParser) Name() string { return "Kubernetes" }

func (p *KubernetesParser) CanParse(workspacePath string) bool {
	found := false
	_ = filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if shouldSkipDir(path, info, workspacePath) {
				return filepath.SkipDir
			}
			return nil
		}
		filename := strings.ToLower(info.Name())
		if strings.HasSuffix(filename, ".yaml") || strings.HasSuffix(filename, ".yml") {
			if filename == "docker-compose.yml" || filename == "docker-compose.yaml" {
				return nil
			}
			data, err := os.ReadFile(path)
			if err == nil {
				content := string(data)
				if strings.Contains(content, "apiVersion:") && strings.Contains(content, "kind:") {
					found = true
					return filepath.SkipDir
				}
			}
		}
		return nil
	})
	return found
}

func (p *KubernetesParser) Parse(workspacePath string) ([]domain.Node, []domain.Edge, error) {
	var nodes []domain.Node
	var edges []domain.Edge

	deployments := make(map[string]*K8sDeployment)
	services := make(map[string]*K8sService)

	err := filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if shouldSkipDir(path, info, workspacePath) {
				return filepath.SkipDir
			}
			return nil
		}
		filename := strings.ToLower(info.Name())
		if strings.HasSuffix(filename, ".yaml") || strings.HasSuffix(filename, ".yml") {
			if filename == "docker-compose.yml" || filename == "docker-compose.yaml" {
				return nil
			}

			data, err := os.ReadFile(path)
			if err != nil {
				return nil
			}

			docs := strings.Split(string(data), "\n---")
			for _, doc := range docs {
				doc = strings.TrimSpace(doc)
				if doc == "" {
					continue
				}

				// 1. Phân loại loại cấu hình
				var header K8sHeader
				if err := yaml.Unmarshal([]byte(doc), &header); err == nil {
					if header.Kind == "Deployment" || header.Kind == "StatefulSet" {
						var deploy K8sDeployment
						if err := yaml.Unmarshal([]byte(doc), &deploy); err == nil && deploy.Metadata.Name != "" {
							deployments[deploy.Metadata.Name] = &deploy
						}
					} else if header.Kind == "Service" {
						var svc K8sService
						if err := yaml.Unmarshal([]byte(doc), &svc); err == nil && svc.Metadata.Name != "" {
							services[svc.Metadata.Name] = &svc
						}
					}
				}
			}
		}
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	for name, deploy := range deployments {
		nodeType := "app"
		lowerName := strings.ToLower(name)

		var image string
		var ports []string
		var envValues []string

		if len(deploy.Spec.Template.Spec.Containers) > 0 {
			container := deploy.Spec.Template.Spec.Containers[0]
			image = container.Image
			lowerImage := strings.ToLower(image)

			tech := DetectTechnology(name)
			if tech == nil {
				tech = DetectTechnology(image)
			}

			if tech != nil {
				if tech.Type == "database" || tech.Type == "gateway" {
					nodeType = tech.Type
				}
			} else {
				if isDatabase(lowerName, lowerImage) {
					nodeType = "database"
				} else if isGateway(lowerName, lowerImage) {
					nodeType = "gateway"
				}
			}

			for _, p := range container.Ports {
				ports = append(ports, fmt.Sprintf("%d", p.ContainerPort))
			}

			for _, env := range container.Env {
				valTrim := strings.Trim(strings.TrimSpace(env.Value), `"'`)
				if valTrim != "" {
					envValues = append(envValues, valTrim)
				}
			}
		}

		metadata := map[string]string{
			"image":      image,
			"ports":      strings.Join(ports, ", "),
			"env_values": strings.Join(envValues, ","),
		}

		nodes = append(nodes, domain.Node{
			ID:       name,
			Label:    fmt.Sprintf("☸️ %s", name),
			Type:     nodeType,
			Status:   "active",
			Metadata: metadata,
			ParentID: "kubernetes-group",
		})

		for _, envVal := range envValues {
			cleanVal := envVal
			if strings.Contains(cleanVal, ":") {
				parts := strings.Split(cleanVal, ":")
				cleanVal = parts[0]
			}
			cleanVal = strings.TrimSpace(cleanVal)

			if _, exists := deployments[cleanVal]; exists && cleanVal != name {
				edges = append(edges, domain.Edge{
					ID:     fmt.Sprintf("%s-%s", name, cleanVal),
					Source: name,
					Target: cleanVal,
					Label:  "Depends On",
				})
			}
		}
	}

	if len(nodes) > 0 {
		nodes = append(nodes, domain.Node{
			ID:    "kubernetes-group",
			Label: "☸️ Kubernetes Cluster",
			Type:  "group",
		})
	}

	return nodes, edges, nil
}
