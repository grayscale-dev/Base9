# Rate Limiting & Caching Strategy

## Rate Limiting Implementation

### Architecture
**File**: `functions/rateLimiter.js`  
**Storage**: In-memory Map (production would use Redis/Deno KV)  
**Algorithm**: Sliding window with burst control  
**Cleanup**: Automatic expiry of old entries every 10 minutes

---

## Rate Limit Tiers

### 1. PUBLIC_API (Standard Read Endpoints)
**Applies to**:
- `publicGetWorkspace`
- `publicGetFeedback`
- `publicGetFeedbackDetail`
- `publicGetRoadmap`
- `publicGetRoadmapDetail`
- `publicGetChangelog`
- `publicGetDocs`
- `publicGetDocDetail`
- `publicGetSupport`

**Limits**:
- **60 requests per minute per IP** (sliding window)
- **10 request burst** (within 10 seconds)
- **Auto-reset**: Rolling window

**Rationale**:
- Allows legitimate users to browse rapidly
- Prevents aggressive scrapers (60/min = 1 req/sec sustained)
- Burst allowance handles page load with multiple requests
- Sufficient for real-time user interaction

---

### 2. ANALYTICS (Tracking Endpoints)
**Applies to**:
- `publicTrackBoardView`

**Limits**:
- **1 request per 5 minutes per session+board combo**
- **Plus 60 requests per minute per IP** (inherited from PUBLIC_API)
- **No burst allowance** (strict throttling)

**Rationale**:
- Prevents analytics spam/manipulation
- One legitimate view per board per session every 5 minutes
- Per-IP cap prevents single malicious actor from flooding
- Session ID is client-generated (non-PII) but validated per-IP

**Session ID Generation** (client-side):
```javascript
let sessionId = sessionStorage.getItem('analytics_session_id');
if (!sessionId) {
  sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  sessionStorage.setItem('analytics_session_id', sessionId);
}
```

**Properties**:
- Non-PII (no user identification)
- Ephemeral (clears on tab close)
- Prevents duplicate views within session
- Server validates session+IP combo

---

### 3. SIGNUP (Form Submissions)
**Applies to**:
- `publicWaitlistSignup`

**Limits**:
- **3 requests per minute per IP**
- **1 request burst** (no rapid retries)

**Rationale**:
- Prevents spam signups
- Allows legitimate retries (network errors)
- Low enough to deter automation
- High enough for real user workflows

---

## Caching Strategy

### Cache Headers by Endpoint Type

#### Read-Only Board Metadata (5 min cache)
**Endpoints**: `publicGetWorkspace`  
**Headers**:
```
Cache-Control: public, max-age=300, s-maxage=300
Expires: <timestamp + 5 min>
Vary: Accept-Encoding
```

**Rationale**:
- Workspace metadata rarely changes
- Reduces DB load for popular boards
- CDN can serve cached copies
- 5 minutes balances freshness vs efficiency

---

#### Feedback Lists (2 min cache)
**Endpoints**: `publicGetFeedback`  
**Headers**:
```
Cache-Control: public, max-age=120, s-maxage=120
Expires: <timestamp + 2 min>
Vary: Accept-Encoding
```

**Rationale**:
- Feedback list changes more frequently
- New submissions should appear quickly
- Shorter TTL for better real-time feel
- Still reduces load on hot boards

---

#### Feedback Detail (3 min cache)
**Endpoints**: `publicGetFeedbackDetail`  
**Headers**:
```
Cache-Control: public, max-age=180, s-maxage=180
Expires: <timestamp + 3 min>
Vary: Accept-Encoding
```

**Rationale**:
- Details include comment threads
- Comments arrive regularly but not constantly
- 3 min balances freshness with caching benefit
- Direct links benefit from CDN caching

---

#### Write/Track Endpoints (No Cache)
**Endpoints**: `publicTrackBoardView`, `publicWaitlistSignup`  
**Headers**:
```
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
```

**Rationale**:
- Analytics must never be cached
- Each view tracking must hit server
- Signups must always process fresh
- Prevents duplicate submissions from cache

---

## IP Address Extraction

**Priority Order**:
1. `X-Forwarded-For` (proxy/CDN)
2. `X-Real-IP` (nginx)
3. `CF-Connecting-IP` (Cloudflare)
4. Fallback: `'unknown'`

**Handling**:
- Extracts first IP from comma-separated list
- Trims whitespace
- Unknown IPs still rate-limited (shared bucket)

---

## Rate Limit Response

### Headers
```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1736428800000
```

### Response Body
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 42
}
```

**Burst Exceeded**:
```json
{
  "error": "Too many requests in burst. Please slow down.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 10
}
```

**Session Limit** (analytics):
```json
{
  "error": "Analytics tracking limit exceeded for this session",
  "code": "SESSION_LIMIT_EXCEEDED",
  "retryAfter": 287
}
```

---

## Memory Management

### Automatic Cleanup
- Runs every 10 minutes
- Removes entries older than 1 hour
- Prevents memory leaks from abandoned IPs/sessions
- No manual intervention needed

### Storage Limits
**In-Memory** (current):
- ~1 KB per IP entry
- ~10,000 unique IPs = ~10 MB
- Acceptable for moderate traffic

**Production Scaling** (future):
- Migrate to Deno KV or Redis
- Distributed rate limiting across regions
- Persistent storage with TTL
- Shared state across function instances

---

## Testing Scenarios

### ✅ Normal User Browsing
- Opens board → workspace cached
- Views feedback → list cached
- Clicks item → detail cached
- **Result**: Most requests served from cache, rate limit never hit

### ✅ Rapid Navigation
- User clicks through 10 feedback items quickly
- Burst allowance handles initial spike
- Sliding window allows sustained browsing
- **Result**: Smooth UX, no rate limit

### ⚠️ Aggressive Scraper
- Bot makes 100 req/sec
- Burst exceeded after 10 requests
- Rate limit enforced immediately
- **Result**: Blocked with 429, must wait

### ⚠️ Analytics Spam
- Malicious actor tries to inflate view count
- Session+board combo limited to 1 per 5 min
- IP-based cap prevents mass session creation
- **Result**: Views accurately counted, spam blocked

---

## Monitoring & Observability

### Metrics to Track
- Rate limit hit rate (per endpoint)
- Cache hit rate (CDN/browser)
- Average response time (cached vs uncached)
- Unique IPs per hour
- Burst violations

### Alerts
- High rate limit rate (>5% requests)
- Sustained 429 responses from single IP
- Unusual analytics patterns

---

## Future Enhancements

1. **Geographic Rate Limiting**
   - Different limits by region
   - Higher limits for known good IPs

2. **Dynamic Rate Limits**
   - Increase limits for authenticated users
   - Decrease during DDoS attacks

3. **Request Cost-Based Limiting**
   - Complex queries cost more tokens
   - Simple cached reads cost less

4. **Allowlist/Blocklist**
   - Trusted IPs bypass limits
   - Known bad actors permanently blocked