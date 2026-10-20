/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useState } from 'react';
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
import { GymSettings, StaffMember, OccupancyCount, TimeRecord } from './types';
import { storage } from './utils/storage';
import { formatDateKey } from './utils/timeUtils';
import { Header } from './components/Header';

const NextCountReminderBanner = lazy(() => import('./components/NextCountReminderBanner').then((module) => ({ default: module.NextCountReminderBanner })));
const SlotTimeline30Min = lazy(() => import('./components/SlotTimeline30Min').then((module) => ({ default: module.SlotTimeline30Min })));
const OccupancyQuickCounter = lazy(() => import('./components/OccupancyQuickCounter').then((module) => ({ default: module.OccupancyQuickCounter })));
const TimeClockModal = lazy(() => import('./components/TimeClockModal').then((module) => ({ default: module.TimeClockModal })));
const TimeClockView = lazy(() => import('./components/TimeClockView').then((module) => ({ default: module.TimeClockView })));
const ExcelSheetView = lazy(() => import('./components/ExcelSheetView').then((module) => ({ default: module.ExcelSheetView })));
const OccupancyAnalyticsView = lazy(() => import('./components/OccupancyAnalyticsView').then((module) => ({ default: module.OccupancyAnalyticsView })));
const StaffManagementView = lazy(() => import('./components/StaffManagementView').then((module) => ({ default: module.StaffManagementView })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));

export default function App() {
  const [settings, setSettings] = useState<GymSettings>(() => storage.getSettings());
  const [staffList, setStaffList] = useState<StaffMember[]>(() => storage.getStaff());
  const [occupancyCounts, setOccupancyCounts] = useState<OccupancyCount[]>(() => storage.getOccupancy());
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>(() => storage.getTimeRecords());

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isQuickCountOpen, setIsQuickCountOpen] = useState<boolean>(false);
  const [isTimeClockOpen, setIsTimeClockOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [targetSlot, setTargetSlot] = useState<string | undefined>(undefined);
  const [targetDate, setTargetDate] = useState<string | undefined>(undefined);
  const [editingRecord, setEditingRecord] = useState<OccupancyCount | null>(null);

  const todayKey = formatDateKey(new Date());

  const todayCounts = occupancyCounts.filter((c) => c.date === todayKey);

  const handleSaveSettings = (newSettings: GymSettings) => {
    setSettings(newSettings);
    storage.saveSettings(newSettings);
  };

  const handleSaveStaffList = (newList: StaffMember[]) => {
    setStaffList(newList);
    storage.saveStaff(newList);
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

  const handleSaveTimeRecord = (record: TimeRecord) => {
    const updated = [record, ...timeRecords];
    setTimeRecords(updated);
    storage.saveTimeRecords(updated);
  };

  const handleOpenSlotToCount = (slot?: string, date?: string, existing?: OccupancyCount) => {
    setTargetSlot(slot);
    setTargetDate(date || todayKey);
    setEditingRecord(existing || null);
    setIsQuickCountOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex flex-col font-sans selection:bg-[#00F201] selection:text-black">
      {/* Top Header with live clock, active staff & occupancy gauge */}
      <Header
        settings={settings}
        staffList={staffList}
        todayCounts={todayCounts}
        timeRecords={timeRecords}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTimeClock={() => setIsTimeClockOpen(true)}
        onOpenQuickCount={() => handleOpenSlotToCount()}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
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
          />
        )}

        {/* Tab 4: Staff & Shift Schedule */}
        {activeTab === 'staff' && (
          <StaffManagementView
            staffList={staffList}
            onSaveStaffList={handleSaveStaffList}
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
