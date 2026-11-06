import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Holiday, PunchType, StaffMember, TimeRecord } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para habilitar o acesso.');
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}

export interface UserProfile {
  id: string;
  role: 'manager' | 'professor';
  staffId: string | null;
  staffName?: string;
  username?: string;
}

interface StaffRow {
  id: string;
  name: string;
  username?: string | null;
  pin?: string | null;
  role: StaffMember['role'];
  email: string | null;
  phone: string | null;
  color: string;
  active: boolean;
  scheduled_shift: string;
}

interface TimeRecordRow {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_role: string;
  date: string;
  time: string;
  timestamp: number;
  type: TimeRecord['type'];
  location: string;
  notes: string | null;
  code: string;
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, role, staff_id')
    .eq('id', userId)
    .single();
  throwOnError(error);
  if (!data) throw new Error('Profile not found');
  return { id: data.id, role: data.role, staffId: data.staff_id };
}

export async function fetchStaff(isManager: boolean): Promise<StaffMember[]> {
  const supabase = getSupabase();
  const [{ data: staffRows, error: staffError }, payrollResult, profilesResult] = await Promise.all([
    supabase
      .from('staff')
      .select('id, name, username, pin, role, email, phone, color, active, scheduled_shift')
      .order('name'),
    isManager
      ? supabase.from('staff_payroll').select('staff_id, hourly_rate')
      : Promise.resolve({ data: [], error: null }),
    isManager
      ? supabase.from('profiles').select('staff_id').eq('role', 'professor')
      : Promise.resolve({ data: [], error: null }),
  ]);
  throwOnError(staffError);
  throwOnError(payrollResult.error);
  throwOnError(profilesResult.error);

  const rates = new Map((payrollResult.data || []).map((row) => [row.staff_id, Number(row.hourly_rate)]));
  const linkedStaffIds = new Set((profilesResult.data || []).map((row) => row.staff_id).filter(Boolean));

  return ((staffRows || []) as StaffRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username || undefined,
    role: row.role,
    pin: isManager ? row.pin || undefined : undefined,
    email: row.email || undefined,
    phone: row.phone || undefined,
    color: row.color,
    active: row.active,
    scheduledShift: row.scheduled_shift,
    hourlyRate: isManager ? rates.get(row.id) || 0 : 0,
    hasLoginAccount: isManager ? linkedStaffIds.has(row.id) : undefined,
  }));
}

export async function updateStaffHourlyRate(staffId: string, hourlyRate: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('staff_payroll')
    .upsert({
      staff_id: staffId,
      hourly_rate: Number(hourlyRate),
      updated_at: new Date().toISOString(),
    });
  throwOnError(error);
}

export async function verifyStaffLogin(
  username: string,
  pin: string,
): Promise<{ success: boolean; staff?: StaffMember; error?: string }> {
  const supabase = getSupabase();
  const cleanUsername = username.trim().toLowerCase();
  const cleanPin = pin.trim();

  try {
    const { data, error } = await supabase.rpc('verify_staff_login', {
      p_username: cleanUsername,
      p_pin: cleanPin,
    });

    if (!error && data) {
      if (data.success && data.staff) {
        return {
          success: true,
          staff: {
            id: data.staff.id,
            name: data.staff.name,
            username: data.staff.username,
            role: data.staff.role,
            color: data.staff.color,
            active: true,
            scheduledShift: data.staff.scheduledShift,
            hourlyRate: Number(data.staff.hourlyRate) || 0,
          },
        };
      }
      return { success: false, error: data.error || 'Nome de usuário ou PIN incorreto.' };
    }
  } catch {
    // If RPC is not available yet, fallback to direct staff table query
  }

  // Fallback to direct query on staff table
  const { data: staffData, error: directError } = await supabase
    .from('staff')
    .select('id, name, username, pin, role, color, active, scheduled_shift')
    .ilike('username', cleanUsername)
    .eq('pin', cleanPin)
    .eq('active', true)
    .maybeSingle();

  if (directError || !staffData) {
    return { success: false, error: 'Nome de usuário ou PIN de 6 dígitos inválido.' };
  }

  return {
    success: true,
    staff: {
      id: staffData.id,
      name: staffData.name,
      username: staffData.username || undefined,
      role: staffData.role,
      color: staffData.color,
      active: staffData.active,
      scheduledShift: staffData.scheduled_shift,
      hourlyRate: 0,
    },
  };
}

