# Incident Response Guide — Booking Platform

## Step-by-Step Response

### 1. Detect & Acknowledge (0–5 min)
- Acknowledge PagerDuty alert within 5 minutes
- Post in `#incidents` Slack with initial message (see escalation-policy.md)
- Open Grafana SLO + RED dashboards

### 2. Assess Scope (5–10 min)
- Which service is affected? (book / user / search / frontend)
- What % of requests are failing?
- Is it getting worse or stable?
- What's the error budget impact?

```bash
# Quick scope check
kubectl get pods -A | grep -v Running
kubectl top nodes
kubectl get hpa -n default
```

### 3. Identify Root Cause (10–20 min)

**Recent deployment?**
```bash
kubectl rollout history deployment -n default
```

**Pod health?**
```bash
kubectl describe pods -n default -l app=<service> | grep -A5 Events
kubectl logs -n default -l app=<service> --tail=50 --previous
```

**Traces for errors?**
```
Grafana → Explore → Tempo → status=error, service=<name>
```

**Logs for errors?**
```
Grafana → Explore → Loki → {app="<service>"} |= "ERROR"
```

### 4. Fix or Mitigate (20–30 min)

| Root Cause | Action |
|---|---|
| Bad deployment | `kubectl rollout undo deployment/<name> -n default` |
| OOMKill | Increase memory limit, restart pod |
| Dependency down | Check downstream service, circuit breaker |
| Traffic spike | Scale up manually `kubectl scale deployment/<name> --replicas=N` |
| Config/secret missing | Check env vars, re-apply secret |

### 5. Verify Resolution
- Confirm error rate drops below 0.1% for 10+ minutes
- Confirm SLO burn rate alert resolves in Alertmanager
- Confirm pods are Running and stable

### 6. Close Incident
- Post resolution message in `#incidents`
- Update PagerDuty with resolution notes
- Calculate error budget impact
- Schedule post-mortem (P1 = within 48 hours, P2 = within 1 week)

---

## Post-Mortem Template

```markdown
## Post-Mortem: [Date] — [Service] [Brief Description]

### Summary
[1-2 sentence summary of what happened and impact]

### Timeline
| Time | Event |
|------|-------|
| HH:MM | Alert fired |
| HH:MM | On-call acknowledged |
| HH:MM | Root cause identified |
| HH:MM | Fix applied |
| HH:MM | Incident resolved |

### Root Cause
[Detailed explanation]

### Impact
- Duration: X minutes
- Error rate: X%
- Error budget consumed: X% of monthly budget
- Users affected: estimated X

### What Went Well
-
-

### What Went Wrong
-
-

### Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| | | |

### Lessons Learned
[Key takeaways]
```

---

## Do's and Don'ts

**Do:**
- Communicate early and often in `#incidents`
- Focus on mitigation first, root cause second
- Document everything as you go
- Ask for help early

**Don't:**
- Panic or make hasty changes without understanding impact
- Forget to update the team on progress
- Skip the post-mortem for P1 incidents
- Blame individuals — focus on systems