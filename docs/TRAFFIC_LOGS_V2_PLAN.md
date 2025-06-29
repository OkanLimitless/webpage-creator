# Traffic Logs System V2 - Clean Architecture Plan

## 🎯 OBJECTIVES
- High-performance logging with minimal KV operations
- Automatic data retention and cleanup
- Efficient querying and analytics
- Cost-effective storage with data aggregation
- Overflow protection and rate limiting

## 📊 NEW DATA ARCHITECTURE

### Key Naming Strategy
```
Format: {type}:{date}:{hour}:{suffix}
Examples:
- traffic:2025-06-28:14:batch001
- traffic:2025-06-28:14:batch002
- summary:2025-06-28:14:stats
- meta:cleanup:last_run
```

### Data Aggregation Levels
1. **Batch Logs** (up to 100 requests per key)
2. **Hourly Summaries** (aggregated stats)  
3. **Daily Summaries** (high-level metrics)
4. **Cleanup Metadata** (system maintenance)

## 🔧 IMPLEMENTATION PLAN

### Phase 1: New KV Namespace
- [ ] Create fresh TRAFFIC_LOGS_V2 namespace
- [ ] Update environment variables in Vercel
- [ ] Migrate worker bindings to new namespace

### Phase 2: Smart Batching System
- [ ] Implement in-memory batch accumulation
- [ ] 100 requests per batch or 5-minute timeout
- [ ] Atomic batch writes to reduce KV operations
- [ ] Duplicate detection and filtering

### Phase 3: Automatic Cleanup
- [ ] TTL-based expiration (48 hours for batches)
- [ ] Hourly cleanup job for orphaned keys
- [ ] Smart retention based on traffic volume
- [ ] Emergency overflow protection

### Phase 4: Efficient API
- [ ] Date-based key scanning
- [ ] Cached summary data
- [ ] Pagination with proper cursors
- [ ] Real-time stats dashboard

## 📈 PERFORMANCE IMPROVEMENTS

### Before (Current System)
- 1 KV write per request → **10,000 writes/hour**
- Manual cleanup required → **KV bloat**
- Linear key scanning → **Slow queries**
- 7-day retention → **Expensive storage**

### After (New System)  
- 1 KV write per 100 requests → **100 writes/hour** (99% reduction)
- Automatic TTL cleanup → **Zero maintenance**
- Date-indexed scanning → **Fast queries**
- 48-hour retention → **Cost efficient**

## 🛡️ OVERFLOW PROTECTION

### Traffic Spike Protection
- Max 10 batches per hour per domain
- Emergency fallback to sampling (1 in N)
- Rate limiting for suspicious traffic
- Alert system for unusual volume

### Memory Management
- In-memory batch limit: 10MB
- Automatic flush on memory pressure
- Failed write retry with exponential backoff
- Circuit breaker for KV failures

## 📋 DATA STRUCTURE

### Batch Entry Format
```json
{
  "batch_id": "traffic:2025-06-28:14:001",
  "timestamp": "2025-06-28T14:30:00.000Z",
  "count": 95,
  "requests": [
    {
      "ts": 1719840600000,
      "ip": "hashed_ip",
      "domain": "example.com", 
      "path": "/landing1",
      "decision": "safe_page",
      "country": "DE",
      "reason": "vpn_detected",
      "risk": 75,
      "gclid": "present"
    }
    // ... up to 100 requests
  ]
}
```

### Hourly Summary Format
```json
{
  "summary_id": "summary:2025-06-28:14:stats", 
  "timestamp": "2025-06-28T14:00:00.000Z",
  "total_requests": 2450,
  "safe_page_count": 1820,
  "money_page_count": 630,
  "top_countries": {"DE": 890, "US": 760, "NL": 340},
  "top_reasons": {"vpn_detected": 450, "geo_block": 380},
  "unique_ips": 1240,
  "domains": {"example.com": 1200, "test.com": 1250}
}
```

## 🚀 MIGRATION STRATEGY

### Step 1: Parallel System
- Deploy V2 alongside current system
- Route 10% of traffic to V2 for testing
- Compare data accuracy and performance

### Step 2: Gradual Migration  
- Increase V2 traffic to 50%, then 100%
- Keep V1 read-only for 48 hours
- Verify V2 stability and completeness

### Step 3: Complete Cutover
- Disable V1 logging completely
- Archive V1 data if needed
- Update all API endpoints to V2
- Clean up old KV namespace

## 📊 SUCCESS METRICS

### Performance Targets
- < 5ms logging latency (vs current 20-50ms)
- 99% reduction in KV write operations  
- < 2GB total KV storage (vs current 10GB+)
- Zero manual cleanup required

### Reliability Targets
- 99.9% log capture rate
- < 1% data loss during spikes
- Automatic recovery from KV failures
- Real-time alerting for issues

## 🔧 TECHNICAL REQUIREMENTS

### Environment Variables
```bash
TRAFFIC_LOGS_V2_NAMESPACE_ID=new_namespace_id
TRAFFIC_LOGS_BATCH_SIZE=100
TRAFFIC_LOGS_RETENTION_HOURS=48
TRAFFIC_LOGS_MAX_MEMORY_MB=10
```

### Worker KV Bindings
```javascript
const kvBindings = [
  { name: 'TRAFFIC_LOGS_V2', namespace_id: process.env.TRAFFIC_LOGS_V2_NAMESPACE_ID },
  { name: 'INTELLIGENCE_STORE', namespace_id: process.env.INTELLIGENCE_STORE_NAMESPACE_ID }
];
```

### API Endpoints
- `GET /api/traffic-logs/v2` - Paginated log retrieval
- `GET /api/traffic-logs/v2/summary` - Hourly/daily stats
- `POST /api/traffic-logs/v2/cleanup` - Manual cleanup trigger
- `GET /api/traffic-logs/v2/health` - System health check 