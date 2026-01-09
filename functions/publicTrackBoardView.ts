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

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { slug, referrer, session_id } = payload;
    
    if (!slug) {
      return Response.json({ error: 'slug is required' }, { status: 400 });
    }
    
    // Apply strict rate limiting for analytics
    // Both per-session (1 view per board per 5 min) AND per-IP (60 req/min)
    const rateLimitResponse = applyRateLimit(req, RATE_LIMITS.ANALYTICS, {
      sessionId: session_id,
      identifier: slug,
    });
    if (rateLimitResponse) return rateLimitResponse;
    
    const base44 = createClientFromRequest(req);

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

    const response = Response.json({ 
      success: true,
      workspace_id: workspace.id 
    });
    
    // Never cache analytics tracking
    return addNoCacheHeaders(response);

  } catch (error) {
    console.error('Public board view tracking error:', error);
    // Don't fail the request if tracking fails
    return Response.json({ success: false }, { status: 200 });
  }
});