export async function fetchTimeRecords(): Promise<TimeRecord[]> {
  const supabase = getSupabase();
  const rows: TimeRecordRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('time_records')
      .select('id, staff_id, staff_name, staff_role, date, time, timestamp, type, location, notes, code')
      .order('timestamp', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + 999);
    throwOnError(error);
    rows.push(...(data || []) as TimeRecordRow[]);
    if (!data || data.length < 1000) break;
  }

  return rows.map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    staffRole: row.staff_role,
    date: row.date,
    time: row.time,
    timestamp: row.timestamp,
    type: row.type,
    location: row.location,
    notes: row.notes || undefined,
    code: row.code,
  }));
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data, error } = await getSupabase()
    .from('holidays')
    .select('date, name')
    .order('date');
  throwOnError(error);
  return (data || []).map((row) => ({ date: row.date, name: row.name }));
}

export async function saveStaff(staffList: StaffMember[]): Promise<void> {
  const supabase = getSupabase();
  const { data: currentStaff, error: currentStaffError } = await supabase.from('staff').select('id');
  throwOnError(currentStaffError);

  const staffRows = staffList.map((staff) => ({
    id: staff.id,
    name: staff.name,
    username: staff.username ? staff.username.trim().toLowerCase() : null,
    pin: staff.pin ? staff.pin.trim() : null,
    role: staff.role,
    email: staff.email || null,
    phone: staff.phone || null,
    color: staff.color,
    active: staff.active,
    scheduled_shift: staff.scheduledShift,
  }));
  const { error: staffError } = await supabase.from('staff').upsert(staffRows);
  throwOnError(staffError);

  const payrollRows = staffList
    .filter((staff) => Number.isFinite(staff.hourlyRate) && staff.hourlyRate > 0)
    .map((staff) => ({
      staff_id: staff.id,
      hourly_rate: staff.hourlyRate,
    }));
  if (payrollRows.length > 0) {
    const { error: payrollError } = await supabase.from('staff_payroll').upsert(payrollRows);
    throwOnError(payrollError);
  }

  const retainedIds = new Set(staffList.map((staff) => staff.id));
  const deactivatedRows = (currentStaff || [])
    .filter((row) => !retainedIds.has(row.id))
    .map((row) => row.id);
  for (const id of deactivatedRows) {
    const { error: deactivateError } = await supabase.from('staff').update({ active: false }).eq('id', id);
    throwOnError(deactivateError);
  }
}

