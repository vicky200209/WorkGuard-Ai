import { useAuth } from '../hooks/useAuth';
import { 
  Building, 
  Users, 
  MapPin, 
  ShieldAlert, 
  FileText, 
  CheckSquare, 
  ClipboardList, 
  Boxes, 
  Bell, 
  Compass, 
  DollarSign, 
  Activity,
  LayoutDashboard,
  CalendarDays,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  currentSection: string;
  setCurrentSection: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ currentSection, setCurrentSection, isOpen, onClose }: SidebarProps) {
  const { profile } = useAuth();
  const role = profile?.role || 'worker';

  // Define navigation categories depending on the user's role
  const getNavItems = () => {
    switch (role) {
      case 'admin':
        return [
          { id: 'stats', label: 'HQ Analytics', icon: LayoutDashboard },
          { id: 'sites', label: 'Manage Sites', icon: Building },
          { id: 'users', label: 'Staff & Profiles', icon: Users },
          { id: 'audit_logs', label: 'System Logs', icon: ClipboardList },
          { id: 'notifications', label: 'All Notifications', icon: Bell },
        ];
      case 'site_manager':
        return [
          { id: 'assigned_site', label: 'My Construction Site', icon: Building },
          { id: 'workers', label: 'Workers & Supervisors', icon: Users },
          { id: 'attendance', label: 'Daily Attendance', icon: CalendarDays },
          { id: 'tasks', label: 'Task Statuses', icon: CheckSquare },
          { id: 'inspections', label: 'Site Inspections', icon: FileText },
          { id: 'materials', label: 'Material Inventory', icon: Boxes },
          { id: 'notifications', label: 'My Alerts', icon: Bell },
        ];
      case 'supervisor':
        return [
          { id: 'mysite', label: 'Site Home', icon: Building },
          { id: 'mark_attendance', label: 'Mark Attendance', icon: CalendarDays },
          { id: 'assign_tasks', label: 'Delegate Tasks', icon: CheckSquare },
          { id: 'inspections', label: 'Inspection Audit', icon: FileText },
          { id: 'notifications', label: 'Alerts Desk', icon: Bell },
        ];
      case 'worker':
        return [
          { id: 'tasks', label: 'My Active Tasks', icon: CheckSquare },
          { id: 'attendance_history', label: 'My Work Log', icon: CalendarDays },
          { id: 'profile', label: 'Profile & Payrate', icon: Users },
          { id: 'notifications', label: 'My Bulletins', icon: Bell },
        ];
      default:
        return [];
    }
  };

  const menuItems = getNavItems();

  const getRoleBadgeColor = () => {
    switch (role) {
      case 'admin':
        return 'text-amber-500 border-amber-500/30 bg-amber-500/5';
      case 'site_manager':
        return 'text-sky-400 border-sky-400/30 bg-sky-400/5';
      case 'supervisor':
        return 'text-purple-400 border-purple-400/30 bg-purple-400/5';
      default:
        return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5';
    }
  };

  return (
    <>
      {/* Background Mask for Mobile View */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          aria-label="Close sidebar overlay"
        />
      )}

      <aside 
        className={`fixed md:sticky top-0 left-0 bottom-0 z-40 w-64 bg-[#111319] border-r border-[#222631] text-gray-300 flex flex-col transition-transform duration-300 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        id="side-navigation"
      >
        {/* Brand Header */}
        <div className="h-16 border-b border-[#222631] flex items-center justify-between px-5 bg-[#0F1116]">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 text-black px-2 py-1 rounded font-mono font-black text-lg tracking-tighter shadow-sm flex items-center gap-1.5 animate-pulse">
              <Compass className="w-5 h-5" />
              <span>SITESYNC</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="md:hidden text-gray-400 hover:text-white p-1 rounded"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active User Profile Frame */}
        <div className="p-4 border-b border-[#222631] bg-[#14171E]/50">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Authenticated</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-sans font-semibold text-gray-200 truncate">{profile?.full_name || 'Personnel'}</h2>
              <p className="text-xs text-gray-400 font-mono truncate">{profile?.email || 'offline@systems'}</p>
            </div>
          </div>
          <div className={`mt-2.5 text-[10px] font-mono tracking-wider px-2 py-1 border rounded text-center uppercase font-bold ${getRoleBadgeColor()}`}>
            ROLE: {(profile?.role || 'field_worker').replace('_', ' ')}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-800" id="main-nav">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 px-3 mb-2">OPERATIONS MENU</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentSection(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-semibold border transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#1E222B] text-amber-400 border-amber-500/20 shadow-xs' 
                    : 'text-gray-400 border-transparent hover:bg-[#14171F] hover:text-gray-200'
                }`}
                id={`nav-${item.id}`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-amber-500' : 'text-gray-500'}`} />
                <span className="flex-1 text-left truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer/System Status Box */}
        <div className="p-4 border-t border-[#222631] bg-[#0E1015] font-mono text-[10px] text-gray-500 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span>SECURE SHELL</span>
            <span className="text-emerald-500">LIVE</span>
          </div>
          <div className="flex items-center justify-between">
            <span>SUPABASE API</span>
            <span className="text-emerald-500">ONLINE</span>
          </div>
          <div className="mt-2 text-center text-[9px] uppercase tracking-wider border-t border-gray-800/50 pt-2 text-gray-600">
            SiteSync © 2026 Site Operations
          </div>
        </div>
      </aside>
    </>
  );
}
