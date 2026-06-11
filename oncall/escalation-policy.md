# On-Call Escalation Policy — Booking Platform

## On-Call Rotation

| Role | Responsibility |
|---|---|
| Primary On-Call | First responder, acknowledge within 5 min |
| Secondary On-Call | Backup if primary unreachable for 10 min |
| Engineering Lead | Escalate for P1 incidents or budget exhausted |
| VP Engineering | Escalate for customer-impacting outages > 30 min |

---

## Severity Levels

### P1 — Critical (SLO Fast Burn / Full Outage)
- **Definition:** Service unavailable or error rate > 1% (burning budget at 14.4×)
- **Response SLA:** Acknowledge in **5 minutes**, resolve in **30 minutes**
- **Notify:** Primary on-call → Secondary (10 min) → Engineering Lead (20 min)
- **Channel:** `#incidents` + PagerDuty page

### P2 — High (SLO Slow Burn / Degraded)
- **Definition:** Elevated error rate (3× burn), latency SLO breaching
- **Response SLA:** Acknowledge in **30 minutes**, resolve in **4 hours**
- **Notify:** Primary on-call via Slack
- **Channel:** `#slo-alerts`

### P3 — Medium (Warning alerts)
- **Definition:** High CPU/memory, pod restarts, non-SLO alerts
- **Response SLA:** Acknowledge in **2 hours**, resolve in **24 hours**
- **Notify:** Team Slack channel
- **Channel:** `#alerts-warning`

### P4 — Low (Informational)
- **Definition:** Capacity planning, budget > 25% consumed
- **Response SLA:** Next business day
- **Channel:** `#alerts-info`

---

## Escalation Timeline

```
T+0 min   → Alert fires → PagerDuty pages Primary On-Call
T+5 min   → If no ack → PagerDuty pages again
T+10 min  → If no ack → PagerDuty pages Secondary On-Call
T+20 min  → If not resolved → Auto-escalate to Engineering Lead
T+30 min  → If not resolved → Engineering Lead notifies VP
T+60 min  → Customer communication drafted
```

---

## Incident Communication Template

**Slack `#incidents` initial post:**
```
🔴 *[P1 INCIDENT]* - [Service] high error rate
• Started: [time]
• Impact: [X]% error rate, [Y]% error budget consumed
• Owner: @on-call-engineer
• Status: Investigating
• Runbook: [link]
```

**Update every 15 minutes:**
```
🔄 *UPDATE* [time] - [Service] incident
• Status: [Investigating / Identified / Fixing / Resolved]
• Finding: [what we found]
• Next: [what we're doing]
```

**Resolution:**
```
✅ *RESOLVED* [time] - [Service] incident
• Duration: [X] minutes
• Root cause: [brief description]
• Error budget impact: [X]% consumed
• Post-mortem: [scheduled / link]
```

---

## Useful Links

| Resource | URL |
|---|---|
| Grafana | http://grafana.observability.svc |
| Prometheus | http://prometheus.observability.svc:9090 |
| Alertmanager | http://alertmanager.observability.svc:9093 |
| SLO Dashboard | http://grafana.observability.svc/d/slo-dashboard |
| RED Dashboard | http://grafana.observability.svc/d/red-dashboard |
| Runbooks | This repo: `runbooks/` folder |