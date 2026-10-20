import React, { useState, useEffect } from 'react';
import { 
  Timer, 
  X, 
  CheckCircle2, 
  LogIn, 
  LogOut, 
  Coffee, 
  Play, 
  Clock, 
  ShieldCheck, 
  KeyRound,
  Download,
  Printer,
  Sparkles,
  MapPin
} from 'lucide-react';
import { StaffMember, TimeRecord, PunchType, GymSettings } from '../types';
import { generateReceiptCode, formatDateBR } from '../utils/timeUtils';
import { soundEffects } from '../utils/audioAlert';

interface TimeClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  todayRecords: TimeRecord[];
  onSaveRecord: (record: TimeRecord) => void;
  settings: GymSettings;
}

export const TimeClockModal: React.FC<TimeClockModalProps> = ({
  isOpen,
  onClose,
  staffList,
  todayRecords,
  onSaveRecord,
  settings,
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffList[0]?.id || '');
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [receiptRecord, setReceiptRecord] = useState<TimeRecord | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) || staffList[0];

  // Records for selected staff today
  const selectedStaffTodayRecords = todayRecords
    .filter((r) => r.staffId === selectedStaff?.id && r.date === new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.timestamp - b.timestamp);

  const lastPunch = selectedStaffTodayRecords.length > 0 
    ? selectedStaffTodayRecords[selectedStaffTodayRecords.length - 1] 
    : null;

  // Determine what next punch should logically be recommended
  let recommendedType: PunchType = 'ENTRADA';
  if (!lastPunch || lastPunch.type === 'SAIDA') {
    recommendedType = 'ENTRADA';
  } else if (lastPunch.type === 'ENTRADA') {
    recommendedType = 'INTERVALO_SAIDA';
  } else if (lastPunch.type === 'INTERVALO_SAIDA') {
    recommendedType = 'INTERVALO_RETORNO';
  } else if (lastPunch.type === 'INTERVALO_RETORNO') {
    recommendedType = 'SAIDA';
  }

  const handlePunch = (type: PunchType) => {
    // PIN Validation
    if (selectedStaff.pin && pinInput !== selectedStaff.pin) {
      setPinError('PIN de segurança incorreto. Digite os 4 dígitos cadastrados.');
      return;
    }

    setPinError(null);
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const newRecord: TimeRecord = {
      id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      staffRole: selectedStaff.role,
      date: dateKey,
      time: timeStr,
      timestamp: now.getTime(),
      type,
      location: `${settings.condoName} - ${settings.unitAddress}`,
      notes: notes.trim() || undefined,
      code: generateReceiptCode(),
    };

    if (settings.soundAlertEnabled) {
      soundEffects.playSuccessSound();
    }

    onSaveRecord(newRecord);
    setReceiptRecord(newRecord);
    setPinInput('');
    setNotes('');
  };

  const getPunchTypeLabel = (type: PunchType) => {
    switch (type) {
      case 'ENTRADA':
        return 'Entrada no Turno';
      case 'INTERVALO_SAIDA':
        return 'Saída para Intervalo';
      case 'INTERVALO_RETORNO':
        return 'Retorno de Intervalo';
      case 'SAIDA':
        return 'Saída Final do Turno';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* If voucher receipt is active, show voucher */}
        {receiptRecord ? (
          <div className="p-6 text-center space-y-5">
            <div className="w-16 h-16 bg-[#E2E8F0]/10 text-[#E2E8F0] border border-[#E2E8F0]/20 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Ponto Registrado com Sucesso!</h2>
              <p className="text-xs text-[#777] mt-1">Comprovante eletrônico de presença emitido</p>
            </div>

            {/* Voucher Card */}
            <div className="bg-[#0d0d0d] p-4 rounded-xl border border-[#2a2a2a] text-left space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-[#222] pb-2">
                <span className="text-[#777] uppercase font-sans">Comprovante</span>
                <span className="text-[#00F201] font-bold text-sm">{receiptRecord.code}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[#e0e0e0]">
                <div>
                  <div className="text-[10px] text-[#777] font-sans">COLABORADOR</div>
                  <div className="font-bold truncate">{receiptRecord.staffName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#777] font-sans">CARGO</div>
                  <div className="font-medium truncate text-[#aaa]">{receiptRecord.staffRole}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#777] font-sans">DATA & HORA</div>
                  <div className="font-bold text-[#E2E8F0]">
                    {formatDateBR(receiptRecord.date)} às {receiptRecord.time}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#777] font-sans">TIPO DE REGISTRO</div>
                  <div className="font-bold text-white">{getPunchTypeLabel(receiptRecord.type)}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-[#222] text-[10px] text-[#555] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#777]" />
                <span className="truncate">{receiptRecord.location}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setReceiptRecord(null)}
                className="px-6 py-2.5 bg-[#00F201] hover:bg-[#00cc01] text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-[#00F201]/20"
              >
                Concluir & Novo Ponto
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] text-[#e0e0e0] font-semibold rounded-xl text-xs border border-[#333] transition-all"
              >
                Fechar Janela
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#0d0d0d] border-b border-[#2a2a2a] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/20 flex items-center justify-center">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                    Relógio de Ponto Eletrônico
                  </h2>
                  <p className="text-xs text-[#777]">{settings.condoName}</p>
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
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-[#e0e0e0]">
              {/* Digital Clock Display */}
              <div className="text-center bg-[#0d0d0d] p-4 rounded-xl border border-[#2a2a2a] relative overflow-hidden">
                <div className="text-xs text-[#777] uppercase tracking-widest font-semibold">
                  Horário Oficial do Ponto
                </div>
                <div className="font-mono text-4xl sm:text-5xl font-extrabold text-[#00F201] tracking-tight my-1">
                  {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-xs text-[#777] capitalize">
                  {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Staff Member Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#777] uppercase tracking-wider mb-2">
                  Selecione o Colaborador
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {staffList.map((staff) => (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaffId(staff.id);
                        setPinError(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                        selectedStaffId === staff.id
                          ? 'border-[#00F201] bg-[#00F201]/10 text-white ring-1 ring-[#00F201]'
                          : 'border-[#2a2a2a] bg-[#0d0d0d] text-[#777] hover:border-[#3a3a3a] hover:bg-[#141414]'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-black shrink-0"
                        style={{ backgroundColor: staff.color }}
                      >
                        {staff.name.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-semibold text-xs text-white truncate">{staff.name}</div>
                        <div className="text-[10px] text-[#777] truncate">{staff.role} • {staff.scheduledShift}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* PIN Code Security Field */}
              <div className="bg-[#0d0d0d] p-3.5 rounded-xl border border-[#2a2a2a] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#ccc] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#00F201]" />
                    <span>PIN de 4 Dígitos do Colaborador</span>
                  </label>
                  <span className="text-[10px] text-[#555]">Padrão demo: {selectedStaff?.pin}</span>
                </div>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(null);
                  }}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-[#00F201]"
                />
                {pinError && <p className="text-xs text-[#ff4444] font-medium">{pinError}</p>}
              </div>

              {/* Today's Punch Timeline for this staff */}
              {selectedStaffTodayRecords.length > 0 && (
                <div className="bg-[#0d0d0d] p-3 rounded-xl border border-[#2a2a2a]">
                  <div className="text-[11px] font-semibold text-[#777] uppercase tracking-wider mb-2">
                    Batidas de Hoje ({selectedStaff.name.split(' ')[0]})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedStaffTodayRecords.map((r, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-[#141414] border border-[#2a2a2a] text-xs font-mono flex items-center gap-1.5"
                      >
                        <span className="text-[#E2E8F0] font-bold">{r.time.slice(0, 5)}</span>
                        <span className="text-[#777] text-[10px]">
                          ({r.type === 'ENTRADA' ? 'Entrada' : r.type === 'INTERVALO_SAIDA' ? 'Saída Almoço' : r.type === 'INTERVALO_RETORNO' ? 'Retorno' : 'Saída'})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Punch Actions (4 distinct types) */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-[#777] uppercase tracking-wider">
                  Tipo de Registro de Ponto
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* 1. Entrada */}
                  <button
                    type="button"
                    onClick={() => handlePunch('ENTRADA')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all active:scale-95 ${
                      recommendedType === 'ENTRADA'
                        ? 'bg-[#E2E8F0]/15 border-[#E2E8F0] text-white font-bold ring-1 ring-[#E2E8F0]'
                        : 'bg-[#0d0d0d] border-[#2a2a2a] text-[#aaa] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <LogIn className="w-5 h-5 text-[#E2E8F0]" />
                    <span className="text-xs">1. Entrada</span>
                    <span className="text-[10px] text-[#777]">Início de turno</span>
                  </button>

                  {/* 2. Saída Intervalo */}
                  <button
                    type="button"
                    onClick={() => handlePunch('INTERVALO_SAIDA')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all active:scale-95 ${
                      recommendedType === 'INTERVALO_SAIDA'
                        ? 'bg-[#00F201]/15 border-[#00F201] text-white font-bold ring-1 ring-[#00F201]'
                        : 'bg-[#0d0d0d] border-[#2a2a2a] text-[#aaa] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <Coffee className="w-5 h-5 text-[#00F201]" />
                    <span className="text-xs">2. Saída Intervalo</span>
                    <span className="text-[10px] text-[#777]">Almoço / Pausa</span>
                  </button>

                  {/* 3. Retorno Intervalo */}
                  <button
                    type="button"
                    onClick={() => handlePunch('INTERVALO_RETORNO')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all active:scale-95 ${
                      recommendedType === 'INTERVALO_RETORNO'
                        ? 'bg-[#ffaa00]/15 border-[#ffaa00] text-white font-bold ring-1 ring-[#ffaa00]'
                        : 'bg-[#0d0d0d] border-[#2a2a2a] text-[#aaa] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <Play className="w-5 h-5 text-[#ffaa00]" />
                    <span className="text-xs">3. Retorno Intervalo</span>
                    <span className="text-[10px] text-[#777]">Volta do intervalo</span>
                  </button>

                  {/* 4. Saída Final */}
                  <button
                    type="button"
                    onClick={() => handlePunch('SAIDA')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all active:scale-95 ${
                      recommendedType === 'SAIDA'
                        ? 'bg-[#ff4444]/15 border-[#ff4444] text-white font-bold ring-1 ring-[#ff4444]'
                        : 'bg-[#0d0d0d] border-[#2a2a2a] text-[#aaa] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <LogOut className="w-5 h-5 text-[#ff4444]" />
                    <span className="text-xs">4. Saída Final</span>
                    <span className="text-[10px] text-[#777]">Fim do expediente</span>
                  </button>
                </div>
              </div>

              {/* Optional notes */}
              <div>
                <input
                  type="text"
                  placeholder="Observação opcional sobre o ponto (ex: troca de turno)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#00F201]"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
