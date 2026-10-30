import { GymSettings, StaffMember, OccupancyCount, TimeRecord } from '../types';
import { formatDateKey, generateTimeSlots, generateReceiptCode } from './timeUtils';

const SETTINGS_KEY = 'condogym_settings_v1';
const STAFF_KEY = 'condogym_staff_v1';
const OCCUPANCY_KEY = 'condogym_occupancy_v1';
const TIME_RECORDS_KEY = 'condogym_time_records_v1';

export const DEFAULT_SETTINGS: GymSettings = {
  gymName: 'Academia Fitness & Wellness',
  condoName: 'Condomínio Residencial Jardins do Bosque',
  unitAddress: 'Espaço Fitness - Piso Térreo / Bloco Central',
  maxCapacity: 35,
  warningCapacity: 28, // 80%
  openingTime: '06:00',
  closingTime: '22:00',
  intervalMinutes: 30,
  soundAlertEnabled: true,
  alertAdvanceMinutes: 5,
  zones: {
    musculacao: 'Musculação / Pesos Livres',
    cardio: 'Cardio (Esteiras & Bikes)',
    funcional: 'Área Funcional / Alongamento',
    outros: 'Salas Especiais / Pilates',
  },
};

export const DEFAULT_STAFF: StaffMember[] = [
  {
    id: 'st-1',
    name: 'Carlos Eduardo Silva',
    role: 'Instrutor',
    pin: '1234',
    email: 'carlos.silva@condogym.com.br',
    phone: '(11) 98765-4321',
    color: '#10B981', // Emerald
    active: true,
    scheduledShift: '06:00 - 14:00 (Manhã)',
    hourlyRate: 45.0, // R$ 45/h
  },
  {
    id: 'st-2',
    name: 'Mariana Costa Ribeiro',
    role: 'Instrutor',
    pin: '2345',
    email: 'mariana.costa@condogym.com.br',
    phone: '(11) 97654-3210',
    color: '#3B82F6', // Blue
    active: true,
    scheduledShift: '14:00 - 22:00 (Tarde/Noite)',
    hourlyRate: 45.0, // R$ 45/h
  },
  {
    id: 'st-3',
    name: 'Rafael Mendes Rocha',
    role: 'Personal Trainer',
    pin: '3456',
    email: 'rafael.rocha@condogym.com.br',
    phone: '(11) 96543-2109',
    color: '#F59E0B', // Amber
    active: true,
    scheduledShift: '07:00 - 16:00 (Intermediário)',
    hourlyRate: 65.0, // R$ 65/h
  },
  {
    id: 'st-4',
    name: 'Juliana Beatriz Santos',
    role: 'Estagiário',
    pin: '4567',
    email: 'juliana.santos@condogym.com.br',
    phone: '(11) 95432-1098',
    color: '#8B5CF6', // Purple
    active: true,
    scheduledShift: '17:00 - 21:00 (Pico Noite)',
    hourlyRate: 25.0, // R$ 25/h
  },
];

