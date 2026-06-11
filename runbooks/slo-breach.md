# Runbook: SLO Breach / Error Budget Exhausted

**Alert:** `SLOBookAvailabilityFastBurn`, `SLOBookLatencyBudgetBurn`  
**Severity:** Critical (fast burn) / Warning (slow burn)  

---

## 1. Check Error Budget Status

**Grafana SLO Dashboard:**
```
http://grafana.observability.svc/d/slo-dashboard
```

**PromQL — Check remaining budget:**
```promql
# Book service error budget remaining
slo:book_error_budget_remaining:ratio

# All services
{__name__=~"slo:.*_error_budget_remaining:ratio"}
```

| Value | Meaning |
|---|---|
| 1.0 | Full budget remaining |
| 0.5 | 50% consumed |
| 0.0 | Budget exhausted |
| Negative | Over budget (SLO breached) |

---

## 2. Fast Burn Response (14.4×)

**This means:** At current error rate, you'll exhaust the **monthly budget in ~2 days**.

```bash
# Immediately check error rate
rate(http_server_requests_seconds_count{job="book",status=~"5.."}[5m])

# Find the spike start time in Grafana
# Go to: RED Dashboard → Error Rate panel → zoom out to 1h
```

**Immediate actions:**
1. Check for recent deployment → rollback if needed
2. Check pod health → see pod-crashloop.md
3. Check downstream dependencies
4. If no fix in 15 min → escalate to engineering lead

---

## 3. Slow Burn Response (3×)

**This means:** Elevated error rate that will exhaust budget in ~10 days.

```bash
# Check which endpoints are slow/erroring
topk(5,
  sum by (uri) (rate(http_server_requests_seconds_count{job="book",status=~"5.."}[1h]))
)
```

**Actions:**
1. Create ticket for root cause investigation
2. Review in next standup
3. Schedule fix within current sprint

---

## 4. Latency SLO Breach

```promql
# Check p95 latency
histogram_quantile(0.95,
  sum by (le) (rate(http_server_requests_seconds_bucket{job="book"}[5m]))
)

# Check which endpoints are slow
histogram_quantile(0.95,
  sum by (le, uri) (rate(http_server_requests_seconds_bucket{job="book"}[5m]))
)
```

**Common causes:**
- Database slow queries → check DB metrics
- Downstream service timeout → check Tempo traces
- GC pressure (Java) → check JVM metrics
- Cold start after scaling → check pod age

**Trace slow requests in Tempo:**
```
Grafana → Explore → Tempo → Search
Service: book | Min Duration: 500ms | Status: any
```

---

## 5. Error Budget Policy Actions

Follow `slo/error-budget-policy.yaml` based on remaining budget:

- **> 50%** → Normal operations
- **25–50%** → Review and plan reliability work
- **10–25%** → Freeze non-critical deployments
- **< 10%** → Stop all feature deployments
- **Exhausted** → Emergency response mode

---

## 6. Post-Mortem (Required for Fast Burn Events)

Schedule within 48 hours. Use template in `runbooks/high-error-rate.md`.