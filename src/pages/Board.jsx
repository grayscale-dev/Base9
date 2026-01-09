import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';

/**
 * Canonical Board Router
 * Route: /board/:slug/:section?
 * 
 * This replaces the old auth-first flow:
 * OLD: Login → Workspaces → Select → Board
 * NEW: Direct link → Board (with contextual auth)
 * 
 * Flow:
 * 1. Load workspace by slug (unauthenticated)
 * 2. Check visibility:
 *    - Public: Show board immediately (read-only for unauth)
 *    - Private: Redirect to login with nextUrl
 * 3. For authenticated users, check role and grant appropriate access
 */
export default function Board() {
  const { slug, section = 'feedback' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    resolveBoard();
  }, [slug]);

  const resolveBoard = async () => {
    try {
      // Step 1: Load workspace by slug (public endpoint, no auth required)
      const response = await base44.functions.invoke('publicGetWorkspace', { slug });
      
      if (!response.data) {
        setError('Board not found');
        setLoading(false);
        return;
      }

      const workspace = response.data;

      // Step 2: Check if workspace is public
      if (workspace.visibility === 'public') {
        // Public board - allow access regardless of auth status
        // Try to get authenticated user for role-based features
        let user = null;
        let role = 'viewer';
        let isPublicAccess = true;

        try {
          user = await base44.auth.me();
          
          // Check if authenticated user has a role
          const roles = await base44.entities.WorkspaceRole.filter({
            workspace_id: workspace.id,
            user_id: user.id
          });

          if (roles.length > 0) {
            role = roles[0].role;
            isPublicAccess = false;
          }
        } catch (error) {
          // Not authenticated, proceed as public viewer
        }

        // Set workspace context
        sessionStorage.setItem('selectedWorkspaceId', workspace.id);
        sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
        sessionStorage.setItem('currentRole', role);
        sessionStorage.setItem('isPublicAccess', isPublicAccess.toString());

        // Navigate to requested section
        const sectionPageMap = {
          'feedback': 'Feedback',
          'roadmap': 'Roadmap',
          'changelog': 'Changelog',
          'docs': 'Docs',
          'support': 'Support'
        };

        const targetPage = sectionPageMap[section] || 'Feedback';
        navigate(createPageUrl(targetPage) + `?slug=${slug}`, { replace: true });

      } else {
        // Private board - require authentication
        const isAuthenticated = await base44.auth.isAuthenticated();

        if (!isAuthenticated) {
          // Redirect to login with return URL
          const returnUrl = `${window.location.origin}/board/${slug}/${section}`;
          base44.auth.redirectToLogin(returnUrl);
          return;
        }

        // User is authenticated, check if they have access
        const user = await base44.auth.me();
        const roles = await base44.entities.WorkspaceRole.filter({
          workspace_id: workspace.id,
          user_id: user.id
        });

        if (roles.length === 0) {
          // No access to private board
          setError('You don\'t have access to this board. Please contact the admin.');
          setLoading(false);
          return;
        }

        // User has access
        const role = roles[0].role;
        sessionStorage.setItem('selectedWorkspaceId', workspace.id);
        sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
        sessionStorage.setItem('currentRole', role);
        sessionStorage.removeItem('isPublicAccess');

        // Navigate to requested section
        const sectionPageMap = {
          'feedback': 'Feedback',
          'roadmap': 'Roadmap',
          'changelog': 'Changelog',
          'docs': 'Docs',
          'support': 'Support'
        };

        const targetPage = sectionPageMap[section] || 'Feedback';
        navigate(createPageUrl(targetPage) + `?slug=${slug}`, { replace: true });
      }

    } catch (error) {
      console.error('Board resolution error:', error);
      setError('Failed to load board. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading board..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Unable to Load Board</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}