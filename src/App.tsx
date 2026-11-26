/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Timer, 
  ShieldCheck, 
  Plus, 
  Users, 
  Clock, 
  Download, 
  Sparkles,
  Dumbbell
} from 'lucide-react';
import { GymSettings, StaffMember, OccupancyCount, TimeRecord, Holiday } from './types';
import { storage } from './utils/storage';
import { formatDateKey } from './utils/timeUtils';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { ManagerMfaView } from './components/ManagerMfaView';
import {
  deleteHoliday,
  endProfessorSession,
  fetchHolidays,
  fetchPayrollMigrationStatus,
  fetchProfile,
  fetchStaff,
  fetchTimeRecords,
  fetchOccupancy,
  saveOccupancyCount,
  importOccupancyCounts,
  type ProfessorSession,
  getSupabase,
  importLocalPayrollData,
  isSupabaseConfigured,
  completePayrollMigration,
  linkStaffAccount,
  saveHoliday,
  saveStaff,
  deleteStaff,
  fetchGymSettings,
  saveGymSettings,
  registerTimePunch,
  updateStaffHourlyRate,
  UserProfile,
} from './utils/supabase';

const NextCountReminderBanner = lazy(() => import('./components/NextCountReminderBanner').then((module) => ({ default: module.NextCountReminderBanner })));
const SlotTimeline30Min = lazy(() => import('./components/SlotTimeline30Min').then((module) => ({ default: module.SlotTimeline30Min })));
const OccupancyQuickCounter = lazy(() => import('./components/OccupancyQuickCounter').then((module) => ({ default: module.OccupancyQuickCounter })));
const TimeClockModal = lazy(() => import('./components/TimeClockModal').then((module) => ({ default: module.TimeClockModal })));
const TimeClockView = lazy(() => import('./components/TimeClockView').then((module) => ({ default: module.TimeClockView })));
const ExcelSheetView = lazy(() => import('./components/ExcelSheetView').then((module) => ({ default: module.ExcelSheetView })));
const OccupancyAnalyticsView = lazy(() => import('./components/OccupancyAnalyticsView').then((module) => ({ default: module.OccupancyAnalyticsView })));
const StaffManagementView = lazy(() => import('./components/StaffManagementView').then((module) => ({ default: module.StaffManagementView })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));

const THEME_STORAGE_KEY = 'condogym_theme_v1';
const PROFESSOR_SESSION_KEY = 'ogfitness_staff_device_session';

