import { useState } from 'react';
import {
  CloudRain,
  Database,
  Download,
  Save,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import type { LiveReadingRow } from '../lib/supabase';
import type {
  AlertLevel,
  Lrt2Station,
  PhWeatherData,
  TelemetrySample,
  ThresholdConfig,
} from '../types/flood';

interface BottomAnalyticsProps {
  samples: TelemetrySample[];
  savedLogs: LiveReadingRow[];
  weatherData: PhWeatherData | null;
  selectedStation: Lrt2Station;
  thresholds: ThresholdConfig;
  onSaveSnapshot: () => Promise<void>;
}

export function BottomAnalytics({
  samples,
  savedLogs,
  weatherData,
  selectedStation,
  thresholds,
  onSaveSnapshot,
}: BottomAnalyticsProps) {
  const [filterLevel, setFilterLevel] = useState<'ALL' | AlertLevel>('ALL');
  const [saving, setSaving] = useState(false);

  const totalSamples = Math.max(1, samples.length);
  const greenCount = samples.filter((s) => s.level === 'GREEN').length;
  const orangeCount = samples.filter((s) => s.level === 'ORANGE').length;
  const redCount = samples.filter((s) => s.level === 'RED').length;

  const greenPct = Math.round((greenCount / totalSamples) * 100);
  const orangePct = Math.round((orangeCount / totalSamples) * 100);
  const redPct = Math.round((redCount / totalSamples) * 100);

  const trendSamples = samples.slice(-45);
  const chartPath = (() => {
    if (trendSamples.length < 2) return '';
    return trendSamples
      .map((s, idx) => {
        const x = (idx / (trendSamples.length - 1)) * 520;
        const clamped = Math.max(0, Math.min(thresholds.mountHeightCm, s.waterDepthCm));
        const y = 128 - (clamped / thresholds.mountHeightCm) * 112;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  })();

  const maxPrecip = Math.max(
    2,
    ...(weatherData?.hourly.map((h) => h.precipitationMm) ?? [2]),
  );

  const visibleLogs =
    filterLevel === 'ALL'
      ? savedLogs
      : savedLogs.filter((row) => row.alert_level === filterLevel);

  function handleExportCsv() {
    const header = 'id,recorded_at_ph,station_id,raw_distance_cm,water_depth_cm,alert_level,source';
    const lines = visibleLogs.map((r) => {
      const phTime = new Date(r.recorded_at).toLocaleString('en-PH', {
        hour12: false,
      });
      return `${r.id},"${phTime}",${r.station_id},${Number(r.raw_distance_cm).toFixed(1)},${Number(r.water_depth_cm).toFixed(1)},${r.alert_level},${r.source}`;
    });
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lrt2_flood_logs_${selectedStation.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveClick() {
    setSaving(true);
    try {
      await onSaveSnapshot();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      {/* Row 1: Alert Zone Distribution + Manila Rainfall/Weather Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <article className="lg:col-span-5 bg-white rounded-[10px] border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h2 className="font-display text-sm font-bold text-[#0F172A]">
              Monitoring Tier Distribution
            </h2>
            <span className="text-xs text-[#64748B] font-mono-num">
              Last {samples.length} readings
            </span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-[#E2E8F0] mt-4">
            {[
              {
                label: 'Green',
                sub: 'Normal',
                pct: greenPct,
                ring: '#16A34A',
                bg: 'bg-[#DCFCE7] text-[#15803D]',
              },
              {
                label: 'Orange',
                sub: 'Warning',
                pct: orangePct,
                ring: '#EA580C',
                bg: 'bg-[#FFEDD5] text-[#C2410C]',
              },
              {
                label: 'Red',
                sub: 'Critical',
                pct: redPct,
                ring: '#DC2626',
                bg: 'bg-[#FEE2E2] text-[#B91C1C]',
              },
            ].map((item) => {
              const c = 2 * Math.PI * 24;
              const offset = c * (1 - item.pct / 100);
              return (
                <div
                  key={item.label}
                  className="px-2 py-2 flex flex-col items-center text-center"
                >
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 60 60">
                      <circle
                        cx="30"
                        cy="30"
                        r="24"
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth="5"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r="24"
                        fill="none"
                        stroke={item.ring}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <span className="absolute font-mono-num text-xs font-bold text-[#0F172A]">
                      {item.pct}%
                    </span>
                  </div>
                  <span className={`mt-2 px-2 py-0.5 rounded text-[11px] font-bold ${item.bg}`}>
                    {item.label}
                  </span>
                  <span className="text-[11px] text-[#64748B] mt-0.5">{item.sub}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="lg:col-span-7 bg-white rounded-[10px] border border-[#E2E8F0] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-display text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-[#0284C7]" />
                Manila Weather &amp; Rainfall Forecast ({selectedStation.name})
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                {weatherData?.isLiveApi
                  ? `Live Open-Meteo API · Updated ${weatherData.fetchedAt}`
                  : 'Offline fallback forecast · Connect internet for live Open-Meteo'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono-num">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#F1F5F9] text-[#0F172A] font-semibold">
                <Thermometer className="w-3.5 h-3.5 text-[#EA580C]" />
                {weatherData?.currentTempC.toFixed(1) ?? '--'}°C
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#EFF6FF] text-[#0369A1] font-semibold">
                <CloudRain className="w-3.5 h-3.5" />
                {weatherData?.currentPrecipMm.toFixed(1) ?? '--'} mm/h
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-8 gap-2 items-end h-32">
            {(weatherData?.hourly ?? []).map((pt) => {
              const barPct = Math.max(8, Math.round((pt.precipitationMm / maxPrecip) * 100));
              return (
                <div
                  key={pt.hourLabel}
                  className="flex flex-col items-center justify-end h-full gap-1"
                >
                  <span className="font-mono-num text-[11px] text-[#334155]">
                    {pt.precipitationMm.toFixed(1)}
                  </span>
                  <div className="w-full max-w-7 bg-[#EFF6FF] rounded-t-md h-20 flex items-end overflow-hidden border border-[#DBEAFE]">
                    <div
                      className="w-full bg-[#0284C7] rounded-t-sm transition-all duration-300"
                      style={{ height: `${barPct}%` }}
                    />
                  </div>
                  <span className="font-mono-num text-[11px] text-[#475569]">
                    {pt.hourLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {/* Row 2: Live Water Depth Trend + Persisted Supabase Logs & CSV Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <article className="lg:col-span-5 bg-white rounded-[10px] border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h2 className="font-display text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0284C7]" />
              Live Water Depth Curve (cm)
            </h2>
            <span className="text-xs text-[#64748B]">Higher = deeper water</span>
          </div>

          <div className="mt-3">
            <svg viewBox="0 0 520 140" className="w-full h-40">
              <line x1="0" y1="128" x2="520" y2="128" stroke="#E2E8F0" />
              <line
                x1="0"
                y1={
                  128 -
                  ((thresholds.mountHeightCm - thresholds.warningDistanceCm) /
                    thresholds.mountHeightCm) *
                    112
                }
                x2="520"
                y2={
                  128 -
                  ((thresholds.mountHeightCm - thresholds.warningDistanceCm) /
                    thresholds.mountHeightCm) *
                    112
                }
                stroke="#EA580C"
                strokeDasharray="4 4"
              />
              <line
                x1="0"
                y1={
                  128 -
                  ((thresholds.mountHeightCm - thresholds.alertDistanceCm) /
                    thresholds.mountHeightCm) *
                    112
                }
                x2="520"
                y2={
                  128 -
                  ((thresholds.mountHeightCm - thresholds.alertDistanceCm) /
                    thresholds.mountHeightCm) *
                    112
                }
                stroke="#DC2626"
                strokeDasharray="4 4"
              />
              {chartPath && (
                <path
                  d={chartPath}
                  fill="none"
                  stroke="#0284C7"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        </article>

        {/* Persisted Supabase Sensor Logs */}
        <article className="lg:col-span-7 bg-white rounded-[10px] border border-[#E2E8F0] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-display text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Database className="w-4 h-4 text-[#6B21A8]" />
                Saved Cloud Logs ({visibleLogs.length})
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Stored in Supabase · {selectedStation.name}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'RED', 'ORANGE', 'GREEN'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                    filterLevel === lvl
                      ? 'bg-[#6B21A8] text-white border-[#6B21A8]'
                      : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={saving}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F3E8FF] text-[#4C1D95] border border-[#D8B4FE] text-[11px] font-semibold hover:bg-[#E9D5FF] disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-3 h-3" />
                {saving ? 'Saving...' : 'Save Now'}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={visibleLogs.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#111827] text-white text-[11px] font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-2 max-h-48 overflow-y-auto">
            {visibleLogs.length === 0 ? (
              <p className="text-xs text-[#64748B] py-6 text-center">
                No saved readings yet for {selectedStation.name}. Connect your ESP32
                to Wi-Fi and Supabase to log live measurements here.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC] text-[#475569] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-1.5 px-2 font-semibold">Date &amp; Time (PH)</th>
                    <th className="py-1.5 px-2 font-semibold">Raw Gap</th>
                    <th className="py-1.5 px-2 font-semibold">Water Depth</th>
                    <th className="py-1.5 px-2 font-semibold">Status</th>
                    <th className="py-1.5 px-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {visibleLogs.slice(0, 50).map((row) => {
                    const badge =
                      row.alert_level === 'RED'
                        ? 'bg-[#FEE2E2] text-[#B91C1C]'
                        : row.alert_level === 'ORANGE'
                          ? 'bg-[#FFEDD5] text-[#C2410C]'
                          : 'bg-[#DCFCE7] text-[#15803D]';
                    const phDateTime = new Date(row.recorded_at).toLocaleString(
                      'en-PH',
                      {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      },
                    );
                    return (
                      <tr key={row.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-1.5 px-2 font-mono-num text-[#334155]">
                          {phDateTime}
                        </td>
                        <td className="py-1.5 px-2 font-mono-num font-semibold text-[#0F172A]">
                          {Number(row.raw_distance_cm).toFixed(1)} cm
                        </td>
                        <td className="py-1.5 px-2 font-mono-num text-[#334155]">
                          {Number(row.water_depth_cm).toFixed(1)} cm
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge}`}
                          >
                            {row.alert_level}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 font-mono-num text-[#64748B]">
                          {row.source}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
