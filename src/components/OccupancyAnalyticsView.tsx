import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Flame, 
  Clock, 
  Users, 
  Calendar, 
  Award,
  Zap,
  Info
} from 'lucide-react';
import { OccupancyCount, GymSettings } from '../types';
import { generateTimeSlots, formatDateBR } from '../utils/timeUtils';

interface OccupancyAnalyticsViewProps {
  counts: OccupancyCount[];
  settings: GymSettings;
}

export const OccupancyAnalyticsView: React.FC<OccupancyAnalyticsViewProps> = ({
  counts,
  settings,
}) => {
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);
  const allSlots = useMemo(() => generateTimeSlots(settings.openingTime, settings.closingTime), [settings]);

  // Hourly Average Curve (Across all recorded days)
  const hourlyData = useMemo(() => {
    return allSlots.map((slot) => {
      const slotRecords = counts.filter((c) => c.timeSlot === slot);
      const total = slotRecords.reduce((sum, c) => sum + c.count, 0);
      const avg = slotRecords.length > 0 ? Math.round((total / slotRecords.length) * 10) / 10 : 0;
      const max = slotRecords.reduce((m, c) => (c.count > m ? c.count : m), 0);

      return {
        slot,
        media: avg,
        maximo: max,
        amostras: slotRecords.length,
      };
    });
  }, [allSlots, counts]);

  // Day of Week Distribution
  const dayOfWeekData = useMemo(() => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const buckets = Array(7).fill(0).map((_, i) => ({ day: days[i], total: 0, count: 0 }));

    counts.forEach((c) => {
      const [y, m, d] = c.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayIdx = dateObj.getDay();
      buckets[dayIdx].total += c.count;
      buckets[dayIdx].count += 1;
    });

    return buckets.map((b) => ({
      day: b.day,
      media: b.count > 0 ? Math.round(b.total / b.count) : 0,
      totalRegistros: b.count,
    }));
  }, [counts]);

  // Find Peak Slot Overall
  const peakSlot = useMemo(() => {
    return [...hourlyData].sort((a, b) => b.media - a.media)[0];
  }, [hourlyData]);

  // Find Calmest Slot Overall
  const calmSlot = useMemo(() => {
    const activeHours = hourlyData.filter((h) => h.amostras > 0);
    return [...activeHours].sort((a, b) => a.media - b.media)[0];
  }, [hourlyData]);

  return (
    <div className="space-y-6">
      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#00F201]/10 text-[#00F201] border border-[#00F201]/20 shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] text-[#777] font-semibold uppercase tracking-widest">Horário de Maior Pico</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">
              {peakSlot ? `${peakSlot.slot} (Média ${peakSlot.media} alunos)` : '--:--'}
            </div>
            <div className="text-[11px] text-[#00F201] font-medium mt-0.5">Maior fluxo de moradores</div>
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#E2E8F0]/10 text-[#E2E8F0] border border-[#E2E8F0]/20 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] text-[#777] font-semibold uppercase tracking-widest">Horário Mais Tranquilo</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">
              {calmSlot ? `${calmSlot.slot} (Média ${calmSlot.media} alunos)` : '--:--'}
            </div>
            <div className="text-[11px] text-[#E2E8F0] font-medium mt-0.5">Ideal para treinos calmos</div>
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#1a1a1a] text-[#aaa] border border-[#333] shrink-0">
            <Users className="w-6 h-6 text-[#00F201]" />
          </div>
          <div>
            <div className="text-[10px] text-[#777] font-semibold uppercase tracking-widest">Capacidade do Condomínio</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">
              {settings.maxCapacity} Alunos Máx.
            </div>
            <div className="text-[11px] text-[#777] mt-0.5">Alerta a partir de {settings.warningCapacity} alunos</div>
          </div>
        </div>
      </div>

      {/* Main Chart: 30-Min Occupancy Curve */}
      <div className="bg-[#141414] border border-[#2a2a2a] p-4 sm:p-6 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="font-semibold text-base text-white">Curva de Ocupação por Faixa de 30 Minutos</h3>
            <p className="text-xs text-[#777]">Média histórica de ocupação ao longo do horário de funcionamento</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-[#e0e0e0]">
              <span className="w-3 h-3 rounded bg-[#00F201]"></span>
              <span>Média de Alunos</span>
            </span>
            <span className="flex items-center gap-1.5 text-[#777]">
              <span className="w-3 h-0.5 bg-[#ff4444]"></span>
              <span>Capacidade Máx ({settings.maxCapacity})</span>
            </span>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F201" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#00F201" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
              <XAxis 
                dataKey="slot" 
                stroke="#555555" 
                fontSize={11} 
                interval={1}
                tickLine={false}
              />
              <YAxis stroke="#555555" fontSize={11} domain={[0, settings.maxCapacity + 5]} />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#0d0d0d] border border-[#333333] p-3 rounded-xl text-xs shadow-2xl font-mono text-[#e0e0e0]">
                        <div className="font-bold text-white mb-1.5 border-b border-[#222] pb-1">Horário: {label}</div>
                        <div className="text-[#00F201]">Média: {data.media} alunos</div>
                        <div className="text-[#e0e0e0]">Pico Máx: {data.maximo} alunos</div>
                        <div className="text-[#777] text-[10px] mt-1">{data.amostras} medições coletadas</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine 
                y={settings.maxCapacity} 
                stroke="#ff4444" 
                strokeDasharray="4 4" 
                label={{ value: 'Limite Máximo', fill: '#ff4444', fontSize: 10, position: 'insideTopRight' }} 
              />
              <ReferenceLine 
                y={settings.warningCapacity} 
                stroke="#ffb700" 
                strokeDasharray="2 2" 
                label={{ value: 'Atenção 80%', fill: '#ffb700', fontSize: 10, position: 'insideBottomRight' }} 
              />
              <Area 
                type="monotone" 
                dataKey="media" 
                stroke="#00F201" 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#occupancyGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Charts: Day of Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Day of Week Attendance */}
        <div className="bg-[#141414] border border-[#2a2a2a] p-4 sm:p-5 rounded-2xl shadow-xl">
          <h3 className="font-semibold text-sm text-white mb-0.5">Média de Alunos por Dia da Semana</h3>
          <p className="text-xs text-[#777] mb-4">Descubra os dias mais movimentados da academia</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={dayOfWeekData}
                onMouseMove={(state: any) => {
                  if (state && typeof state.activeTooltipIndex !== 'undefined') {
                    setActiveBarIndex(Number(state.activeTooltipIndex));
                  } else {
                    setActiveBarIndex(null);
                  }
                }}
                onMouseLeave={() => setActiveBarIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                <XAxis dataKey="day" stroke="#555555" fontSize={11} />
                <YAxis stroke="#555555" fontSize={11} />
                <Tooltip 
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#0d0d0d] border border-[#333333] p-2.5 rounded-xl text-xs font-mono shadow-2xl">
                          <div className="font-bold text-white mb-0.5">{label}</div>
                          <div className="text-[#00F201] font-semibold">Média: {payload[0].value} alunos</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="media" radius={[6, 6, 0, 0]} animationDuration={400} activeBar={false}>
                  {dayOfWeekData.map((entry, index) => {
                    const isHovered = activeBarIndex === index;
                    const baseFill = entry.media >= 20 ? '#00F201' : entry.media >= 14 ? '#00cc01' : '#333333';
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isHovered ? '#00F201' : baseFill}
                        opacity={activeBarIndex === null || isHovered ? 1 : 0.35}
                        style={{
                          filter: isHovered ? 'drop-shadow(0 0 10px rgba(0, 242, 1, 0.75)) brightness(1.25)' : 'none',
                          transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                          transformOrigin: 'bottom',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          cursor: 'pointer'
                        }}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Condominium Gym Insights */}
        <div className="bg-[#141414] border border-[#2a2a2a] p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-[#00F201]" />
              <h3 className="font-semibold text-sm text-white">Recomendações Operacionais</h3>
            </div>
            <div className="space-y-2.5 text-xs text-[#ccc]">
              <div className="bg-[#0d0d0d] p-3 rounded-xl border border-[#222]">
                <span className="font-semibold text-[#00F201]">Pico Noturno (17h30 às 20h30):</span>
                <p className="text-[#777] mt-0.5">
                  Maior demanda dos moradores. Recomendado manter 2 instrutores na sala para auxílio de aparelhos e segurança.
                </p>
              </div>
              <div className="bg-[#0d0d0d] p-3 rounded-xl border border-[#222]">
                <span className="font-semibold text-[#E2E8F0]">Pico Matutino (07h00 às 09h00):</span>
                <p className="text-[#777] mt-0.5">
                  Grande fluxo na área de cardio (esteiras e bikes). Recomendado conferir lubrificação e higienização.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#222] text-[11px] text-[#555]">
            Atualizado automaticamente a cada nova contagem registrada de 30 minutos.
          </div>
        </div>
      </div>
    </div>
  );
};
