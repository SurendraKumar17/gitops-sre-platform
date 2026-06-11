# Runbook: High CPU / Memory Usage

**Alerts:** `KubeNodeHighCPU`, `KubePodHighMemory`, `KubeHpaMaxedOut`  
**Severity:** Warning → Critical  

---

## 1. Identify What's Consuming Resources

```bash
# Top pods by CPU
kubectl top pods -n default --sort-by=cpu

# Top pods by memory
kubectl top pods -n default --sort-by=memory

# Top nodes
kubectl top nodes
```

**Grafana:**
```
Infra Overview Dashboard → Node CPU/Memory panels
```

---

## 2. High CPU

```bash
# Check HPA status — is it scaling?
kubectl get hpa -n default

# Check current replicas vs max
kubectl describe hpa <name> -n default

# Check CPU throttling
kubectl describe pod <pod-name> -n default | grep -A5 "Limits"
```

**PromQL to check CPU throttling:**
```promql
sum by (pod) (
  rate(container_cpu_cfs_throttled_seconds_total{namespace="default"}[5m])
)
/
sum by (pod) (
  rate(container_cpu_cfs_periods_total{namespace="default"}[5m])
)
> 0.25
```

**Fix:**
```bash
# Manually scale if HPA is maxed and traffic is high
kubectl scale deployment book --replicas=8 -n default

# Increase CPU limit if consistently throttled
kubectl edit deployment book -n default
# cpu: requests: 300m → 500m, limits: 1000m → 1500m
```

---

## 3. High Memory / OOMKill Risk

```bash
# Check memory usage vs limits
kubectl top pods -n default | grep book

# Check if OOMKill happened recently
kubectl describe nodes | grep -A5 OOMKilling

# Check JVM heap for Java (book service)
kubectl exec deploy/book -n default -- curl -s localhost:8080/actuator/metrics/jvm.memory.used | jq .
```

**Fix for Java (book service) OOM:**
```bash
# Increase heap size via env var
kubectl set env deployment/book -n default JAVA_OPTS="-Xms512m -Xmx1g"

# Or increase memory limit
kubectl edit deployment book -n default
# memory: limits: 1Gi → 2Gi
```

**Fix for Node.js (user/search/frontend):**
```bash
# Increase Node.js heap
kubectl set env deployment/user -n default NODE_OPTIONS="--max-old-space-size=1024"
```

---

## 4. Node Pressure

```bash
# Check node conditions
kubectl describe nodes | grep -E "MemoryPressure|DiskPressure|PIDPressure"

# Check node capacity vs allocatable
kubectl describe node <node-name> | grep -A10 "Allocated resources"

# Cordon node if it's unhealthy (stop scheduling new pods)
kubectl cordon <node-name>

# Drain node safely
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
```

---

## 5. Check VPA Recommendations

```bash
# If VPA is installed, check recommendations
kubectl get vpa -n default
kubectl describe vpa book -n default
```

---

## 6. Escalation

| Condition | Action |
|---|---|
| Single pod high CPU | Check HPA, may be normal |
| HPA maxed + CPU > 90% | Scale manually, review limits |
| Node memory pressure | Drain node, add capacity |
| Multiple nodes under pressure | Cluster autoscaler issue, escalate |