// Generate realistic mock occupancy counts for today and past 6 days
export function generateSeedOccupancy(): OccupancyCount[] {
  const counts: OccupancyCount[] = [];
  const today = new Date();
  const allSlots = generateTimeSlots('06:00', '22:00');

  // Curve profile: Low early (6-7h), morning peak (7-9h), lunch lull (12-14h), afternoon rise (17-20h - high peak), drops (21-22h)
  const getSimulatedCount = (slot: string, isWeekend: boolean): { total: number; musculacao: number; cardio: number; funcional: number; outros: number } => {
    const [h, m] = slot.split(':').map(Number);
    const timeVal = h + m / 60;
    let base = 5;

    if (timeVal >= 6 && timeVal < 7) base = 6;
    else if (timeVal >= 7 && timeVal < 9.5) base = isWeekend ? 16 : 22; // morning peak
    else if (timeVal >= 9.5 && timeVal < 11.5) base = isWeekend ? 20 : 12;
    else if (timeVal >= 11.5 && timeVal < 14) base = 8;
    else if (timeVal >= 14 && timeVal < 17) base = 10;
    else if (timeVal >= 17 && timeVal < 20.5) base = isWeekend ? 14 : 31; // evening peak
    else if (timeVal >= 20.5 && timeVal < 21.5) base = 18;
    else base = 7;

    const jitter = Math.floor(Math.random() * 5) - 2;
    const total = Math.max(2, Math.min(35, base + jitter));

    const musculacao = Math.round(total * 0.5);
    const cardio = Math.round(total * 0.3);
    const funcional = Math.round(total * 0.15);
    const outros = Math.max(0, total - (musculacao + cardio + funcional));

    return { total, musculacao, cardio, funcional, outros };
  };

  // Past 6 days + today
  for (let d = 6; d >= 0; d--) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - d);
    const dateKey = formatDateKey(targetDate);
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;

    // For today, only populate up to current hour/half-hour
    const currentHour = today.getHours();
    const currentMin = today.getMinutes();

    allSlots.forEach((slot, idx) => {
      const [sh, sm] = slot.split(':').map(Number);
      if (d === 0 && (sh > currentHour || (sh === currentHour && sm > currentMin))) {
        // Skip future slots for today
        return;
      }

      const sim = getSimulatedCount(slot, isWeekend);
      const staffIndex = idx < allSlots.length / 2 ? 0 : 1;
      const staff = DEFAULT_STAFF[staffIndex];

      let status: OccupancyCount['status'] = 'normal';
      if (sim.total >= 30) status = 'lotado';
      else if (sim.total >= 24) status = 'alerta';

      counts.push({
        id: `occ-${dateKey}-${slot.replace(':', '')}`,
        date: dateKey,
        timeSlot: slot,
        timestamp: new Date(`${dateKey}T${slot}:00`).getTime(),
        count: sim.total,
        maxCapacity: 35,
        breakdown: {
          musculacao: sim.musculacao,
          cardio: sim.cardio,
          funcional: sim.funcional,
          outros: sim.outros,
        },
        loggedByStaffId: staff.id,
        loggedByStaffName: staff.name,
        status,
      });
    });
  }

  return counts;
}

// Generate realistic mock time clock records for staff
export function generateSeedTimeRecords(): TimeRecord[] {
  const records: TimeRecord[] = [];
  const today = new Date();
  let idCounter = 1;

  // Helper to add a complete day's punches
  const addDayPunches = (
    staff: StaffMember,
    dateKey: string,
    inTime: string,
    outTime: string
  ) => {
    records.push({
      id: `tr-seed-${idCounter++}`,
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      date: dateKey,
      time: inTime,
      timestamp: new Date(`${dateKey}T${inTime}`).getTime(),
      type: 'ENTRADA',
      location: 'Academia Bloco Central',
      code: generateReceiptCode(),
    });

    if (outTime) {
      records.push({
        id: `tr-seed-${idCounter++}`,
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
        date: dateKey,
        time: outTime,
        timestamp: new Date(`${dateKey}T${outTime}`).getTime(),
        type: 'SAIDA',
        location: 'Academia Bloco Central',
        code: generateReceiptCode(),
      });
    }
  };

  // Generate historical shifts for the last 20 days
  for (let d = 20; d >= 1; d--) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - d);
    const dateKey = formatDateKey(targetDate);
    const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 6 is Saturday

    // 1. Carlos (Mon - Fri: 06:00 to 14:00)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      addDayPunches(DEFAULT_STAFF[0], dateKey, '05:58:12', '14:02:15');
    } else if (dayOfWeek === 6 && d % 2 === 0) {
      // Carlos Saturday shift (4 hours)
      addDayPunches(DEFAULT_STAFF[0], dateKey, '07:00:10', '12:00:22');
    }

    // 2. Mariana (Mon - Fri: 14:00 to 22:00)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      addDayPunches(DEFAULT_STAFF[1], dateKey, '13:55:40', '22:05:30');
    } else if (dayOfWeek === 0) {
      // Mariana Sunday shift (Special 2x Double Rate! 09:00 to 15:00)
      addDayPunches(DEFAULT_STAFF[1], dateKey, '08:58:15', '15:02:40');
    }

    // 3. Rafael (Personal Trainer: Mon, Wed, Fri + Sundays 2x)
    if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      addDayPunches(DEFAULT_STAFF[2], dateKey, '06:55:00', '15:00:00');
    } else if (dayOfWeek === 0) {
      // Rafael Sunday Personal (Special 2x Double Rate! 08:00 to 13:00)
      addDayPunches(DEFAULT_STAFF[2], dateKey, '07:55:20', '13:05:10');
    }

    // 4. Juliana (Estagiário: Mon - Fri: 17:00 to 21:00)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      addDayPunches(DEFAULT_STAFF[3], dateKey, '16:58:45', '21:03:12');
    }
  }

  // Today's ongoing records
  const todayKey = formatDateKey(today);
  records.push({
    id: `tr-today-1`,
    staffId: 'st-1',
    staffName: 'Carlos Eduardo Silva',
    staffRole: 'Instrutor',
    date: todayKey,
    time: '05:56:42',
    timestamp: new Date(`${todayKey}T05:56:42`).getTime(),
    type: 'ENTRADA',
    location: 'Academia Bloco Central',
    code: generateReceiptCode(),
  });
  return records;
}

