import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { authorizeWriteAction } from './authHelpers.js';

/**
 * Create roadmap update
 * Endpoint: POST /api/roadmap/update/create
 * Auth: Required - Support role minimum (staff only)
 * 
 * Request: {
 *   roadmap_item_id: string,
 *   workspace_id: string,
 *   content: string,
 *   update_type?: 'progress' | 'status_change' | 'announcement'
 * }
 * 
 * Response: { id: string, ...update }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { roadmap_item_id, workspace_id, content, update_type = 'progress' } = payload;

    // Validate input
    if (!roadmap_item_id || !workspace_id || !content) {
      return Response.json({ 
        error: 'Missing required fields',
        code: 'INVALID_INPUT',
        required: ['roadmap_item_id', 'workspace_id', 'content']
      }, { status: 400 });
    }

    // Authorize write action - staff only, display name required
    const auth = await authorizeWriteAction(base44, workspace_id, 'support');
    if (!auth.success) {
      return auth.error;
    }

    const user = auth.user;

    // Create roadmap update
    const update = await base44.entities.RoadmapUpdate.create({
      roadmap_item_id,
      workspace_id,
      content,
      author_id: user.id,
      update_type,
    });

    return Response.json(update);

  } catch (error) {
    console.error('Create roadmap update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});