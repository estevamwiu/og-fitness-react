/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
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
import {
  deleteHoliday,
  fetchHolidays,
  fetchPayrollMigrationStatus,
  fetchProfile,
  fetchStaff,
  fetchTimeRecords,
  getSupabase,
  importLocalPayrollData,
  isSupabaseConfigured,
  completePayrollMigration,
  linkStaffAccount,
  saveHoliday,
  saveStaff,
  registerTimePunch,
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

export default function App() {
  const [settings, setSettings] = useState<GymSettings>(() => storage.getSettings());
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [occupancyCounts, setOccupancyCounts] = useState<OccupancyCount[]>(() => storage.getOccupancy());
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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

    Promise.all([supabase.auth.getSession(), fetchPayrollMigrationStatus()])
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

  useLayoutEffect(() => {
    if (!session) {
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
    setProfile(null);
    setStaffList([]);
    setTimeRecords([]);
    setHolidays([]);

    fetchProfile(session.user.id)
      .then(async (userProfile) => {
        const isManager = userProfile.role === 'manager';
        const [staff, records, customHolidays] = await Promise.all([
          fetchStaff(isManager),
          fetchTimeRecords(),
          isManager ? fetchHolidays() : Promise.resolve([]),
        ]);
        if (active) {
          setProfile(userProfile);
          setStaffList(staff);
          setTimeRecords(records);
          setHolidays(customHolidays);
          if (!isManager) setActiveTab('timeclock');
        }
      })
      .catch((reason) => {
        if (active) setDataError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados.');
      })
      .finally(() => {
        if (active) setIsDataLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const todayCounts = occupancyCounts.filter((c) => c.date === todayKey);

  const handleSaveSettings = (newSettings: GymSettings) => {
    setSettings(newSettings);
    storage.saveSettings(newSettings);
  };

  const handleSaveStaffList = async (newList: StaffMember[]) => {
    await saveStaff(newList);
    setStaffList(await fetchStaff(true));
  };

  const handleLinkStaffAccount = async (staff: StaffMember) => {
    if (!staff.email) throw new Error('Cadastre o e-mail do colaborador antes de vincular a conta.');
    await linkStaffAccount(staff.email, staff.id);
    setStaffList(await fetchStaff(true));
  };

  const handleSaveCount = (newCount: OccupancyCount) => {
    const existingIndex = occupancyCounts.findIndex((c) => c.id === newCount.id);
    let updated: OccupancyCount[];
    if (existingIndex >= 0) {
      updated = [...occupancyCounts];
      updated[existingIndex] = newCount;
    } else {

      const slotIndex = occupancyCounts.findIndex(
        (c) => c.date === newCount.date && c.timeSlot === newCount.timeSlot
      );
      if (slotIndex >= 0) {
        updated = [...occupancyCounts];
        updated[slotIndex] = newCount;
      } else {
        updated = [newCount, ...occupancyCounts];
      }
    }
    setOccupancyCounts(updated);
    storage.saveOccupancy(updated);
  };

  const handleSaveTimeRecord = async (
    record: Pick<TimeRecord, 'staffId' | 'type' | 'location' | 'notes'>,
  ): Promise<TimeRecord> => {
    if (record.type !== 'ENTRADA' && record.type !== 'SAIDA') {
      throw new Error('Tipo de batida inválido.');
    }
    const savedRecord = await registerTimePunch(record.staffId, record.type, record.location, record.notes);
    setTimeRecords((records) => [savedRecord, ...records]);
    return savedRecord;
  };

  const handleSaveHoliday = async (holiday: Holiday) => {
    await saveHoliday(holiday);
    setHolidays(await fetchHolidays());
  };

  const handleDeleteHoliday = async (date: string) => {
    await deleteHoliday(date);
    setHolidays(await fetchHolidays());
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

  const handleSignOut = async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) setAuthError(error.message);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6">
          <h1 className="text-lg font-bold">Configure o acesso seguro</h1>
          <p className="mt-2 text-sm text-[#aaa]">
            Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env e execute o esquema de supabase/schema.sql no SQL Editor do seu projeto.
          </p>
        </div>
      </div>
    );
  }

  if (isAuthLoading) {
    return <div className="min-h-screen bg-[#0a0a0a] text-[#aaa] grid place-items-center">Verificando acesso...</div>;
  }

  if (!session) {
    return (
      <>
        <LoginView />
        {authError && <p role="alert" className="fixed bottom-4 left-4 right-4 text-center text-sm text-[#ff7777]">{authError}</p>}
      </>
    );
  }

  if (isDataLoading || (profile && profile.id !== session.user.id)) {
    return <div className="min-h-screen bg-[#0a0a0a] text-[#aaa] grid place-items-center">Carregando dados protegidos...</div>;
  }

  if (!profile || dataError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6 space-y-4">
          <h1 className="text-lg font-bold">Não foi possível carregar seu perfil</h1>
          <p role="alert" className="text-sm text-[#ff9999]">{dataError || 'Perfil não encontrado no banco de dados.'}</p>
          <p className="text-xs text-[#888]">Confirme a configuração do banco e o cadastro do perfil antes de tentar novamente.</p>
          <button onClick={handleSignOut} className="rounded-lg bg-[#00F201] px-4 py-2 text-sm font-bold text-black">Sair</button>
        </div>
      </div>
    );
  }

  const isManager = profile.role === 'manager';

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
        onToggleTheme={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
        onOpenTimeClock={() => setIsTimeClockOpen(true)}
        onOpenQuickCount={() => handleOpenSlotToCount()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isManager={isManager}
        userEmail={session.user.email || ''}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
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
            <OccupancyAnalyticsView
              counts={occupancyCounts}
              settings={settings}
            />
          </div>
        )}

        {/* Tab 2: Interactive Excel Spreadsheet Matrix */}
        {activeTab === 'excel' && (
          <ExcelSheetView
            counts={occupancyCounts}
            settings={settings}
            staffList={staffList}
            onOpenCountModal={(slot, date, existing) => handleOpenSlotToCount(slot, date, existing)}
          />
        )}

        {/* Tab 3: Time Clock & Timesheet (Ponto Eletrônico & Espelho de Ponto) */}
        {activeTab === 'timeclock' && (
          <TimeClockView
            staffList={staffList}
            timeRecords={timeRecords}
            settings={settings}
            onOpenTimeClockModal={() => setIsTimeClockOpen(true)}
            isManager={isManager}
            currentStaffId={profile.staffId}
            holidays={holidays}
            canImportLocalData={isManager && hasLocalPayrollData && !isMigrationComplete}
            hasLocalData={hasLocalPayrollData}
            isMigrationComplete={isMigrationComplete}
            onSaveHoliday={handleSaveHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            onImportLocalData={handleImportLocalData}
            onCompleteMigration={handleCompleteMigration}
          />
        )}

        {/* Tab 4: Staff & Shift Schedule */}
        {activeTab === 'staff' && isManager && (
          <StaffManagementView
            staffList={staffList}
            onSaveStaffList={handleSaveStaffList}
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
              <div className="w-2 h-2 rounded-full bg-[#E2E8F0]"></div>
              <span className="text-[11px] text-[#777] uppercase tracking-widest">Sincronizado em Tempo Real</span>
            </div>
            <span className="text-[#333]">|</span>
            <span className="text-[11px] text-[#555] uppercase tracking-wider">{settings.condoName}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#555] uppercase tracking-widest">
              OG FITNESS • Sistema de Ocupação & Ponto Eletrônico
            </span>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Action Button for Quick Count */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden flex flex-col gap-2">
        <button
          onClick={() => handleOpenSlotToCount()}
          className="w-14 h-14 rounded-2xl bg-[#00F201] hover:bg-[#00cc01] text-black flex items-center justify-center shadow-2xl border border-[#00F201]/40 font-bold active:scale-95 transition-all"
          title="Nova Contagem de Alunos"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Modals */}
      {isQuickCountOpen && <Suspense fallback={null}><OccupancyQuickCounter
        isOpen={isQuickCountOpen}
        onClose={() => {
          setIsQuickCountOpen(false);
          setEditingRecord(null);
        }}
        onSaveCount={handleSaveCount}
        settings={settings}
        staffList={staffList}
        initialSlot={targetSlot}
        initialDate={targetDate}
        existingRecord={editingRecord}
      /></Suspense>}

      {isTimeClockOpen && <Suspense fallback={null}><TimeClockModal
        isOpen={isTimeClockOpen}
        onClose={() => setIsTimeClockOpen(false)}
        staffList={staffList}
        todayRecords={timeRecords}
        onSaveRecord={handleSaveTimeRecord}
        settings={settings}
        isManager={isManager}
        currentStaffId={profile.staffId}
      /></Suspense>}

      {isSettingsOpen && <Suspense fallback={null}><SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      /></Suspense>}
    </div>
  );
}
