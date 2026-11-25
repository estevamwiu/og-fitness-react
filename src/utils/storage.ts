import { GymSettings, StaffMember, OccupancyCount, TimeRecord } from '../types';

const SETTINGS_KEY = 'condogym_settings_v1';
const STAFF_KEY = 'condogym_staff_v1';
const OCCUPANCY_KEY = 'condogym_occupancy_v1';
const TIME_RECORDS_KEY = 'condogym_time_records_v1';

function stripStaffPin({ pin: _pin, ...staff }: StaffMember): StaffMember {
  return staff;
}

export const DEFAULT_SETTINGS: GymSettings = {
  gymName: 'OG Fitness',
  condoName: 'Condomínio',
  unitAddress: '',
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

const demoStaff = new Map([
  ['st-1', 'carlos'],
  ['st-2', 'mariana'],
  ['st-3', 'rafael'],
  ['st-4', 'juliana'],
]);

function readRecords<T>(key: string, isDemo: (record: T) => boolean): T[] {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(stored)) return [];
    const records = stored.filter((record): record is T => record != null && !isDemo(record));
    if (records.length !== stored.length) {
      localStorage.setItem(key, JSON.stringify(records));
    }
    return records;
  } catch {
    return [];
  }
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
    const records = readRecords<StaffMember>(STAFF_KEY, (staff) =>
      demoStaff.has(staff.id) && demoStaff.get(staff.id) === staff.username,
    );
    const staff = records.map((member) => ({ ...stripStaffPin(member), hourlyRate: member.hourlyRate ?? 0 }));
    if (records.some((member) => 'pin' in member)) {
      try {
        this.saveStaff(staff);
      } catch {
        // Storage may be unavailable.
      }
    }
    return staff;
  },

  saveStaff(staff: StaffMember[]) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff.map(stripStaffPin)));
  },

  getOccupancy(): OccupancyCount[] {
    return readRecords<OccupancyCount>(OCCUPANCY_KEY, (count) =>
      /^occ-\d{4}-\d{2}-\d{2}-\d{4}$/.test(count.id) &&
      demoStaff.has(count.loggedByStaffId) &&
      count.notes === undefined,
    );
  },

  saveOccupancy(counts: OccupancyCount[]) {
    localStorage.setItem(OCCUPANCY_KEY, JSON.stringify(counts));
  },

  getTimeRecords(): TimeRecord[] {
    return readRecords<TimeRecord>(TIME_RECORDS_KEY, (record) =>
      /^tr-seed-\d+$/.test(record.id) || record.id === 'tr-today-1',
    );
  },

  saveTimeRecords(records: TimeRecord[]) {
    localStorage.setItem(TIME_RECORDS_KEY, JSON.stringify(records));
  },

  getLocalPayrollData(): { staff: StaffMember[]; records: TimeRecord[] } | null {
    const staff = this.getStaff();
    const records = this.getTimeRecords();
    return staff.length || records.length ? { staff, records } : null;
  },

  hasLocalPayrollData(): boolean {
    return this.getLocalPayrollData() !== null;
  },

  clearLocalPayrollData() {
    localStorage.removeItem(STAFF_KEY);
    localStorage.removeItem(TIME_RECORDS_KEY);
  },
};
