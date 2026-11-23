import { CloudRain, Clock, Thermometer, TrendingUp } from 'lucide-react';
import type {
  AlertEvent,
  Lrt2Station,
  PhWeatherData,
  TelemetrySample,
  ThresholdConfig,
} from '../types/flood';

interface BottomAnalyticsProps {
  samples: TelemetrySample[];
  alertEvents: AlertEvent[];
  weatherData: PhWeatherData | null;
  selectedStation: Lrt2Station;
  thresholds: ThresholdConfig;
}

export function BottomAnalytics({
  samples,
  alertEvents,
  weatherData,
  selectedStation,
  thresholds,
}: BottomAnalyticsProps) {
  const totalSamples = Math.max(1, samples.length);
  const greenCount = samples.filter((s) => s.level === 'GREEN').length;
  const orangeCount = samples.filter((s) => s.level === 'ORANGE').length;
  const redCount = samples.filter((s) => s.level === 'RED').length;

  const greenPct = Math.round((greenCount / totalSamples) * 100);
  const orangePct = Math.round((orangeCount / totalSamples) * 100);
  const redPct = Math.round((redCount / totalSamples) * 100);

  // Build SVG trend curve for raw distance & water depth
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

  return (
    <section className="space-y-4">
      {/* Row 1: Alert Zone Distribution + Manila Rainfall/Weather Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Green / Orange / Red Exposure Gauges */}
        <article className="lg:col-span-5 bg-white rounded-[10px] border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h2 className="font-display text-sm font-bold text-[#0F172A]">
              Monitoring Tier Distribution
            </h2>
            <span className="text-xs text-[#64748B] font-mono-num">
              Last {samples.length} ticks
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

        {/* Right: Manila Open-Meteo Weather & Rainfall Panel */}
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

      {/* Row 2: Live Water Depth Trend + Incident Alert Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Trend Chart */}
        <article className="lg:col-span-6 bg-white rounded-[10px] border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h2 className="font-display text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0284C7]" />
              Simulated Water Depth Curve (cm)
            </h2>
            <span className="text-xs text-[#64748B]">Higher curve = deeper water</span>
          </div>

          <div className="mt-3">
            <svg viewBox="0 0 520 140" className="w-full h-36">
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

        {/* Right: Recent Alert Transitions */}
        <article className="lg:col-span-6 bg-white rounded-[10px] border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h2 className="font-display text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#475569]" />
              Alert Transition Log
            </h2>
            <span className="text-xs text-[#64748B] font-mono-num">
              {alertEvents.length} logged
            </span>
          </div>

          <div className="mt-3 max-h-40 overflow-y-auto divide-y divide-[#F1F5F9]">
            {alertEvents.length === 0 ? (
              <p className="text-xs text-[#64748B] py-6 text-center">
                No warning transitions recorded yet. Trigger Storm Rise or drag the
                simulation slider to observe Green/Orange/Red events.
              </p>
            ) : (
              alertEvents.slice(0, 8).map((ev) => {
                const badge =
                  ev.level === 'RED'
                    ? 'bg-[#FEE2E2] text-[#B91C1C]'
                    : ev.level === 'ORANGE'
                      ? 'bg-[#FFEDD5] text-[#C2410C]'
                      : 'bg-[#DCFCE7] text-[#15803D]';
                return (
                  <div
                    key={ev.id}
                    className="py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#0F172A] truncate">
                        {ev.stationName} · {ev.message}
                      </p>
                      <p className="text-[11px] font-mono-num text-[#64748B]">
                        {ev.timestamp} · Raw {ev.rawDistanceCm.toFixed(1)} cm
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold ${badge}`}
                    >
                      {ev.level}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
