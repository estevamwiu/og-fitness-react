import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Table as TableIcon, 
  ListFilter,
  Flame,
  Clock,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { OccupancyCount, GymSettings, StaffMember } from '../types';
import { generateTimeSlots, formatDateBR, formatDateKey } from '../utils/timeUtils';
import { exportOccupancyGridCSV } from '../utils/exportExcel';

interface ExcelSheetViewProps {
  counts: OccupancyCount[];
  settings: GymSettings;
  staffList: StaffMember[];
  onOpenCountModal: (slot?: string, date?: string, existingRecord?: OccupancyCount) => void;
}

export const ExcelSheetView: React.FC<ExcelSheetViewProps> = ({
  counts,
  settings,
  staffList,
  onOpenCountModal,
}) => {
  const [viewFormat, setViewFormat] = useState<'MATRIX' | 'DETAILED'>('MATRIX');
  const [dateRange, setDateRange] = useState<'7D' | '14D' | '30D' | 'ALL'>('7D');
  const [searchTerm, setSearchTerm] = useState('');

  const allSlots = generateTimeSlots(settings.openingTime, settings.closingTime);

  // Get distinct dates
  const allDates: string[] = Array.from(new Set<string>(counts.map((c) => c.date))).sort().reverse();
  
  // Filter dates based on selection
  let filteredDates: string[] = allDates;
  if (dateRange === '7D') filteredDates = allDates.slice(0, 7);
  else if (dateRange === '14D') filteredDates = allDates.slice(0, 14);
  else if (dateRange === '30D') filteredDates = allDates.slice(0, 30);

  // Heatmap background color based on occupancy count
  const getCellColor = (count: number | undefined) => {
    if (count === undefined) return 'bg-[#0a0a0a]/50 text-[#444444]';
    if (count >= settings.maxCapacity) return 'bg-[#cc0000]/25 text-[#ff4444] font-bold border-[#cc0000]/40';
    if (count >= settings.warningCapacity) return 'bg-[#ffb700]/25 text-[#ffb700] font-bold border-[#ffb700]/40';
    if (count >= 15) return 'bg-[#00F201]/10 text-[#70ff70] font-semibold';
    if (count > 0) return 'bg-[#1a1a1a] text-[#E2E8F0]';
    return 'bg-[#0d0d0d] text-[#555555]';
  };

  const handleExport = () => {
    exportOccupancyGridCSV(counts, settings);
  };

  return (
    <div className="space-y-4">
      {/* View Header & Action Bar */}
      <div className="bg-[#141414] border border-[#2a2a2a] p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Planilha Eletrônica de Ocupação (30 min)
              </h2>
              <p className="text-xs text-[#777]">
                Substitui a planilha manual do Excel com registro automático, análise de pico e exportação direta.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Format Switcher */}
          <div className="flex bg-[#0d0d0d] p-1 rounded-xl border border-[#2a2a2a] text-xs font-semibold">
            <button
              onClick={() => setViewFormat('MATRIX')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                viewFormat === 'MATRIX' ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/30' : 'text-[#777] hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Matriz Excel</span>
            </button>
            <button
              onClick={() => setViewFormat('DETAILED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                viewFormat === 'DETAILED' ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/30' : 'text-[#777] hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Log Detalhado</span>
            </button>
          </div>

          {/* Date range filter */}
          <div className="flex bg-[#0d0d0d] p-1 rounded-xl border border-[#2a2a2a] text-xs">
            {(['7D', '14D', '30D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  dateRange === r ? 'bg-[#1a1a1a] text-white border border-[#333]' : 'text-[#777] hover:text-[#ccc]'
                }`}
              >
                {r === '7D' ? '7 dias' : r === '14D' ? '14 dias' : r === '30D' ? '30 dias' : 'Tudo'}
              </button>
            ))}
          </div>

          {/* Export Excel / CSV */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#00F201] hover:bg-[#00cc01] text-black font-bold rounded-xl text-xs shadow-md shadow-[#00F201]/20 transition-all active:scale-95"
            id="btn-export-excel"
          >
            <Download className="w-4 h-4 text-black" />
            <span>Baixar Planilha Excel</span>
          </button>
        </div>
      </div>

      {/* MATRIX VIEW (Exact Excel Replica with 30-min columns) */}
      {viewFormat === 'MATRIX' ? (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3.5 bg-[#141414] border-b border-[#2a2a2a] flex items-center justify-between text-xs text-[#777]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Matriz de Ocupação por Faixa de 30 minutos</span>
              <span className="text-[#555]">• Clique em qualquer célula para editar</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#E2E8F0]/10 border border-[#E2E8F0]/30"></span>
                <span>Normal (&lt;24)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#ffb700]/20 border border-[#ffb700]/40"></span>
                <span>Alerta (24-29)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#cc0000]/30 border border-[#cc0000]/50"></span>
                <span>Lotado (30+)</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-xs text-center border-collapse">
              <thead className="sticky top-0 z-10 bg-[#0d0d0d] text-[#777] font-mono uppercase text-[11px] shadow-sm">
                <tr>
                  <th className="sticky left-0 z-20 bg-[#0d0d0d] px-3 py-2.5 text-left border-r border-b border-[#2a2a2a] font-sans font-bold text-white min-w-[110px]">
                    Data
                  </th>
                  {allSlots.map((slot) => (
                    <th key={slot} className="px-2 py-2.5 border-b border-r border-[#2a2a2a] font-bold min-w-[54px]">
                      {slot}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 border-b border-r border-[#2a2a2a] bg-[#141414] font-sans font-bold text-[#e0e0e0] min-w-[80px]">
                    Média
                  </th>
                  <th className="px-3 py-2.5 border-b border-r border-[#2a2a2a] bg-[#141414] font-sans font-bold text-[#00F201] min-w-[80px]">
                    Pico
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a] font-mono text-xs">
                {filteredDates.map((date) => {
                  const dayCounts = counts.filter((c) => c.date === date);
                  let sum = 0;
                  let max = 0;
                  let peakSlot = '-';
                  let validCount = 0;

                  return (
                    <tr key={date} className="hover:bg-[#1a1a1a]/50 transition-colors">
                      {/* Sticky Date Column */}
                      <td className="sticky left-0 z-10 bg-[#141414]/95 px-3 py-2 text-left font-bold font-sans text-white border-r border-[#2a2a2a] whitespace-nowrap">
                        {formatDateBR(date)}
                      </td>

                      {/* 30-min Slot Cells */}
                      {allSlots.map((slot) => {
                        const record = dayCounts.find((c) => c.timeSlot === slot);
                        if (record) {
                          sum += record.count;
                          validCount++;
                          if (record.count > max) {
                            max = record.count;
                            peakSlot = slot;
                          }
                        }

                        return (
                          <td
                            key={slot}
                            onClick={() => onOpenCountModal(slot, date, record)}
                            className={`px-1.5 py-2 border-r border-[#2a2a2a]/80 cursor-pointer transition-all hover:ring-1 hover:ring-[#00F201] ${getCellColor(
                              record?.count
                            )}`}
                            title={
                              record
                                ? `${record.count} alunos às ${slot} (Resp: ${record.loggedByStaffName})`
                                : `Clique para registrar ${slot}`
                            }
                          >
                            {record ? record.count : '-'}
                          </td>
                        );
                      })}

                      {/* Daily Avg */}
                      <td className="px-3 py-2 font-bold text-[#e0e0e0] bg-[#0d0d0d]/40 border-r border-[#2a2a2a]">
                        {validCount > 0 ? (sum / validCount).toFixed(1) : '-'}
                      </td>

                      {/* Daily Peak */}
                      <td className="px-3 py-2 font-bold text-[#00F201] bg-[#0d0d0d]/40">
                        {max > 0 ? `${max} (${peakSlot})` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* DETAILED LOG VIEW (Chronological list with zones) */
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3.5 bg-[#141414] border-b border-[#2a2a2a] flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white">Registros Detalhados de Contagem</h3>
            <span className="text-xs text-[#777]">{counts.length} medições registradas</span>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0d0d0d] text-[#777] font-semibold uppercase tracking-wider border-b border-[#2a2a2a]">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Horário Slot</th>
                  <th className="px-4 py-3">Total Alunos</th>
                  <th className="px-4 py-3">Musculação</th>
                  <th className="px-4 py-3">Cardio</th>
                  <th className="px-4 py-3">Funcional</th>
                  <th className="px-4 py-3">Instrutor Responsável</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222] font-mono text-[#ccc]">
                {[...counts]
                  .sort((a, b) => (b.date + b.timeSlot).localeCompare(a.date + a.timeSlot))
                  .slice(0, 100)
                  .map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-4 py-2.5 font-bold font-sans text-white">{formatDateBR(rec.date)}</td>
                      <td className="px-4 py-2.5 font-bold text-[#00F201]">{rec.timeSlot}</td>
                      <td className="px-4 py-2.5 font-bold text-lg text-white">{rec.count}</td>
                      <td className="px-4 py-2.5 text-[#aaa]">{rec.breakdown?.musculacao ?? '-'}</td>
                      <td className="px-4 py-2.5 text-[#70ff70]">{rec.breakdown?.cardio ?? '-'}</td>
                      <td className="px-4 py-2.5 text-[#E2E8F0]">{rec.breakdown?.funcional ?? '-'}</td>
                      <td className="px-4 py-2.5 font-sans text-[#e0e0e0]">{rec.loggedByStaffName}</td>
                      <td className="px-4 py-2.5 font-sans">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            rec.status === 'lotado'
                              ? 'bg-[#cc0000]/20 text-[#ff4444] border-[#cc0000]/30'
                              : rec.status === 'alerta'
                              ? 'bg-[#ffb700]/20 text-[#ffb700] border-[#ffb700]/30'
                              : 'bg-[#E2E8F0]/10 text-[#E2E8F0] border-[#E2E8F0]/30'
                          }`}
                        >
                          {rec.status === 'lotado' ? 'Lotado' : rec.status === 'alerta' ? 'Alto' : 'Normal'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => onOpenCountModal(rec.timeSlot, rec.date, rec)}
                          className="text-[#00F201] hover:text-[#00cc01] text-[11px] font-sans font-semibold underline"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
