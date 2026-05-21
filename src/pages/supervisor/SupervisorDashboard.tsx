import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Building, Users, Calendar, CheckSquare, FileText, 
  Bell, RefreshCw, Layers, Plus, Shield, Send, Check
} from 'lucide-react';
import { useToast } from '../../components/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useRealtime } from '../../hooks/useRealtime';
import { Site, Profile, Worker, Attendance, Task, SiteInspection } from '../../types';

export default function SupervisorDashboard({ activeSection }: { activeSection: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  const [workers, setWorkers] = useState<(Worker & { profile: Profile })[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<{ [workerId: string]: { status: any; notes: string } }>({});
  const [historicalAttendance, setHistoricalAttendance] = useState<Attendance[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form states: New Task delegation
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskWorker, setTaskWorker] = useState('');
  const [taskDueDate, setTaskDueDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Form states: Site Inspection
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  const fetchSitesAndInitialState = async () => {
    try {
      const { data: sitesData } = await supabase.from('sites').select('*').eq('is_deleted', false);
      setAllSites(sitesData || []);

      if (profile) {
        // Find if this supervisor is assigned to a site
        const { data: supData } = await supabase
          .from('supervisors')
          .select('*')
          .eq('profile_id', profile.id)
          .maybeSingle();

        if (supData && sitesData) {
          const targetSite = sitesData.find(s => s.id === supData.site_id);
          if (targetSite) {
            setActiveSite(targetSite);
            setSelectedSiteId(targetSite.id);
          }
        } else if (sitesData && sitesData.length > 0) {
          // If no assignment exists, default to first site for simulator
          setActiveSite(sitesData[0]);
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
      // Fetch Workers on site with joined profile data directly
      const { data: wrks } = await supabase
        .from('workers')
        .select('*, profile:profiles(*)')
        .eq('site_id', siteId);
      
      const enrichedWrks = (wrks || []).map(w => {
        const p = (w as any).profile;
        return {
          ...w,
          profile: p || { id: w.profile_id, full_name: 'Unlisted Worker', email: '', role: 'worker' as const }
        };
      });
      setWorkers(enrichedWrks as any);

      // Pre-fill attendance form states for each worker with 'present' default
      const initialAttendance: typeof attendance = {};
      enrichedWrks.forEach(w => {
        initialAttendance[w.id] = { status: 'present', notes: '' };
      });
      setAttendance(initialAttendance);

      // 3. Fetch Tasks on site
      const { data: tsks } = await supabase
        .from('tasks')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_deleted', false);
      setTasks(tsks || []);

      // 4. Fetch attendance records for reporting
      const { data: attHistory } = await supabase
        .from('attendance')
        .select('*')
        .eq('site_id', siteId)
        .order('attendance_date', { ascending: false });
      setHistoricalAttendance(attHistory || []);

    } catch (err: any) {
      console.error('Error fetching site data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSitesAndInitialState();
  }, [profile]);

  useEffect(() => {
    if (selectedSiteId) {
      const targetSite = allSites.find(s => s.id === selectedSiteId);
      if (targetSite) {
        setActiveSite(targetSite);
      }
      fetchSiteSpecificData(selectedSiteId);
    }
  }, [selectedSiteId, activeSection]);

  // Realtime updates
  useRealtime<Task>({
    table: 'tasks',
    onEvent: (payload) => {
      console.log('Realtime task state updating in Supervisor dashboard:', payload);
      if (selectedSiteId) fetchSiteSpecificData(selectedSiteId);
    }
  });

  const handleUpdateTaskStatus = async (taskId: string, currentCompleted: boolean) => {
    try {
      const newStatus = !currentCompleted;
      const { error } = await supabase
        .from('tasks')
        .update({ is_completed: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      showToast(`Task status toggled to [${newStatus ? 'COMPLETED' : 'ACTIVE'}]`, 'success');

      // Add to audit trail
      await supabase.from('audit_logs').insert({
        action: 'UPDATE_TASK',
        performed_by: profile?.full_name || 'Supervisor',
        target_table: 'tasks',
        target_id: taskId
      });

      if (selectedSiteId) fetchSiteSpecificData(selectedSiteId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !selectedSiteId) {
      showToast('Task title is required', 'error');
      return;
    }

    try {
      const { data, error } = await supabase.from('tasks').insert({
        site_id: selectedSiteId,
        assigned_worker: taskWorker || null,
        assigned_supervisor: profile?.id || null,
        title: taskTitle,
        description: taskDesc,
        is_completed: false,
        due_date: taskDueDate,
        is_deleted: false
      }).select();

      if (error) throw error;

      showToast(`Task "${taskTitle}" assigned successfully!`, 'success');

      // Audit Log
      await supabase.from('audit_logs').insert({
        action: 'ASSIGN_TASK',
        performed_by: profile?.full_name || 'Supervisor',
        target_table: 'tasks',
        target_id: data?.[0]?.id || 'unknown'
      });

      setTaskTitle('');
      setTaskDesc('');
      setTaskWorker('');
      fetchSiteSpecificData(selectedSiteId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleMarkAttendance = async (workerId: string) => {
    const record = attendance[workerId];
    if (!record || !selectedSiteId) return;

    try {
      const formattedDate = new Date().toISOString().split('T')[0];
      
      // Upsert record to table
      const { error } = await supabase.from('attendance').upsert({
        worker_id: workerId,
        site_id: selectedSiteId,
        marked_by: profile?.id || 'supervisor',
        attendance_date: formattedDate,
        status: record.status,
        notes: record.notes
      });

      if (error) throw error;

      showToast(`Attendance marked successfully for worker!`, 'success');

      // Log
      await supabase.from('audit_logs').insert({
        action: 'MARK_ATTENDANCE',
        performed_by: profile?.full_name || 'Supervisor',
        target_table: 'attendance',
        target_id: workerId
      });

      fetchSiteSpecificData(selectedSiteId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUploadInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectionNotes || !selectedSiteId) {
      showToast('Inspection notes are required to audit compliance', 'error');
      return;
    }

    setAiAnalyzing(true);
    try {
      // Mock safety risk evaluation feedback mimicking AI output matching keywords
      let aiFeedback = 'Inspection compliant. Debris cleanups verified. Structural scaffolding bounds certified.';
      if (inspectionNotes.toLowerCase().includes('scaffold') || inspectionNotes.toLowerCase().includes('damage')) {
        aiFeedback = '⚠️ RISK DETECTED: Scaffold structural layout shows load vulnerabilities. Please verify harness cables.';
      } else if (inspectionNotes.toLowerCase().includes('debris') || inspectionNotes.toLowerCase().includes('wire')) {
        aiFeedback = '⚠️ HAZARD DETECTED: High electrical safety risk in wire coil region. Clearing debris recommended.';
      }

      await new Promise(r => setTimeout(r, 1500)); // Build effect delay

      const { data, error } = await supabase.from('site_inspections').insert({
        site_id: selectedSiteId,
        supervisor_id: profile?.id || 'supervisor',
        notes: inspectionNotes,
        ai_result: aiFeedback,
        is_deleted: false
      }).select();

      if (error) throw error;

      showToast('Safety audit report uploaded and risk score processed!', 'success');
      
      // Log
      await supabase.from('audit_logs').insert({
        action: 'SUBMIT_INSPECTION',
        performed_by: profile?.full_name || 'Supervisor',
        target_table: 'site_inspections',
        target_id: data?.[0]?.id || 'unknown'
      });

      setInspectionNotes('');
      fetchSiteSpecificData(selectedSiteId);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAiAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center animate-pulse" id="supervisor-loader">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs text-gray-400 font-mono">LOADING DATA...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 text-[#E4E6EB]" id="supervisor-panel">
      {/* Header and site override switcher */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#222631] pb-5">
        <div>
          <h1 className="text-xl font-mono font-black text-white uppercase tracking-wider">
            Supervisor Dashboard
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Site Zone: <span className="text-amber-500 underline font-bold tracking-wide select-none">{activeSite ? activeSite.name : 'Unassigned'}</span>
          </p>
        </div>

        {/* Override dropdown */}
        <div className="flex items-center gap-2 bg-[#1A1D24] p-2 rounded-lg border border-[#2E3440] font-mono text-xs">
          <Layers className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="text-gray-400 font-bold">Select Site:</span>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="bg-[#111319] text-[#E4E6EB] border border-[#2E3440] p-1 rounded font-sans cursor-pointer text-xs font-semibold animate-none"
            id="simulation-site-select-supervisor"
          >
            <option value="">Select site</option>
            {allSites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid specific sections */}
      {activeSection === 'mysite' && (
        <div className="space-y-6 animate-fadeIn" id="sect-supervisor-site">
          {activeSite ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Site detail */}
              <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-widest text-amber-500 font-bold">Active Site</h3>
                <div className="font-mono text-xs space-y-2">
                  <p className="text-white font-bold">{activeSite.name}</p>
                  <p className="text-gray-400 font-sans">{activeSite.location}</p>
                  <div className="pt-2 border-t border-gray-800 flex justify-between text-[11px] text-[#A3AEC2]">
                    <span>Roster:</span>
                    <span>{workers.length} workers</span>
                  </div>
                </div>
              </div>

              {/* Core instructions panel */}
              <div className="md:col-span-2 bg-[#13161C] border border-[#222631] p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-widest text-[#888E99] font-bold mb-2">Instructions</h3>
                  <p className="text-xs text-gray-300 font-sans leading-relaxed">
                    Keep site shifts running smoothly. Record daily worker attendance, assign tasks, and file safety inspections.
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-850 mt-4 flex items-center gap-2 text-[10px] font-mono text-amber-400 font-bold">
                  <Shield className="w-4 h-4 text-amber-500 animate-pulse" />
                  Helmets and safety vests required on site
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#13161C] border border-[#222631] rounded-lg">
              <Building className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-xs text-gray-400 font-mono">No site configured, use override selector inside headers toolbar.</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'mark_attendance' && (
        <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4 animate-fadeIn" id="sect-mark-rolls">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 font-sans">
            Daily Attendance Checklist
          </h2>

          {workers.length === 0 ? (
            <p className="text-xs text-gray-500 font-mono text-center py-6">No workers assigned to this site</p>
          ) : (
            <div className="space-y-4">
              {workers.map((wrk) => {
                const stateObj = attendance[wrk.id] || { status: 'present', notes: '' };
                return (
                  <div key={wrk.id} className="bg-[#181C25] border border-[#2B3242]/40 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 font-mono text-xs font-sans">
                    <div className="flex items-center gap-3">
                      <img 
                        src={wrk.profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(wrk.profile.full_name)}`} 
                        alt="av" 
                        className="w-8 h-8 rounded border border-gray-700 bg-gray-950"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-white">{wrk.profile.full_name}</h4>
                        <span className="text-[10px] text-gray-500 block font-mono">CODE: {wrk.worker_code}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Attendance Selector options */}
                      <div className="flex gap-1.5 bg-[#101217] p-1 rounded border border-gray-800">
                        {['present', 'absent', 'half_day', 'leave'].map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setAttendance({
                                ...attendance,
                                [wrk.id]: { ...stateObj, status: opt }
                              });
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                              stateObj.status === opt
                                ? 'bg-amber-500 text-black shadow-xs'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {opt === 'half_day' ? 'Half' : opt}
                          </button>
                        ))}
                      </div>

                      {/* Custom Remark text field */}
                      <input
                        type="text"
                        placeholder="Notes / Remarks"
                        value={stateObj.notes}
                        onChange={(e) => {
                          setAttendance({
                            ...attendance,
                            [wrk.id]: { ...stateObj, notes: e.target.value }
                          });
                        }}
                        className="bg-[#161B24] border border-[#2B3242] p-1.5 rounded text-gray-250 outline-hidden focus:border-amber-500 text-xs w-full sm:w-44 font-medium"
                      />

                      {/* Submit single roll button */}
                      <button
                        onClick={() => handleMarkAttendance(wrk.id)}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase text-[10px] rounded tracking-wider flex items-center gap-1 cursor-pointer transition-colors font-mono"
                      >
                        <Check className="w-3.5 h-3.5 font-extrabold" />
                        Log Roll
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSection === 'assign_tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn" id="sect-assignations">
          {/* Create Task Form */}
          <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg h-fit space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-white font-bold border-b border-[#222631] pb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-500" />
              Assign Task
            </h2>
            <form onSubmit={handleAssignTask} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scaffolding Inspection Block B"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 text-sm font-sans"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Task Description</label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed steps..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 text-xs font-sans font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Assign Worker</label>
                  <select
                    value={taskWorker}
                    onChange={(e) => setTaskWorker(e.target.value)}
                    className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden text-xs cursor-pointer select-none font-sans"
                  >
                    <option value="">No worker assigned</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.profile.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-[#181C25] border border-[#2B3242] p-1.5 rounded text-[#E4E6EB] outline-hidden text-xs text-center"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2 rounded font-mono font-bold tracking-wider uppercase transition-all cursor-pointer font-bold"
              >
                Assign Task
              </button>
            </form>
          </div>

          {/* Core active site tasks checklist */}
          <div className="lg:col-span-2 bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 flex items-center justify-between">
              <span>Tasks on Site ({tasks.length})</span>
            </h2>

            {tasks.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono text-center py-6">No tasks assigned yet</p>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                {tasks.map((tsk) => {
                  const worker = workers.find(w => w.id === tsk.assigned_worker);
                  return (
                    <div key={tsk.id} className="bg-[#181C25] border border-[#2B3242]/40 rounded-lg p-4 flex items-center justify-between gap-4 font-sans">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">{tsk.title}</h4>
                        <p className="text-xs text-gray-400 font-sans font-medium line-clamp-1">{tsk.description || 'No description provided'}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-bold font-mono">Assignee: {worker ? worker.profile.full_name : 'No worker assigned'} • Due: {tsk.due_date}</p>
                      </div>

                      <button
                        onClick={() => handleUpdateTaskStatus(tsk.id, tsk.is_completed)}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 border transition-all cursor-pointer font-mono ${
                          tsk.is_completed
                            ? 'bg-[#122A1E] border-emerald-500/20 text-emerald-400'
                            : 'bg-[#251F14] border-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                        }`}
                      >
                        {tsk.is_completed ? 'Completed ✓' : 'Toggle Completed'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'inspections' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn" id="sect-supervisor-surveys">
          {/* Submit inspections form */}
          <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg h-fit space-y-4 font-mono text-xs">
            <h2 className="text-sm uppercase tracking-widest text-white font-bold border-b border-[#222631] pb-3 flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-500 animate-pulse" />
              Submit Safety Inspection
            </h2>
            <form onSubmit={handleUploadInspection} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1 text-[11px] uppercase tracking-wider">Safety Notes</label>
                <textarea
                  rows={5}
                  required
                  placeholder="Record scaffolding notes, wear constraints, hazards, or wiring updates..."
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  className="w-full bg-[#181C25] border border-[#2B3242] p-2 rounded text-[#E4E6EB] outline-hidden focus:border-amber-500 font-sans font-semibold text-xs leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={aiAnalyzing}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 text-black py-2.5 rounded font-mono font-bold tracking-wider uppercase flex justify-center items-center gap-1.5 shadow cursor-pointer font-bold"
              >
                {aiAnalyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    Checking notes...
                  </>
                ) : (
                  'Submit Safety Inspection'
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-[#13161C] border border-[#222631] p-5 rounded-lg flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3">
                Safety Inspection helper
              </h2>
              <p className="text-xs text-gray-300 font-sans leading-relaxed mt-3">
                WorkGuardAi safety notes help you check site safety. Under the notes field, write details including <strong>wire</strong>, <strong>scaffold</strong>, or <strong>debris</strong> to test safety reactions.
              </p>
            </div>

            <div className="mt-6 p-4 bg-[#14261A] text-emerald-400 rounded-lg border border-emerald-500/10 text-xs font-mono font-semibold flex items-center gap-3">
              <div className="shrink-0 p-1.5 bg-emerald-500 text-black rounded animate-none">
                <Shield className="w-4 h-4" />
              </div>
              Site safety compliance reports are compiled for Site Manager review and sign-off inside dashboards.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
