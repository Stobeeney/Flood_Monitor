import {
  Activity,
  AlertOctagon,
  ArrowDown,
  ArrowUp,
  Droplets,
  Radio,
  Ruler,
} from 'lucide-react';
import type {
  AlertLevel,
  Lrt2Station,
  TelemetrySample,
  ThresholdConfig,
} from '../types/flood';

interface TopKpiRowProps {
  rawDistanceCm: number;
  waterDepthCm: number;
  alertLevel: AlertLevel;
  thresholds: ThresholdConfig;
  samples: TelemetrySample[];
  selectedStation: Lrt2Station;
  alertCountToday: number;
  peakDepthCm: number;
}

function getLevelMeta(level: AlertLevel) {
  switch (level) {
    case 'RED':
      return {
        label: 'RED · CRITICAL FLOOD',
        short: 'RED',
        badgeClass: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
        accentHex: '#DC2626',
        cardTint: 'bg-[#FEF2F2] border-[#FECACA]',
      };
    case 'ORANGE':
      return {
        label: 'ORANGE · WARNING',
        short: 'ORANGE',
        badgeClass: 'bg-[#FFEDD5] text-[#C2410C] border-[#FDBA74]',
        accentHex: '#EA580C',
        cardTint: 'bg-[#FFF7ED] border-[#FED7AA]',
      };
    default:
      return {
        label: 'GREEN · NORMAL',
        short: 'GREEN',
        badgeClass: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
        accentHex: '#16A34A',
        cardTint: 'bg-[#FAF5FF] border-[#DDD6FE]',
      };
  }
}

