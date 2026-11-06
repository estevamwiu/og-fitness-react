import React, { useMemo, useState } from 'react';
import { 
  CalendarDays, 
  Download, 
  Plus, 
  Trash2, 
  Upload, 
  DollarSign, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  ShieldCheck, 
  Eye, 
  Clock,
  Sparkles,
  Edit2
} from 'lucide-react';
import { GymSettings, Holiday, StaffMember, TimeRecord, MonthlyPayrollSummary, DayPayrollDetail } from '../types';
import {
  calculateMonthlyStaffPayroll,
  formatCurrencyBRL,
  formatMinutesToHours,
  formatDateBR,
} from '../utils/timeUtils';
import { exportMonthlyPayrollCSV } from '../utils/exportExcel';

interface MonthlyPayrollViewProps {
  staffList: StaffMember[];
  timeRecords: TimeRecord[];
  settings: GymSettings;
  month: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  holidays: Holiday[];
  canImportLocalData: boolean;
  hasLocalData: boolean;
  isMigrationComplete: boolean;
  onSaveHoliday: (holiday: Holiday) => Promise<void>;
  onDeleteHoliday: (date: string) => Promise<void>;
  onImportLocalData: () => Promise<void>;
  onCompleteMigration: () => Promise<void>;
  onUpdateStaffHourlyRate?: (staffId: string, newRate: number) => Promise<void>;
}

