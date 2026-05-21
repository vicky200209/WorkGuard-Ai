import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Building, Users, Calendar, CheckSquare, FileText, 
  Boxes, Bell, RefreshCw, Layers, Plus, ShoppingCart, CheckCircle, Clock
} from 'lucide-react';
import { useToast } from '../../components/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useRealtime } from '../../hooks/useRealtime';
import { Site, Profile, Worker, Supervisor, Attendance, Task, SiteInspection, Material, Notification } from '../../types';

export default function ManagerDashboard({ activeSection }: { activeSection: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [managedSite, setManagedSite] = useState<Site | null>(null);
  const [allSites, setAllSites] = useState<Site[]>([]); // To allow manual simulation override
  const [selectedSiteId, setSelectedSiteId] = useState<string>(''); // For simulation overriding

  const [workers, setWorkers] = useState<(Worker & { profile: Profile })[]>([]);
  const [supervisors, setSupervisors] = useState<(Supervisor & { profile: Profile })[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inspections, setInspections] = useState<SiteInspection[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Material Creation Form
  const [newMatName, setNewMatName] = useState('');
  const [newMatQty, setNewMatQty] = useState(0);
  const [newMatUnit, setNewMatUnit] = useState('Bags');
  const [newMatStatus, setNewMatStatus] = useState<any>('available');

  const fetchSites = async () => {
    try {
      // Fetch all sites so we allow simulation toggle
      const { data: sitesData } = await supabase.from('sites').select('*').eq('is_deleted', false);
      setAllSites(sitesData || []);

      // Attempt to find the site managed by the current user
      if (profile) {
        const mySite = sitesData?.find(s => s.manager_id === profile.id);
        if (mySite) {
          setManagedSite(mySite);
          setSelectedSiteId(mySite.id);
        } else if (sitesData && sitesData.length > 0) {
          // If none assigned, default to first or let user choose
          setManagedSite(sitesData[0]);
          setSelectedSiteId(sitesData[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
    }
  };

  const fetchSiteSpecificData = async (siteId: string) => {
    if (!siteId) return;
    setRefreshing(true);
    try {
      // 1. Profiles (as cache for joins)
      const { data: profs } = await supabase.from('profiles').select('*');
      const profileMap = new Map<string, Profile>();
      profs?.forEach(p => profileMap.set(p.id, p));
      setAllProfiles(profs || []);

      // 2. Supervisors assigned to site
      const { data: sups } = await supabase
        .from('supervisors')
        .select('*')
        .eq('site_id', siteId);
      const enrichedSups = (sups || []).map(s => ({
        ...s,
        profile: profileMap.get(s.profile_id) || { id: s.profile_id, full_name: 'Unknown Supervisor', email: '', role: 'supervisor' as const }
      }));
      setSupervisors(enrichedSups);

      // 3. Workers assigned to site
      const { data: wrks } = await supabase
        .from('workers')
        .select('*')
        .eq('site_id', siteId);
      const enrichedWrks = (wrks || []).map(w => ({
        ...w,
        profile: profileMap.get(w.profile_id) || { id: w.profile_id, full_name: 'Unknown Worker', email: '', role: 'worker' as const }
      }));
      setWorkers(enrichedWrks);

      // 4. Attendance
      const { data: att } = await supabase
        .from('attendance')
        .select('*')
        .eq('site_id', siteId);
      const enrichedAtt = (att || []).map(a => {
        const w = enrichedWrks.find(worker => worker.id === a.worker_id);
        return {
          ...a,
          worker_name: w?.profile.full_name || 'Unidentified Worker'
        };
      });
      setAttendance(enrichedAtt);

      // 5. Tasks lists
      const { data: tsk } = await supabase
        .from('tasks')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_deleted', false);
      setTasks(tsk || []);

      // 6. Inspections
      const { data: insp } = await supabase
        .from('site_inspections')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      setInspections(insp || []);

      // 7. Materials stock
      const { data: mat } = await supabase
        .from('materials')
        .select('*')
        .eq('site_id', siteId);
      setMaterials(mat || []);

    } catch (err: any) {
      console.error('Error fetching site-specific data:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [profile]);

  useEffect(() => {
    if (selectedSiteId) {
      const targetSite = allSites.find(s => s.id === selectedSiteId);
      if (targetSite) {
        setManagedSite(targetSite);
      }
      fetchSiteSpecificData(selectedSiteId);
    }
  }, [selectedSiteId, activeSection]);

  // Realtime subscriptions
  useRealtime<Attendance>({
    table: 'attendance',
    onEvent: (payload) => {
      console.log('Realtime Attendance updating on Site Manager dashboard:', payload);
      if (selectedSiteId) fetchSiteSpecificData(selectedSiteId);
    }
  });

  useRealtime<Task>({
    table: 'tasks',
    onEvent: (payload) => {
      console.log('Realtime Task updating on Site Manager dashboard:', payload);
      if (selectedSiteId) fetchSiteSpecificData(selectedSiteId);
    }
  });

  const handleUpdateMaterialStatus = async (item: Material, newStatus: typeof item.status) => {
    try {
      const { error } = await supabase
        .from('materials')
        .update({ status: newStatus })
        .eq('id', item.id);

      if (error) throw error;

      showToast(`Material "${item.name}" marked as [${newStatus.replace('_', ' ').toUpperCase()}]`, 'success');
      
      // Audit log entry
      await supabase.from('audit_logs').insert({
        action: 'UPDATE_MATERIAL',
        performed_by: profile?.full_name || 'Site Manager',
        target_table: 'materials',
        target_id: item.id
      });

      if (selectedSiteId) fetchSiteSpecificData(selectedSiteId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName || !selectedSiteId) {
      showToast('Material Name required', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('materials').insert({
        site_id: selectedSiteId,
        name: newMatName,
        quantity: newMatQty,
        unit: newMatUnit,
        status: newMatStatus
      });

      if (error) throw error;

      showToast(`Added [${newMatName}] to site inventory!`, 'success');
      setNewMatName('');
      setNewMatQty(0);
      if (selectedSiteId) fetchSiteSpecificData(selectedSiteId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleApproveInspection = async (insp: SiteInspection, isApproved: boolean) => {
    try {
      // Simulate review by adding a concluding remark / updating AI audit log
      const updatedAiText = `[Approved by Manager: ${profile?.full_name}] ${insp.ai_result || 'Safety compliance verified.'}`;
      const { error } = await supabase
        .from('site_inspections')
        .update({ ai_result: updatedAiText })
        .eq('id', insp.id);

      if (error) throw error;
      showToast(isApproved ? 'Inspection Safety Report approved!' : 'Inspection reviewed with notes.', 'success');
      if (selectedSiteId) fetchSiteSpecificData(selectedSiteId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center animate-pulse" id="manager-loader">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs text-gray-400 font-mono">LOADING...</p>
      </div>
    );
  }

  // Attendance statistics for summary
  const totalAttendance = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const leaveCount = attendance.filter(a => a.status === 'leave').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const halfDayCount = attendance.filter(a => a.status === 'half_day').length;

  return (
    <div className="p-6 space-y-6 text-[#E4E6EB]" id="manager-panel">
      {/* Simulation Selector Bar & Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#222631] pb-5">
        <div>
          <h1 className="text-xl font-mono font-black text-white uppercase tracking-wider font-sans">
            Manager Dashboard
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Managing: <span className="text-amber-500 underline font-bold text-sm select-none">{managedSite ? managedSite.name : 'Unassigned'}</span>
          </p>
        </div>

        {/* Demo simulator override dropdown */}
        <div className="flex items-center gap-2 bg-[#1A1D24] p-2 rounded-lg border border-[#2E3440] font-mono text-xs">
          <Layers className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="text-gray-400 font-bold font-sans">Select Site:</span>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="bg-[#111319] text-[#E4E6EB] border border-[#2E3440] p-1 rounded font-sans cursor-pointer text-xs font-semibold"
            id="simulation-site-select"
          >
            <option value="">Select site</option>
            {allSites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Render dynamic section templates */}
      {activeSection === 'assigned_site' && (
        <div className="space-y-6 animate-fadeIn" id="sect-assigned-site">
          {managedSite ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Site Details Card */}
              <div className="bg-[#13161C] border border-[#222631] p-6 rounded-lg space-y-4">
                <div className="flex items-center gap-3 border-b border-[#222631] pb-3">
                  <div className="p-2.5 bg-amber-500/15 text-amber-500 rounded">
                    <Building className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-mono font-bold tracking-wider text-white uppercase font-sans">Active Site Details</h3>
                    <p className="text-[10px] text-gray-500 font-mono">WorkGuardAi Telemetry</p>
                  </div>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="text-gray-500 font-bold">NAME:</span>
                    <span className="text-gray-200 font-bold">{managedSite.name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="text-gray-500 font-bold font-mono">LOCATION:</span>
                    <span className="text-gray-200 font-sans font-medium">{managedSite.location}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2 flex-wrap">
                    <span className="text-gray-500 font-bold block uppercase text-[10px] font-sans">Supervisors:</span>
                    <span className="text-purple-400 font-bold">{supervisors.length} assigned</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2 flex-wrap text-right">
                    <span className="text-gray-500 font-bold block uppercase text-[10px] font-sans">Workers Roster:</span>
                    <span className="text-emerald-400 font-bold text-sm">{workers.length} active</span>
                  </div>
                </div>
              </div>

              {/* Roster & Quick Overview Panel */}
              <div className="lg:col-span-2 bg-[#13161C] border border-[#222631] p-6 rounded-lg flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 flex items-center gap-2 font-sans text-xs">
                    <CheckSquare className="w-4 h-4 text-amber-500" />
                    Attendance Overview
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 font-sans">
                    <div className="bg-[#171B24] p-4 rounded text-center border border-[#222733]">
                      <span className="block text-[11px] text-gray-500 uppercase tracking-wider">Present</span>
                      <span className="text-2xl font-bold font-mono text-emerald-400">{presentCount}</span>
                    </div>
                    <div className="bg-[#171B24] p-4 rounded text-center border border-[#222733]">
                      <span className="block text-[11px] text-gray-500 uppercase tracking-wider">On Leave</span>
                      <span className="text-2xl font-bold font-mono text-sky-400">{leaveCount}</span>
                    </div>
                    <div className="bg-[#171B24] p-4 rounded text-center border border-[#222733]">
                      <span className="block text-[11px] text-gray-500 uppercase tracking-wider">Absent</span>
                      <span className="text-2xl font-bold font-mono text-rose-400">{absentCount}</span>
                    </div>
                    <div className="bg-[#171B24] p-4 rounded text-center border border-[#222733]">
                      <span className="block text-[11px] text-gray-500 uppercase tracking-wider">Half Day</span>
                      <span className="text-2xl font-bold font-mono text-amber-400">{halfDayCount}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-[#181B24] rounded-lg border border-[#222733] text-xs font-mono text-gray-400 leading-relaxed flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-full animate-pulse">
                    <Bell className="w-5 h-5 font-bold" />
                  </div>
                  <div>
                    <span className="font-bold text-white uppercase block font-sans text-xs">Manager Bulletins</span>
                    Track task logs and review material replenishments to keep the worksite progressing within target timelines.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#13161C] border border-[#222631] rounded-lg font-mono">
              <Building className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-white uppercase mb-1">Vacancy Profile</h3>
              <p className="text-xs text-gray-400">Please choose a site from the simulator dropdown in the top-right to override.</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'workers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn" id="sect-roster">
          {/* Supervisors roster */}
          <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 flex items-center gap-2 font-sans text-xs">
              <Users className="w-4 h-4 text-purple-400" />
              Supervisors ({supervisors.length})
            </h2>

            {supervisors.length === 0 ? (
              <p className="text-xs text-gray-500 font-sans py-4 text-center">No supervisors assigned to this site</p>
            ) : (
              <div className="space-y-3 font-sans text-xs">
                {supervisors.map((item) => (
                  <div key={item.id} className="bg-[#181C25] border border-[#2B3242]/40 rounded p-3 flex items-center gap-3">
                    <img 
                      src={item.profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(item.profile.full_name)}`} 
                      alt="sup-av" 
                      className="w-8 h-8 rounded border border-[#2B3242]"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.profile.full_name}</h4>
                      <p className="text-[10px] font-mono text-purple-400 uppercase font-bold tracking-wider">Site Captain</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workers roster */}
          <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 flex items-center gap-2 font-sans text-xs">
              <Users className="w-4 h-4 text-emerald-400" />
              Workers ({workers.length})
            </h2>

            {workers.length === 0 ? (
              <p className="text-xs text-gray-500 font-sans py-4 text-center">No workers assigned to this site</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin font-sans text-xs">
                {workers.map((item) => (
                  <div key={item.id} className="bg-[#181C25] border border-[#2B3242]/40 rounded p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={item.profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(item.profile.full_name)}`} 
                        alt="wrk-av" 
                        className="w-8 h-8 rounded border border-[#2B3242]"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.profile.full_name}</h4>
                        <p className="text-[10px] font-mono text-gray-400">{item.worker_code} • {item.profile.email || 'No email'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-[#142A1E] text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-sans">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'attendance' && (
        <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4 animate-fadeIn" id="sect-att-logs">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 flex items-center justify-between font-sans text-xs">
            <span>Attendance History</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-0.5 rounded font-mono uppercase font-bold text-[9px]">
              Daily Shifts
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-[#222631] text-gray-400 bg-[#161922]">
                  <th className="p-3 uppercase">Worker Name</th>
                  <th className="p-3 uppercase">Shift Date</th>
                  <th className="p-3 uppercase font-sans">Status</th>
                  <th className="p-3 uppercase font-sans">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D212A]">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500 font-sans">
                      No attendance data logged today for this site.
                    </td>
                  </tr>
                ) : (
                  attendance.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#161B24] transition-colors text-xs font-semibold">
                      <td className="p-3 font-bold text-gray-200">{entry.worker_name}</td>
                      <td className="p-3 text-gray-400">{entry.attendance_date}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          entry.status === 'present'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : entry.status === 'absent'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            : entry.status === 'half_day'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-300 font-sans font-medium">{entry.notes || 'No remarks recorded'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'tasks' && (
        <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4 animate-fadeIn font-sans text-xs animate-fadeIn" id="sect-tasks-logs font-sans text-xs">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 font-sans text-xs">
            Tasks on Site ({tasks.length})
          </h2>

          {tasks.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-[#222631] rounded-lg">
              <CheckSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-xs text-gray-400 font-sans">No tasks found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map((task) => {
                const assignee = allProfiles.find(p => p.id === task.assigned_worker);
                return (
                  <div key={task.id} className="bg-[#181C25] border border-[#2B3242]/40 rounded-lg p-4 space-y-3 relative flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-white">{task.title}</h4>
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          task.is_completed 
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {task.is_completed ? 'Completed' : 'Active Duty'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed font-sans">{task.description}</p>
                    </div>

                    <div className="pt-3 border-t border-gray-800 flex items-center justify-between text-[11px] font-mono">
                      <div>
                        <span className="text-gray-500 block uppercase text-[9px]">Assignee:</span>
                        <span className="text-gray-300 font-sans font-medium">{assignee ? assignee.full_name : 'General LaborPool'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block uppercase text-[9px]">Target Due:</span>
                        <span className="text-gray-300">{task.due_date}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSection === 'inspections' && (
        <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4 animate-fadeIn font-sans text-xs" id="sect-inspections">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 font-sans text-xs">
            Safety Inspections ({inspections.length})
          </h2>

          {inspections.length === 0 ? (
            <p className="text-xs text-gray-500 font-sans py-4 text-center animate-fadeIn font-sans">No safety inspections on file</p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin font-sans text-xs animate-fadeIn font-sans">
              {inspections.map((item) => {
                const inspector = allProfiles.find(p => p.id === item.supervisor_id);
                return (
                  <div key={item.id} className="bg-[#181C25] border border-[#2B3242]/50 rounded-lg p-5 space-y-3 font-sans">
                    <div className="flex items-center justify-between border-b border-gray-850 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-amber-500/10 p-1 rounded">
                          <FileText className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="text-xs font-bold text-gray-250 font-mono uppercase">Inspection: {item.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just Now'}
                      </span>
                    </div>

                    <div className="text-xs font-sans">
                      <span className="text-gray-400 font-bold block uppercase text-[10px] font-mono mb-0.5">Notes Recorded:</span>
                      <p className="text-gray-200 font-sans font-medium bg-[#13161D] p-3 rounded border border-gray-800 leading-relaxed font-sans">{item.notes}</p>
                    </div>

                    {item.ai_result ? (
                      <div className="bg-[#132320]/40 border border-emerald-500/20 p-3.5 rounded-lg text-xs font-sans animate-fadeIn">
                        <span className="text-emerald-400 font-bold font-mono tracking-wider block mb-1 uppercase font-sans text-[11px]">✓ Verified Safety Compliance:</span>
                        <p className="text-[#A7F3D0] leading-relaxed font-sans">{item.ai_result}</p>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center bg-[#1D1714] border border-amber-500/10 p-3.5 rounded-lg text-xs font-mono">
                        <span className="text-amber-500 animate-pulse font-bold uppercase font-sans text-[11px]">Pending Review</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveInspection(item, true)}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded text-[11px] font-bold cursor-pointer transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproveInspection(item, false)}
                            className="px-3 py-1 bg-[#1A1D24] border border-gray-700 hover:border-gray-500 text-gray-300 rounded text-[11px] font-medium cursor-pointer transition-all"
                          >
                            Review Notes
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-gray-400 font-mono flex items-center justify-between pt-1">
                      <span>AUDITOR PROFILE: <strong className="text-gray-200">{inspector ? inspector.full_name : 'Operations Supervisor'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSection === 'materials' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn" id="sect-inventory">
          {/* Add materials form */}
          <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg h-fit space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2 border-b border-[#222631] pb-3 font-sans text-xs">
              <Plus className="w-4 h-4 text-amber-500" />
              Add Material
            </h2>
            <form onSubmit={handleCreateMaterial} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider font-sans">Material Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Copper Wire Coils"
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 text-sm font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Quantity</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newMatQty}
                    onChange={(e) => setNewMatQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 text-xs text-center"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Unit</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bags, Tons"
                    value={newMatUnit}
                    onChange={(e) => setNewMatUnit(e.target.value)}
                    className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 text-xs text-center"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2 rounded font-sans font-bold tracking-wider uppercase transition-all cursor-pointer text-xs"
              >
                Add Material
              </button>
            </form>
          </div>

          {/* Catalog inventory stock */}
          <div className="lg:col-span-2 bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 flex items-center justify-between font-sans text-xs">
              <span>Materials Inventory ({materials.length})</span>
            </h2>

            {materials.length === 0 ? (
              <p className="text-xs text-gray-500 font-sans py-4 text-center">No materials recorded</p>
            ) : (
              <div className="space-y-3">
                {materials.map((item) => (
                  <div key={item.id} className="bg-[#181C25] border border-[#2B3242]/40 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.name}</h4>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">Stock Level: <strong className="text-amber-500">{item.quantity}</strong> {item.unit}</p>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      {item.status === 'out_of_stock' && (
                        <div className="flex items-center gap-1.5 uppercase font-bold text-rose-450 bg-[#2E161A] border border-rose-500/20 px-2 py-1 rounded">
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>OUT OF STOCK / ORDER REQUIRED</span>
                        </div>
                      )}

                      {item.status === 'low_stock' && (
                        <div className="flex items-center gap-1.5 uppercase font-bold text-amber-500 bg-[#251F14] border border-amber-500/20 px-2 py-1 rounded">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Low Stock Alert</span>
                        </div>
                      )}

                      {item.status === 'ordered' && (
                        <div className="flex items-center gap-1.5 uppercase font-bold text-sky-400 bg-[#16242E] border border-sky-400/20 px-2 py-1 rounded">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Supply Ordered</span>
                        </div>
                      )}

                      {item.status === 'available' && (
                        <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded uppercase font-bold">Available</span>
                      )}

                      <div className="flex gap-1">
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateMaterialStatus(item, e.target.value as any)}
                          className="bg-[#101217] border border-[#2B3242] p-1 rounded font-sans text-gray-300 font-bold cursor-pointer text-[11px]"
                          id={`mat-status-${item.id}`}
                        >
                          <option value="available">Available</option>
                          <option value="low_stock">Low Stock</option>
                          <option value="out_of_stock">Out of Stock</option>
                          <option value="ordered">Ordered</option>
                        </select>
                      </div>
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
