import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { applyRateLimit, addNoCacheHeaders, RATE_LIMITS } from './rateLimiter.js';

/**
 * Public API: Track board view (analytics)
 * Endpoint: /api/public/boards/:slug/view
 * Method: POST
 * Auth: None required
 * Rate Limiting: 1 view per session per board per 5 minutes
 * 
 * Request: {
 *   slug: string,
 *   referrer?: string (optional, for analytics)
 * }
 * 
 * Response: {
 *   success: boolean
 * }
 * 
 * Notes:
 * - No PII is stored
 * - Rate limited by session identifier (generated client-side)
 * - Used for basic analytics only
 */

// In-memory rate limit cache (5 minute window)
const viewCache = new Map();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { slug, referrer, session_id } = payload;

    if (!slug) {
      return Response.json({ error: 'slug is required' }, { status: 400 });
    }

    // Rate limiting check
    if (session_id) {
      const cacheKey = `${session_id}:${slug}`;
      const lastView = viewCache.get(cacheKey);
      
      if (lastView && Date.now() - lastView < RATE_LIMIT_WINDOW) {
        // Already tracked recently, skip
        return Response.json({ success: true, cached: true });
      }
      
      // Update cache
      viewCache.set(cacheKey, Date.now());
      
      // Clean up old entries periodically
      if (viewCache.size > 10000) {
        const now = Date.now();
        for (const [key, timestamp] of viewCache.entries()) {
          if (now - timestamp > RATE_LIMIT_WINDOW) {
            viewCache.delete(key);
          }
        }
      }
    }

    // Fetch workspace by slug
    const workspaces = await base44.asServiceRole.entities.Workspace.filter({ 
      slug,
      status: 'active'
    });

    if (workspaces.length === 0) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = workspaces[0];

    // Create a simple analytics record (you can extend this entity later)
    // For now, we'll just increment a counter or create a minimal record
    // Note: You'd typically create a BoardView entity for this
    // For MVP, we can skip actual storage and just return success
    // This allows the infrastructure to be in place without requiring a new entity

    return Response.json({ 
      success: true,
      workspace_id: workspace.id 
    });

  } catch (error) {
    console.error('Public board view tracking error:', error);
    // Don't fail the request if tracking fails
    return Response.json({ success: false }, { status: 200 });
  }
});