export const MonthlyPayrollView: React.FC<MonthlyPayrollViewProps> = ({
  staffList,
  timeRecords,
  settings,
  month,
  onMonthChange,
  holidays,
  canImportLocalData,
  hasLocalData,
  isMigrationComplete,
  onSaveHoliday,
  onDeleteHoliday,
  onImportLocalData,
  onCompleteMigration,
  onUpdateStaffHourlyRate,
}) => {
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCompletingMigration, setIsCompletingMigration] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Inline editing of hourly rate
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<string>('');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Selected staff breakdown modal
  const [selectedStaffPayroll, setSelectedStaffPayroll] = useState<MonthlyPayrollSummary | null>(null);

  const payrolls = useMemo(
    () => staffList.map((staff) => calculateMonthlyStaffPayroll(staff, timeRecords, month, holidays)),
    [staffList, timeRecords, month, holidays],
  );

  const totalRegularMinutes = payrolls.reduce((sum, payroll) => sum + payroll.regularMinutes, 0);
  const totalSundayHolidayMinutes = payrolls.reduce((sum, payroll) => sum + payroll.sundayHolidayMinutes, 0);
  const totalMinutes = payrolls.reduce((sum, payroll) => sum + payroll.totalWorkedMinutes, 0);
  const totalSalary = payrolls.reduce((sum, payroll) => sum + payroll.totalGrossSalary, 0);
  const hasMissingRates = payrolls.some(
    (payroll) => payroll.totalWorkedMinutes > 0 && payroll.baseHourlyRate <= 0,
  );

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const nextY = date.getFullYear();
    const nextM = (date.getMonth() + 1).toString().padStart(2, '0');
    onMonthChange(`${nextY}-${nextM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m, 1);
    const nextY = date.getFullYear();
    const nextM = (date.getMonth() + 1).toString().padStart(2, '0');
    onMonthChange(`${nextY}-${nextM}`);
  };

  const formattedMonthLong = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [month]);

  // Inline Rate Edit Handlers
  const handleStartEditRate = (staffId: string, currentRate: number) => {
    setEditingStaffId(staffId);
    setEditingRateValue(currentRate > 0 ? currentRate.toString() : '');
  };

  const handleSaveRate = async (staffId: string) => {
    const rateNum = Number(editingRateValue);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      alert('Informe um valor por hora válido maior que zero.');
      return;
    }

    if (onUpdateStaffHourlyRate) {
      setIsSavingRate(true);
      try {
        await onUpdateStaffHourlyRate(staffId, rateNum);
        setEditingStaffId(null);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao atualizar valor por hora.');
      } finally {
        setIsSavingRate(false);
      }
    }
  };

  const handleSaveHoliday = async (event: React.FormEvent) => {
    event.preventDefault();
    setHolidayError(null);
    if (!holidayDate || !holidayName.trim()) {
      setHolidayError('Informe a data e o nome do feriado.');
      return;
    }

    setIsSavingHoliday(true);
    try {
      await onSaveHoliday({ date: holidayDate, name: holidayName.trim() });
      setHolidayDate('');
      setHolidayName('');
    } catch (reason) {
      setHolidayError(reason instanceof Error ? reason.message : 'Não foi possível salvar o feriado.');
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (date: string) => {
    setActionError(null);
    try {
      await onDeleteHoliday(date);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível remover o feriado.');
    }
  };

  const handleImport = async () => {
    if (!confirm('Importar equipe, valores e batidas salvos neste navegador para o Supabase?')) return;
    setActionError(null);
    setIsImporting(true);
    try {
      await onImportLocalData();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível importar os dados.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCompleteMigration = async () => {
    if (!confirm('Confirme que os dados locais de todos os navegadores foram importados. Ao finalizar, o sistema apagará os dados locais antigos no próximo acesso.')) return;
    setActionError(null);
    setIsCompletingMigration(true);
    try {
      await onCompleteMigration();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível finalizar a migração.');
    } finally {
      setIsCompletingMigration(false);
    }
  };

  const handlePrintPayroll = () => {
    window.print();
  };

  return (
    <section className="space-y-4">
      {/* Relatório Mensal para os 2 Gestores */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 sm:p-5 space-y-5">
        {/* Top Header & Month Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/20">
                <CalendarDays className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                  <span>Fechamento Mensal de Professores & Folha</span>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/30">
                    2 Gestores Autorizados
                  </span>
                </h3>
                <p className="text-xs text-[#777]">
                  Cálculo automático de horistas com escalas flexíveis: dias normais (1x) e domingos/feriados com 100% de adicional (2x).
                </p>
              </div>
            </div>
          </div>

          {/* Month Navigator Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 text-[#777] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                title="Mês anterior"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-xs font-semibold text-white capitalize">
                {formattedMonthLong}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 text-[#777] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                title="Próximo mês"
                aria-label="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <input
              type="month"
              value={month}
              onChange={(event) => {
                if (event.target.value) onMonthChange(event.target.value);
              }}
              className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer"
            />

            <button
              type="button"
              onClick={handlePrintPayroll}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0d0d0d] hover:bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-xs font-semibold text-white transition-all cursor-pointer"
              title="Imprimir relatório da folha"
            >
              <Printer className="w-3.5 h-3.5 text-[#aaa]" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              disabled={hasMissingRates}
              title={hasMissingRates ? 'Cadastre o valor por hora de todos os professores que trabalharam neste mês.' : 'Baixar planilha CSV/Excel'}
              onClick={() => exportMonthlyPayrollCSV(staffList, timeRecords, settings, month, holidays)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#00F201] hover:bg-[#00cc01] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl text-xs shadow-md shadow-[#00F201]/10 transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4 text-black" />
              <span>Exportar Folha (Excel/CSV)</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-3.5">
            <p className="text-[10px] uppercase tracking-wider text-[#777]">Professores no Fechamento</p>
            <p className="mt-1 text-xl font-bold text-white">{payrolls.length}</p>
            <p className="text-[10px] text-[#555] mt-0.5">{payrolls.filter(p => p.totalWorkedMinutes > 0).length} com horas no mês</p>
          </div>

          <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-3.5">
            <p className="text-[10px] uppercase tracking-wider text-[#777]">Horas Normais (1x)</p>
            <p className="mt-1 text-xl font-bold text-white">{formatMinutesToHours(totalRegularMinutes)}</p>
            <p className="text-[10px] text-[#555] mt-0.5">Segunda a Sábado</p>
          </div>

          <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-3.5">
            <p className="text-[10px] uppercase tracking-wider text-[#ffaa00]">Horas Dobradas (2x)</p>
            <p className="mt-1 text-xl font-bold text-[#ffaa00]">{formatMinutesToHours(totalSundayHolidayMinutes)}</p>
            <p className="text-[10px] text-[#ffaa00]/70 mt-0.5">Domingos e Feriados</p>
          </div>

          <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-3.5 border-l-2 border-l-[#00F201]">
            <p className="text-[10px] uppercase tracking-wider text-[#00F201] font-semibold">Total Bruto a Pagar</p>
            <p className="mt-1 text-xl font-extrabold text-[#00F201] font-mono">{formatCurrencyBRL(totalSalary)}</p>
            <p className="text-[10px] text-[#777] mt-0.5">Total de {formatMinutesToHours(totalMinutes)} trabalhadas</p>
          </div>
        </div>

        {hasMissingRates && (
          <div className="rounded-xl border border-[#ffaa00]/30 bg-[#ffaa00]/10 p-3.5 text-xs text-[#ffcc66] flex items-center justify-between gap-3">
            <span>
              <strong>Atenção:</strong> Há professores com horas trabalhadas sem valor por hora cadastrado. Digite o valor por hora diretamente na tabela abaixo para calcular o salário final.
            </span>
          </div>
        )}

        {/* Payroll Table */}
        {payrolls.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#777]">Nenhum professor cadastrado no sistema.</p>
        ) : (
          <div className="overflow-x-auto border border-[#222] rounded-xl">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="bg-[#0d0d0d] text-[#777] uppercase tracking-wider font-semibold border-b border-[#222]">
                <tr>
                  <th className="px-3.5 py-3.5">Professor</th>
                  <th className="px-3.5 py-3.5">Valor Base/Hora</th>
                  <th className="px-3.5 py-3.5">Dias Trabalhados</th>
                  <th className="px-3.5 py-3.5">Horas Normais (1x)</th>
                  <th className="px-3.5 py-3.5 text-[#ffaa00]">Horas Dom/Fer (2x)</th>
                  <th className="px-3.5 py-3.5 font-bold">Total Horas</th>
                  <th className="px-3.5 py-3.5 text-right font-bold text-[#00F201]">Salário Final</th>
                  <th className="px-3.5 py-3.5 text-center">Extrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {payrolls.map((payroll) => {
                  const isEditingThis = editingStaffId === payroll.staffId;

                  return (
                    <tr key={payroll.staffId} className="hover:bg-[#1a1a1a]/50 text-[#ccc] transition-colors">
                      {/* Name & Role */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-black shrink-0"
                            style={{ backgroundColor: payroll.color }}
                          >
                            {payroll.staffName.charAt(0)}
                          </span>
                          <div>
                            <span className="font-semibold text-white block">{payroll.staffName}</span>
                            <span className="text-[10px] text-[#777]">{payroll.role}</span>
                          </div>
                        </div>
                      </td>

                      {/* Hourly Rate with Interactive Inline Edit */}
                      <td className="px-3.5 py-3">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5 bg-[#0d0d0d] p-1 rounded-lg border border-[#00F201]">
                            <span className="text-[10px] text-[#777] pl-1 font-mono">R$</span>
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              value={editingRateValue}
                              onChange={(e) => setEditingRateValue(e.target.value)}
                              className="w-20 bg-transparent text-white font-mono text-xs font-bold outline-none"
                              placeholder="45.00"
                              autoFocus
                            />
                            <button
                              type="button"
                              disabled={isSavingRate}
                              onClick={() => handleSaveRate(payroll.staffId)}
                              className="p-1 bg-[#00F201] text-black rounded hover:bg-[#00cc01]"
                              title="Salvar valor por hora"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStaffId(null)}
                              className="p-1 text-[#777] hover:text-white rounded"
                              title="Cancelar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span className="font-mono font-bold text-white">
                              {payroll.baseHourlyRate > 0 ? (
                                formatCurrencyBRL(payroll.baseHourlyRate) + '/h'
                              ) : (
                                <span className="text-[#ffaa00] text-[11px] underline">Definir R$/h</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditRate(payroll.staffId, payroll.baseHourlyRate)}
                              className="opacity-40 group-hover:opacity-100 p-1 text-[#777] hover:text-[#00F201] transition-opacity"
                              title="Editar valor por hora deste professor"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {payroll.baseHourlyRate > 0 && (
                          <span className="block text-[9px] text-[#ffaa00]">
                            2x Dom/Fer: {formatCurrencyBRL(payroll.baseHourlyRate * 2)}/h
                          </span>
                        )}
                      </td>

                      {/* Days Worked */}
                      <td className="px-3.5 py-3">
                        <span className="font-mono font-medium">{payroll.daysWorkedCount} dias</span>
                      </td>

                      {/* Regular Hours */}
                      <td className="px-3.5 py-3 font-mono">
                        {formatMinutesToHours(payroll.regularMinutes)}
                        <span className="block text-[9px] text-[#777]">
                          {formatCurrencyBRL(payroll.regularEarnings)}
                        </span>
                      </td>

                      {/* 2x Sunday / Holiday Hours */}
                      <td className="px-3.5 py-3 font-mono text-[#ffaa00]">
                        {formatMinutesToHours(payroll.sundayHolidayMinutes)}
                        <span className="block text-[9px] text-[#ffaa00]/70">
                          {formatCurrencyBRL(payroll.sundayHolidayEarnings)} (2x)
                        </span>
                      </td>

                      {/* Total Hours */}
                      <td className="px-3.5 py-3 font-mono font-bold text-white">
                        {formatMinutesToHours(payroll.totalWorkedMinutes)}
                      </td>

                      {/* Final Gross Salary */}
                      <td className="px-3.5 py-3 text-right font-mono font-extrabold text-sm text-[#00F201]">
                        {formatCurrencyBRL(payroll.totalGrossSalary)}
                      </td>

                      {/* Action: Open Day Breakdown */}
                      <td className="px-3.5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedStaffPayroll(payroll)}
                          className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] hover:border-[#00F201] text-white rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 mx-auto cursor-pointer"
                          title="Ver espelho diário deste professor"
                        >
                          <Eye className="w-3 h-3 text-[#00F201]" />
                          <span>Extrato</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Total Row */}
                <tr className="bg-[#0d0d0d] font-bold text-white border-t-2 border-[#222]">
                  <td className="px-3.5 py-3.5" colSpan={3}>
                    TOTAL GERAL DA FOLHA DE PAGAMENTO ({payrolls.length} PROFESSORES)
                  </td>
                  <td className="px-3.5 py-3.5 font-mono">{formatMinutesToHours(totalRegularMinutes)}</td>
                  <td className="px-3.5 py-3.5 font-mono text-[#ffaa00]">{formatMinutesToHours(totalSundayHolidayMinutes)}</td>
                  <td className="px-3.5 py-3.5 font-mono text-base">{formatMinutesToHours(totalMinutes)}</td>
                  <td className="px-3.5 py-3.5 text-right font-mono text-base text-[#00F201]">
                    {formatCurrencyBRL(totalSalary)}
                  </td>
                  <td className="px-3.5 py-3.5"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal: Daily Breakdown of Selected Staff */}
      {selectedStaffPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#0d0d0d] border-b border-[#2a2a2a] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-black"
                  style={{ backgroundColor: selectedStaffPayroll.color }}
                >
                  {selectedStaffPayroll.staffName.charAt(0)}
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">{selectedStaffPayroll.staffName}</h3>
                  <p className="text-xs text-[#777]">
                    Extrato detalhado de horas e diárias · {formattedMonthLong} · {selectedStaffPayroll.role}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaffPayroll(null)}
                className="text-[#777] hover:text-white p-1 rounded-lg hover:bg-[#1a1a1a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Summary Banner */}
            <div className="p-4 bg-[#111] border-b border-[#222] grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-[#222]">
                <p className="text-[10px] text-[#777] uppercase">Valor Base/Hora</p>
                <p className="font-mono font-bold text-white mt-0.5">{formatCurrencyBRL(selectedStaffPayroll.baseHourlyRate)}/h</p>
              </div>
              <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-[#222]">
                <p className="text-[10px] text-[#777] uppercase">Total de Horas</p>
                <p className="font-mono font-bold text-white mt-0.5">{formatMinutesToHours(selectedStaffPayroll.totalWorkedMinutes)}</p>
              </div>
              <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-[#222]">
                <p className="text-[10px] text-[#00F201] uppercase font-semibold">Salário Final</p>
                <p className="font-mono font-bold text-[#00F201] mt-0.5">{formatCurrencyBRL(selectedStaffPayroll.totalGrossSalary)}</p>
              </div>
            </div>

            {/* Modal Body: List of Days Worked */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {selectedStaffPayroll.daysBreakdown.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#777]">Nenhum registro de ponto encontrado para este mês.</p>
              ) : (
                selectedStaffPayroll.daysBreakdown.map((day) => (
                  <div
                    key={day.date}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                      day.isDoubleRate
                        ? 'bg-[#ffaa00]/5 border-[#ffaa00]/30'
                        : 'bg-[#0d0d0d] border-[#222]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{formatDateBR(day.date)}</span>
                        <span className="text-[#888]">· {day.dayOfWeek}</span>
                        {day.isDoubleRate && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-[#ffaa00]/20 text-[#ffaa00] border border-[#ffaa00]/40">
                            {day.holidayName ? `Feriado: ${day.holidayName} (2x)` : 'Domingo (2x)'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#777] mt-1 flex items-center gap-3">
                        <span>Entrada: <strong className="text-white font-mono">{day.entrada || '--:--'}</strong></span>
                        <span>Saída: <strong className="text-white font-mono">{day.saida || '--:--'}</strong></span>
                        <span>Horas: <strong className="text-white font-mono">{day.workedHours}h</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-[#777]">
                        {day.multiplier}x taxa ({formatCurrencyBRL(day.effectiveHourlyRate)}/h)
                      </div>
                      <div className="font-mono font-bold text-sm text-[#00F201]">
                        {formatCurrencyBRL(day.dailyTotal)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#0d0d0d] border-t border-[#2a2a2a] flex items-center justify-between">
              <span className="text-xs text-[#777]">
                Total de {selectedStaffPayroll.daysWorkedCount} dias computados no mês.
              </span>
              <button
                type="button"
                onClick={() => setSelectedStaffPayroll(null)}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-lg text-xs font-semibold"
              >
                Fechar Extrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feriados e Configurações de Migração */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gestão de Feriados com Adicional 2x */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00F201]" />
              <span>Feriados Municipais / Estaduais (Adicional 2x)</span>
            </h4>
            <p className="text-[11px] text-[#777]">
              Feriados nacionais já são calculados automaticamente com adicional de 100% (2x). Adicione feriados locais abaixo.
            </p>
          </div>

          <form onSubmit={handleSaveHoliday} className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2">
            <input
              type="date"
              required
              value={holidayDate}
              onChange={(event) => setHolidayDate(event.target.value)}
              className="min-w-0 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-xs text-white"
            />
            <input
              type="text"
              required
              value={holidayName}
              onChange={(event) => setHolidayName(event.target.value)}
              placeholder="Nome do feriado local"
              className="min-w-0 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-xs text-white"
            />
            <button
              type="submit"
              disabled={isSavingHoliday}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-[#00F201] disabled:opacity-50 rounded-lg text-xs font-bold text-black"
            >
              <Plus className="w-3.5 h-3.5" /> Salvar
            </button>
          </form>

          {holidayError && <p role="alert" className="text-xs text-[#ff7777]">{holidayError}</p>}
          {actionError && <p role="alert" className="text-xs text-[#ff7777]">{actionError}</p>}

          <div className="max-h-44 overflow-y-auto divide-y divide-[#222]">
            {holidays.length === 0 ? (
              <p className="py-3 text-xs text-[#666]">Nenhum feriado adicional cadastrado.</p>
            ) : holidays.map((holiday) => (
              <div key={holiday.date} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="text-[#ccc]">{holiday.date.split('-').reverse().join('/')} · {holiday.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteHoliday(holiday.date)}
                  aria-label={`Remover ${holiday.name}`}
                  className="p-1 text-[#777] hover:text-[#ff4444]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Migração dos dados locais */}
        {(!isMigrationComplete || canImportLocalData) && (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#00F201]" />
                <span>Migração & Conexão de Dados</span>
              </h4>
              <p className="mt-1 text-[11px] text-[#777]">
                Importe os colaboradores e batidas locais deste navegador para o banco de dados Supabase na nuvem.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canImportLocalData && !isMigrationComplete && (
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleImport}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg text-xs font-semibold text-white hover:border-[#00F201] disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 text-[#00F201]" />
                  {isImporting ? 'Importando...' : 'Importar dados locais'}
                </button>
              )}
              {!isMigrationComplete && !hasLocalData && (
                <button
                  type="button"
                  disabled={isCompletingMigration}
                  onClick={handleCompleteMigration}
                  className="px-3 py-2.5 rounded-lg bg-[#00F201] text-xs font-bold text-black disabled:opacity-50"
                >
                  {isCompletingMigration ? 'Finalizando...' : 'Concluir Migração'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