export const storage = {
  getSettings(): GymSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: GymSettings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  getStaff(): StaffMember[] {
    try {
      const data = localStorage.getItem(STAFF_KEY);
      if (!data) return DEFAULT_STAFF;
      const parsed: StaffMember[] = JSON.parse(data);
      return parsed.map((s, idx) => ({
        ...s,
        hourlyRate: typeof s.hourlyRate === 'number' && s.hourlyRate > 0 
          ? s.hourlyRate 
          : DEFAULT_STAFF[idx]?.hourlyRate || 45,
      }));
    } catch {
      return DEFAULT_STAFF;
    }
  },

  saveStaff(staff: StaffMember[]) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  },

  getOccupancy(): OccupancyCount[] {
    try {
      const data = localStorage.getItem(OCCUPANCY_KEY);
      if (data) {
        return JSON.parse(data);
      }
      const seeded = generateSeedOccupancy();
      localStorage.setItem(OCCUPANCY_KEY, JSON.stringify(seeded));
      return seeded;
    } catch {
      return generateSeedOccupancy();
    }
  },

  saveOccupancy(counts: OccupancyCount[]) {
    localStorage.setItem(OCCUPANCY_KEY, JSON.stringify(counts));
  },

  getTimeRecords(): TimeRecord[] {
    try {
      const data = localStorage.getItem(TIME_RECORDS_KEY);
      if (data) {
        return JSON.parse(data);
      }
      const seeded = generateSeedTimeRecords();
      localStorage.setItem(TIME_RECORDS_KEY, JSON.stringify(seeded));
      return seeded;
    } catch {
      return generateSeedTimeRecords();
    }
  },

  saveTimeRecords(records: TimeRecord[]) {
    localStorage.setItem(TIME_RECORDS_KEY, JSON.stringify(records));
  },

  getLocalPayrollData(): { staff: StaffMember[]; records: TimeRecord[] } | null {
    const storedStaff = localStorage.getItem(STAFF_KEY);
    const storedRecords = localStorage.getItem(TIME_RECORDS_KEY);
    if (!storedStaff && !storedRecords) return null;

    return {
      staff: storedStaff ? JSON.parse(storedStaff) as StaffMember[] : DEFAULT_STAFF,
      records: storedRecords ? JSON.parse(storedRecords) as TimeRecord[] : [],
    };
  },

  hasLocalPayrollData(): boolean {
    return Boolean(localStorage.getItem(STAFF_KEY) || localStorage.getItem(TIME_RECORDS_KEY));
  },

  clearLocalPayrollData() {
    localStorage.removeItem(STAFF_KEY);
    localStorage.removeItem(TIME_RECORDS_KEY);
  },

  resetAllData() {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(STAFF_KEY);
    localStorage.removeItem(OCCUPANCY_KEY);
    localStorage.removeItem(TIME_RECORDS_KEY);
    window.location.reload();
  },
};
