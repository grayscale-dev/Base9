import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// Import all section components
import Feedback from './Feedback';
import Roadmap from './Roadmap';
import Changelog from './Changelog';
import Docs from './Docs';
import Support from './Support';
import WorkspaceSettings from './WorkspaceSettings';
import ApiDocs from './ApiDocs';

/**
 * Board Router
 * 
 * Matches: /board/:slug/:section
 * - Parses slug and section from URL
 * - Loads workspace and user context
 * - Renders the appropriate section component
 */
export default function Board() {
  const navigate = useNavigate();
  const { slug: routeSlug, section: routeSection } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [slug, setSlug] = useState(null);
  const [section, setSection] = useState(null);

  // Map of section names to components
  const sectionComponents = {
    feedback: Feedback,
    roadmap: Roadmap,
    changelog: Changelog,
    docs: Docs,
    support: Support,
    settings: WorkspaceSettings,
    api: ApiDocs,
  };

  useEffect(() => {
    initializeBoard(routeSlug, routeSection);
  }, [routeSlug, routeSection]);

  const initializeBoard = async (routeSlugParam, routeSectionParam) => {
    try {
      setLoading(true);
      setError(null);
      setAccessRequired(false);

      if (!routeSlugParam || !routeSectionParam) {
        setError('Invalid board URL');
        setLoading(false);
        return;
      }

      const boardSlug = routeSlugParam;
      const boardSection = routeSectionParam;

      // Validate section exists
      if (!sectionComponents[boardSection]) {
        setError(`Unknown section: ${boardSection}`);
        setLoading(false);
        return;
      }

      setSlug(boardSlug);
      setSection(boardSection);

      // Load workspace context via public endpoint
      try {
        let workspace = null;
        try {
          const { data } = await base44.functions.invoke('publicGetBoard', {
            slug: boardSlug
          });
          workspace = data;
        } catch (publicError) {
          const status = publicError?.status || publicError?.response?.status;
          if (status === 401) {
            try {
              await base44.auth.logout();
            } catch {
              // ignore logout errors
            }
            const returnUrl = window.location.pathname;
            base44.auth.redirectToLogin(window.location.origin + returnUrl);
            return;
          }
          if (status === 403) {
            try {
              await base44.auth.me();
            } catch {
              const returnUrl = window.location.pathname;
              base44.auth.redirectToLogin(window.location.origin + returnUrl);
              return;
            }
            setAccessRequired(true);
            setLoading(false);
            return;
          }
          throw publicError;
        }

        if (!workspace) {
          setError('Board not found');
          setLoading(false);
          return;
        }

        // Try to get user role if authenticated
        let user = null;
        let role = 'viewer';
        let isPublicAccess = false;

        try {
          user = await base44.auth.me();

          // Check if user has a role in this workspace
          const roles = await base44.entities.BoardRole.filter({
            board_id: workspace.id,
            user_id: user.id
          });

          if (roles.length > 0) {
            role = roles[0].role;
            isPublicAccess = false;
          } else if (workspace.visibility === 'restricted') {
            setAccessRequired(true);
            setLoading(false);
            return;
          } else {
            role = 'viewer';
            isPublicAccess = true;
          }
        } catch (authError) {
          // Not authenticated - public access
          if (workspace.visibility !== 'public') {
            // Private workspace and not authenticated
            setError('This board is private. Please log in to access it.');
            setLoading(false);
            return;
          }
          isPublicAccess = true;
        }

        // Store workspace context in sessionStorage for layout and components
        sessionStorage.setItem('selectedBoard', JSON.stringify(workspace));
        sessionStorage.setItem('selectedBoardId', workspace.id);
        sessionStorage.setItem('currentRole', role);
        sessionStorage.setItem('isPublicAccess', isPublicAccess.toString());

        setLoading(false);
      } catch (contextError) {
        console.error('Failed to load board context:', contextError);
        setError('Failed to load board');
        setLoading(false);
      }
    } catch (error) {
      console.error('Board initialization error:', error);
      setError('An error occurred');
      setLoading(false);
    }
  };

  const handleAccessCodeSubmit = async () => {
    if (!accessCode.trim() || !slug) return;
    setAccessSubmitting(true);
    setError(null);
    try {
      const { data } = await base44.functions.invoke('joinBoardWithAccessCode', {
        slug,
        access_code: accessCode.trim()
      });

      if (data?.board) {
        sessionStorage.setItem('selectedBoard', JSON.stringify(data.board));
        sessionStorage.setItem('selectedBoardId', data.board.id);
        sessionStorage.setItem('currentRole', data.role || 'contributor');
        sessionStorage.setItem('isPublicAccess', 'false');
        navigate(`/board/${data.board.slug}/feedback`);
      }
    } catch (joinError) {
      console.error('Failed to join with access code:', joinError);
      setError('Invalid access code. Please try again.');
    } finally {
      setAccessSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <LoadingSpinner size="lg" text="Loading board..." />
      </div>
    );
  }

  if (accessRequired) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Enter access code</h2>
            <p className="text-slate-600 mt-2">
              This board is private. Enter the access code provided by an admin.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Access code"
              className="text-center tracking-[0.3em] uppercase"
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAccessCodeSubmit();
              }}
            />
            {error && (
              <p className="text-sm text-rose-600">{error}</p>
            )}
          </div>
          <Button
            onClick={handleAccessCodeSubmit}
            disabled={accessSubmitting || !accessCode.trim()}
            className="w-full bg-slate-900 hover:bg-slate-800"
          >
            {accessSubmitting ? 'Checking...' : 'Join Board'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/')}
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Oops!</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Render the appropriate section component
  const SectionComponent = sectionComponents[section];
  
  if (!SectionComponent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">Section not found</h2>
        </div>
      </div>
    );
  }

  return <SectionComponent />;
}
