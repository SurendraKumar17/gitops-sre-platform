# Runbook: Pod CrashLoopBackOff

**Alert:** `KubePodCrashLooping`  
**Severity:** Critical  
**Namespace:** default (app services), monitoring, observability  

---

## 1. Identify the Pod

```bash
# Find all crashlooping pods
kubectl get pods -A | grep CrashLoop

# Get details on the crashing pod
kubectl describe pod <pod-name> -n <namespace>

# Check restart count
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.status.containerStatuses[0].restartCount}'
```

---

## 2. Read the Logs

```bash
# Current logs
kubectl logs <pod-name> -n <namespace>

# Previous container logs (before crash)
kubectl logs <pod-name> -n <namespace> --previous

# Follow logs in real time
kubectl logs -f <pod-name> -n <namespace>
```

**Common error patterns to look for:**
- `OOMKilled` → memory limit too low
- `Error: ECONNREFUSED` → dependency not ready
- `Caused by: java.lang.OutOfMemoryError` → Java heap exhausted
- `Cannot find module` → missing Node.js dependency
- `Connection refused` → database or service not reachable

---

## 3. Check Exit Code

```bash
kubectl describe pod <pod-name> -n <namespace> | grep -A3 "Last State"
```

| Exit Code | Meaning |
|---|---|
| 0 | Clean exit (app bug — exiting when it shouldn't) |
| 1 | Application error |
| 137 | OOMKilled (out of memory) |
| 139 | Segfault |
| 143 | SIGTERM (graceful shutdown issue) |

---

## 4. Fix by Root Cause

### OOMKilled (exit 137)
```bash
# Check current limits
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.containers[0].resources}'

# Increase memory limit in deployment
kubectl edit deployment <name> -n <namespace>
# Change: memory: 512Mi → 1Gi
```

### App startup failure (missing config/secret)
```bash
# Check env vars and secrets
kubectl exec <pod-name> -n <namespace> -- env | grep -i db
kubectl get secret -n <namespace>
kubectl describe secret <secret-name> -n <namespace>
```

### Dependency not ready (connection refused)
```bash
# Check if dependent service is running
kubectl get pods -n <namespace> | grep <dependency>

# Check if service DNS resolves
kubectl exec <pod-name> -n <namespace> -- nslookup <service-name>
```

---

## 5. Temporary Relief

```bash
# Delete the pod to restart fresh (if restartPolicy allows)
kubectl delete pod <pod-name> -n <namespace>

# Scale down and back up
kubectl scale deployment <name> -n <namespace> --replicas=0
kubectl scale deployment <name> -n <namespace> --replicas=2
```

---

## 6. Escalation

- 3+ restarts with no clear fix → escalate to service owner
- OOMKill in production → escalate and increase limits immediately
- All pods of a service crashlooping → P1 incident, war room

---

## Related Alerts
- `KubePodNotReady`
- `KubeDeploymentReplicasMismatch`
- `SLOBookAvailabilityFastBurn` (will likely fire together)