import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, 
  Clock, 
  Users, 
  Bell, 
  Settings as SettingsIcon, 
  UserCheck, 
  FileSpreadsheet, 
  Timer,
  BarChart3,
  ShieldCheck
} from 'lucide-react';
import { GymSettings, StaffMember, OccupancyCount, TimeRecord } from '../types';
import { getNext30MinSlot, formatSecondsToCountdown } from '../utils/timeUtils';
import { soundEffects } from '../utils/audioAlert';

interface HeaderProps {
  settings: GymSettings;
  staffList: StaffMember[];
  todayCounts: OccupancyCount[];
  timeRecords: TimeRecord[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenTimeClock: () => void;
  onOpenQuickCount: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  staffList,
  todayCounts,
  timeRecords,
  activeTab,
  setActiveTab,
  onOpenTimeClock,
  onOpenQuickCount,
  onOpenSettings,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [countdown, setCountdown] = useState({ slot: '00:00', secondsRemaining: 1800 });

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const next = getNext30MinSlot(now);
      setCountdown({ slot: next.slot, secondsRemaining: next.secondsRemaining });

      // Audio notification if within 1 minute of next 30-min slot and sound is enabled
      if (settings.soundAlertEnabled && next.secondsRemaining === 60) {
        soundEffects.playReminderChime();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [settings.soundAlertEnabled]);

  // Find latest recorded count for today
  const latestCount = todayCounts.length > 0 
    ? [...todayCounts].sort((a, b) => b.timestamp - a.timestamp)[0]
    : null;

  const currentCountVal = latestCount ? latestCount.count : 0;
  const occupancyRate = Math.min(100, Math.round((currentCountVal / settings.maxCapacity) * 100));

  // Determine active staff on duty (last punch was ENTRADA or INTERVALO_RETORNO)
  const activeStaffIds = new Set<string>();
  staffList.forEach((staff) => {
    const userRecords = timeRecords
      .filter((r) => r.staffId === staff.id && r.date === new Date().toISOString().slice(0, 10))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (userRecords.length > 0) {
      const last = userRecords[userRecords.length - 1];
      if (last.type === 'ENTRADA' || last.type === 'INTERVALO_RETORNO') {
        activeStaffIds.add(staff.id);
      }
    }
  });

  const activeStaffMembers = staffList.filter((s) => activeStaffIds.has(s.id));

  // Capacity color status
  const getCapacityColor = () => {
    if (currentCountVal >= settings.maxCapacity) return 'bg-[#cc0000]/20 text-[#ff4444] border-[#cc0000]/40';
    if (currentCountVal >= settings.warningCapacity) return 'bg-[#ffb700]/20 text-[#ffb700] border-[#ffb700]/40';
    return 'bg-[#E2E8F0]/10 text-[#E2E8F0] border-[#E2E8F0]/30';
  };

  const isUrgentCount = countdown.secondsRemaining <= 300; // Under 5 mins

  return (
    <header className="sticky top-0 z-30 border-b border-[#2a2a2a] bg-[#0d0d0d]/95 backdrop-blur-md">
      {/* Top Meta Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2a2a] text-xs text-[#777]">
        <div className="flex items-center gap-2 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-[#E2E8F0] animate-pulse"></span>
          <span className="text-[#e0e0e0] font-semibold">{settings.condoName}</span>
          <span className="hidden md:inline text-[#444]">|</span>
          <span className="hidden md:inline text-[#777]">{settings.unitAddress}</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 ml-auto">
          {/* Status do Colaborador */}
          <div className="hidden sm:block text-right">
            <p className="text-[10px] text-[#777] uppercase tracking-widest">Status do Colaborador</p>
            <p className="text-xs font-medium text-[#E2E8F0]">
              {activeStaffMembers.length > 0 
                ? `● Em Serviço (${activeStaffMembers.map(s => s.name.split(' ')[0]).join(', ')})`
                : '○ Nenhum em Turno'}
            </p>
          </div>

          {/* Real-time Clock */}
          <div className="flex items-center gap-1.5 bg-[#141414] px-3 py-1 rounded-lg border border-[#2a2a2a] font-mono text-[#e0e0e0]">
            <Clock className="w-3.5 h-3.5 text-[#00F201]" />
            <span className="font-medium text-xs sm:text-sm">
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Next 30-min count countdown pill */}
          <div 
            onClick={onOpenQuickCount}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border cursor-pointer transition-colors ${
              isUrgentCount 
                ? 'bg-[#00F201]/10 border-[#00F201]/50 text-[#00F201] animate-pulse'
                : 'bg-[#141414] border-[#2a2a2a] text-[#aaa] hover:border-[#333]'
            }`}
            title="Clique para registrar contagem agora"
          >
            <Bell className={`w-3.5 h-3.5 ${isUrgentCount ? 'text-[#00F201]' : 'text-[#777]'}`} />
            <span className="hidden md:inline text-[11px] uppercase tracking-wider">Próx. Contagem ({countdown.slot}):</span>
            <span className="font-mono font-bold text-xs">{formatSecondsToCountdown(countdown.secondsRemaining)}</span>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-1.5 text-[#777] hover:text-[#e0e0e0] hover:bg-[#1a1a1a] rounded-lg border border-transparent hover:border-[#2a2a2a] transition-colors"
            title="Configurações da Academia"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Navigation & Quick Action Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00F201] rounded-xl flex items-center justify-center font-bold text-black text-sm tracking-tighter shadow-md shadow-[#00F201]/20">
            OG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold tracking-tight text-white">OG FITNESS</span>
              <span className="text-[#777] font-normal text-xs sm:text-sm">| {settings.gymName}</span>
            </div>
            <p className="text-[11px] text-[#777] uppercase tracking-widest mt-0.5">Contagem 30min & Ponto Eletrônico</p>
          </div>
        </div>

        {/* Live Status Indicators (Occupancy + Active Staff) */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Current Occupancy Badge */}
          <div 
            onClick={onOpenQuickCount}
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#141414] border border-[#2a2a2a] cursor-pointer hover:border-[#333] transition-all"
            title="Clique para atualizar a contagem de alunos"
          >
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center border border-[#2a2a2a]">
              <Users className="w-4 h-4 text-[#00F201]" />
            </div>
            <div>
              <div className="text-[10px] text-[#777] uppercase tracking-widest font-semibold">Ocupação Atual</div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-base font-bold text-white leading-none">
                  {currentCountVal}
                </span>
                <span className="text-xs text-[#555] font-normal">/ {settings.maxCapacity}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getCapacityColor()}`}>
                  {occupancyRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Primary Quick Action: Registrar Alunos */}
          <button
            onClick={onOpenQuickCount}
            className="hidden sm:flex items-center gap-2 bg-[#00F201] hover:bg-[#00cc01] text-black font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-[#00F201]/10 active:scale-95"
            id="btn-quick-count-header"
          >
            <span className="text-base leading-none">+</span>
            <span>Registrar Alunos</span>
          </button>