export function TopKpiRow({
  rawDistanceCm,
  waterDepthCm,
  alertLevel,
  thresholds,
  samples,
  selectedStation,
  alertCountToday,
  peakDepthCm,
}: TopKpiRowProps) {
  const meta = getLevelMeta(alertLevel);
  const recent = samples.slice(-20);

  // Build mini sparkline path for Card 1
  const sparkPath = (() => {
    if (recent.length < 2) return '';
    const vals = recent.map((s) => s.rawDistanceCm);
    const min = Math.min(...vals) - 2;
    const max = Math.max(...vals) + 2;
    const span = Math.max(1, max - min);
    return vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * 160;
        const y = 34 - ((v - min) / span) * 28;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  })();

  const prevDistance =
    recent.length >= 2 ? recent[recent.length - 2].rawDistanceCm : rawDistanceCm;
  const deltaCm = Number((prevDistance - rawDistanceCm).toFixed(1)); // positive = water rising

  const uptimePct = 99.4;
  const ringCircumference = 2 * Math.PI * 22;
  const ringOffset = ringCircumference * (1 - uptimePct / 100);

  return (
    <section
      aria-label="Raw flood detection telemetry and warning status"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5"
    >
      {/* Card 1: Raw Detection Distance (cm) */}
      <article className={`rounded-[10px] border p-4 flex flex-col justify-between ${meta.cardTint}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#334155]">
            Raw Detection Data
          </span>
          <Ruler className="w-4 h-4 text-[#475569]" />
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <div>
            <span className="font-mono-num text-2xl font-bold text-[#0F172A]">
              {rawDistanceCm.toFixed(1)}
            </span>
            <span className="ml-1 text-xs font-semibold text-[#475569]">cm</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${meta.badgeClass}`}
          >
            {meta.short}
          </span>
        </div>

        <svg
          viewBox="0 0 160 38"
          className="w-full h-9 mt-2 overflow-visible"
          aria-hidden="true"
        >
          {sparkPath && (
            <path
              d={sparkPath}
              fill="none"
              stroke={meta.accentHex}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        <div className="mt-1 flex items-center justify-between text-[11px] text-[#475569]">
          <span>Sensor-to-water gap</span>
          <span className="font-mono-num font-semibold">{selectedStation.name}</span>
        </div>
      </article>

      {/* Card 2: Calibrated Water Level */}
      <article className="bg-white rounded-[10px] border border-[#E2E8F0] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#334155]">
            Water Rise Depth
          </span>
          <Droplets className="w-4 h-4 text-[#0284C7]" />
        </div>

        <div className="my-2 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border-[5px] border-[#E2E8F0] flex flex-col items-center justify-center relative">
            <span className="font-mono-num text-lg font-bold text-[#0F172A]">
              {waterDepthCm.toFixed(1)}
            </span>
            <span className="text-[11px] font-medium text-[#64748B]">cm depth</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#475569]">
          <span className="inline-flex items-center gap-1">
            {deltaCm >= 0 ? (
              <ArrowUp className="w-3.5 h-3.5 text-[#DC2626]" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-[#16A34A]" />
            )}
            <span className="font-mono-num font-medium">
              {deltaCm >= 0 ? `+${deltaCm}` : deltaCm} cm/tick
            </span>
          </span>
          <span className="font-mono-num text-[#64748B]">
            Max {thresholds.mountHeightCm} cm
          </span>
        </div>
      </article>

      {/* Card 3: Green / Orange / Red Warning Status */}
      <article className="bg-white rounded-[10px] border border-[#E2E8F0] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#334155]">
            Warning Monitor
          </span>
          <AlertOctagon className="w-4 h-4 text-[#475569]" />
        </div>

        <div className="my-2 divide-y divide-[#F1F5F9]">
          {[
            {
              key: 'GREEN' as AlertLevel,
              title: 'Green · Normal',
              range: `0–${thresholds.warningDistanceCm - 1} cm`,
              dot: 'bg-[#16A34A]',
              active: 'bg-[#DCFCE7] text-[#14532D] rounded-md',
            },
            {
              key: 'ORANGE' as AlertLevel,
              title: 'Orange · Warning',
              range: `${thresholds.warningDistanceCm}–${thresholds.alertDistanceCm - 1} cm`,
              dot: 'bg-[#EA580C]',
              active: 'bg-[#FFEDD5] text-[#7C2D12] rounded-md',
            },
            {
              key: 'RED' as AlertLevel,
              title: 'Red · Critical',
              range: `≥ ${thresholds.alertDistanceCm} cm`,
              dot: 'bg-[#DC2626]',
              active: 'bg-[#FEE2E2] text-[#7F1D1D] rounded-md',
            },
          ].map((tier) => {
            const isCurrent = alertLevel === tier.key;
            return (
              <div
                key={tier.key}
                className={`px-2 py-1.5 text-xs flex items-center justify-between transition-colors ${
                  isCurrent
                    ? `${tier.active} font-semibold`
                    : 'text-[#475569]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${tier.dot} ${
                      isCurrent ? 'ring-2 ring-offset-1 ring-current' : ''
                    }`}
                  />
                  {tier.title}
                </span>
                <span className="font-mono-num text-[11px]">{tier.range}</span>
              </div>
            );
          })}
        </div>
      </article>

      {/* Card 4: Sensor Feed & Simulator Health */}
      <article className="bg-white rounded-[10px] border border-[#E2E8F0] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#334155]">
            Stream Reliability
          </span>
          <Radio className="w-4 h-4 text-[#16A34A]" />
        </div>

        <div className="my-2 flex items-center justify-center">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="22"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="5"
              />
              <circle
                cx="28"
                cy="28"
                r="22"
                fill="none"
                stroke="#16A34A"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <span className="absolute font-mono-num text-sm font-bold text-[#0F172A]">
              {uptimePct.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#475569]">
          <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
            <Activity className="w-3.5 h-3.5" />
            Live ESP32 Feed
          </span>
          <span className="font-mono-num">Supabase RT</span>
        </div>
      </article>

      {/* Card 5: Station Telemetry Summary */}
      <article className="bg-white rounded-[10px] border border-[#E2E8F0] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#334155]">
            Station Summary
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">
            LRT-2 #{selectedStation.order}
          </span>
        </div>

        <div className="mt-2 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#475569]">Raw Reading</span>
            <span className="font-mono-num px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] font-semibold">
              {rawDistanceCm.toFixed(1)} cm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#475569]">Peak Depth</span>
            <span className="font-mono-num px-2 py-0.5 rounded bg-[#FFEDD5] text-[#C2410C] font-semibold">
              {peakDepthCm.toFixed(1)} cm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#475569]">Risk Zone</span>
            <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#0F172A] font-semibold">
              {selectedStation.riskProfile}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#475569]">Alerts Logged</span>
            <span
              className={`font-mono-num px-2 py-0.5 rounded font-semibold ${
                alertCountToday > 0
                  ? 'bg-[#FEE2E2] text-[#B91C1C]'
                  : 'bg-[#F1F5F9] text-[#475569]'
              }`}
            >
              {alertCountToday} events
            </span>
          </div>
        </div>
      </article>
    </section>
  );
}
