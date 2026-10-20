import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Clock, 
  Users, 
  ChevronRight, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';
import { OccupancyCount, GymSettings } from '../types';
import { getNext30MinSlot, getClosest30MinSlot, formatSecondsToCountdown } from '../utils/timeUtils';

interface NextCountReminderBannerProps {
  todayCounts: OccupancyCount[];
  settings: GymSettings;
  onOpenQuickCount: (slot?: string) => void;
}

export const NextCountReminderBanner: React.FC<NextCountReminderBannerProps> = ({
  todayCounts,
  settings,
  onOpenQuickCount,
}) => {
  const [countdown, setCountdown] = useState({ slot: '00:00', secondsRemaining: 1800 });
  const currentSlot = getClosest30MinSlot();

  useEffect(() => {
    const updateCountdown = () => {
      const next = getNext30MinSlot(new Date());
      setCountdown({ slot: next.slot, secondsRemaining: next.secondsRemaining });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check if current slot is already recorded
  const isCurrentSlotLogged = todayCounts.some((c) => c.timeSlot === currentSlot);
  const latestCount = todayCounts.length > 0 
    ? [...todayCounts].sort((a, b) => b.timestamp - a.timestamp)[0] 
    : null;

  const isUrgent = countdown.secondsRemaining <= 300 || !isCurrentSlotLogged;

  return (
    <div
      className={`p-4 sm:p-6 rounded-2xl border transition-all relative overflow-hidden flex flex-wrap items-center justify-between gap-4 ${
        !isCurrentSlotLogged
          ? 'bg-[#141414] border-[#00F201]/60 shadow-lg shadow-[#00F201]/10'
          : 'bg-[#141414] border-[#2a2a2a]'
      }`}
    >
      {/* Left side: Status & Timer */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            !isCurrentSlotLogged
              ? 'bg-[#00F201]/20 text-[#00F201] border-[#00F201]/40'
              : 'bg-[#E2E8F0]/10 text-[#E2E8F0] border-[#E2E8F0]/30'
          }`}
        >
          {!isCurrentSlotLogged ? (
            <Bell className="w-6 h-6 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-6 h-6" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                !isCurrentSlotLogged
                  ? 'bg-[#00F201]/20 text-[#00F201] border-[#00F201]/40'
                  : 'bg-[#E2E8F0]/10 text-[#E2E8F0] border-[#E2E8F0]/30'
              }`}
            >
              {!isCurrentSlotLogged ? 'Contagem Pendente' : 'Horário Atual Registrado'}
            </span>
            <span className="text-xs text-[#777] font-mono">Slot {currentSlot}</span>
          </div>

          <h3 className="text-sm sm:text-base font-bold text-white mt-1">
            {!isCurrentSlotLogged
              ? `Hora de contar os alunos na academia (${currentSlot})`
              : `Próxima contagem agendada para às ${countdown.slot}`}
          </h3>

          <p className="text-xs text-[#777] mt-0.5">
            {latestCount
              ? `Última medição: ${latestCount.count} alunos às ${latestCount.timeSlot} (Resp: ${latestCount.loggedByStaffName})`
              : 'Nenhuma contagem registrada hoje ainda.'}
          </p>
        </div>
      </div>

      {/* Right side: Countdown & Action */}
      <div className="flex items-center gap-4 ml-auto sm:ml-0">
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-[#777] uppercase font-semibold tracking-widest">Próximo Slot em</div>
          <div className="font-mono text-xl font-extrabold text-[#00F201]">
            {formatSecondsToCountdown(countdown.secondsRemaining)}
          </div>
        </div>

        <button
          onClick={() => onOpenQuickCount(!isCurrentSlotLogged ? currentSlot : undefined)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
            !isCurrentSlotLogged
              ? 'bg-[#00F201] hover:bg-[#00cc01] text-black shadow-[#00F201]/20'
              : 'bg-[#222222] hover:bg-[#2a2a2a] text-[#e0e0e0] border border-[#333333]'
          }`}
          id="btn-reminder-count"
        >
          <Users className={`w-4 h-4 ${!isCurrentSlotLogged ? 'text-black' : 'text-[#00F201]'}`} />
          <span>{!isCurrentSlotLogged ? 'Registrar Slot Agora' : '+ Nova Contagem'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
