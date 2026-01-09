/**
 * Rate Limiter for Public Endpoints
 * 
 * Provides per-IP rate limiting with burst handling and sliding window
 * to protect public endpoints from abuse.
 */

// In-memory store for rate limiting (production would use Redis/KV)
const ipStore = new Map();
const sessionStore = new Map();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 3600000; // 1 hour
  
  for (const [key, data] of ipStore.entries()) {
    if (now - data.lastCleanup > maxAge) {
      ipStore.delete(key);
    }
  }
  
  for (const [key, data] of sessionStore.entries()) {
    if (now - data.lastCleanup > maxAge) {
      sessionStore.delete(key);
    }
  }
}, 600000);

/**
 * Extract IP address from request
 */
function getClientIP(req) {
  // Check common proxy headers
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback to remote address (Deno Deploy provides this)
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
  // Standard public API - 60 requests per minute per IP
  PUBLIC_API: {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    burst: 10, // Allow 10 immediate requests
  },
  
  // Analytics tracking - very restrictive
  ANALYTICS: {
    windowMs: 300000, // 5 minutes
    maxRequests: 1, // 1 request per 5 minutes per session+IP combo
    burst: 1,
  },
  
  // Waitlist signup - moderate
  SIGNUP: {
    windowMs: 60000, // 1 minute
    maxRequests: 3, // 3 signups per minute per IP
    burst: 1,
  },
};

/**
 * Check rate limit for an IP address
 * Uses sliding window algorithm with burst allowance
 */
function checkIPLimit(ip, config) {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  if (!ipStore.has(ip)) {
    ipStore.set(ip, {
      requests: [],
      lastCleanup: now,
    });
  }
  
  const data = ipStore.get(ip);
  
  // Remove expired requests (sliding window)
  data.requests = data.requests.filter(timestamp => timestamp > windowStart);
  data.lastCleanup = now;
  
  // Check if limit exceeded
  if (data.requests.length >= config.maxRequests) {
    const oldestRequest = data.requests[0];
    const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
    
    return {
      allowed: false,
      retryAfter,
      remaining: 0,
      limit: config.maxRequests,
    };
  }
  
  // Check burst (recent requests in last 10 seconds)
  const burstWindowStart = now - 10000;
  const recentRequests = data.requests.filter(timestamp => timestamp > burstWindowStart);
  
  if (recentRequests.length >= config.burst) {
    return {
      allowed: false,
      retryAfter: 10,
      remaining: 0,
      limit: config.maxRequests,
      burstExceeded: true,
    };
  }
  
  // Allow request
  data.requests.push(now);
  
  return {
    allowed: true,
    remaining: config.maxRequests - data.requests.length,
    limit: config.maxRequests,
    retryAfter: null,
  };
}

/**
 * Check rate limit for a session (analytics-specific)
 */
function checkSessionLimit(sessionId, identifier, config) {
  const key = `${sessionId}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  if (!sessionStore.has(key)) {
    sessionStore.set(key, {
      requests: [],
      lastCleanup: now,
    });
  }
  
  const data = sessionStore.get(key);
  
  // Remove expired requests
  data.requests = data.requests.filter(timestamp => timestamp > windowStart);
  data.lastCleanup = now;
  
  // Check if limit exceeded
  if (data.requests.length >= config.maxRequests) {
    const oldestRequest = data.requests[0];
    const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
    
    return {
      allowed: false,
      retryAfter,
    };
  }
  
  // Allow request
  data.requests.push(now);
  
  return {
    allowed: true,
    retryAfter: null,
  };
}

/**
 * Apply rate limiting to a request
 * Returns Response object if rate limit exceeded, null if allowed
 */
export function applyRateLimit(req, config, options = {}) {
  const ip = getClientIP(req);
  
  // Check IP-based limit
  const ipLimit = checkIPLimit(ip, config);
  
  if (!ipLimit.allowed) {
    return Response.json({
      error: ipLimit.burstExceeded 
        ? 'Too many requests in burst. Please slow down.'
        : 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: ipLimit.retryAfter,
    }, {
      status: 429,
      headers: {
        'Retry-After': ipLimit.retryAfter.toString(),
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + (ipLimit.retryAfter * 1000)).toString(),
      }
    });
  }
  
  // Additional session-based limit for analytics
  if (options.sessionId && options.identifier) {
    const sessionLimit = checkSessionLimit(options.sessionId, options.identifier, config);
    
    if (!sessionLimit.allowed) {
      return Response.json({
        error: 'Analytics tracking limit exceeded for this session',
        code: 'SESSION_LIMIT_EXCEEDED',
        retryAfter: sessionLimit.retryAfter,
      }, {
        status: 429,
        headers: {
          'Retry-After': sessionLimit.retryAfter.toString(),
        }
      });
    }
  }
  
  // Rate limit passed - return null (no response = continue)
  return null;
}

/**
 * Add cache headers to response
 */
export function addCacheHeaders(response, ttlSeconds) {
  const headers = new Headers(response.headers);
  
  // Public cache with max-age
  headers.set('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
  headers.set('Expires', new Date(Date.now() + (ttlSeconds * 1000)).toUTCString());
  
  // Add ETag for conditional requests
  headers.set('Vary', 'Accept-Encoding');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Add no-cache headers to response
 */
export function addNoCacheHeaders(response) {
  const headers = new Headers(response.headers);
  
  // Explicitly no cache
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}