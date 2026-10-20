import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Minus, 
  Check, 
  X, 
  Dumbbell, 
  Flame, 
  Activity, 
  Sparkles, 
  Clock, 
  UserCheck, 
  AlertCircle 
} from 'lucide-react';
import { OccupancyCount, GymSettings, StaffMember } from '../types';
import { getClosest30MinSlot, formatDateKey, generateTimeSlots } from '../utils/timeUtils';
import { soundEffects } from '../utils/audioAlert';

interface OccupancyQuickCounterProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCount: (count: OccupancyCount) => void;
  settings: GymSettings;
  staffList: StaffMember[];
  initialSlot?: string;
  initialDate?: string;
  existingRecord?: OccupancyCount | null;
}

export const OccupancyQuickCounter: React.FC<OccupancyQuickCounterProps> = ({
  isOpen,
  onClose,
  onSaveCount,
  settings,
  staffList,
  initialSlot,
  initialDate,
  existingRecord,
}) => {
  const [selectedDate, setSelectedDate] = useState(initialDate || formatDateKey(new Date()));
  const [selectedSlot, setSelectedSlot] = useState(initialSlot || getClosest30MinSlot());
  const [selectedStaffId, setSelectedStaffId] = useState(staffList[0]?.id || '');
  const [notes, setNotes] = useState('');

  // Zone counts
  const [musculacao, setMusculacao] = useState(8);
  const [cardio, setCardio] = useState(5);
  const [funcional, setFuncional] = useState(2);
  const [outros, setOutros] = useState(0);

  // Sync with existing record if editing
  useEffect(() => {
    if (existingRecord) {
      setSelectedDate(existingRecord.date);
      setSelectedSlot(existingRecord.timeSlot);
      setSelectedStaffId(existingRecord.loggedByStaffId || staffList[0]?.id || '');
      setNotes(existingRecord.notes || '');
      if (existingRecord.breakdown) {
        setMusculacao(existingRecord.breakdown.musculacao || 0);
        setCardio(existingRecord.breakdown.cardio || 0);
        setFuncional(existingRecord.breakdown.funcional || 0);
        setOutros(existingRecord.breakdown.outros || 0);
      } else {
        setMusculacao(Math.round(existingRecord.count * 0.5));
        setCardio(Math.round(existingRecord.count * 0.3));
        setFuncional(Math.round(existingRecord.count * 0.2));
        setOutros(0);
      }
    } else {
      setSelectedDate(initialDate || formatDateKey(new Date()));
      setSelectedSlot(initialSlot || getClosest30MinSlot());
      setNotes('');
    }
  }, [existingRecord, initialSlot, initialDate, staffList]);

  if (!isOpen) return null;

  const totalCount = Math.max(0, musculacao + cardio + funcional + outros);
  const occupancyPercentage = Math.round((totalCount / settings.maxCapacity) * 100);
  const isOverCapacity = totalCount >= settings.maxCapacity;
  const isWarning = totalCount >= settings.warningCapacity;

  const timeSlots = generateTimeSlots(settings.openingTime, settings.closingTime);
  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) || staffList[0];

  const handleQuickAdd = (amount: number) => {
    // Add to musculacao by default or distribute
    setMusculacao((prev) => Math.max(0, prev + amount));
  };

  const handleSave = () => {
    let status: OccupancyCount['status'] = 'normal';
    if (totalCount >= settings.maxCapacity) status = 'lotado';
    else if (totalCount >= settings.warningCapacity) status = 'alerta';

    const countRecord: OccupancyCount = {
      id: existingRecord?.id || `occ-${selectedDate}-${selectedSlot.replace(':', '')}-${Date.now().toString().slice(-4)}`,
      date: selectedDate,
      timeSlot: selectedSlot,
      timestamp: new Date(`${selectedDate}T${selectedSlot}:00`).getTime() || Date.now(),
      count: totalCount,
      maxCapacity: settings.maxCapacity,
      breakdown: {
        musculacao,
        cardio,
        funcional,
        outros,
      },
      loggedByStaffId: selectedStaff?.id || 'unknown',
      loggedByStaffName: selectedStaff?.name || 'Instrutor',
      notes: notes.trim(),
      status,
    };

    if (settings.soundAlertEnabled) {
      soundEffects.playSuccessSound();
    }

    onSaveCount(countRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#0d0d0d] border-b border-[#2a2a2a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/20 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                {existingRecord ? 'Editar Contagem de Alunos' : 'Nova Contagem de Alunos (30 min)'}
              </h2>
              <p className="text-xs text-[#777]">
                {settings.gymName} • {settings.condoName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#777] hover:text-white p-1 rounded-lg hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-[#e0e0e0] text-sm">
          {/* Time & Slot Picker Row */}
          <div className="grid grid-cols-2 gap-3 bg-[#0d0d0d] p-3.5 rounded-xl border border-[#2a2a2a]">
            <div>
              <label className="block text-[10px] font-semibold text-[#777] uppercase tracking-wider mb-1">
                Data do Registro
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00F201] font-mono cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#777] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#00F201]" />
                Slot de 30 Minutos
              </label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00F201] font-mono font-bold cursor-pointer"
              >
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot} className="bg-[#141414] text-white">
                    {slot} ({slot === getClosest30MinSlot() ? 'Horário Atual' : 'Slot'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Big Occupancy Display */}
          <div className="text-center bg-[#0d0d0d] p-4 rounded-xl border border-[#2a2a2a] relative overflow-hidden">
            <div className="text-xs text-[#777] font-semibold uppercase tracking-wider">TOTAL DE ALUNOS PRESENTES</div>
            <div className="flex items-center justify-center gap-3 my-2">
              <button
                type="button"
                onClick={() => handleQuickAdd(-5)}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-xs font-mono text-[#ccc] border border-[#333] active:scale-95 transition-all"
                title="Subtrair 5"
              >
                -5
              </button>
              <span className="font-mono text-5xl font-extrabold text-white tracking-tight">
                {totalCount}
              </span>
              <button
                type="button"
                onClick={() => handleQuickAdd(5)}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-xs font-mono text-[#00F201] border border-[#00F201]/30 active:scale-95 transition-all"
                title="Adicionar 5"
              >
                +5
              </button>
            </div>

            {/* Capacity Progress Bar */}
            <div className="max-w-xs mx-auto space-y-1">
              <div className="flex justify-between text-[11px] text-[#777]">
                <span>Lotação: {occupancyPercentage}%</span>
                <span>Máx: {settings.maxCapacity} alunos</span>
              </div>
              <div className="h-2 w-full bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isOverCapacity ? 'bg-[#ff4444]' : isWarning ? 'bg-[#ffb700]' : 'bg-[#E2E8F0]'
                  }`}
                  style={{ width: `${Math.min(100, occupancyPercentage)}%` }}
                />
              </div>
              {isOverCapacity && (
                <div className="flex items-center justify-center gap-1 text-[11px] text-[#ff4444] font-semibold pt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Capacidade máxima atingida ou excedida!</span>
                </div>
              )}
            </div>
          </div>

          {/* Breakdown per Zone */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-[#777] uppercase tracking-wider flex items-center justify-between">
              <span>Distribuição por Áreas da Academia</span>
              <span className="text-[10px] text-[#555] font-normal">Ajuste individual</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Musculação */}
              <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-[#2a2a2a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#00F201]/10 text-[#00F201]">
                    <Dumbbell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{settings.zones.musculacao}</div>
                    <div className="text-[10px] text-[#777]">Pesos e Máquinas</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMusculacao((p) => Math.max(0, p - 1))}
                    className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] flex items-center justify-center text-[#ccc] border border-[#333] active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono font-bold text-sm text-white">{musculacao}</span>
                  <button
                    type="button"
                    onClick={() => setMusculacao((p) => p + 1)}
                    className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] flex items-center justify-center text-[#00F201] border border-[#00F201]/30 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cardio */}
              <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-[#2a2a2a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#ffaa66]/10 text-[#ffaa66]">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{settings.zones.cardio}</div>
                    <div className="text-[10px] text-[#777]">Esteiras e Bikes</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCardio((p) => Math.max(0, p - 1))}
                    className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] flex items-center justify-center text-[#ccc] border border-[#333] active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono font-bold text-sm text-white">{cardio}</span>
                  <button
                    type="button"
                    onClick={() => setCardio((p) => p + 1)}
                    className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] flex items-center justify-center text-[#00F201] border border-[#00F201]/30 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Funcional */}
              <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-[#2a2a2a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#E2E8F0]/10 text-[#E2E8F0]">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{settings.zones.funcional}</div>
                    <div className="text-[10px] text-[#777]">Alongamento / Cross</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFuncional((p) => Math.max(0, p - 1))}
                    className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] flex items-center justify-center text-[#ccc] border border-[#333] active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono font-bold text-sm text-white">{funcional}</span>
                  <button
                    type="button"
                    onClick={() => setFuncional((p) => p + 1)}
                    className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] flex items-center justify-center text-[#E2E8F0] border border-[#E2E8F0]/30 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Outros / Aulas */}
              <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-[#2a2a2a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#888]/10 text-[#aaa]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{settings.zones.outros}</div>
                    <div className="text-[10px] text-[#777]">Salas e Espaço Livre</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOutros((p) => Math.max(0, p - 1))}
                    className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] flex items-center justify-center text-[#ccc] border border-[#333] active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono font-bold text-sm text-white">{outros}</span>
                  <button
                    type="button"
                    onClick={() => setOutros((p) => p + 1)}
                    className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] flex items-center justify-center text-[#aaa] border border-[#333] active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Instructor in charge & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-semibold text-[#777] uppercase tracking-wider mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#E2E8F0]" />
                Instrutor Responsável
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#00F201] cursor-pointer"
              >
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id} className="bg-[#141414] text-white">
                    {staff.name} ({staff.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#777] uppercase tracking-wider mb-1">
                Observações / Ocorrências (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Aula com personal, manutenção de bike..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#00F201]"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0d0d0d] border-t border-[#2a2a2a] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#777] hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 bg-[#00F201] hover:bg-[#00cc01] text-black font-bold rounded-lg text-xs shadow-md shadow-[#00F201]/20 transition-all active:scale-95"
            id="btn-save-occupancy-count"
          >
            <Check className="w-4 h-4" />
            <span>Salvar Contagem ({selectedSlot})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
