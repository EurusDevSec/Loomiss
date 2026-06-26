package parsers

import (
	"strings"
)

type TechDefinition struct {
	ID      string
	Name    string
	Type    string // "frontend", "backend", "database", "gateway", "queue", "cloud", "observability", "app"
	Emoji   string
	Matches []string
}

var TechRegistry = []TechDefinition{
	// Frontends
	{ID: "nextdotjs", Name: "Next.js", Type: "frontend", Emoji: "⚡", Matches: []string{"next", "nextjs", "next.js"}},
	{ID: "react", Name: "React", Type: "frontend", Emoji: "⚛️", Matches: []string{"react"}},
	{ID: "vuedotjs", Name: "Vue", Type: "frontend", Emoji: "💚", Matches: []string{"vue", "vue.js", "vuedotjs"}},
	{ID: "svelte", Name: "Svelte", Type: "frontend", Emoji: "🧡", Matches: []string{"svelte"}},
	{ID: "angular", Name: "Angular", Type: "frontend", Emoji: "🅰️", Matches: []string{"angular"}},
	{ID: "nuxtdotjs", Name: "Nuxt", Type: "frontend", Emoji: "💚", Matches: []string{"nuxt"}},

	// Backends
	{ID: "go", Name: "Go", Type: "backend", Emoji: "🐹", Matches: []string{"go", "golang"}},
	{ID: "laravel", Name: "Laravel", Type: "backend", Emoji: "🐘", Matches: []string{"laravel"}},
	{ID: "symfony", Name: "Symfony", Type: "backend", Emoji: "🎼", Matches: []string{"symfony"}},
	{ID: "express", Name: "Express", Type: "backend", Emoji: "🟢", Matches: []string{"express"}},
	{ID: "nestjs", Name: "NestJS", Type: "backend", Emoji: "🔴", Matches: []string{"nest"}},
	{ID: "nodedotjs", Name: "Node.js", Type: "backend", Emoji: "📦", Matches: []string{"node", "nodejs"}},
	{ID: "springboot", Name: "Spring Boot", Type: "backend", Emoji: "🍃", Matches: []string{"spring", "springboot"}},
	{ID: "django", Name: "Django", Type: "backend", Emoji: "💚", Matches: []string{"django"}},
	{ID: "fastapi", Name: "FastAPI", Type: "backend", Emoji: "⚡", Matches: []string{"fastapi"}},
	{ID: "flask", Name: "Flask", Type: "backend", Emoji: "🧪", Matches: []string{"flask"}},
	{ID: "rubyonrails", Name: "Ruby on Rails", Type: "backend", Emoji: "💎", Matches: []string{"rails", "rubyonrails"}},

	// Databases / Caches
	{ID: "postgresql", Name: "PostgreSQL", Type: "database", Emoji: "🐘", Matches: []string{"postgres", "pgsql", "postgresql"}},
	{ID: "mysql", Name: "MySQL", Type: "database", Emoji: "🐬", Matches: []string{"mysql"}},
	{ID: "sqlite", Name: "SQLite", Type: "database", Emoji: "💾", Matches: []string{"sqlite"}},
	{ID: "mongodb", Name: "MongoDB", Type: "database", Emoji: "🍃", Matches: []string{"mongo", "mongodb"}},
	{ID: "redis", Name: "Redis", Type: "database", Emoji: "❤️", Matches: []string{"redis"}},
	{ID: "mariadb", Name: "MariaDB", Type: "database", Emoji: "🦭", Matches: []string{"mariadb"}},
	{ID: "cassandra", Name: "Cassandra", Type: "database", Emoji: "👁️", Matches: []string{"cassandra"}},
	{ID: "elasticsearch", Name: "Elasticsearch", Type: "database", Emoji: "🔍", Matches: []string{"elasticsearch", "elastic"}},
	{ID: "dynamodb", Name: "DynamoDB", Type: "database", Emoji: "⚡", Matches: []string{"dynamodb"}},

	// Queues / Message Brokers
	{ID: "rabbitmq", Name: "RabbitMQ", Type: "queue", Emoji: "🐇", Matches: []string{"rabbitmq"}},
	{ID: "apachekafka", Name: "Kafka", Type: "queue", Emoji: "🫘", Matches: []string{"kafka"}},

	// Gateways / Proxies / Load Balancers
	{ID: "nginx", Name: "Nginx", Type: "gateway", Emoji: "🟢", Matches: []string{"nginx"}},
	{ID: "caddy", Name: "Caddy", Type: "gateway", Emoji: "🦆", Matches: []string{"caddy"}},
	{ID: "traefik", Name: "Traefik", Type: "gateway", Emoji: "🚦", Matches: []string{"traefik"}},
	{ID: "kong", Name: "Kong", Type: "gateway", Emoji: "🦍", Matches: []string{"kong"}},
	{ID: "amazonelasticloadbalancing", Name: "ALB", Type: "gateway", Emoji: "⚖️", Matches: []string{"alb", "elb", "loadbalancer"}},

	// Cloud / Infrastructure / DevOps
	{ID: "terraform", Name: "Terraform", Type: "cloud", Emoji: "☁️", Matches: []string{"terraform"}},
	{ID: "kubernetes", Name: "Kubernetes", Type: "cloud", Emoji: "☸️", Matches: []string{"kubernetes", "k8s"}},
	{ID: "docker", Name: "Docker", Type: "cloud", Emoji: "🐳", Matches: []string{"docker"}},
	{ID: "amazonroute53", Name: "Route 53", Type: "cloud", Emoji: "🌐", Matches: []string{"route53", "route 53", "dns"}},
	{ID: "amazonwaf", Name: "AWS WAF", Type: "cloud", Emoji: "🛡️", Matches: []string{"waf", "aws-waf"}},
	{ID: "amazonwebservices", Name: "AWS", Type: "cloud", Emoji: "☁️", Matches: []string{"aws", "amazon"}},
	{ID: "googlecloud", Name: "GCP", Type: "cloud", Emoji: "☁️", Matches: []string{"gcp", "google-cloud"}},
	{ID: "cloudflare", Name: "Cloudflare", Type: "cloud", Emoji: "☁️", Matches: []string{"cloudflare"}},

	// CI/CD & Observability
	{ID: "jenkins", Name: "Jenkins", Type: "observability", Emoji: "🧓", Matches: []string{"jenkins"}},
	{ID: "githubactions", Name: "GitHub Actions", Type: "observability", Emoji: "🐙", Matches: []string{"github-actions", "githubactions"}},
	{ID: "prometheus", Name: "Prometheus", Type: "observability", Emoji: "🔥", Matches: []string{"prometheus"}},
	{ID: "grafana", Name: "Grafana", Type: "observability", Emoji: "📊", Matches: []string{"grafana"}},
}

// DetectTechnology detects the technology based on matched substrings
func DetectTechnology(term string) *TechDefinition {
	termLower := strings.ToLower(term)
	for _, tech := range TechRegistry {
		for _, match := range tech.Matches {
			if match == "go" {
				// Avoid matching things like "mongodb" or "django" as "go"
				if termLower == "go" || strings.Contains(termLower, "go:") || strings.Contains(termLower, "golang") || strings.Contains(termLower, "go-") || strings.Contains(termLower, "go_") {
					return &tech
				}
				continue
			}
			if strings.Contains(termLower, match) {
				return &tech
			}
		}
	}
	return nil
}

// GetReadableType converts category to capitalized readable string
func GetReadableType(t string) string {
	switch t {
	case "frontend":
		return "Frontend"
	case "backend":
		return "Backend"
	case "database":
		return "Database"
	case "gateway":
		return "Gateway"
	case "queue":
		return "Queue"
	case "cloud":
		return "Infrastructure"
	case "observability":
		return "Observability"
	default:
		return "Service"
	}
}

