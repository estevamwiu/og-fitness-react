import { OccupancyCount, TimeRecord, GymSettings, StaffMember } from '../types';
import { 
  formatDateBR, 
  generateTimeSlots, 
  computeDailyStaffSummary, 
  formatMinutesToHours,
  calculateMonthlyStaffPayroll,
  formatCurrencyBRL
} from './timeUtils';

// Helper to trigger download of CSV / text file with UTF-8 BOM for Excel compatibility
function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export 30-minute Occupancy Grid as Excel-ready CSV
export function exportOccupancyGridCSV(
  counts: OccupancyCount[],
  settings: GymSettings,
  filterStartDate?: string,
  filterEndDate?: string
) {
  let filtered = [...counts];
  if (filterStartDate) {
    filtered = filtered.filter((c) => c.date >= filterStartDate);
  }
  if (filterEndDate) {
    filtered = filtered.filter((c) => c.date <= filterEndDate);
  }

  // Get unique dates sorted descending
  const dates: string[] = Array.from(new Set<string>(filtered.map((c) => c.date))).sort().reverse();
  const timeSlots = generateTimeSlots(settings.openingTime, settings.closingTime);

  const lines: string[] = [];

  // Header Info
  lines.push(`"${settings.condoName} - ${settings.gymName}"`);
  lines.push(`"RELATÓRIO DE CONTAGEM DE ALUNOS A CADA 30 MINUTOS"`);
  lines.push(`"Capacidade Máxima: ${settings.maxCapacity} alunos | Gerado em: ${new Date().toLocaleString('pt-BR')}"`);
  lines.push('');

  // Table 1: Matrix Time Slots (Columns) x Dates (Rows)
  const headerRow = ['Data', ...timeSlots, 'Média Diária', 'Pico Máximo', 'Horário de Pico'];
  lines.push(headerRow.map((h) => `"${h}"`).join(';'));

  dates.forEach((date) => {
    const rowCounts = filtered.filter((c) => c.date === date);
    let sum = 0;
    let max = 0;
    let peakSlot = '-';
    let validSlots = 0;

    const slotValues = timeSlots.map((slot) => {
      const match = rowCounts.find((c) => c.timeSlot === slot);
      if (match) {
        sum += match.count;
        validSlots++;
        if (match.count > max) {
          max = match.count;
          peakSlot = slot;
        }
        return match.count.toString();
      }
      return '-';
    });

    const avg = validSlots > 0 ? (sum / validSlots).toFixed(1) : '-';
    const row = [formatDateBR(date), ...slotValues, avg, max > 0 ? max.toString() : '-', peakSlot];
    lines.push(row.map((val) => `"${val}"`).join(';'));
  });

  lines.push('');
  lines.push('"--- DETALHAMENTO DE REGISTROS POR ZONA E RESPONSÁVEL ---"');
  lines.push('"Data";"Horário (Slot)";"Total Alunos";"Musculação";"Cardio";"Funcional";"Outros";"Capacidade %";"Instrutor Responsável";"Observação"');

  // Detailed records list
  filtered
    .sort((a, b) => (b.date + b.timeSlot).localeCompare(a.date + a.timeSlot))
    .forEach((rec) => {
      const occPct = Math.round((rec.count / (rec.maxCapacity || settings.maxCapacity)) * 100);
      const detailRow = [
        formatDateBR(rec.date),
        rec.timeSlot,
        rec.count,
        rec.breakdown?.musculacao ?? '-',
        rec.breakdown?.cardio ?? '-',
        rec.breakdown?.funcional ?? '-',
        rec.breakdown?.outros ?? '-',
        `${occPct}%`,
        rec.loggedByStaffName || '-',
        (rec.notes || '').replace(/"/g, '""'),
      ];
      lines.push(detailRow.map((v) => `"${v}"`).join(';'));
    });

  const filename = `Contagem_Ocupacao_30min_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(lines.join('\r\n'), filename);
}

// Export Employee Time Clock Records (Espelho de Ponto)
export function exportTimeRecordsCSV(
  records: TimeRecord[],
  staffList: StaffMember[],
  settings: GymSettings,
  filterStaffId?: string,
  filterMonth?: string // YYYY-MM
) {
  let filtered = [...records];
  if (filterStaffId && filterStaffId !== 'ALL') {
    filtered = filtered.filter((r) => r.staffId === filterStaffId);
  }
  if (filterMonth) {
    filtered = filtered.filter((r) => r.date.startsWith(filterMonth));
  }

  const lines: string[] = [];
  lines.push(`"${settings.condoName} - CONTROLE DE PONTO ELETRÔNICO"`);
  lines.push(`"ESPELHO DE PONTO DOS COLABORADORES DA ACADEMIA"`);
  lines.push(`"Gerado em: ${new Date().toLocaleString('pt-BR')}"`);
  lines.push('');

  // Daily Summary per staff
  lines.push('"--- RESUMO DIÁRIO DE JORNADA (ESPELHO DE PONTO) ---"');
  lines.push('"Colaborador";"Cargo";"Data";"Entrada";"Saída";"Total Trabalhado";"Status"');

  const dates: string[] = Array.from(new Set<string>(filtered.map((r) => r.date))).sort().reverse();
  const staffToInclude = filterStaffId && filterStaffId !== 'ALL'
    ? staffList.filter((s) => s.id === filterStaffId)
    : staffList;

  staffToInclude.forEach((staff) => {
    dates.forEach((date) => {
      const summary = computeDailyStaffSummary(staff, filtered, date);
      if (summary.records.length > 0) {
        const row = [
          staff.name,
          staff.role,
          formatDateBR(date),
          summary.entrada || '--:--',
          summary.saida || '--:--',
          formatMinutesToHours(summary.totalWorkedMinutes),
          summary.status === 'EM_TURNO' ? 'Em Turno' : summary.status === 'FINALIZADO' ? 'Concluído' : 'Em Aberto',
        ];
        lines.push(row.map((v) => `"${v}"`).join(';'));
      }
    });
  });

  lines.push('');
  lines.push('"--- LOG DETALHADO DE BATIDAS DE PONTO ---"');
  lines.push('"Código Comprovante";"Colaborador";"Cargo";"Data";"Horário";"Tipo de Batida";"Local";"Observação"');

  filtered
    .sort((a, b) => b.timestamp - a.timestamp)
    .forEach((rec) => {
      const typeLabel = rec.type === 'ENTRADA'
        ? 'Entrada'
        : rec.type === 'SAIDA'
        ? 'Saída'
        : 'Registro antigo (intervalo)';

      const row = [
        rec.code || '-',
        rec.staffName,
        rec.staffRole,
        formatDateBR(rec.date),
        rec.time,
        typeLabel,
        rec.location,
        (rec.notes || '').replace(/"/g, '""'),
      ];
      lines.push(row.map((v) => `"${v}"`).join(';'));
    });

  const filename = `Espelho_de_Ponto_Academia_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(lines.join('\r\n'), filename);
}

// Export Monthly Payroll Summary (Cálculo Mensal de Horistas)
export function exportMonthlyPayrollCSV(
  staffList: StaffMember[],
  records: TimeRecord[],
  settings: GymSettings,
  monthKey: string // YYYY-MM
) {
  const [year, month] = monthKey.split('-').map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const lines: string[] = [];
  lines.push(`"${settings.condoName} - ${settings.gymName}"`);
  lines.push(`"RELATÓRIO MENSAL DE FECHAMENTO DE HORAS & FOLHA DE PAGAMENTO"`);
  lines.push(`"Mês de Referência: ${monthName.toUpperCase()} (${monthKey})"`);
  lines.push(`"Regra de Cálculo: Horas normais (1x) | Domingos e Feriados Nacionais (2x Dobrado)"`);
  lines.push(`"Gerado em: ${new Date().toLocaleString('pt-BR')}"`);
  lines.push('');

  // 1. Resumo por Funcionário
  lines.push('"--- CONSOLIDAÇÃO MENSAL POR COLABORADOR ---"');
  lines.push('"Colaborador";"Cargo";"Valor Base/Hora";"Dias Trabalhados";"Horas Normais (1x)";"Subtotal Normais (R$)";"Horas Dom/Feriado (2x)";"Valor Dom/Feriado";"Subtotal Dom/Feriado (R$)";"Total Horas";"Salário Final a Pagar (R$)"');

  let totalGeralHoras = 0;
  let totalGeralFolha = 0;

  staffList.forEach((staff) => {
    const payroll = calculateMonthlyStaffPayroll(staff, records, monthKey);
    totalGeralHoras += payroll.totalWorkedHours;
    totalGeralFolha += payroll.totalGrossSalary;

    const row = [
      staff.name,
      staff.role,
      `R$ ${staff.hourlyRate.toFixed(2).replace('.', ',')}`,
      payroll.daysWorkedCount,
      payroll.regularHours.toFixed(2).replace('.', ','),
      `R$ ${payroll.regularEarnings.toFixed(2).replace('.', ',')}`,
      payroll.sundayHolidayHours.toFixed(2).replace('.', ','),
      `R$ ${(staff.hourlyRate * 2).toFixed(2).replace('.', ',')}`,
      `R$ ${payroll.sundayHolidayEarnings.toFixed(2).replace('.', ',')}`,
      payroll.totalWorkedHours.toFixed(2).replace('.', ','),
      `R$ ${payroll.totalGrossSalary.toFixed(2).replace('.', ',')}`,
    ];
    lines.push(row.map((v) => `"${v}"`).join(';'));
  });

  lines.push('');
  lines.push(`"TOTAL GERAL DA FOLHA DO MÊS";"";"";"";"";"";"";"";"";"${totalGeralHoras.toFixed(2).replace('.', ',')}h";"R$ ${totalGeralFolha.toFixed(2).replace('.', ',')}"`);
  lines.push('');

  // 2. Detalhamento Dia a Dia de Cada Colaborador
  lines.push('"--- DETALHAMENTO DIÁRIO DE HORAS E VALORES CALCULADOS ---"');
  lines.push('"Colaborador";"Data";"Dia da Semana";"Classificação do Dia";"Entrada";"Saída";"Horas Trabalhadas";"Multiplicador";"Valor/Hora Aplicado";"Total do Dia (R$)"');

  staffList.forEach((staff) => {
    const payroll = calculateMonthlyStaffPayroll(staff, records, monthKey);
    payroll.daysBreakdown.forEach((day) => {
      const row = [
        staff.name,
        formatDateBR(day.date),
        day.dayOfWeek,
        day.holidayName ? `Feriado (${day.holidayName})` : day.isSunday ? 'Domingo (Valor Dobrado 2x)' : 'Dia Regular',
        day.entrada || '--:--',
        day.saida || '--:--',
        `${day.workedHours.toFixed(2).replace('.', ',')}h`,
        `${day.multiplier}x`,
        `R$ ${day.effectiveHourlyRate.toFixed(2).replace('.', ',')}`,
        `R$ ${day.dailyTotal.toFixed(2).replace('.', ',')}`,
      ];
      lines.push(row.map((v) => `"${v}"`).join(';'));
    });
  });

  const filename = `Folha_Pagamento_Horistas_${monthKey}_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(lines.join('\r\n'), filename);
}
