export type PunchType = 'ENTRADA' | 'SAIDA';
export type LegacyPunchType = 'INTERVALO_SAIDA' | 'INTERVALO_RETORNO';

export interface StaffMember {
  id: string;
  name: string;
  role: 'Instrutor' | 'Personal Trainer' | 'Estagiário' | 'Coordenador' | 'Recepcionista';
  pin: string;
  email?: string;
  phone?: string;
  avatar?: string;
  color: string;
  active: boolean;
  scheduledShift: string; // e.g. "06:00 - 14:00", "14:00 - 22:00"
  hourlyRate: number; // Valor pago por hora em R$ (ex: 45.00)
}

export interface TimeRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  timestamp: number;
  type: PunchType | LegacyPunchType;
  location: string;
  notes?: string;
  code: string; // Electronic receipt voucher code (e.g., "PG-8492-CD")
}

export interface ZoneBreakdown {
  musculacao: number;
  cardio: number;
  funcional: number;
  outros: number;
}

export interface OccupancyCount {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "06:00", "06:30", "07:00", ..., "22:00"
  timestamp: number;
  count: number;
  maxCapacity: number;
  breakdown: ZoneBreakdown;
  loggedByStaffId: string;
  loggedByStaffName: string;
  notes?: string;
  status: 'normal' | 'alerta' | 'lotado';
}

export interface GymSettings {
  gymName: string;
  condoName: string;
  unitAddress: string;
  maxCapacity: number;
  warningCapacity: number; // e.g. 80% of max
  openingTime: string; // "06:00"
  closingTime: string; // "22:00"
  intervalMinutes: number; // 30
  soundAlertEnabled: boolean;
  alertAdvanceMinutes: number; // 5 min before slot
  zones: {
    musculacao: string;
    cardio: string;
    funcional: string;
    outros: string;
  };
}

export interface DailyStaffSummary {
  staffId: string;
  staffName: string;
  role: string;
  date: string;
  entrada?: string;
  saida?: string;
  totalWorkedMinutes: number;
  status: 'EM_TURNO' | 'FINALIZADO' | 'NAO_INICIADO';
  records: TimeRecord[];
}

export interface DayPayrollDetail {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // "Segunda-feira", "Domingo", etc.
  isSunday: boolean;
  isHoliday: boolean;
  isDoubleRate: boolean; // true if Sunday or Holiday
  holidayName?: string;
  entrada?: string;
  saida?: string;
  workedMinutes: number;
  workedHours: number;
  baseHourlyRate: number;
  multiplier: number; // 1 or 2
  effectiveHourlyRate: number; // baseHourlyRate * multiplier
  dailyTotal: number; // workedHours * effectiveHourlyRate
}

export interface MonthlyPayrollSummary {
  staffId: string;
  staffName: string;
  role: string;
  color: string;
  baseHourlyRate: number;
  month: string; // YYYY-MM
  regularMinutes: number;
  regularHours: number;
  sundayHolidayMinutes: number;
  sundayHolidayHours: number;
  totalWorkedMinutes: number;
  totalWorkedHours: number;
  regularEarnings: number; // regularHours * baseHourlyRate
  sundayHolidayEarnings: number; // sundayHolidayHours * (baseHourlyRate * 2)
  totalGrossSalary: number; // regularEarnings + sundayHolidayEarnings
  daysWorkedCount: number;
  daysBreakdown: DayPayrollDetail[];
}
