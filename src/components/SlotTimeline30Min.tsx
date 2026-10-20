import React, { useState } from 'react';
import { 
  Clock, 
  Plus, 
  Edit3, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Calendar,
  Filter
} from 'lucide-react';
import { OccupancyCount, GymSettings, StaffMember } from '../types';
import { generateTimeSlots, getClosest30MinSlot, formatDateBR } from '../utils/timeUtils';

interface SlotTimeline30MinProps {
  currentDate: string;
  counts: OccupancyCount[];
  settings: GymSettings;
  staffList: StaffMember[];
  onSelectSlotToCount: (slot: string, existingRecord?: OccupancyCount) => void;
}

export const SlotTimeline30Min: React.FC<SlotTimeline30MinProps> = ({
  currentDate,
  counts,
  settings,
  staffList,
  onSelectSlotToCount,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'ALL' | 'MANHA' | 'TARDE' | 'NOITE'>('ALL');

  const allSlots = generateTimeSlots(settings.openingTime, settings.closingTime);
  const currentSlotNow = getClosest30MinSlot();

  // Filter slots by period
  const filteredSlots = allSlots.filter((slot) => {
    const hour = parseInt(slot.split(':')[0], 10);
    if (filterPeriod === 'MANHA') return hour >= 6 && hour < 12;
    if (filterPeriod === 'TARDE') return hour >= 12 && hour < 18;
    if (filterPeriod === 'NOITE') return hour >= 18 && hour <= 22;
    return true;
  });

  // Calculate statistics for the day
  const recordedToday = counts.filter((c) => c.date === currentDate);
  const totalSlotsCount = allSlots.length;
  const completedSlotsCount = recordedToday.length;
  const completionRate = Math.round((completedSlotsCount / totalSlotsCount) * 100);

  const maxStudentCount = recordedToday.reduce((max, c) => (c.count > max ? c.count : max), 0);
  const peakSlotRecord = recordedToday.find((c) => c.count === maxStudentCount && maxStudentCount > 0);
  const avgStudents = completedSlotsCount > 0 
    ? (recordedToday.reduce((sum, c) => sum + c.count, 0) / completedSlotsCount).toFixed(1)
    : '0';

  return (
    <div className="space-y-4">
      {/* Daily Progress & Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl">
          <div className="text-[10px] text-[#777] font-semibold uppercase tracking-widest">Slots Preenchidos</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-2xl font-bold text-white">
              {completedSlotsCount} <span className="text-xs font-normal text-[#555]">/ {totalSlotsCount}</span>
            </span>
            <span className="text-xs font-semibold text-[#E2E8F0]">{completionRate}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#222] rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-[#00F201] rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl">
          <div className="text-[10px] text-[#777] font-semibold uppercase tracking-widest">Média de Alunos</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-mono text-2xl font-bold text-white">{avgStudents}</span>
            <span className="text-xs text-[#777]">por 30 min</span>
          </div>
          <div className="text-[11px] text-[#555] mt-1">Baseado em {completedSlotsCount} medições</div>
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl">
          <div className="text-[10px] text-[#777] font-semibold uppercase tracking-widest flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-[#00F201]" />
            Pico do Dia
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-2xl font-bold text-[#00F201]">{maxStudentCount}</span>
            <span className="text-xs text-[#aaa] font-semibold">{peakSlotRecord ? `às ${peakSlotRecord.timeSlot}` : '--:--'}</span>
          </div>
          <div className="text-[11px] text-[#555] mt-1">Capacidade: {settings.maxCapacity} alunos</div>
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl flex flex-col justify-between">
          <div className="text-[10px] text-[#777] font-semibold uppercase tracking-widest">Status Geral</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#E2E8F0] animate-pulse"></span>
            <span className="text-xs font-semibold text-[#e0e0e0]">Monitoramento Ativo</span>
          </div>
          <div className="text-[11px] text-[#555] mt-1">Intervalo: 30 minutos</div>
        </div>
      </div>

      {/* Filter and Period Selection */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141414] p-3 sm:p-4 rounded-2xl border border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#00F201]" />
          <span className="font-semibold text-white text-sm">Linha do Tempo de Hoje</span>
          <span className="text-xs text-[#777]">({formatDateBR(currentDate)})</span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#0d0d0d] p-1 rounded-xl border border-[#2a2a2a] text-xs">
          <button
            onClick={() => setFilterPeriod('ALL')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterPeriod === 'ALL' ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/40 font-bold' : 'text-[#777] hover:text-white'
            }`}
          >
            Todos ({allSlots.length})
          </button>
          <button
            onClick={() => setFilterPeriod('MANHA')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterPeriod === 'MANHA' ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/40 font-bold' : 'text-[#777] hover:text-white'
            }`}
          >
            Manhã (06h-12h)
          </button>
          <button
            onClick={() => setFilterPeriod('TARDE')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterPeriod === 'TARDE' ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/40 font-bold' : 'text-[#777] hover:text-white'
            }`}
          >
            Tarde (12h-18h)
          </button>
          <button
            onClick={() => setFilterPeriod('NOITE')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterPeriod === 'NOITE' ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/40 font-bold' : 'text-[#777] hover:text-white'
            }`}
          >
            Noite (18h-22h)
          </button>
        </div>
      </div>

      {/* 30-min Slots Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredSlots.map((slot) => {
          const record = recordedToday.find((c) => c.timeSlot === slot);
          const isCurrentSlot = slot === currentSlotNow;
          const isFilled = !!record;
          const count = record ? record.count : 0;
          const occPercent = Math.min(100, Math.round((count / settings.maxCapacity) * 100));

          const isOverCap = count >= settings.maxCapacity;
          const isWarnCap = count >= settings.warningCapacity;

          return (
            <div
              key={slot}
              onClick={() => onSelectSlotToCount(slot, record)}
              className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[125px] ${
                isCurrentSlot
                  ? 'ring-1 ring-[#00F201] border-[#00F201] bg-[#1a1a1a] shadow-lg shadow-[#00F201]/10'
                  : isFilled
                  ? 'bg-[#141414] border-[#2a2a2a] hover:border-[#444444] hover:bg-[#1a1a1a]'
                  : 'bg-[#0d0d0d] border-dashed border-[#222222] hover:border-[#00F201]/50 hover:bg-[#141414]'
              }`}
            >
              {/* Card Top: Time Slot & Status Tag */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#e0e0e0]">
                  <Clock className="w-3.5 h-3.5 text-[#00F201]" />
                  <span>{slot}</span>
                </div>

                {isCurrentSlot && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#00F201] text-black">
                    Atual
                  </span>
                )}

                {isFilled && !isCurrentSlot && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      isOverCap
                        ? 'bg-[#cc0000]/20 text-[#ff4444] border-[#cc0000]/40'
                        : isWarnCap
                        ? 'bg-[#ffb700]/20 text-[#ffb700] border-[#ffb700]/40'
                        : 'bg-[#E2E8F0]/10 text-[#E2E8F0] border-[#E2E8F0]/30'
                    }`}
                  >
                    {isOverCap ? 'Lotado' : isWarnCap ? 'Alto' : 'Normal'}
                  </span>
                )}
              </div>

              {/* Card Middle: Count or Empty State */}
              <div className="my-2">
                {isFilled ? (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white leading-none">
                        {count}
                      </span>
                      <span className="text-xs text-[#777] font-medium">alunos</span>
                    </div>

                    {/* Mini progress bar */}
                    <div className="h-1.5 w-full bg-[#222] rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full ${
                          isOverCap ? 'bg-[#ff4444]' : isWarnCap ? 'bg-[#ffb700]' : 'bg-[#E2E8F0]'
                        }`}
                        style={{ width: `${occPercent}%` }}
                      />
                    </div>

                    {/* Breakdown mini tags */}
                    {record.breakdown && (
                      <div className="flex gap-1 text-[10px] text-[#777] font-mono mt-1.5 truncate">
                        <span title="Musculação">M:{record.breakdown.musculacao}</span>
                        <span>•</span>
                        <span title="Cardio">C:{record.breakdown.cardio}</span>
                        <span>•</span>
                        <span title="Funcional">F:{record.breakdown.funcional}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2 text-[#555] group-hover:text-[#00F201] transition-colors">
                    <Plus className="w-5 h-5 mb-0.5" />
                    <span className="text-[11px] font-medium">Registrar</span>
                  </div>
                )}
              </div>

              {/* Card Bottom: Staff name or prompt */}
              <div className="text-[10px] text-[#777] truncate pt-1.5 border-t border-[#222] flex items-center justify-between">
                {isFilled ? (
                  <>
                    <span className="truncate">{record.loggedByStaffName.split(' ')[0]}</span>
                    <Edit3 className="w-3 h-3 text-[#555] group-hover:text-[#00F201] shrink-0 ml-1" />
                  </>
                ) : (
                  <span className="text-[#444]">Pendente</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
