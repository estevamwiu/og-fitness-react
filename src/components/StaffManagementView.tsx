import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  Clock, 
  CheckCircle2, 
  X,
  UserCheck,
  DollarSign,
  Link2
} from 'lucide-react';
import { StaffMember, TimeRecord, GymSettings } from '../types';
import { computeDailyStaffSummary, formatMinutesToHours, formatDateBR, formatCurrencyBRL, formatDateKey } from '../utils/timeUtils';

interface StaffManagementViewProps {
  staffList: StaffMember[];
  onSaveStaffList: (list: StaffMember[]) => Promise<void>;
  onLinkAccount: (staff: StaffMember) => Promise<void>;
  timeRecords: TimeRecord[];
  settings: GymSettings;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  staffList,
  onSaveStaffList,
  onLinkAccount,
  timeRecords,
  settings,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkingStaffId, setLinkingStaffId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffMember['role']>('Instrutor');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [scheduledShift, setScheduledShift] = useState('06:00 - 14:00');
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [color, setColor] = useState('#10B981');

  const todayKey = formatDateKey();

  const handleOpenAdd = () => {
    setSaveError(null);
    setEditingStaff(null);
    setName('');
    setRole('Instrutor');
    setEmail('');
    setPhone('');
    setScheduledShift('06:00 - 14:00');
    setHourlyRate(0);
    setColor('#10B981');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setSaveError(null);
    setEditingStaff(staff);
    setName(staff.name);
    setRole(staff.role);
    setEmail(staff.email || '');
    setPhone(staff.phone || '');
    setScheduledShift(staff.scheduledShift);
    setHourlyRate(staff.hourlyRate || 0);
    setColor(staff.color);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (staff: StaffMember) => {
    if (staff.active && staffList.filter((member) => member.active).length <= 1) {
      alert('É necessário manter pelo menos um colaborador ativo.');
      return;
    }
    const action = staff.active ? 'desativar' : 'reativar';
    if (confirm(`Deseja realmente ${action} ${staff.name}?`)) {
      const updated = staffList.map((member) =>
        member.id === staff.id ? { ...member, active: !member.active } : member
      );
      try {
        await onSaveStaffList(updated);
      } catch (reason) {
        setSaveError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a equipe.');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!name.trim() || !email.trim()) {
      setSaveError('Informe nome e e-mail para cadastrar o acesso do colaborador.');
      return;
    }

    const rateNum = Number(hourlyRate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setSaveError('Informe um valor por hora maior que zero.');
      return;
    }

    try {
      if (editingStaff) {
        const updated = staffList.map((s) =>
          s.id === editingStaff.id
            ? {
                ...s,
                name: name.trim(),
                role,
                email: email.trim(),
                phone: phone.trim() || undefined,
                scheduledShift: scheduledShift.trim(),
                hourlyRate: rateNum,
                color,
              }
            : s
        );
        await onSaveStaffList(updated);
      } else {
        const newStaff: StaffMember = {
          id: `st-${Date.now()}`,
          name: name.trim(),
          role,
          email: email.trim(),
          phone: phone.trim() || undefined,
          scheduledShift: scheduledShift.trim(),
          hourlyRate: rateNum,
          color,
          active: true,
        };
        await onSaveStaffList([...staffList, newStaff]);
      }
      setIsModalOpen(false);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Não foi possível salvar o colaborador.');
    }
  };

  const handleLinkAccount = async (staff: StaffMember) => {
    setSaveError(null);
    setLinkingStaffId(staff.id);
    try {
      await onLinkAccount(staff);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Não foi possível vincular a conta.');
    } finally {
      setLinkingStaffId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="bg-[#141414] border border-[#2a2a2a] p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Equipe & Escala de Instrutores</h2>
              <p className="text-xs text-[#777]">
                Cadastro de colaboradores autorizados a registrar ponto eletrônico e contagem de 30min na academia.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#00F201] hover:bg-[#00cc01] text-black font-bold rounded-xl text-xs shadow-md shadow-[#00F201]/20 transition-all active:scale-95 cursor-pointer"
          id="btn-add-staff"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Colaborador</span>
        </button>
      </div>

      {/* Staff Members Grid */}
      {saveError && !isModalOpen && (
        <p role="alert" className="rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 p-3 text-xs text-[#ff7777]">
          {saveError}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffList.map((staff) => {
          const summaryToday = computeDailyStaffSummary(staff, timeRecords, todayKey);
          const isWorking = summaryToday.status === 'EM_TURNO';

          return (
            <div
              key={staff.id}
              className={`bg-[#141414] border border-[#2a2a2a] p-4 sm:p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between ${staff.active ? '' : 'opacity-60'}`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base text-black shadow-md"
                      style={{ backgroundColor: staff.color }}
                    >
                      {staff.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white truncate max-w-[150px]">{staff.name}</h3>
                      <span className="inline-block text-[11px] font-semibold text-[#00F201] bg-[#00F201]/10 px-2 py-0.5 rounded border border-[#00F201]/20 mt-0.5">
                        {staff.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(staff)}
                      className="p-1.5 text-[#777] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer"
                      title="Editar Colaborador"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handleToggleActive(staff)}
                      className="p-1.5 text-[#777] hover:text-[#ff4444] hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer"
                      title={staff.active ? 'Desativar colaborador' : 'Reativar colaborador'}
                    >
                      {staff.active ? <Trash2 className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Details List */}
                <div className="my-4 space-y-2.5 text-xs border-t border-b border-[#222] py-3">
                  <div className="flex items-center justify-between text-[#ccc]">
                    <span className="text-[#777] flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-[#00F201]" />
                      Valor por Hora:
                    </span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#00F201]">
                        {staff.hourlyRate > 0 ? `${formatCurrencyBRL(staff.hourlyRate)}/h` : 'Não cadastrado'}
                      </span>
                      {staff.hourlyRate > 0 && (
                        <span className="block text-[9px] text-[#777]">
                          Dom/Feriado: 2x ({formatCurrencyBRL(staff.hourlyRate * 2)}/h)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[#ccc]">
                    <span className="text-[#777] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#777]" />
                      Escala de Trabalho:
                    </span>
                    <span className="font-mono font-medium">{staff.scheduledShift}</span>
                  </div>

                  {staff.phone && (
                    <div className="flex items-center justify-between text-[#ccc]">
                      <span className="text-[#777] flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#777]" />
                        Telefone:
                      </span>
                      <span>{staff.phone}</span>
                    </div>
                  )}
                  {staff.email && (
                    <div className="flex items-center justify-between gap-2 text-[#ccc]">
                      <span className="truncate text-[#777] flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#777]" />
                        {staff.email}
                      </span>
                      {staff.hasLoginAccount ? (
                        <span className="shrink-0 text-[9px] text-[#00F201]">Login vinculado</span>
                      ) : (
                        <button
                          type="button"
                          disabled={linkingStaffId === staff.id}
                          onClick={() => void handleLinkAccount(staff)}
                          className="shrink-0 flex items-center gap-1 text-[9px] font-semibold text-[#00F201] disabled:opacity-50"
                        >
                          <Link2 className="w-3 h-3" />
                          {linkingStaffId === staff.id ? 'Vinculando...' : 'Vincular login'}
                        </button>
                      )}
                    </div>
                  )}
                  {!staff.active && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#ffaa00]">Colaborador desativado</p>
                  )}
                </div>
              </div>

              {/* Status Today */}
              <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-[#2a2a2a] flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-[#777] uppercase">Status Hoje</div>
                  <div className="font-semibold text-[#ccc]">
                    {isWorking ? (
                      <span className="text-[#E2E8F0] font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#E2E8F0] animate-pulse"></span>
                        Em Turno (desde {summaryToday.entrada})
                      </span>
                    ) : summaryToday.status === 'FINALIZADO' ? (
                      <span className="text-[#ffaa00]">Finalizou {formatMinutesToHours(summaryToday.totalWorkedMinutes)}</span>
                    ) : (
                      <span className="text-[#777]">Fora do expediente</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-[#777] uppercase">Horas Hoje</div>
                  <div className="font-mono font-bold text-white">
                    {formatMinutesToHours(summaryToday.totalWorkedMinutes)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#0d0d0d] border-b border-[#2a2a2a] flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingStaff ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#777] hover:text-white p-1 rounded-lg hover:bg-[#1a1a1a]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3.5 text-xs text-[#ccc]">
              <div>
                <label className="block text-[#777] font-semibold mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs focus:border-[#00F201] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#777] font-semibold mb-1">Cargo</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as StaffMember['role'])}
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-white text-xs focus:border-[#00F201] focus:outline-none cursor-pointer"
                  >
                    <option value="Instrutor" className="bg-[#141414] text-white">Instrutor</option>
                    <option value="Personal Trainer" className="bg-[#141414] text-white">Personal Trainer</option>
                    <option value="Estagiário" className="bg-[#141414] text-white">Estagiário</option>
                    <option value="Coordenador" className="bg-[#141414] text-white">Coordenador</option>
                    <option value="Recepcionista" className="bg-[#141414] text-white">Recepcionista</option>
                  </select>
                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#777] font-semibold mb-1">Escala / Turno de Trabalho</label>
                  <input
                    type="text"
                    placeholder="Ex: 06:00 - 14:00 (Manhã)"
                    value={scheduledShift}
                    onChange={(e) => setScheduledShift(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs focus:border-[#00F201] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#777] font-semibold mb-1 flex items-center justify-between">
                    <span>Valor por Hora (R$/h)</span>
                    <span className="text-[9px] text-[#00F201]">Dom/Fer = 2x</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[#777] font-mono text-xs">R$</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="45.00"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg pl-8 pr-2.5 py-2 text-white font-mono font-bold text-xs focus:border-[#00F201] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#777] font-semibold mb-1">E-mail de acesso</label>
                  <input
                    type="email"
                    required
                    placeholder="nome@condominio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs focus:border-[#00F201] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#777] font-semibold mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs focus:border-[#00F201] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#777] font-semibold mb-1">Cor do Crachá / Avatar</label>
                <div className="flex gap-2">
                  {['#00F201', '#E2E8F0', '#ffaa00', '#8B5CF6', '#EC4899', '#06B6D4'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        color === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#0d0d0d] rounded-xl border border-[#2a2a2a] flex justify-end gap-2 pt-3 mt-4">
                {saveError && <p role="alert" className="mr-auto self-center text-xs text-[#ff7777]">{saveError}</p>}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-[#777] hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00F201] hover:bg-[#00cc01] text-black font-bold rounded-lg shadow-md shadow-[#00F201]/20 transition-all active:scale-95"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
