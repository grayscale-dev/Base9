import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Settings, Folder, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear any previous session data on landing
    sessionStorage.clear();
  }, []);

  const handleCustomerPortal = async () => {
    // Customer portal - requires login to see joined workspaces
    sessionStorage.setItem('isPublicAccess', 'true');
    
    try {
      await base44.auth.me();
      navigate(createPageUrl('CustomerHome'));
    } catch (error) {
      // Not authenticated - redirect to login
      base44.auth.redirectToLogin(window.location.origin + createPageUrl('CustomerHome'));
    }
  };

  const handleManagementAccess = async () => {
    sessionStorage.removeItem('isPublicAccess');
    
    try {
      await base44.auth.me();
      navigate(createPageUrl('WorkspaceSelector'));
    } catch (error) {
      base44.auth.redirectToLogin(window.location.origin + createPageUrl('WorkspaceSelector'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 backdrop-blur-sm rounded-2xl mb-6">
            <Folder className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Feedback Portal
          </h1>
          <p className="text-xl text-slate-300 mb-2">
            Choose your access level
          </p>
          <p className="text-sm text-slate-400">
            Select the appropriate portal based on your role
          </p>
        </div>

        {/* Two Options */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Customer Portal */}
          <button
            onClick={handleCustomerPortal}
            className="bg-white/10 backdrop-blur-sm border-2 border-blue-400/30 rounded-2xl p-8 hover:bg-white/15 hover:border-blue-400/50 transition-all text-left group"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/20 rounded-xl group-hover:bg-blue-500/30 transition-colors">
                <Eye className="h-8 w-8 text-blue-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Customer Portal</h2>
                <p className="text-sm text-blue-200">No login required</p>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>View and submit feedback</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>Browse product roadmap</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>Track release history</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-blue-400 mt-0.5">✓</span>
                <span>Access support resources</span>
              </li>
            </ul>
            <div className="flex items-center text-blue-300 font-medium group-hover:translate-x-2 transition-transform">
              Enter Customer Portal
              <span className="ml-2">→</span>
            </div>
          </button>

          {/* Management Access */}
          <div className="flex items-end">
            <button
              onClick={handleManagementAccess}
              className="bg-white/5 backdrop-blur-sm border border-slate-600/30 rounded-xl p-6 hover:bg-white/10 hover:border-slate-500/50 transition-all text-left group w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-500/20 rounded-lg group-hover:bg-slate-500/30 transition-colors">
                  <Settings className="h-6 w-6 text-slate-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Manage Workspaces</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Requires authentication
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Create or manage your workspaces, configure settings, and collaborate with your team.
              </p>
              <div className="flex items-center text-slate-300 text-sm font-medium group-hover:translate-x-1 transition-transform">
                Go to Management
                <span className="ml-2">→</span>
              </div>
            </button>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-400">
            Most users want the <span className="text-blue-300 font-medium">Customer Portal</span> to view feedback and roadmaps
          </p>
        </div>
      </div>
    </div>
  );
}