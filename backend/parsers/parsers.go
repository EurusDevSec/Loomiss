package parsers

import (
	"os"
	"path/filepath"
	"strings"
	"loomiss/domain"
)

// shouldSkipDir checks if a directory should be skipped during walk
func shouldSkipDir(path string, info os.FileInfo, workspacePath string) bool {
	if !info.IsDir() {
		return false
	}
	cleanPath := filepath.Clean(path)
	cleanWorkspace := filepath.Clean(workspacePath)
	if cleanPath == cleanWorkspace {
		return false
	}
	name := info.Name()
	return strings.HasPrefix(name, ".") || name == "node_modules" || name == "dist" || name == "bin"
}

// DockerComposeParser wraps ParseDockerCompose
type DockerComposeParser struct{}

func (p *DockerComposeParser) Name() string { return "DockerCompose" }

func (p *DockerComposeParser) CanParse(workspacePath string) bool {
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
		if filename == "docker-compose.yml" || filename == "docker-compose.yaml" {
			found = true
			return filepath.SkipDir // found one, stop walking
		}
		return nil
	})
	return found
}

func (p *DockerComposeParser) Parse(workspacePath string) ([]domain.Node, []domain.Edge, error) {
	var nodes []domain.Node
	var edges []domain.Edge

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
		if filename == "docker-compose.yml" || filename == "docker-compose.yaml" {
			n, e, err := ParseDockerCompose(path)
			if err == nil {
				nodes = append(nodes, n...)
				edges = append(edges, e...)
			}
		}
		return nil
	})
	return nodes, edges, err
}

// NginxParser wraps ParseNginxConfig
type NginxParser struct{}

func (p *NginxParser) Name() string { return "Nginx" }

func (p *NginxParser) CanParse(workspacePath string) bool {
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
		if filename == "nginx.conf" || (strings.Contains(filename, "nginx") && strings.HasSuffix(filename, ".conf")) {
			found = true
			return filepath.SkipDir
		}
		return nil
	})
	return found
}

func (p *NginxParser) Parse(workspacePath string) ([]domain.Node, []domain.Edge, error) {
	var nodes []domain.Node
	var edges []domain.Edge

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
		if filename == "nginx.conf" || (strings.Contains(filename, "nginx") && strings.HasSuffix(filename, ".conf")) {
			n, e, err := ParseNginxConfig(path)
			if err == nil {
				nodes = append(nodes, n...)
				edges = append(edges, e...)
			}
		}
		return nil
	})
	return nodes, edges, err
}

// TerraformParser wraps ParseTerraformDirectory
type TerraformParser struct{}

func (p *TerraformParser) Name() string { return "Terraform" }

func (p *TerraformParser) CanParse(workspacePath string) bool {
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
		if strings.HasSuffix(strings.ToLower(info.Name()), ".tf") {
			found = true
			return filepath.SkipDir
		}
		return nil
	})
	return found
}

func (p *TerraformParser) Parse(workspacePath string) ([]domain.Node, []domain.Edge, error) {
	var nodes []domain.Node
	var edges []domain.Edge

	err := filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if shouldSkipDir(path, info, workspacePath) {
				return filepath.SkipDir
			}
			tfNodes, tfEdges, err := ParseTerraformDirectory(path)
			if err == nil && len(tfNodes) > 0 {
				nodes = append(nodes, tfNodes...)
				edges = append(edges, tfEdges...)
			}
		}
		return nil
	})
	return nodes, edges, err
}

// GetDefaultParsers returns the list of active configuration parser engines
func GetDefaultParsers() []domain.ConfigParser {
	return []domain.ConfigParser{
		&DockerComposeParser{},
		&NginxParser{},
		&TerraformParser{},
		&AppLevelParser{},
	}
}
