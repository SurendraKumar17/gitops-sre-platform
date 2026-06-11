# Runbook: Disk Pressure / High Disk Usage

**Alerts:** `KubeNodeDiskPressure`, `NodeFilesystemAlmostOutOfSpace`  
**Severity:** Warning (> 80%) → Critical (> 90%)  

---

## 1. Identify Which Node / PVC

```bash
# Check node disk pressure
kubectl describe nodes | grep -A5 "DiskPressure"

# Check PVC usage
kubectl get pvc -A
kubectl describe pvc <pvc-name> -n <namespace>

# Check actual disk usage on node
kubectl debug node/<node-name> -it --image=busybox -- df -h
```

**Grafana:**
```promql
# Node filesystem usage %
(1 - node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100
```

---

## 2. Common Causes & Fixes

### Prometheus / Thanos retention
```bash
# Check Prometheus PVC usage
kubectl exec -n monitoring prometheus-kube-prometheus-stack-prometheus-0 -- df -h /prometheus

# Reduce retention if needed (edit values.yaml)
# retention: 7d → 5d
# retentionSize: "15GB" → "12GB"
```

### Loki logs filling disk
```bash
kubectl exec -n observability loki-0 -- df -h /data

# Check Loki retention config in loki/values.yaml
# compactor.retention_enabled: true
# limits_config.retention_period: 7d
```

### Application log files
```bash
# Check container log sizes
kubectl exec <pod-name> -n default -- du -sh /var/log/

# Truncate if needed (temporary fix)
kubectl exec <pod-name> -n default -- truncate -s 0 /var/log/app.log
```

---

## 3. Node Disk Full — Emergency

```bash
# Cordon node to stop new pods
kubectl cordon <node-name>

# Find large files
kubectl debug node/<node-name> -it --image=busybox -- find / -size +500M 2>/dev/null

# Clean up unused Docker images (if docker runtime)
kubectl debug node/<node-name> -it --image=busybox -- crictl rmi --prune

# Drain if unrecoverable
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
```

---

## 4. Expand PVC (EKS gp2)

```bash
# Edit PVC to request more storage (gp2 supports online expansion)
kubectl edit pvc <pvc-name> -n <namespace>
# Change: storage: 20Gi → 40Gi

# Verify expansion
kubectl get pvc <pvc-name> -n <namespace>
```

---

## 5. Escalation

- > 90% disk on Prometheus/Loki PVC → immediate action
- Node disk full → cordon and drain, escalate to infrastructure team
- Multiple nodes affected → escalate to platform/infra team