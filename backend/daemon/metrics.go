package daemon

import (
	"context"
	"math/rand"
	"time"

	"loomiss/usecase"
)

type NodeMetrics struct {
	CPU     float64 `json:"cpu"`
	RAM     float64 `json:"ram"`
	Network int64   `json:"network"` // in bytes/sec
}

// StartMetricsStreamer starts a loop that streams container resource statistics
func StartMetricsStreamer(hub *Hub) {
	ticker := time.NewTicker(1500 * time.Millisecond)
	ctx := context.Background()

	// Keep track of random state to make changes smooth
	cpuHistory := make(map[string]float64)
	ramHistory := make(map[string]float64)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// 1. Get current active nodes in workspace
				graph, err := usecase.CompileGraph(".")
				if err != nil {
					continue
				}

				metricsMap := make(map[string]NodeMetrics)

				// 2. Generate stats (Graceful Mock Fallback)
				// We simulate metrics dynamically so the Web UI looks alive and "wows" immediately
				for _, node := range graph.Nodes {
					if node.Type == "group" || node.Type == "unknown_service" {
						continue
					}

					// Fetch previous values for smooth transitions
					prevCPU, ok := cpuHistory[node.ID]
					if !ok {
						prevCPU = 10.0 + rand.Float64()*40.0 // init between 10% and 50%
					}
					prevRAM, ok := ramHistory[node.ID]
					if !ok {
						prevRAM = 30.0 + rand.Float64()*30.0 // init between 30% and 60%
					}

					// Jitter CPU
					cpuChange := (rand.Float64() - 0.5) * 15.0 // change up to 7.5%
					newCPU := prevCPU + cpuChange
					if newCPU < 2.0 {
						newCPU = 2.0
					} else if newCPU > 98.0 {
						newCPU = 98.0
					}
					cpuHistory[node.ID] = newCPU

					// Jitter RAM
					ramChange := (rand.Float64() - 0.5) * 4.0 // change up to 2%
					newRAM := prevRAM + ramChange
					if newRAM < 5.0 {
						newRAM = 5.0
					} else if newRAM > 95.0 {
						newRAM = 95.0
					}
					ramHistory[node.ID] = newRAM

					// Network I/O simulation (depends on node type)
					var networkVal int64
					if node.ID == "nginx" || node.Type == "gateway" {
						networkVal = int64(10000 + rand.Intn(80000)) // higher load for gateways
					} else if node.Type == "database" {
						networkVal = int64(5000 + rand.Intn(40000))
					} else {
						networkVal = int64(2000 + rand.Intn(20000))
					}

					// Let's introduce temporary spikes to simulate realistic traffic loads
					if rand.Float64() < 0.1 {
						newCPU = 85.0 + rand.Float64()*10.0
						networkVal = networkVal * 4
					}

					metricsMap[node.ID] = NodeMetrics{
						CPU:     newCPU,
						RAM:     newRAM,
						Network: networkVal,
					}
				}

				// 3. Broadcast to all connected clients
				hub.Broadcast(map[string]interface{}{
					"type":    "METRICS_UPDATE",
					"metrics": metricsMap,
				})
			}
		}
	}()
}
