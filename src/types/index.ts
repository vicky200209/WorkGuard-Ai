export type UserRole = 'admin' | 'site_manager' | 'supervisor' | 'worker';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at?: string;
}

export interface Site {
  id: string;
  name: string;
  location: string;
  manager_id?: string; // profile_id of site_manager
  is_deleted?: boolean;
}

export interface Supervisor {
  id: string;
  profile_id: string;
  site_id: string;
  status: 'active' | 'inactive';
}

export interface Worker {
  id: string;
  profile_id: string;
  site_id: string;
  supervisor_id: string;
  worker_code: string;
  salary: number;
  status: 'active' | 'inactive';
}

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export interface Attendance {
  id: string;
  worker_id: string;
  site_id: string;
  marked_by: string; // supervisor profile_id
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  worker_name?: string; // Joined field for frontend convenience
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';

export interface Task {
  id: string;
  site_id: string;
  assigned_worker?: string | null; // worker profile_id or id
  assigned_supervisor?: string | null; // supervisor profile_id or id
  title: string;
  description: string;
  is_completed: boolean; // Keep boolean as required or map to status
  status?: TaskStatus; // To support both status update (as asked in supervisor) and is_completed
  due_date: string;
  is_deleted: boolean;
}

export interface SiteInspection {
  id: string;
  site_id: string;
  supervisor_id: string; // profile_id
  notes: string;
  ai_result?: string | null; // AI risk analysis or inspection result
  created_at: string;
  is_deleted?: boolean;
}

export type MaterialStatus = 'available' | 'low_stock' | 'out_of_stock' | 'ordered';

export interface Material {
  id: string;
  site_id: string;
  name: string;
  quantity: number;
  unit: string;
  status: MaterialStatus;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  priority: 'low' | 'medium' | 'high';
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performed_by: string; // profile_id or full_name
  target_table: string;
  target_id: string;
  created_at: string;
}
