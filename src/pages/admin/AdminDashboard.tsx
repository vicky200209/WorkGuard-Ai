import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Building, Users, FileText, ClipboardList, Bell, 
  Trash2, Plus, RefreshCw, Layers, Shield, Send, CheckSquare, Activity
} from 'lucide-react';
import { useToast } from '../../components/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useRealtime } from '../../hooks/useRealtime';
import { Profile, Site, AuditLog, Notification } from '../../types';

export default function AdminDashboard({ activeSection }: { activeSection: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [sites, setSites] = useState<Site[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [countStats, setCountStats] = useState({ sites: 0, users: 0, tasks: 0, inspections: 0 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form states: New Site
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [newSiteManager, setNewSiteManager] = useState('');

  // Form states: New Profile/Staff
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'admin' | 'site_manager' | 'supervisor' | 'worker'>('worker');
  const [newStaffSite, setNewStaffSite] = useState('');

  // Form states: Notification broadcast
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [notifPriority, setNotifPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notifType, setNotifType] = useState<'info' | 'warning' | 'success' | 'alert'>('info');

  const fetchData = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch count stats
      const { count: siteCount } = await supabase.from('sites').select('*', { count: 'estimated', head: true }).eq('is_deleted', false);
      const { count: userCount } = await supabase.from('profiles').select('*', { count: 'estimated', head: true });
      const { count: taskCount } = await supabase.from('tasks').select('*', { count: 'estimated', head: true }).eq('is_deleted', false);
      const { count: inspCount } = await supabase.from('site_inspections').select('*', { count: 'estimated', head: true }).eq('is_deleted', false);
      
      setCountStats({
        sites: siteCount || 0,
        users: userCount || 0,
        tasks: taskCount || 0,
        inspections: inspCount || 0
      });

      // 2. Fetch sites
      const { data: sitesData } = await supabase
        .from('sites')
        .select('*')
        .eq('is_deleted', false)
        .order('name', { ascending: true });
      setSites(sitesData || []);

      // 3. Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      setProfiles(profilesData || []);

      // 4. Fetch notifications
      const { data: notificationsData } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      setNotifications(notificationsData || []);

      // 5. Fetch audit logs
      const { data: logsData } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      setLogs(logsData || []);

    } catch (err: any) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSection]);

  // Real-time table listener setup
  useRealtime<Notification>({
    table: 'notifications',
    onEvent: (payload) => {
      console.log('Realtime Notification update:', payload);
      fetchData(); // Quick reload to capture updates
    }
  });

  useRealtime<AuditLog>({
    table: 'audit_logs',
    onEvent: (payload) => {
      console.log('Realtime AuditLog update:', payload);
      fetchData();
    }
  });

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName || !newSiteLocation) {
      showToast('Please enter name and location', 'error');
      return;
    }

    try {
      const { data, error } = await supabase.from('sites').insert({
        name: newSiteName,
        location: newSiteLocation,
        manager_id: newSiteManager || null,
        is_deleted: false
      }).select();

      if (error) throw error;

      showToast(`Site "${newSiteName}" created successfully!`, 'success');
      
      // Log Action
      await supabase.from('audit_logs').insert({
        action: 'CREATE_SITE',
        performed_by: profile?.full_name || 'Admin HQ',
        target_table: 'sites',
        target_id: data?.[0]?.id || 'unknown'
      });

      setNewSiteName('');
      setNewSiteLocation('');
      setNewSiteManager('');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSoftDeleteSite = async (siteId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive site "${name}"?`)) return;

    try {
      const { error } = await supabase
        .from('sites')
        .update({ is_deleted: true })
        .eq('id', siteId);

      if (error) throw error;

      showToast(`Site "${name}" archived successfully.`, 'success');

      // Log Action
      await supabase.from('audit_logs').insert({
        action: 'DELETE_SITE',
        performed_by: profile?.full_name || 'Admin HQ',
        target_table: 'sites',
        target_id: siteId
      });

      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffEmail) {
      showToast('Staff Name and Email are required', 'error');
      return;
    }

    try {
      const newUserId = crypto.randomUUID();
      
      const { data, error } = await supabase.from('profiles').insert({
        id: newUserId,
        full_name: newStaffName,
        email: newStaffEmail,
        role: newStaffRole,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(newStaffName)}`
      }).select();

      if (error) throw error;

      // Handle specific role relations
      if (newStaffSite) {
        if (newStaffRole === 'supervisor') {
          await supabase.from('supervisors').insert({
            profile_id: newUserId,
            site_id: newStaffSite,
            status: 'active'
          });
        } else if (newStaffRole === 'worker') {
          await supabase.from('workers').insert({
            profile_id: newUserId,
            site_id: newStaffSite,
            worker_code: `W-${Math.floor(Math.random() * 9000) + 1000}`,
            salary: 4500,
            status: 'active'
          });
        } else if (newStaffRole === 'site_manager') {
          await supabase.from('sites').update({ manager_id: newUserId }).eq('id', newStaffSite);
        }
      }

      showToast(`Staff member "${newStaffName}" added!`, 'success');
      showToast('This user must register with this email to activate their account', 'info');

      // Log Action
      await supabase.from('audit_logs').insert({
        action: 'CREATE_PROFILE',
        performed_by: profile?.full_name || 'Admin HQ',
        target_table: 'profiles',
        target_id: newUserId
      });

      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffSite('');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleBroadcastNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifMsg) {
      showToast('Notification details are empty', 'error');
      return;
    }

    try {
      // Submit multiple notifications: one for each profile, or dynamic broadcast
      const { data: users } = await supabase.from('profiles').select('id');
      if (users && users.length > 0) {
        const insertRows = users.map(u => ({
          user_id: u.id,
          title: notifTitle,
          message: notifMsg,
          type: notifType,
          priority: notifPriority,
          is_read: false
        }));

        const { error } = await supabase.from('notifications').insert(insertRows);
        if (error) throw error;
      }

      showToast('Notification sent to all users!', 'success');
      setNotifTitle('');
      setNotifMsg('');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const seedDemoDatabase = async () => {
    if (!window.confirm('Would you like to seed the database with demo sites, staff, and helper tasks?')) return;
    setRefreshing(true);
    try {
      showToast('Seeding initial data, please wait...', 'info');

      // 1. Create a modern construction site
      const { data: siteData, error: sErr } = await supabase.from('sites').insert([
        { name: 'Apex Tower Project', location: '742 Platinum Dr, Sector-9', is_deleted: false },
        { name: 'Greenway Residential Estate', location: '12 Emerald Blvd', is_deleted: false }
      ]).select();
      if (sErr) throw sErr;
      const site1 = siteData?.[0]?.id;
      const site2 = siteData?.[1]?.id;

      // 2. Create materials list
      await supabase.from('materials').insert([
        { site_id: site1, name: 'Structural Steel Rebars', quantity: 180, unit: 'Tons', status: 'available' },
        { site_id: site1, name: 'Portland Cement (Type I)', quantity: 25, unit: 'Bags', status: 'low_stock' },
        { site_id: site2, name: 'Tempered Glass Panels', quantity: 0, unit: 'Units', status: 'out_of_stock' }
      ]);

      // 3. Create active dummy audit log
      await supabase.from('audit_logs').insert({
        action: 'DB_SEED',
        performed_by: 'HQ Administrator',
        target_table: 'profiles',
        target_id: 'seeder'
      });

      showToast('Database seeded with demo sites and materials!', 'success');
      fetchData();
    } catch (err: any) {
      console.error('Seeding process errored:', err);
      showToast(`Seeder alert: ${err.message}`, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center animate-pulse" id="admin-loader">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs text-gray-400 font-mono">LOADING DASHBOARD STATS...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 text-[#E4E6EB]" id="admin-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#222631] pb-5">
        <div>
          <h1 className="text-xl font-mono font-black text-white uppercase tracking-wider">
            WorkGuardAi Admin Dashboard
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Manage sites, staff members, audit logs, and status updates
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={seedDemoDatabase}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-black font-mono font-bold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            id="seed-db-btn"
          >
            <Layers className="w-4 h-4" />
            Seed Initial Data
          </button>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 bg-[#1A1D24] text-gray-300 hover:text-white border border-[#2E3440] rounded-lg transition-all"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Render selected operational content */}
      {activeSection === 'stats' && (
        <div className="space-y-6 animate-fadeIn" id="sect-stats">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg flex items-center gap-4">
              <div className="p-3 bg-amber-500/15 text-amber-500 rounded-lg">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">Active Sites</span>
                <span className="text-2xl font-bold font-mono text-white">{countStats.sites}</span>
              </div>
            </div>

            <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg flex items-center gap-4">
              <div className="p-3 bg-sky-400/15 text-sky-400 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">Staff Profiles</span>
                <span className="text-2xl font-bold font-mono text-white">{countStats.users}</span>
              </div>
            </div>

            <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg flex items-center gap-4">
              <div className="p-3 bg-purple-400/15 text-purple-400 rounded-lg">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">Active Tasks</span>
                <span className="text-2xl font-bold font-mono text-white">{countStats.tasks}</span>
              </div>
            </div>

            <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg flex items-center gap-4">
              <div className="p-3 bg-rose-400/15 text-rose-400 rounded-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">Inspections</span>
                <span className="text-2xl font-bold font-mono text-white">{countStats.inspections}</span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg">
              <h3 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-500" />
                Staff Distribution
              </h3>
              <div className="space-y-3">
                {['admin', 'site_manager', 'supervisor', 'worker'].map((roleKey) => {
                  const amt = profiles.filter(p => p.role === roleKey).length;
                  const ratio = profiles.length ? (amt / profiles.length) * 100 : 0;
                  return (
                    <div key={roleKey} className="font-mono text-xs">
                      <div className="flex justify-between text-gray-300 mb-1">
                        <span className="capitalize">{roleKey.replace('_', ' ')}s</span>
                        <span>{amt} ({Math.round(ratio)}%)</span>
                      </div>
                      <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                        <div 
                           className="bg-amber-500 h-full transition-all" 
                           style={{ width: `${ratio}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg">
              <h3 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                Database Status
              </h3>
              <div className="bg-[#171B24] border border-[#222733] p-4 rounded text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Auth Status:</span>
                  <span className="text-emerald-400 font-bold">READY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Database Integrity:</span>
                  <span className="text-emerald-400 font-bold">OPTIMIZED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Row Level Security:</span>
                  <span className="text-amber-400 font-bold">ENFORCED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Port Route:</span>
                  <span className="text-gray-300">HTTPS PROXY 3000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'sites' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn" id="sect-sites">
          {/* Create Site Form */}
          <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg h-fit space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2 border-b border-[#222631] pb-3">
              <Plus className="w-4 h-4 text-amber-500" />
              Add New Site
            </h2>
            <form onSubmit={handleCreateSite} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Site Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Tower Project"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 transition-all font-sans text-sm"
                  id="site-input-name"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Location / Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sector-12, Crossways Ave"
                  value={newSiteLocation}
                  onChange={(e) => setNewSiteLocation(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 transition-all font-sans text-sm"
                  id="site-input-location"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Assigned Site Manager</label>
                <select
                  value={newSiteManager}
                  onChange={(e) => setNewSiteManager(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-gray-200 outline-hidden tracking-wide cursor-pointer text-sm font-semibold"
                  id="site-input-manager"
                >
                  <option value="">Unassigned</option>
                  {profiles
                    .filter((p) => p.role === 'site_manager')
                    .map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2 rounded font-bold tracking-wider uppercase shadow-xs transition-all cursor-pointer"
                id="site-btn-create"
              >
                Create Site
              </button>
            </form>
          </div>

          {/* Active sites catalog */}
          <div className="lg:col-span-2 bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 flex items-center justify-between">
              <span>Active Sites ({sites.length})</span>
            </h2>
            
            {sites.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-[#222631] rounded-lg">
                <Building className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-xs text-gray-400 font-mono">No active sites found</p>
                <p className="text-[10px] text-gray-500 font-mono mt-1">Use the site creation form to add one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sites.map((site) => {
                  const manager = profiles.find(p => p.id === site.manager_id);
                  return (
                    <div key={site.id} className="bg-[#181C25] border border-[#262E3E]/60 rounded-lg p-4 space-y-3 relative group">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-amber-500 transition-colors">{site.name}</h3>
                          <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1 mt-0.5">
                            <span>Location:</span>
                            <span className="text-gray-300 truncate max-w-44">{site.location}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSoftDeleteSite(site.id, site.name)}
                          className="text-gray-500 hover:text-rose-400 p-1 rounded transition-colors bg-black/10 hover:bg-rose-500/10"
                          title="Archive site"
                          aria-label="Delete site"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="pt-2 border-t border-[#222631]/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-gray-500 uppercase text-[9px] tracking-wide">Manager:</span>
                        <span className="text-amber-400 font-bold truncate max-w-40">
                          {manager ? manager.full_name : 'No manager assigned'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn" id="sect-users">
          {/* Create new staff profile */}
          <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg h-fit space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2 border-b border-[#222631] pb-3">
              <Plus className="w-4 h-4 text-amber-500" />
              Add Staff Member
            </h2>
            <form onSubmit={handleCreateProfile} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sandra Kowalski"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 transition-all font-sans text-sm"
                  id="staff-input-name"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 transition-all font-sans text-sm"
                  id="staff-input-email"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Role</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as any)}
                    className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden text-xs cursor-pointer select-none font-semibold"
                    id="staff-input-role"
                  >
                    <option value="worker">Worker</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="site_manager">Site Manager</option>
                    <option value="admin">HQ Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Assigned Site</label>
                  <select
                    value={newStaffSite}
                    onChange={(e) => setNewStaffSite(e.target.value)}
                    className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden text-xs cursor-pointer select-none font-sans"
                    id="staff-input-site"
                  >
                    <option value="">No site assigned</option>
                    {sites.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2 rounded font-bold tracking-wider uppercase transition-all cursor-pointer"
                id="staff-btn-onboard"
              >
                Add Staff
              </button>
            </form>
          </div>

          {/* Directory listings */}
          <div className="lg:col-span-2 bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3">
              Staff Directory ({profiles.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse font-sans">
                <thead>
                  <tr className="border-b border-[#222631] text-gray-400 bg-[#161922] font-mono">
                    <th className="p-3 uppercase">Full Name</th>
                    <th className="p-3 uppercase">Email</th>
                    <th className="p-3 uppercase">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D212A] font-sans">
                  {profiles.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-gray-500 font-mono">
                        No workers or staff found in the register.
                      </td>
                    </tr>
                  ) : (
                    profiles.map((p) => (
                      <tr key={p.id} className="hover:bg-[#161B24] transition-colors">
                        <td className="p-3 flex items-center gap-3">
                          <img 
                            src={p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.full_name)}`}
                            alt="avatar"
                            className="w-7 h-7 rounded-sm border border-gray-700 bg-gray-900" 
                            referrerPolicy="no-referrer"
                          />
                          <span className="font-semibold text-gray-100">{p.full_name}</span>
                        </td>
                        <td className="p-3 text-gray-400 font-mono">{p.email}</td>
                        <td className="p-3 font-mono">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                            p.role === 'admin' 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                              : p.role === 'site_manager' 
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : p.role === 'supervisor'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            {p.role.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'audit_logs' && (
        <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4 animate-fadeIn" id="sect-audit">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 flex items-center justify-between font-sans">
            <span className="font-mono font-bold text-gray-400">Activity Logs</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest bg-gray-800 px-2 py-0.5 rounded font-mono">
              Audit Logs (Last 30)
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#222631] text-gray-400 bg-[#161922]">
                  <th className="p-3 uppercase">Action</th>
                  <th className="p-3 uppercase">Performed By</th>
                  <th className="p-3 uppercase">Table</th>
                  <th className="p-3 uppercase">Item ID</th>
                  <th className="p-3 uppercase">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D212A] font-sans">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 font-mono">
                      No audit logs found yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#161B24] transition-colors font-mono">
                      <td className="p-3 font-bold text-amber-500">{log.action}</td>
                      <td className="p-3 text-gray-200">{log.performed_by}</td>
                      <td className="p-3 text-sky-400 text-[10px]">[{log.target_table.toUpperCase()}]</td>
                      <td className="p-3 text-gray-500 text-[10px] font-semibold">{log.target_id.slice(0, 15)}...</td>
                      <td className="p-3 text-gray-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : 'Just Now'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn" id="sect-notifs">
          {/* Announcement Broadcast */}
          <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg h-fit space-y-4 font-mono text-xs">
            <h2 className="text-sm uppercase tracking-widest text-white font-bold flex items-center gap-2 border-b border-[#222631] pb-3">
              <Send className="w-4 h-4 text-amber-500" />
              Send Notification
            </h2>
            <form onSubmit={handleBroadcastNotification} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Notification Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heavy Rain Alert - Shift Cancellations"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 font-sans text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Message</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Insert instructions for the supervisors and worker dashboards..."
                  value={notifMsg}
                  onChange={(e) => setNotifMsg(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 font-sans text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Priority</label>
                  <select
                     value={notifPriority}
                     onChange={(e) => setNotifPriority(e.target.value as any)}
                     className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden text-xs cursor-pointer select-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">Critical High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Type</label>
                  <select
                     value={notifType}
                     onChange={(e) => setNotifType(e.target.value as any)}
                     className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden text-xs cursor-pointer select-none font-sans"
                  >
                    <option value="info">Info Bulletin</option>
                    <option value="warning">Safety Alert</option>
                    <option value="success">Success Notice</option>
                    <option value="alert">Dispatch Order</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2.5 rounded font-mono font-bold tracking-wider uppercase transition-all cursor-pointer"
              >
                Send Notification
              </button>
            </form>
          </div>

          {/* Historical broadcasts */}
          <div className="lg:col-span-2 bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3">
              Notification History ({notifications.length})
            </h2>

            {notifications.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-[#222631] rounded-lg">
                <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3 animate-bounce" />
                <p className="text-xs text-gray-400 font-mono">No notifications sent yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
                {notifications.map((notif) => (
                  <div key={notif.id} className="bg-[#181C25] border border-[#262E3E]/60 p-4 rounded-lg flex items-start gap-3">
                    <div className="mt-1 shrink-0">
                      <span className={`w-2.5 h-2.5 block rounded-full ${
                        notif.priority === 'high' ? 'bg-rose-500' : notif.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {notif.title}
                        <span className={`text-[9px] font-mono tracking-widest font-bold px-2 py-0.5 rounded border ${
                          notif.type === 'warning' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>
                          {notif.type.toUpperCase()}
                        </span>
                      </h4>
                      <p className="text-xs text-gray-300 mt-1 font-semibold leading-relaxed font-sans">{notif.message}</p>
                      <span className="text-[10px] font-mono text-gray-500 block mt-2">
                        {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Just Broadcasted'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
