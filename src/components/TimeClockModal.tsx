import React, { useState, useEffect } from 'react';
import { 
  Timer, 
  X, 
  CheckCircle2, 
  LogIn, 
  LogOut, 
  Clock, 
  ShieldCheck, 
  Download,
  Printer,
  Sparkles,
  MapPin
} from 'lucide-react';
import { StaffMember, TimeRecord, PunchType, GymSettings } from '../types';
import { formatDateBR, formatDateKey } from '../utils/timeUtils';
import { soundEffects } from '../utils/audioAlert';

interface TimeClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  todayRecords: TimeRecord[];
  onSaveRecord: (record: Pick<TimeRecord, 'staffId' | 'type' | 'location' | 'notes'>) => Promise<TimeRecord>;
  settings: GymSettings;
  isManager: boolean;
  currentStaffId: string | null;
}

export const TimeClockModal: React.FC<TimeClockModalProps> = ({
  isOpen,
  onClose,
  staffList,
  todayRecords,
  onSaveRecord,
  settings,
  isManager,
  currentStaffId,
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<string>(currentStaffId || staffList[0]?.id || '');
  const [notes, setNotes] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [receiptRecord, setReceiptRecord] = useState<TimeRecord | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingPunch, setIsSavingPunch] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const selectableStaff = isManager ? staffList.filter((staff) => staff.active) : staffList;
  const selectedStaff = isManager
    ? selectableStaff.find((s) => s.id === selectedStaffId) || selectableStaff[0]
    : staffList.find((s) => s.id === currentStaffId);

  // Records for selected staff today
  const selectedStaffTodayRecords = todayRecords
    .filter((r) => r.staffId === selectedStaff?.id && r.date === formatDateKey())
    .sort((a, b) => a.timestamp - b.timestamp);

  const selectedStaffTodayPunches = selectedStaffTodayRecords.filter(
    (record) => record.type === 'ENTRADA' || record.type === 'SAIDA'
  );
  const lastPunch = selectedStaffTodayPunches.length > 0
    ? selectedStaffTodayPunches[selectedStaffTodayPunches.length - 1]
    : null;

  const recommendedType: PunchType = !lastPunch || lastPunch.type === 'SAIDA' ? 'ENTRADA' : 'SAIDA';

  const handlePunch = async (type: PunchType) => {
    if (!selectedStaff) return;
    const punch = {
      staffId: selectedStaff.id,
      type,
      location: `${settings.condoName} - ${settings.unitAddress}`,
      notes: notes.trim() || undefined,
    };

    setSaveError(null);
    setIsSavingPunch(true);
    try {
      const savedRecord = await onSaveRecord(punch);
      if (settings.soundAlertEnabled) {
        soundEffects.playSuccessSound();
      }
      setReceiptRecord(savedRecord);
      setNotes('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Não foi possível registrar o ponto.');
    } finally {
      setIsSavingPunch(false);
    }
  };

  const getPunchTypeLabel = (type: TimeRecord['type']) => {
    if (type === 'ENTRADA') return 'Entrada no Turno';
    if (type === 'SAIDA') return 'Saída Final do Turno';
    return 'Registro antigo de intervalo';
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

              {/* Only managers can choose on whose behalf they register a punch. */}
              {isManager ? <div>
                <label className="block text-xs font-semibold text-[#777] uppercase tracking-wider mb-2">
                  Selecione o Colaborador
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectableStaff.map((staff) => (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaffId(staff.id);
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
              </div> : (
                <div className="rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] p-3 text-xs text-[#aaa]">
                  {selectedStaff
                    ? <>Registro de ponto para <strong className="text-white">{selectedStaff.name}</strong></>
                    : 'Seu cadastro ainda não foi vinculado a um colaborador. Solicite ajuda a um gestor.'}
                </div>
              )}

              {/* Today's Punch Timeline for this staff */}
              {isManager && selectedStaffTodayRecords.length > 0 && (
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
                          ({r.type === 'ENTRADA' ? 'Entrada' : r.type === 'SAIDA' ? 'Saída' : 'Registro antigo'})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Punch Actions */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-[#777] uppercase tracking-wider">
                  Tipo de Registro de Ponto
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handlePunch('ENTRADA')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all active:scale-95 ${
                      recommendedType === 'ENTRADA'
                        ? 'bg-[#E2E8F0]/15 border-[#E2E8F0] text-white font-bold ring-1 ring-[#E2E8F0]'
                        : 'bg-[#0d0d0d] border-[#2a2a2a] text-[#aaa] hover:bg-[#1a1a1a]'
                    }`}
                    disabled={isSavingPunch || !selectedStaff?.active}
                  >
                    <LogIn className="w-5 h-5 text-[#E2E8F0]" />
                    <span className="text-xs">Entrada</span>
                    <span className="text-[10px] text-[#777]">Início de turno</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePunch('SAIDA')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all active:scale-95 ${
                      recommendedType === 'SAIDA'
                        ? 'bg-[#ff4444]/15 border-[#ff4444] text-white font-bold ring-1 ring-[#ff4444]'
                        : 'bg-[#0d0d0d] border-[#2a2a2a] text-[#aaa] hover:bg-[#1a1a1a]'
                    }`}
                    disabled={isSavingPunch || !selectedStaff?.active}
                  >
                    <LogOut className="w-5 h-5 text-[#ff4444]" />
                    <span className="text-xs">Saída</span>
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
              {saveError && <p role="alert" className="text-xs text-[#ff7777]">{saveError}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
