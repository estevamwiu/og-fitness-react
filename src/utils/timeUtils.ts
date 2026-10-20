import { TimeRecord, DailyStaffSummary, StaffMember, MonthlyPayrollSummary, DayPayrollDetail } from '../types';

// Generate 30-minute slot list between opening and closing (e.g., "06:00" to "22:00")
export function generateTimeSlots(openingTime: string = '06:00', closingTime: string = '22:00'): string[] {
  const slots: string[] = [];
  const [startH, startM] = openingTime.split(':').map(Number);
  const [endH, endM] = closingTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    const slotStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    slots.push(slotStr);
    currentMinutes += 30;
  }

  return slots;
}

// Get the current closest 30-minute time slot (e.g. 14:12 -> 14:00, 14:48 -> 14:30)
export function getClosest30MinSlot(date: Date = new Date()): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  const roundedMin = minutes < 30 ? '00' : '30';
  return `${hours.toString().padStart(2, '0')}:${roundedMin}`;
}

// Get the NEXT upcoming 30-minute slot
export function getNext30MinSlot(date: Date = new Date()): { slot: string; targetDate: Date; secondsRemaining: number } {
  const current = new Date(date);
  const minutes = current.getMinutes();
  const nextTarget = new Date(current);

  if (minutes < 30) {
    nextTarget.setMinutes(30, 0, 0);
  } else {
    nextTarget.setHours(nextTarget.getHours() + 1, 0, 0, 0);
  }

  const secondsRemaining = Math.max(0, Math.floor((nextTarget.getTime() - current.getTime()) / 1000));
  const slotHours = nextTarget.getHours().toString().padStart(2, '0');
  const slotMinutes = nextTarget.getMinutes().toString().padStart(2, '0');

  return {
    slot: `${slotHours}:${slotMinutes}`,
    targetDate: nextTarget,
    secondsRemaining,
  };
}

// Format seconds into MM:SS
export function formatSecondsToCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Format date to ISO YYYY-MM-DD
export function formatDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Format date to Brazilian friendly display (e.g. "24/08/2026", "Segunda-feira, 24 de Agosto")
export function formatDateBR(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
}

export function formatFullDateLongBR(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

// Generate receipt voucher code
export function generateReceiptCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `CG-${randomNum}-${randomLetters}`;
}

// Calculate worked minutes between two HH:mm:ss strings
export function calculateMinutesBetween(timeStart?: string, timeEnd?: string): number {
  if (!timeStart || !timeEnd) return 0;
  const [h1, m1] = timeStart.split(':').map(Number);
  const [h2, m2] = timeEnd.split(':').map(Number);
  const total1 = h1 * 60 + m1;
  const total2 = h2 * 60 + m2;
  return Math.max(0, total2 - total1);
}

// Format minutes into "7h 30m"
export function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Build daily summary for each staff member based on their time records
export function computeDailyStaffSummary(staff: StaffMember, records: TimeRecord[], date: string): DailyStaffSummary {
  const staffRecords = records
    .filter((r) => r.staffId === staff.id && r.date === date)
    .sort((a, b) => a.timestamp - b.timestamp);

  const entrada = staffRecords.find((r) => r.type === 'ENTRADA')?.time;
  const intervaloSaida = staffRecords.find((r) => r.type === 'INTERVALO_SAIDA')?.time;
  const intervaloRetorno = staffRecords.find((r) => r.type === 'INTERVALO_RETORNO')?.time;
  const saida = staffRecords.find((r) => r.type === 'SAIDA')?.time;

  let totalWorkedMinutes = 0;
  let totalBreakMinutes = 0;

  if (intervaloSaida && intervaloRetorno) {
    totalBreakMinutes = calculateMinutesBetween(intervaloSaida, intervaloRetorno);
  }

  // If both entrada and saida exist:
  if (entrada && saida) {
    const grossMinutes = calculateMinutesBetween(entrada, saida);
    totalWorkedMinutes = Math.max(0, grossMinutes - totalBreakMinutes);
  } else if (entrada && !saida) {
    // Current in progress
    const now = new Date();
    const nowTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    if (intervaloSaida && !intervaloRetorno) {
      // In break
      const workBeforeBreak = calculateMinutesBetween(entrada, intervaloSaida);
      totalWorkedMinutes = workBeforeBreak;
    } else {
      const grossMinutes = calculateMinutesBetween(entrada, nowTime);
      totalWorkedMinutes = Math.max(0, grossMinutes - totalBreakMinutes);
    }
  }

  let status: DailyStaffSummary['status'] = 'NAO_INICIADO';
  if (staffRecords.length === 0) {
    status = 'NAO_INICIADO';
  } else {
    const lastRecord = staffRecords[staffRecords.length - 1];
    if (lastRecord.type === 'ENTRADA' || lastRecord.type === 'INTERVALO_RETORNO') {
      status = 'EM_TURNO';
    } else if (lastRecord.type === 'INTERVALO_SAIDA') {
      status = 'EM_INTERVALO';
    } else if (lastRecord.type === 'SAIDA') {
      status = 'FINALIZADO';
    }
  }

  return {
    staffId: staff.id,
    staffName: staff.name,
    role: staff.role,
    date,
    entrada,
    intervaloSaida,
    intervaloRetorno,
    saida,
    totalWorkedMinutes,
    totalBreakMinutes,
    status,
    records: staffRecords,
  };
}