export async function registerTimePunch(
  staffId: string,
  type: PunchType,
  location: string,
  notes?: string,
): Promise<TimeRecord> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .rpc('register_time_punch', {
        p_staff_id: staffId,
        p_type: type,
        p_location: location,
        p_notes: notes || null,
      })
      .single();
    if (error) throw error;

    const row = data as TimeRecordRow;
    return {
      id: row.id,
      staffId: row.staff_id,
      staffName: row.staff_name,
      staffRole: row.staff_role,
      date: row.date,
      time: row.time,
      timestamp: row.timestamp,
      type: row.type,
      location: row.location,
      notes: row.notes || undefined,
      code: row.code,
    };
  } catch (rpcErr) {
    // If RPC execution fails (e.g. schema needs direct insert), fallback to client-side insert
    const { data: staffData } = await supabase
      .from('staff')
      .select('name, role')
      .eq('id', staffId)
      .single();

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toLocaleTimeString('pt-BR', { hour12: false });
    const code = `PG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newRecordRow = {
      id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      staff_id: staffId,
      staff_name: staffData?.name || 'Instrutor',
      staff_role: staffData?.role || 'Instrutor',
      date,
      time,
      timestamp: now.getTime(),
      type,
      location: location || 'OG FITNESS',
      notes: notes || null,
      code,
    };

    const { error: insertError } = await supabase.from('time_records').insert(newRecordRow);
    if (insertError) {
      throw rpcErr instanceof Error ? rpcErr : new Error('Falha ao registrar batida de ponto.');
    }

    return {
      id: newRecordRow.id,
      staffId: newRecordRow.staff_id,
      staffName: newRecordRow.staff_name,
      staffRole: newRecordRow.staff_role,
      date: newRecordRow.date,
      time: newRecordRow.time,
      timestamp: newRecordRow.timestamp,
      type: newRecordRow.type,
      location: newRecordRow.location,
      notes: newRecordRow.notes || undefined,
      code: newRecordRow.code,
    };
  }
}

export async function saveHoliday(holiday: Holiday): Promise<void> {
  const { error } = await getSupabase().from('holidays').upsert(holiday);
  throwOnError(error);
}

export async function deleteHoliday(date: string): Promise<void> {
  const { error } = await getSupabase().from('holidays').delete().eq('date', date);
  throwOnError(error);
}

export async function linkStaffAccount(email: string, staffId: string): Promise<void> {
  const { error } = await getSupabase().rpc('link_staff_account', {
    p_email: email,
    p_staff_id: staffId,
  });
  throwOnError(error);
}

export async function importLocalPayrollData(
  staffList: StaffMember[],
  records: TimeRecord[],
): Promise<void> {
  const supabase = getSupabase();
  const staffRows = staffList.map((staff) => ({
    id: staff.id,
    name: staff.name,
    username: staff.username ? staff.username.trim().toLowerCase() : null,
    pin: staff.pin ? staff.pin.trim() : null,
    role: staff.role,
    email: staff.email || null,
    phone: staff.phone || null,
    color: staff.color,
    active: staff.active,
    scheduled_shift: staff.scheduledShift,
  }));
  const { error: staffError } = await supabase.from('staff').upsert(staffRows);
  throwOnError(staffError);

  const payrollRows = staffList
    .filter((staff) => Number.isFinite(staff.hourlyRate) && staff.hourlyRate > 0)
    .map((staff) => ({
      staff_id: staff.id,
      hourly_rate: staff.hourlyRate,
    }));
  if (payrollRows.length > 0) {
    const { error: payrollError } = await supabase.from('staff_payroll').upsert(payrollRows);
    throwOnError(payrollError);
  }

  const timeRows = records
    .filter((record) => !record.id.startsWith('tr-seed-') && record.id !== 'tr-today-1')
    .map((record) => ({
      id: record.id,
      staff_id: record.staffId,
      staff_name: record.staffName,
      staff_role: record.staffRole,
      date: record.date,
      time: record.time,
      timestamp: record.timestamp,
      type: record.type,
      location: record.location,
      notes: record.notes || null,
      code: record.code,
    }));
  for (let from = 0; from < timeRows.length; from += 500) {
    const { error: timeError } = await supabase.from('time_records').upsert(timeRows.slice(from, from + 500));
    throwOnError(timeError);
  }
}

export async function fetchPayrollMigrationStatus(): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('app_config')
    .select('value')
    .eq('key', 'payroll_migration_complete')
    .maybeSingle();
  throwOnError(error);
  return data?.value === true;
}

export async function completePayrollMigration(): Promise<void> {
  const { error } = await getSupabase()
    .from('app_config')
    .upsert({ key: 'payroll_migration_complete', value: true, updated_at: new Date().toISOString() });
  throwOnError(error);
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
