import React, { useState } from 'react';
import { 
  Timer, 
  UserCheck, 
  Calendar, 
  Download, 
  Plus, 
  Filter, 
  Clock, 
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { StaffMember, TimeRecord, GymSettings } from '../types';
import { formatDateBR, computeDailyStaffSummary, formatMinutesToHours } from '../utils/timeUtils';
import { exportTimeRecordsCSV } from '../utils/exportExcel';

interface TimeClockViewProps {
  staffList: StaffMember[];
  timeRecords: TimeRecord[];
  settings: GymSettings;
  onOpenTimeClockModal: () => void;
}

export const TimeClockView: React.FC<TimeClockViewProps> = ({
  staffList,
  timeRecords,
  settings,
  onOpenTimeClockModal,
}) => {
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const todayKey = new Date().toISOString().slice(0, 10);

  // Compute status for all staff today
  const staffStatusList = staffList.map((staff) => {
    const summary = computeDailyStaffSummary(staff, timeRecords, todayKey);
    return {
      staff,
      summary,
    };
  });

  // Filtered records for table
  let filteredRecords = [...timeRecords];
  if (selectedStaffFilter !== 'ALL') {
    filteredRecords = filteredRecords.filter((r) => r.staffId === selectedStaffFilter);
  }
  if (selectedMonth) {
    filteredRecords = filteredRecords.filter((r) => r.date.startsWith(selectedMonth));
  }

  // Group by Date and Staff for Espelho de Ponto view
  const uniqueDates: string[] = Array.from(new Set<string>(filteredRecords.map((r) => r.date))).sort().reverse();
  const staffToDisplay = selectedStaffFilter !== 'ALL'
    ? staffList.filter((s) => s.id === selectedStaffFilter)
    : staffList;

  const handleExport = () => {
    exportTimeRecordsCSV(timeRecords, staffList, settings, selectedStaffFilter, selectedMonth);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Punch Trigger */}
      <div className="bg-[#141414] border border-[#2a2a2a] p-4 sm:p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/20">
              <Timer className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Controle de Ponto dos Colaboradores
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#777] max-w-xl">
            Registro de entrada, saída e espelho de ponto dos instrutores e equipe da academia do condomínio.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0d0d0d] hover:bg-[#1a1a1a] text-[#e0e0e0] font-semibold rounded-xl text-xs border border-[#2a2a2a] transition-all"
            id="btn-export-ponto"
          >
            <Download className="w-4 h-4 text-[#00F201]" />
            <span>Exportar Espelho (CSV/Excel)</span>
          </button>

          <button
            onClick={onOpenTimeClockModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00F201] hover:bg-[#00cc01] text-black font-bold rounded-xl text-xs shadow-lg shadow-[#00F201]/20 transition-all active:scale-95"
            id="btn-bater-ponto-view"
          >
            <Timer className="w-4 h-4 text-black" />
            <span>Bater Ponto Agora</span>
          </button>
        </div>
      </div>

      {/* Live Staff Shift Cards (Today's Real-Time Status) */}
      <div>
        <div className="text-[10px] font-semibold text-[#777] uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-[#E2E8F0]" />
          <span>Status dos Instrutores Hoje ({formatDateBR(todayKey)})</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {staffStatusList.map(({ staff, summary }) => {
            const isWorking = summary.status === 'EM_TURNO';
            const isDone = summary.status === 'FINALIZADO';

            return (
              <div
                key={staff.id}
                className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-black shrink-0 shadow-sm"
                      style={{ backgroundColor: staff.color }}
                    >
                      {staff.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-white truncate max-w-[120px]">{staff.name}</h4>
                      <p className="text-[11px] text-[#777]">{staff.role}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                      isWorking
                        ? 'bg-[#E2E8F0]/10 text-[#E2E8F0] border-[#E2E8F0]/30 animate-pulse'
                        : isDone
                        ? 'bg-[#1a1a1a] text-[#888] border-[#333]'
                        : 'bg-[#0d0d0d] text-[#555] border-[#222]'
                    }`}
                  >
                    {isWorking ? 'Em Turno' : isDone ? 'Finalizado' : 'Não Iniciado'}
                  </span>
                </div>

                {/* Shift Info */}
                <div className="my-3 space-y-1 text-xs">
                  <div className="flex justify-between text-[#777] text-[11px]">
                    <span>Escala:</span>
                    <span className="font-mono text-[#ccc]">{staff.scheduledShift}</span>
                  </div>
                  <div className="flex justify-between text-[#777] text-[11px]">
                    <span>Entrada hoje:</span>
                    <span className="font-mono text-white font-semibold">{summary.entrada || '--:--'}</span>
                  </div>
                  <div className="flex justify-between text-[#777] text-[11px]">
                    <span>Horas trabalhadas:</span>
                    <span className="font-mono text-[#E2E8F0] font-bold">
                      {formatMinutesToHours(summary.totalWorkedMinutes)}
                    </span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#222] flex items-center justify-between text-[11px]">
                  <span className="text-[#555]">{summary.records.length} batidas</span>
                  <button
                    onClick={onOpenTimeClockModal}
                    className="text-[#00F201] hover:text-[#00cc01] font-medium flex items-center gap-0.5"
                  >
                    <span>Registrar</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Espelho de Ponto Table */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-xl">
        {/* Table Filter Controls */}
        <div className="p-4 bg-[#141414] border-b border-[#2a2a2a] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#00F201]" />
            <h3 className="font-semibold text-sm text-white">Espelho de Ponto Diário</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Filter by Staff */}
            <div className="flex items-center gap-1.5 bg-[#0d0d0d] px-3 py-1.5 rounded-xl border border-[#2a2a2a]">
              <span className="text-[#777]">Colaborador:</span>
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#141414] text-white">Todos os Colaboradores</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#141414] text-white">
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Month */}
            <div className="flex items-center gap-1.5 bg-[#0d0d0d] px-3 py-1.5 rounded-xl border border-[#2a2a2a] font-mono">
              <Calendar className="w-3.5 h-3.5 text-[#777]" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Table Contents */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d0d0d] text-[#777] uppercase tracking-wider font-semibold border-b border-[#2a2a2a]">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Saída</th>
                <th className="px-4 py-3">Total Trabalhado</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222] font-mono text-[#ccc]">
              {uniqueDates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#555] font-sans">
                    Nenhum registro de ponto encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                uniqueDates.map((date) => {
                  return staffToDisplay.map((staff) => {
                    const summary = computeDailyStaffSummary(staff, filteredRecords, date);
                    if (summary.records.length === 0) return null;

                    return (
                      <tr key={`${date}-${staff.id}`} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                          {formatDateBR(date)}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <div className="font-semibold text-white">{staff.name}</div>
                          <div className="text-[10px] text-[#777]">{staff.role}</div>
                        </td>
                        <td className="px-4 py-3 text-[#E2E8F0] font-bold">{summary.entrada || '--:--'}</td>
                        <td className="px-4 py-3 text-[#ff4444] font-bold">{summary.saida || '--:--'}</td>
                        <td className="px-4 py-3 font-bold text-white">
                          {formatMinutesToHours(summary.totalWorkedMinutes)}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                              summary.status === 'EM_TURNO'
                                ? 'bg-[#E2E8F0]/10 text-[#E2E8F0] border-[#E2E8F0]/30'
                                : summary.status === 'FINALIZADO'
                                ? 'bg-[#1a1a1a] text-[#888] border-[#333]'
                                : 'bg-[#0d0d0d] text-[#555] border-[#222]'
                            }`}
                          >
                            {summary.status === 'EM_TURNO'
                              ? 'Em Turno'
                              : summary.status === 'FINALIZADO'
                              ? 'Concluído'
                              : 'Aberto'}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
