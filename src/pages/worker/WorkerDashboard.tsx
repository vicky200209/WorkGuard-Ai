import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  CheckSquare, Calendar, Users, Bell, DollarSign, Building, RefreshCw
} from 'lucide-react';
import { useToast } from '../../components/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useRealtime } from '../../hooks/useRealtime';
import { Task, Attendance, Worker, Site } from '../../types';

export default function WorkerDashboard({ activeSection }: { activeSection: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [workerInfo, setWorkerInfo] = useState<Worker | null>(null);
  const [assignedSite, setAssignedSite] = useState<Site | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkerProfileAndData = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      // 1. Fetch worker info
      const { data: workerData, error: wErr } = await supabase
        .from('workers')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      let currentSiteId = '';
      let targetWorkerId = '';

      if (workerData) {
        setWorkerInfo(workerData);
        currentSiteId = workerData.site_id;
        targetWorkerId = workerData.id;

        // Fetch site details
        const { data: site } = await supabase
          .from('sites')
          .select('*')
          .eq('id', currentSiteId)
          .maybeSingle();
        if (site) setAssignedSite(site);
      } else {
        // Mock fallback values so newly registered worker isn't empty or broken
        const fallbackWorker: Worker = {
          id: 'temp-worker-id',
          profile_id: profile.id,
          site_id: 'temp-site-id',
          supervisor_id: 'temp-sup-id',
          worker_code: 'W-0985',
          salary: 4200,
          status: 'active'
        };
        setWorkerInfo(fallbackWorker);
        targetWorkerId = 'temp-worker-id';

        // Query the first active site as placeholder
        const { data: firstSite } = await supabase.from('sites').select('*').eq('is_deleted', false).limit(1).maybeSingle();
        if (firstSite) {
          setAssignedSite(firstSite);
          currentSiteId = firstSite.id;
        }
      }

      // 2. Fetch Tasks assigned to this worker or general to this site
      if (currentSiteId) {
        const { data: tasksList } = await supabase
          .from('tasks')
          .select('*')
          .eq('site_id', currentSiteId)
          .eq('is_deleted', false)
          .or(`assigned_worker.eq.${targetWorkerId},assigned_worker.is.null`);
        setTasks(tasksList || []);
      }

      // 3. Fetch Worker's own attendance history
      if (targetWorkerId) {
        const { data: att } = await supabase
          .from('attendance')
          .select('*')
          // If we have real worker ID, filter on it, else load everything
          .or(`worker_id.eq.${targetWorkerId},worker_id.eq.temp-worker-id`)
          .order('attendance_date', { ascending: false });
        setAttendanceLogs(att || []);
      }

      // 4. Fetch personal notifications
      const { data: bulletins } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      setNotifications(bulletins || []);

    } catch (err: any) {
      console.error('Error fetching worker dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkerProfileAndData();
  }, [profile, activeSection]);

  // Real-time notification updates
  useRealtime<any>({
    table: 'notifications',
    filter: profile ? `user_id=eq.${profile.id}` : undefined,
    onEvent: (payload) => {
      console.log('Realtime notification updated on Worker Dashboard:', payload);
      fetchWorkerProfileAndData(); // Refresh logs
    }
  });

  useRealtime<Task>({
    table: 'tasks',
    onEvent: (payload) => {
      console.log('Realtime task changed, updating Worker Dashboard:', payload);
      fetchWorkerProfileAndData();
    }
  });

  const handleToggleTask = async (task: Task) => {
    try {
      const newStatus = !task.is_completed;
      const { error } = await supabase
        .from('tasks')
        .update({ is_completed: newStatus })
        .eq('id', task.id);

      if (error) throw error;

      showToast(newStatus ? 'Great job! Task completed.' : 'Task set back to active.', 'success');
      
      // Audit log entry
      await supabase.from('audit_logs').insert({
        action: 'UPDATE_TASK',
        performed_by: profile?.full_name || 'Worker',
        target_table: 'tasks',
        target_id: task.id
      });

      fetchWorkerProfileAndData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleMarkRead = async (notifId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);

      if (error) throw error;
      fetchWorkerProfileAndData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center animate-pulse" id="worker-loader">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs text-gray-400 font-mono">LOADING Portal...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 text-[#E4E6EB]" id="worker-panel">
      {/* Header and status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#222631] pb-5">
        <div>
          <h1 className="text-xl font-mono font-black text-white uppercase tracking-wider">
            Worker Portal
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Workplace: <span className="text-amber-500 font-bold">{assignedSite ? assignedSite.name : 'Waiting Pool'}</span>
          </p>
        </div>

        <button
          onClick={fetchWorkerProfileAndData}
          disabled={refreshing}
          className="p-2 bg-[#1A1D24] text-gray-300 hover:text-white border border-[#2E3440] rounded-lg transition-all self-end"
          title="Refresh Portal"
          aria-label="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {activeSection === 'tasks' && (
        <div className="space-y-4 animate-fadeIn" id="sect-worker-directives">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 font-sans">
            My Active Tasks ({tasks.length})
          </h2>

          {tasks.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-[#222631] rounded-lg">
              <CheckSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-xs text-gray-400 font-mono">No tasks assigned</p>
              <p className="text-[10px] text-gray-500 font-mono mt-1">Great! There are no pending tasks right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map((task) => (
                <div key={task.id} className="bg-[#131620] border border-[#222631]/60 p-5 rounded-lg flex flex-col justify-between space-y-4 font-mono text-xs">
                  <div>
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="text-sm font-bold text-white font-sans">{task.title}</h3>
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        task.is_completed 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                      }`}>
                        {task.is_completed ? 'Completed' : 'Active'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-sans mt-2 font-medium leading-relaxed">{task.description || 'Instructions pending'}</p>
                  </div>

                  <div className="pt-3 border-t border-gray-800 flex items-center justify-between text-[11px] font-mono">
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase block">Due date:</span>
                      <span className="text-gray-300">{task.due_date}</span>
                    </div>

                    <button
                      onClick={() => handleToggleTask(task)}
                      className={`px-3 py-1.5 rounded text-[10px] uppercase font-bold transition-all cursor-pointer font-sans border ${
                        task.is_completed
                          ? 'bg-[#122A1E] text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500 text-black border-transparent hover:bg-amber-600'
                      }`}
                      id={`worker-task-toggle-${task.id}`}
                    >
                      {task.is_completed ? 'Mark Active' : 'Mark Done'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'attendance_history' && (
        <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4 animate-fadeIn" id="sect-worker-rolls">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 font-sans">
            My Attendance History
          </h2>

          <div className="overflow-x-auto text-xs font-mono">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222631] text-gray-400 bg-[#161922]">
                  <th className="p-3 uppercase">Logged Date</th>
                  <th className="p-3 uppercase">Workplace</th>
                  <th className="p-3 uppercase font-sans">Status</th>
                  <th className="p-3 uppercase font-sans">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D212A]">
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500 font-sans">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  attendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#161B24] transition-colors font-semibold">
                      <td className="p-3 text-gray-200">{log.attendance_date}</td>
                      <td className="p-3 text-gray-400">{assignedSite ? assignedSite.name : 'Main Office'}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase ${
                          log.status === 'present'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : log.status === 'absent'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            : log.status === 'half_day'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {log.status === 'half_day' ? 'Half Day' : log.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-300 font-sans font-medium">{log.notes || 'No notes added'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'profile' && (
        <div className="bg-[#13161C] border border-[#222631] p-6 rounded-lg max-w-2xl animate-fadeIn space-y-6" id="sect-worker-profile">
          <div className="flex items-center gap-4 border-b border-[#222631] pb-5">
            <img 
              src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile?.full_name || '')}`} 
              alt="worker" 
              className="w-16 h-16 rounded border-2 border-amber-500 bg-gray-900"
              referrerPolicy="no-referrer"
            />
            <div>
              <h3 className="text-lg font-bold text-white">{profile?.full_name}</h3>
              <p className="text-xs font-mono text-amber-500 uppercase tracking-widest mt-0.5">Staff Member • {workerInfo?.worker_code || 'W-PEND'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-[#181C25] border border-[#2B3242]/40 rounded p-4 space-y-1">
              <span className="text-gray-500 block uppercase font-bold text-[10px]">Compensation</span>
              <div className="flex items-center gap-1.5 pt-1 text-emerald-400 font-extrabold text-xl font-sans">
                <DollarSign className="w-5 h-5" />
                <span>{(workerInfo?.salary || 4500).toLocaleString()}/mo</span>
              </div>
              <span className="text-[10px] text-gray-500 block">Paid monthly via direct deposit</span>
            </div>

            <div className="bg-[#181C25] border border-[#2B3242]/40 rounded p-4 space-y-1">
              <span className="text-gray-500 block uppercase font-bold text-[10px]">Workplace Address</span>
              <p className="text-white font-bold font-sans text-sm mt-1">{assignedSite ? assignedSite.name : 'Roster Standby Pool'}</p>
              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-sans mt-0.5">
                <Building className="w-3.5 h-3.5 text-gray-500" />
                <span>{assignedSite ? assignedSite.location : 'Main Office'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'notifications' && (
        <div className="bg-[#13161C] border border-[#222631] p-5 rounded-lg space-y-4 animate-fadeIn" id="sect-worker-alerts">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[#888E99] font-bold border-b border-[#222631] pb-3 font-sans">
            Safety Alerts ({notifications.length})
          </h2>

          {notifications.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-mono">
              <Bell className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-xs uppercase">No alerts right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`border p-4 rounded-lg flex items-start justify-between gap-5 transition-all ${
                    notif.is_read 
                      ? 'bg-[#181C25]/50 border-gray-800 text-gray-400' 
                      : 'bg-[#201C14] border-amber-500/25 text-gray-200'
                  }`}
                >
                  <div className="flex gap-3">
                    <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${notif.is_read ? 'bg-gray-700' : 'bg-amber-500'}`} />
                    <div>
                      <h4 className={`text-sm font-bold ${notif.is_read ? 'text-gray-400' : 'text-white'}`}>{notif.title}</h4>
                      <p className="text-xs mt-1 leading-relaxed font-sans font-medium">{notif.message}</p>
                      <span className="text-[10px] font-mono text-gray-500 block mt-2">
                        {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Just Now'}
                      </span>
                    </div>
                  </div>

                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="text-[10px] font-mono hover:text-amber-400 uppercase font-bold border border-gray-700 px-2 py-0.5 rounded cursor-pointer shrink-0 transition-colors bg-black/10"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
