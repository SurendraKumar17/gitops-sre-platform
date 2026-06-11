# Runbook: High Error Rate / SLO Availability Breach

**Alert:** `SLOBookAvailabilityFastBurn` / `SLOFrontendAvailabilityFastBurn`  
**Severity:** Critical  
**Services:** book (Java), user, search, frontend (Node.js)  
**SLO Target:** 99.9% availability  

---

## 1. Acknowledge

- Acknowledge the alert in PagerDuty within **5 minutes**
- Post in `#incidents` Slack channel:
  ```
  🔴 Investigating high error rate on [service] | Started: [time] | Owner: @your-name
  ```

---

## 2. Identify the Scope

**Check Grafana RED dashboard:**
```
http://grafana.observability.svc/d/red-dashboard
```

**Check error rate in Prometheus:**
```promql
# Which service is erroring?
sum by (job) (rate(http_server_requests_seconds_count{status=~"5.."}[5m]))

# Error rate percentage per service
sum(rate(http_server_requests_seconds_count{job="book",status=~"5.."}[5m]))
/
sum(rate(http_server_requests_seconds_count{job="book"}[5m]))
```

**Check which endpoints are affected:**
```promql
topk(10,
  sum by (uri, status) (
    rate(http_server_requests_seconds_count{job="book",status=~"5.."}[5m])
  )
)
```

---

## 3. Check Pod Health

```bash
# Check pod status
kubectl get pods -n default -l app=book

# Check recent events
kubectl describe pods -n default -l app=book | grep -A5 Events

# Check logs for errors
kubectl logs -n default -l app=book --tail=100 | grep -i error

# Check logs via Loki (Grafana)
{app="book"} |= "ERROR" | json
```

---

## 4. Check Recent Deployments

```bash
# Recent rollout history
kubectl rollout history deployment/book -n default

# Check if a new version was deployed recently
kubectl describe deployment book -n default | grep Image

# Check Argo Rollouts if using canary
kubectl argo rollouts get rollout book -n default
```

If a recent deployment caused the issue:
```bash
# Rollback immediately
kubectl rollout undo deployment/book -n default

# Or rollback Argo Rollout
kubectl argo rollouts abort book -n default
kubectl argo rollouts undo book -n default
```

---

## 5. Check Dependencies

```bash
# Check database connectivity (if applicable)
kubectl exec -n default deploy/book -- curl -s http://localhost:8080/actuator/health | jq .

# Check downstream service errors
kubectl logs -n default -l app=book --tail=200 | grep -i "connection refused\|timeout\|unavailable"
```

**Check in Tempo for trace errors:**
```
Grafana → Explore → Tempo → Search: status=error, service=book
```

---

## 6. Scale Up if Overloaded

```bash
# Check current HPA status
kubectl get hpa -n default

# Manually scale if HPA is maxed
kubectl scale deployment book --replicas=6 -n default

# Check resource pressure
kubectl top pods -n default -l app=book
kubectl top nodes
```

---

## 7. Escalation

| Time Since Alert | Action |
|---|---|
| 0–5 min | Acknowledge, begin investigation |
| 5–15 min | Identify root cause |
| 15–30 min | Apply fix or rollback |
| 30+ min | Escalate to engineering lead |
| 60+ min | Escalate to VP Engineering, customer comms |

---

## 8. Resolution

- Confirm error rate back below 0.1% for 10+ minutes
- Update `#incidents` channel with resolution summary
- Post in `#slo-alerts` with error budget impact
- Schedule post-mortem within 48 hours (for critical incidents)

---

## 9. Post-Mortem Template

```
## Incident: [Date] - High Error Rate on [Service]
- Duration:
- Impact: X% of requests failed, Y% error budget consumed
- Root Cause:
- Detection: Alert fired at [time], acknowledged at [time]
- Resolution:
- Action Items:
  1.
  2.
```