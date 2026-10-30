import React, { useMemo, useState } from 'react';
import { CalendarDays, Download, Plus, Trash2, Upload } from 'lucide-react';
import { GymSettings, Holiday, StaffMember, TimeRecord } from '../types';
import {
  calculateMonthlyStaffPayroll,
  formatCurrencyBRL,
  formatMinutesToHours,
} from '../utils/timeUtils';
import { exportMonthlyPayrollCSV } from '../utils/exportExcel';

interface MonthlyPayrollViewProps {
  staffList: StaffMember[];
  timeRecords: TimeRecord[];
  settings: GymSettings;
  month: string;
  onMonthChange: (month: string) => void;
  holidays: Holiday[];
  canImportLocalData: boolean;
  hasLocalData: boolean;
  isMigrationComplete: boolean;
  onSaveHoliday: (holiday: Holiday) => Promise<void>;
  onDeleteHoliday: (date: string) => Promise<void>;
  onImportLocalData: () => Promise<void>;
  onCompleteMigration: () => Promise<void>;
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
}) => {
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCompletingMigration, setIsCompletingMigration] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const payrolls = useMemo(
    () => staffList.map((staff) => calculateMonthlyStaffPayroll(staff, timeRecords, month, holidays)),
    [staffList, timeRecords, month, holidays],
  );
  const totalMinutes = payrolls.reduce((sum, payroll) => sum + payroll.totalWorkedMinutes, 0);
  const totalSalary = payrolls.reduce((sum, payroll) => sum + payroll.totalGrossSalary, 0);
  const hasMissingRates = payrolls.some(
    (payroll) => payroll.totalWorkedMinutes > 0 && payroll.baseHourlyRate <= 0,
  );

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

  return (
    <section className="space-y-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#00F201]" />
            <div>
              <h3 className="font-bold text-white">Fechamento mensal de horistas</h3>
              <p className="text-[11px] text-[#777]">Domingos e feriados cadastrados recebem adicional de 100% (2x).</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-xs text-[#aaa]">
              Mês
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  if (event.target.value) onMonthChange(event.target.value);
                }}
                className="bg-transparent text-white outline-none"
              />
            </label>
            <button
              type="button"
              disabled={hasMissingRates}
              title={hasMissingRates ? 'Cadastre o valor por hora de todos que trabalharam neste mês.' : undefined}
              onClick={() => exportMonthlyPayrollCSV(staffList, timeRecords, settings, month, holidays)}
              className="flex items-center gap-2 px-3 py-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg text-xs font-semibold text-white hover:border-[#00F201] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 text-[#00F201]" />
              Exportar folha CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#777]">Colaboradores no relatório</p>
            <p className="mt-1 text-lg font-bold text-white">{payrolls.length}</p>
          </div>
          <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#777]">Horas trabalhadas no mês</p>
            <p className="mt-1 text-lg font-bold text-white">{formatMinutesToHours(totalMinutes)}</p>
          </div>
          <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#777]">Total bruto da folha</p>
            <p className="mt-1 text-lg font-bold text-[#00F201]">{formatCurrencyBRL(totalSalary)}</p>
          </div>
        </div>

        {hasMissingRates && (
          <p role="alert" className="rounded-lg border border-[#ffaa00]/30 bg-[#ffaa00]/10 p-3 text-xs text-[#ffcc66]">
            Há colaboradores sem valor por hora cadastrado. Atualize o valor na equipe para calcular corretamente a folha.
          </p>
        )}

        {payrolls.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#777]">Nenhum colaborador cadastrado.</p>
        ) : (
          <div className="overflow-x-auto border border-[#222] rounded-xl">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-[#0d0d0d] text-[#777] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3">Colaborador</th>
                  <th className="px-3 py-3">Valor/hora</th>
                  <th className="px-3 py-3">Dias</th>
                  <th className="px-3 py-3">Horas normais</th>
                  <th className="px-3 py-3">Horas 2x</th>
                  <th className="px-3 py-3">Total de horas</th>
                  <th className="px-3 py-3 text-right">Salário bruto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {payrolls.map((payroll) => (
                  <tr key={payroll.staffId} className="text-[#ccc]">
                    <td className="px-3 py-3">
                      <span className="font-semibold text-white">{payroll.staffName}</span>
                      <span className="block text-[10px] text-[#777]">{payroll.role}</span>
                    </td>
                    <td className="px-3 py-3 font-mono">{formatCurrencyBRL(payroll.baseHourlyRate)}</td>
                    <td className="px-3 py-3">{payroll.daysWorkedCount}</td>
                    <td className="px-3 py-3">{formatMinutesToHours(payroll.regularMinutes)}</td>
                    <td className="px-3 py-3 text-[#ffaa00]">{formatMinutesToHours(payroll.sundayHolidayMinutes)}</td>
                    <td className="px-3 py-3 font-semibold">{formatMinutesToHours(payroll.totalWorkedMinutes)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-[#00F201]">
                      {formatCurrencyBRL(payroll.totalGrossSalary)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#0d0d0d] font-bold text-white">
                  <td className="px-3 py-3" colSpan={5}>Total da folha</td>
                  <td className="px-3 py-3">{formatMinutesToHours(totalMinutes)}</td>
                  <td className="px-3 py-3 text-right font-mono text-[#00F201]">{formatCurrencyBRL(totalSalary)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-white">Feriados locais e datas especiais</h4>
            <p className="text-[11px] text-[#777]">Cadastre feriados estaduais, municipais ou datas acordadas para o adicional 2x.</p>
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
              placeholder="Nome do feriado"
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

        {(!isMigrationComplete || canImportLocalData) && (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white">Migração dos dados locais</h4>
              <p className="mt-1 text-[11px] text-[#777]">
                Importe os dados de cada navegador que ainda tenha equipe e batidas antigas antes de finalizar. A importação não apaga registros até ser concluída com sucesso.
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
                  {isImporting ? 'Importando...' : 'Importar dados deste navegador'}
                </button>
              )}
              {!isMigrationComplete && !hasLocalData && (
                <button
                  type="button"
                  disabled={isCompletingMigration}
                  onClick={handleCompleteMigration}
                  className="px-3 py-2.5 rounded-lg bg-[#00F201] text-xs font-bold text-black disabled:opacity-50"
                >
                  {isCompletingMigration ? 'Finalizando...' : 'Finalizar migração'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