export default function App() {
  const [settings, setSettings] = useState<GymSettings>(() => storage.getSettings());
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [occupancyCounts, setOccupancyCounts] = useState<OccupancyCount[]>([]);
  const [localCounts, setLocalCounts] = useState(() => storage.getOccupancy());
  const [isImportingCounts, setIsImportingCounts] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const writeVersion = useRef(0);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);

  // Professor session via username and 6-digit PIN
  const [professorSession, setProfessorSession] = useState<ProfessorSession | null>(() => {
    try {
      const stored = sessionStorage.getItem(PROFESSOR_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const professorUser = professorSession?.staff ?? null;
  const staffToken = professorSession?.token;

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [hasLocalPayrollData, setHasLocalPayrollData] = useState(() => storage.hasLocalPayrollData());
  const [isMigrationComplete, setIsMigrationComplete] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  );

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isQuickCountOpen, setIsQuickCountOpen] = useState<boolean>(false);
  const [isTimeClockOpen, setIsTimeClockOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [targetSlot, setTargetSlot] = useState<string | undefined>(undefined);
  const [targetDate, setTargetDate] = useState<string | undefined>(undefined);
  const [editingRecord, setEditingRecord] = useState<OccupancyCount | null>(null);

  const todayKey = formatDateKey(new Date());

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsAuthLoading(false);
      return;
    }

    let active = true;
    const supabase = getSupabase();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthError(null);
      }
    });

    Promise.all([
      supabase.auth.getSession(),
      fetchPayrollMigrationStatus().catch(() => false)
    ])
      .then(([{ data, error }, isMigrated]) => {
        if (error) throw error;
        if (isMigrated) {
          storage.clearLocalPayrollData();
          setHasLocalPayrollData(false);
        }
        if (active) {
          setIsMigrationComplete(isMigrated);
          setSession(data.session);
        }
      })
      .catch((reason) => {
        if (active) setAuthError(reason instanceof Error ? reason.message : 'Não foi possível verificar a sessão.');
      })
      .finally(() => {
        if (active) setIsAuthLoading(false);
      });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load user profile and data (works for both Manager Auth and Professor PIN login)
  useLayoutEffect(() => {
    if (!session && !professorUser) {
      setMfaUserId(null);
      setProfile(null);
      setStaffList([]);
      setTimeRecords([]);
      setHolidays([]);
      setIsDataLoading(false);
      setDataError(null);
      return;
    }

    let active = true;
    setIsDataLoading(true);
    setDataError(null);

    const loadData = async () => {
      let isManager = false;
      let activeProfile: UserProfile;

      if (professorUser) {
        isManager = false;
        activeProfile = {
          id: professorUser.id,
          role: 'professor',
          staffId: professorUser.id,
          staffName: professorUser.name,
          username: professorUser.username,
        };
      } else if (session) {
        try {
          activeProfile = await fetchProfile(session.user.id);
          isManager = activeProfile.role === 'manager';
          if (isManager) {
            const { data, error } = await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel(session.access_token);
            if (error) throw error;
            if (!active) return;
            if (data.currentLevel !== 'aal2') {
              setProfile(null);
              setStaffList([]);
              setTimeRecords([]);
              setHolidays([]);
              setMfaUserId(session.user.id);
              setIsDataLoading(false);
              return;
            }
          }
        } catch (reason) {
          if (active) {
            setMfaUserId(null);
            setProfile(null);
            setDataError(reason instanceof Error ? reason.message : 'Não foi possível verificar o perfil.');
            setIsDataLoading(false);
          }
          return;
        }
      } else {
        return;
      }

      if (active) setMfaUserId(null);
      try {
        const [staff, records, customHolidays, gymSettings] = await Promise.all([
          fetchStaff(isManager, staffToken).catch(() => isManager ? [] : professorUser ? [professorUser] : []),
          fetchTimeRecords(staffToken).catch(() => []),
          isManager ? fetchHolidays().catch(() => []) : Promise.resolve([]),
          fetchGymSettings(staffToken).catch(() => null),
        ]);

        if (active) {
          setProfile(activeProfile);
          setStaffList(staff);
          setTimeRecords(records);
          setHolidays(customHolidays);
          if (gymSettings) setSettings(gymSettings);
          if (!isManager) {
            setActiveTab('dashboard');
          }
        }
      } catch (reason) {
        if (active) {
          // Fallback to local storage
          setProfile(activeProfile);
          setStaffList(professorUser ? [professorUser] : []);
          setTimeRecords([]);
          if (!isManager) setActiveTab('dashboard');
        }
      } finally {
        if (active) setIsDataLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [session, professorUser, staffToken]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const todayCounts = occupancyCounts.filter((c) => c.date === todayKey);

  const handleSaveSettings = async (newSettings: GymSettings) => {
    if (profile?.role !== 'manager') throw new Error('Somente gestores podem salvar configurações.');
    await saveGymSettings(newSettings);
    setSettings(newSettings);
    storage.saveSettings(newSettings);
  };

  const handleSaveStaff = async (staff: StaffMember) => {
    await saveStaff([staff]);
    const { pin: _pin, ...savedStaff } = staff;
    const updated = staffList.some((member) => member.id === staff.id)
      ? staffList.map((member) => member.id === staff.id ? savedStaff : member)
      : [...staffList, savedStaff];
    setStaffList(updated);
    storage.saveStaff(updated);
  };

  const handleDeleteStaff = async (staffId: string) => {
    await deleteStaff(staffId);
    const updated = staffList.filter((member) => member.id !== staffId);
    setStaffList(updated);
    storage.saveStaff(updated);
  };

  const handleUpdateStaffHourlyRate = async (staffId: string, newRate: number) => {
    await updateStaffHourlyRate(staffId, newRate);
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, hourlyRate: newRate } : s))
    );
    const updatedLocal = storage.getStaff().map((s) => (s.id === staffId ? { ...s, hourlyRate: newRate } : s));
    storage.saveStaff(updatedLocal);
  };

  const handleLinkStaffAccount = async (staff: StaffMember) => {
    if (!staff.email) throw new Error('Cadastre o e-mail do colaborador antes de vincular a conta.');
    await linkStaffAccount(staff.email, staff.id);
    setStaffList(await fetchStaff(true));
  };

  useEffect(() => {
    if (!profile) {
      setOccupancyCounts([]);
      setCloudError(null);
      return;
    }
    let active = true;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      const version = writeVersion.current;
      try {
        const [counts, records] = await Promise.all([fetchOccupancy(staffToken), fetchTimeRecords(staffToken)]);
        if (active && version === writeVersion.current) {
          setOccupancyCounts(counts);
          setTimeRecords(records);
          setCloudError(null);
        }
      } catch (reason) {
        if (active) setCloudError(reason instanceof Error ? reason.message : 'Falha ao sincronizar com o Supabase.');
      } finally {
        running = false;
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [profile, staffToken]);

  const handleSaveCount = async (count: OccupancyCount) => {
    const saved = await saveOccupancyCount(count, staffToken);
    writeVersion.current++;
    setOccupancyCounts((counts) => [
      saved,
      ...counts.filter((item) => item.date !== saved.date || item.timeSlot !== saved.timeSlot),
    ]);
  };

  const handleImportCounts = async () => {
    setIsImportingCounts(true);
    try {
      await importOccupancyCounts(localCounts);
      const counts = await fetchOccupancy(staffToken);
      writeVersion.current++;
      setOccupancyCounts(counts);
      storage.saveOccupancy([]);
      setLocalCounts([]);
      setCloudError(null);
    } catch (reason) {
      setCloudError(reason instanceof Error ? reason.message : 'Não foi possível importar as contagens.');
    } finally {
      setIsImportingCounts(false);
    }
  };

  const handleSaveTimeRecord = async (
    record: Pick<TimeRecord, 'staffId' | 'type' | 'location' | 'notes'>,
  ): Promise<TimeRecord> => {
    const saved = await registerTimePunch(record.staffId, record.type, record.location, record.notes, staffToken);
    writeVersion.current++;
    setTimeRecords((records) => [saved, ...records.filter((item) => item.id !== saved.id)]);
    return saved;
  };

  const handleSaveHoliday = async (holiday: Holiday) => {
    try {
      await saveHoliday(holiday);
      setHolidays(await fetchHolidays());
    } catch {
      setHolidays((prev) => [...prev.filter((h) => h.date !== holiday.date), holiday]);
    }
  };

  const handleDeleteHoliday = async (date: string) => {
    try {
      await deleteHoliday(date);
      setHolidays(await fetchHolidays());
    } catch {
      setHolidays((prev) => prev.filter((h) => h.date !== date));
    }
  };

  const handleImportLocalData = async () => {
    const localData = storage.getLocalPayrollData();
    if (!localData) throw new Error('Não há dados locais de equipe ou ponto para importar.');
    await importLocalPayrollData(localData.staff, localData.records);
    storage.clearLocalPayrollData();
    setHasLocalPayrollData(false);
    const [staff, records] = await Promise.all([fetchStaff(true), fetchTimeRecords()]);
    setStaffList(staff);
    setTimeRecords(records);
  };

  const handleCompleteMigration = async () => {
    if (hasLocalPayrollData) {
      throw new Error('Importe os dados locais deste navegador antes de finalizar a migração.');
    }
    await completePayrollMigration();
    storage.clearLocalPayrollData();
    setHasLocalPayrollData(false);
    setIsMigrationComplete(true);
  };

  const handleOpenSlotToCount = (slot?: string, date?: string, existing?: OccupancyCount) => {
    setTargetSlot(slot);
    setTargetDate(date || todayKey);
    setEditingRecord(existing || null);
    setIsQuickCountOpen(true);
  };

  // Login handler for Professor (Username + 6-digit PIN)
  const handleStaffLoggedIn = (newSession: ProfessorSession) => {
    const { staff } = newSession;
    try {
      sessionStorage.setItem(PROFESSOR_SESSION_KEY, JSON.stringify(newSession));
    } catch {
      // Storage unavailable
    }
    setProfessorSession(newSession);
    setProfile({
      id: staff.id,
      role: 'professor',
      staffId: staff.id,
      staffName: staff.name,
      username: staff.username,
    });
    setActiveTab('dashboard');
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      sessionStorage.removeItem(PROFESSOR_SESSION_KEY);
    } catch {
      // Storage unavailable
    }
    setProfessorSession(null);
    setProfile(null);
    if (staffToken) {
      try {
        await endProfessorSession(staffToken);
      } catch {
        setAuthError('Você saiu deste navegador, mas não foi possível encerrar a sessão no servidor.');
      }
    }
    if (session) {
      const { error } = await getSupabase().auth.signOut();
      if (error) setAuthError(error.message);
    }
  };

  const handleToggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-[#00F201]" />
            <h1 className="text-lg font-bold">Configuração do Supabase</h1>
          </div>
          <p className="text-sm text-[#aaa]">
            Defina as variáveis <code className="text-[#00F201]">VITE_SUPABASE_URL</code> e <code className="text-[#00F201]">VITE_SUPABASE_ANON_KEY</code> no seu arquivo .env para conectar ao banco de dados na nuvem.
          </p>
        </div>
      </div>
    );
  }

  if (isAuthLoading) {
    return <div className="min-h-screen bg-[#0a0a0a] text-[#aaa] grid place-items-center">Verificando acesso...</div>;
  }

  // Not logged in: Show Login Screen (Professor Username + 6-digit PIN or Manager)
  if (!session && !professorUser) {
    return (
      <>
        <LoginView onStaffLoggedIn={handleStaffLoggedIn} theme={theme} onToggleTheme={handleToggleTheme} />
        {authError && <p role="alert" className="fixed bottom-4 left-4 right-4 text-center text-sm text-[#ff7777]">{authError}</p>}
      </>
    );
  }

  if (!professorUser && session && mfaUserId === session.user.id) {
    return <ManagerMfaView key={session.user.id} onSignOut={handleSignOut} />;
  }

  if (isDataLoading) {
    return <div className="min-h-screen bg-[#0a0a0a] text-[#aaa] grid place-items-center">Carregando dados da academia...</div>;
  }

  if (dataError && !profile) {
    return (
      <main className="min-h-screen grid place-content-center gap-3 p-6 text-center">
        <p role="alert">Não foi possível verificar seu acesso. {dataError}</p>
        <button type="button" onClick={handleSignOut} className="underline">Voltar ao login</button>
      </main>
    );
  }

  const isManager = profile?.role === 'manager';

  return (
    <div data-theme={theme} className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex flex-col font-sans selection:bg-[#00F201] selection:text-black">
      {/* Top Header with live clock, active staff & occupancy gauge */}
      <Header
        settings={settings}
        staffList={staffList}
        todayCounts={todayCounts}
        timeRecords={timeRecords}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenTimeClock={() => setIsTimeClockOpen(true)}
        onOpenQuickCount={() => handleOpenSlotToCount()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isManager={isManager}
        userEmail={session?.user?.email || (profile?.username ? `@${profile.username}` : profile?.staffName || 'Gestor')}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {cloudError && <p role="alert" className="rounded-lg border border-[#ff4444]/30 p-3 text-sm text-[#ff9999]">{cloudError}</p>}
        {isManager && localCounts.length > 0 && (
          <button type="button" disabled={isImportingCounts} onClick={handleImportCounts}
            className="rounded-lg border border-[#00F201]/40 px-3 py-2 text-sm">
            {isImportingCounts ? 'Importando...' : 'Importar contagens deste navegador'}
          </button>
        )}
        {authError && (
          <p role="alert" className="rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 p-3 text-xs text-[#ff9999]">
            {authError}
          </p>
        )}
        <Suspense fallback={<div className="py-12 text-center text-sm text-[#777]">Carregando...</div>}>
        {/* Tab 1: Dashboard (Live 30-min Timeline + Reminder + Charts) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Smart Reminder / Countdown Ticker */}
            <NextCountReminderBanner
              todayCounts={todayCounts}
              settings={settings}
              onOpenQuickCount={(slot) => handleOpenSlotToCount(slot)}
            />

            {/* 30-Minute Slots Interactive Timeline */}
            <SlotTimeline30Min
              currentDate={todayKey}
              counts={occupancyCounts}
              settings={settings}
              staffList={staffList}
              onSelectSlotToCount={(slot, existing) => handleOpenSlotToCount(slot, todayKey, existing)}
            />

            {/* Live Occupancy Analytics & Peak Hour Curve */}
            {isManager && <OccupancyAnalyticsView
              counts={occupancyCounts}
              settings={settings}
            />}
          </div>
        )}

        {/* Tab 2: Interactive Excel Spreadsheet Matrix */}
        {activeTab === 'excel' && (
          <ExcelSheetView
            counts={occupancyCounts}
            settings={settings}
            staffList={staffList}
            onOpenCountModal={isManager ? handleOpenSlotToCount : undefined}
          />
        )}

        {/* Tab 3: Time Clock & Timesheet (Ponto Eletrônico & Fechamento Mensal dos 2 Gestores) */}
        {activeTab === 'timeclock' && (
          <TimeClockView
            staffList={staffList}
            timeRecords={timeRecords}
            settings={settings}
            onOpenTimeClockModal={() => setIsTimeClockOpen(true)}
            isManager={isManager}
            currentStaffId={profile?.staffId || null}
            holidays={holidays}
            canImportLocalData={isManager && hasLocalPayrollData && !isMigrationComplete}
            hasLocalData={hasLocalPayrollData}
            isMigrationComplete={isMigrationComplete}
            onSaveHoliday={handleSaveHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            onImportLocalData={handleImportLocalData}
            onCompleteMigration={handleCompleteMigration}
            onUpdateStaffHourlyRate={handleUpdateStaffHourlyRate}
          />
        )}

        {/* Tab 4: Staff & Shift Schedule */}
        {activeTab === 'staff' && isManager && (
          <StaffManagementView
            staffList={staffList}
            onSaveStaff={handleSaveStaff}
            onDeleteStaff={handleDeleteStaff}
            onLinkAccount={handleLinkStaffAccount}
            timeRecords={timeRecords}
            settings={settings}
          />
        )}
        </Suspense>
      </main>

      {/* Elegant Dark Footer */}
      <footer className="border-t border-[#2a2a2a] bg-[#0d0d0d] px-4 sm:px-8 py-4 text-xs text-[#777]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00F201] animate-pulse"></div>
              <span className="text-[11px] text-[#777] uppercase tracking-widest">
                {isSupabaseConfigured ? 'Supabase Conectado' : 'Modo Offline'}
              </span>
            </div>
            <span className="text-[#333]">|</span>
            <span className="text-[11px] text-[#555] uppercase tracking-wider">{settings.condoName}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#555] uppercase tracking-widest">
              OG FITNESS • Fechamento Mensal de Horistas & Ponto Eletrônico
            </span>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Action Button for Quick Count */}
      {isManager && (
        <div className="fixed bottom-6 right-6 z-40 sm:hidden flex flex-col gap-2">
          <button
            onClick={() => handleOpenSlotToCount()}
            className="w-14 h-14 rounded-2xl bg-[#00F201] hover:bg-[#00cc01] text-black flex items-center justify-center shadow-2xl border border-[#00F201]/40 font-bold active:scale-95 transition-all"
            title="Nova Contagem de Alunos"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>
      )}

      {/* Modals */}
      {isQuickCountOpen && (
        <Suspense fallback={null}>
          <OccupancyQuickCounter
            isOpen={isQuickCountOpen}
            onClose={() => {
              setIsQuickCountOpen(false);
              setEditingRecord(null);
            }}
            onSaveCount={handleSaveCount}
            settings={settings}
            staffList={staffList}
            currentStaffId={isManager ? undefined : profile?.staffId ?? undefined}
            initialSlot={targetSlot}
            initialDate={targetDate}
            existingRecord={editingRecord}
          />
        </Suspense>
      )}

      {isTimeClockOpen && (
        <Suspense fallback={null}>
          <TimeClockModal
            isOpen={isTimeClockOpen}
            onClose={() => setIsTimeClockOpen(false)}
            staffList={staffList}
            todayRecords={timeRecords}
            onSaveRecord={handleSaveTimeRecord}
            settings={settings}
            isManager={isManager}
            currentStaffId={profile?.staffId || null}
          />
        </Suspense>
      )}

      {isManager && isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        </Suspense>
      )}
    </div>
  );
}