          {/* Secondary Quick Action: Bater Ponto */}
          <button
            onClick={onOpenTimeClock}
            className="flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] hover:border-[#333] text-[#e0e0e0] font-medium px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-95"
            id="btn-quick-punch"
          >
            <Timer className="w-4 h-4 text-[#E2E8F0]" />
            <span>Bater Ponto</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 flex overflow-x-auto gap-1 sm:gap-2 border-t border-[#2a2a2a] pt-1.5 pb-2 scrollbar-none text-xs sm:text-sm font-medium">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/40 font-semibold'
              : 'text-[#777] hover:text-[#e0e0e0] hover:bg-[#141414]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Painel 30min & Contagem</span>
        </button>

        <button
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'excel'
              ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/40 font-semibold'
              : 'text-[#777] hover:text-[#e0e0e0] hover:bg-[#141414]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Planilha Excel (Histórico)</span>
        </button>

        <button
          onClick={() => setActiveTab('timeclock')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'timeclock'
              ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/40 font-semibold'
              : 'text-[#777] hover:text-[#e0e0e0] hover:bg-[#141414]'
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>Ponto & Espelho de Horas</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'staff'
              ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/40 font-semibold'
              : 'text-[#777] hover:text-[#e0e0e0] hover:bg-[#141414]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Equipe & Escala</span>
        </button>
      </div>
    </header>
  );
};