// Feriados Nacionais Brasileiros (formato MM-DD)
export const BRAZILIAN_HOLIDAYS_FIXED: Record<string, string> = {
  '01-01': 'Confraternização Universal (Ano Novo)',
  '04-21': 'Tiradentes',
  '05-01': 'Dia Mundial do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'N. Sra. Aparecida (Padroeira do Brasil)',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Dia Nacional de Zumbi e da Consciência Negra',
  '12-25': 'Natal',
};

// Verifica se uma data específica é Domingo ou Feriado Nacional (para cálculo 2x dobrado)
export function isSundayOrHoliday(dateString: string): { 
  isDoubleRate: boolean; 
  isSunday: boolean; 
  isHoliday: boolean; 
  label: string; 
  holidayName?: string;
} {
  if (!dateString) return { isDoubleRate: false, isSunday: false, isHoliday: false, label: 'Dia Útil' };
  
  const [year, month, day] = dateString.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
  const mmDd = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  const holidayName = BRAZILIAN_HOLIDAYS_FIXED[mmDd];
  if (holidayName) {
    return {
      isDoubleRate: true,
      isSunday: dayOfWeek === 0,
      isHoliday: true,
      label: `Feriado (${holidayName}) - 2x Dobrado`,
      holidayName,
    };
  }

  if (dayOfWeek === 0) {
    return {
      isDoubleRate: true,
      isSunday: true,
      isHoliday: false,
      label: 'Domingo - 2x Dobrado',
    };
  }

  if (dayOfWeek === 6) {
    return {
      isDoubleRate: false,
      isSunday: false,
      isHoliday: false,
      label: 'Sábado (Horista Regular)',
    };
  }

  return {
    isDoubleRate: false,
    isSunday: false,
    isHoliday: false,
    label: 'Dia Útil (Horista Regular)',
  };
}

// Formata valores em Real Brasileiro (ex: R$ 4.250,00)
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Formata horas decimais (ex: 140.5 -> "140h 30m" ou "140.5h")
export function formatDecimalHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

// Calcula o fechamento mensal da folha de pagamento de um colaborador horista
export function calculateMonthlyStaffPayroll(
  staff: StaffMember,
  records: TimeRecord[],
  yearMonth: string // "YYYY-MM"
): MonthlyPayrollSummary {
  const baseRate = typeof staff.hourlyRate === 'number' && staff.hourlyRate > 0 ? staff.hourlyRate : 45;

  // Filtrar registros deste colaborador e deste mês
  const monthRecords = records.filter(
    (r) => r.staffId === staff.id && r.date.startsWith(yearMonth)
  );

  // Obter datas distintas trabalhadas
  const uniqueDates = Array.from(new Set(monthRecords.map((r) => r.date))).sort();

  let regularMinutes = 0;
  let sundayHolidayMinutes = 0;

  const daysBreakdown: DayPayrollDetail[] = uniqueDates.map((date) => {
    const dailySummary = computeDailyStaffSummary(staff, records, date);
    const workedMin = dailySummary.totalWorkedMinutes;
    const specialCheck = isSundayOrHoliday(date);
    
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayOfWeek = dayNames[dateObj.getDay()];

    const multiplier = specialCheck.isDoubleRate ? 2 : 1;
    const effectiveHourlyRate = baseRate * multiplier;
    const workedHours = Math.round((workedMin / 60) * 100) / 100;
    const dailyTotal = Math.round((workedHours * effectiveHourlyRate) * 100) / 100;

    if (specialCheck.isDoubleRate) {
      sundayHolidayMinutes += workedMin;
    } else {
      regularMinutes += workedMin;
    }

    return {
      date,
      dayOfWeek,
      isSunday: specialCheck.isSunday,
      isHoliday: specialCheck.isHoliday,
      isDoubleRate: specialCheck.isDoubleRate,
      holidayName: specialCheck.holidayName,
      entrada: dailySummary.entrada,
      saida: dailySummary.saida,
      intervaloMinutos: dailySummary.totalBreakMinutes,
      workedMinutes: workedMin,
      workedHours,
      baseHourlyRate: baseRate,
      multiplier,
      effectiveHourlyRate,
      dailyTotal,
    };
  });

  const regularHours = Math.round((regularMinutes / 60) * 100) / 100;
  const sundayHolidayHours = Math.round((sundayHolidayMinutes / 60) * 100) / 100;
  const totalWorkedMinutes = regularMinutes + sundayHolidayMinutes;
  const totalWorkedHours = Math.round((totalWorkedMinutes / 60) * 100) / 100;

  const regularEarnings = Math.round((regularHours * baseRate) * 100) / 100;
  const sundayHolidayEarnings = Math.round((sundayHolidayHours * (baseRate * 2)) * 100) / 100;
  const totalGrossSalary = Math.round((regularEarnings + sundayHolidayEarnings) * 100) / 100;

  return {
    staffId: staff.id,
    staffName: staff.name,
    role: staff.role,
    color: staff.color,
    baseHourlyRate: baseRate,
    month: yearMonth,
    regularMinutes,
    regularHours,
    sundayHolidayMinutes,
    sundayHolidayHours,
    totalWorkedMinutes,
    totalWorkedHours,
    regularEarnings,
    sundayHolidayEarnings,
    totalGrossSalary,
    daysWorkedCount: uniqueDates.length,
    daysBreakdown,
  };
}
