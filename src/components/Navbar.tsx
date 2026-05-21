import { useAuth } from '../hooks/useAuth';
import { LogOut, User, Shield, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavbarProps {
  onToggleSidebar?: () => void;
  notificationsCount?: number;
  onNotificationsClick?: () => void;
}

export default function Navbar({ onToggleSidebar, notificationsCount = 0, onNotificationsClick }: NavbarProps) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'HQ ADMIN';
      case 'site_manager':
        return 'SITE MANAGER';
      case 'supervisor':
        return 'SUPERVISOR';
      case 'worker':
        return 'FIELD WORKER';
      default:
        return 'VISITOR';
    }
  };

  return (
    <header className="bg-[#13161C] border-b border-[#222631] text-gray-200 h-16 px-6 flex items-center justify-between sticky top-0 z-40" id="main-header">
      {/* Brand Indicator */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded text-amber-500 hover:bg-[#1E222B] transition-colors"
          aria-label="Toggle Menu"
          id="toggle-sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="hidden md:flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
          <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">SITESYNC SECURE CORE ACTIVE</span>
        </div>
      </div>

      {/* Profile & Notifications Actions */}
      <div className="flex items-center gap-5">
        {/* Notifications Trigger */}
        <button 
          onClick={onNotificationsClick}
          className="relative p-2 rounded-full hover:bg-[#1E222B] text-gray-300 transition-colors"
          id="btn-notifications"
          aria-label="View notifications"
        >
          <Bell className="w-5 h-5" />
          {notificationsCount > 0 && (
            <span className="absolute top-1 right-1 bg-amber-500 text-black text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-[#13161C]">
              {notificationsCount}
            </span>
          )}
        </button>

        {/* User Card */}
        <div className="flex items-center gap-3 border-l border-[#222631] pl-5">
          <div className="text-right">
            <p className="text-sm font-sans font-medium text-[#E4E6EB]">{profile?.full_name || 'System Operator'}</p>
            <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 mt-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {getRoleLabel(profile?.role)}
            </span>
          </div>

          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt={profile.full_name || 'Avatar'}
              className="w-9 h-9 rounded-full object-cover border border-amber-500"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#1A1D24] border border-amber-500/30 flex items-center justify-center text-amber-500">
              <User className="w-4 h-4" />
            </div>
          )}

          <button
            onClick={handleLogout}
            className="p-2 ml-2 rounded hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 transition-all cursor-pointer"
            title="Log Out Protocol"
            id="navbar-logout-btn"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
