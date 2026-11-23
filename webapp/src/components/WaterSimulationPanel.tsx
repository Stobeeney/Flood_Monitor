import { Play, Pause, Radio, Ruler, SlidersHorizontal } from 'lucide-react';
import type {
  AlertLevel,
  Lrt2Station,
  SimulationPreset,
  ThresholdConfig,
} from '../types/flood';

interface WaterSimulationPanelProps {
  rawDistanceCm: number;
  waterDepthCm: number;
  alertLevel: AlertLevel;
  thresholds: ThresholdConfig;
  selectedStation: Lrt2Station;
  preset: SimulationPreset;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSelectPreset: (preset: SimulationPreset) => void;
  onManualDistanceChange: (distanceCm: number) => void;
}

const PRESET_OPTIONS: Array<{ id: SimulationPreset; label: string }> = [
  { id: 'rise_fall_cycle', label: 'Rise & Fall' },
  { id: 'normal_cycle', label: 'Normal Flow' },
  { id: 'rising_storm', label: 'Storm Rise' },
  { id: 'critical_flood', label: 'Red Surge' },
  { id: 'receding', label: 'Receding' },
];

export function WaterSimulationPanel({
  rawDistanceCm,
  waterDepthCm,
  alertLevel,
  thresholds,
  selectedStation,
  preset,
  isPlaying,
  onTogglePlay,
  onSelectPreset,
  onManualDistanceChange,
}: WaterSimulationPanelProps) {
  const maxHeight = thresholds.mountHeightCm;
  const waterPct = Math.max(2, Math.min(96, (waterDepthCm / maxHeight) * 100));

  const orangeDepthCm = Math.max(0, maxHeight - thresholds.warningDistanceCm);
  const redDepthCm = Math.max(0, maxHeight - thresholds.alertDistanceCm);
  const orangePct = Math.max(4, Math.min(96, (orangeDepthCm / maxHeight) * 100));
  const redPct = Math.max(4, Math.min(96, (redDepthCm / maxHeight) * 100));

  // Generate ruler tick marks every 5 cm from 0 (floor) up to maxHeight (sensor)
  const ticks: Array<{ cm: number; pct: number; kind: 'major' | 'mid' | 'minor' }> =
    [];
  for (let cm = 0; cm <= maxHeight; cm += 5) {
    const kind = cm % 20 === 0 ? 'major' : cm % 10 === 0 ? 'mid' : 'minor';
    ticks.push({
      cm,
      pct: (cm / maxHeight) * 100,
      kind,
    });
  }

  const palette =
    alertLevel === 'RED'
      ? {
          waterTop: '#EF4444',
          waterMid: '#DC2626',
          waterDeep: '#991B1B',
          beam: '#DC2626',
          pill: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
          needle: 'bg-[#DC2626]',
          statusText: 'CRITICAL FLOOD LEVEL',
        }
      : alertLevel === 'ORANGE'
        ? {
            waterTop: '#FB923C',
            waterMid: '#EA580C',
            waterDeep: '#9A3412',
            beam: '#EA580C',
            pill: 'bg-[#FFEDD5] text-[#C2410C] border-[#FDBA74]',
            needle: 'bg-[#EA580C]',
            statusText: 'WARNING: WATER RISING',
          }
        : {
            waterTop: '#38BDF8',
            waterMid: '#0284C7',
            waterDeep: '#075985',
            beam: '#0284C7',
            pill: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
            needle: 'bg-[#16A34A]',
            statusText: 'NORMAL CLEARANCE',
          };

  return (
    <article className="bg-white rounded-[10px] border border-[#E2E8F0] p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
        <div>
          <h2 className="font-display text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#6B21A8]" />
            Water Level Staff Gauge Simulation
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            {selectedStation.name} · {selectedStation.waterway}
          </p>
        </div>

        <button
          type="button"
          onClick={onTogglePlay}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] cursor-pointer"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Play
            </>
          )}
        </button>
      </div>

      {/* Staff-Gauge Ruler + Animated Water Column */}
      <div className="mt-3 h-72 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] flex overflow-hidden select-none relative">
        {/* Left Vertical Flood Staff-Gauge Ruler */}
        <div className="w-24 shrink-0 bg-[#FFFDF7] border-r-2 border-[#334155] relative z-30">
          {/* Colored Green / Orange / Red vertical band along the right edge of the ruler */}
          <div
            className="absolute right-0 bottom-0 w-2 bg-[#16A34A]"
            style={{ height: `${orangePct}%` }}
          />
          <div
            className="absolute right-0 w-2 bg-[#EA580C]"
            style={{
              bottom: `${orangePct}%`,
              height: `${Math.max(0, redPct - orangePct)}%`,
            }}
          />
          <div
            className="absolute right-0 top-0 w-2 bg-[#DC2626]"
            style={{ height: `${Math.max(0, 100 - redPct)}%` }}
          />

          {/* Graduated Ruler Ticks & Numbers */}
          {ticks.map((t) => (
            <div
              key={t.cm}
              className="absolute left-0 right-2 flex items-center justify-end"
              style={{ bottom: `${t.pct}%`, transform: 'translateY(50%)' }}
            >
              {t.kind === 'major' && (
                <span className="mr-1.5 font-mono-num text-[10px] font-bold text-[#0F172A] leading-none">
                  {t.cm}
                </span>
              )}
              <span
                className={`block bg-[#1E293B] ${
                  t.kind === 'major'
                    ? 'w-5 h-[2px]'
                    : t.kind === 'mid'
                      ? 'w-3.5 h-[1.5px]'
                      : 'w-2 h-[1px] opacity-60'
                }`}
              />
            </div>
          ))}

          {/* Ruler Unit Header */}
          <span className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded bg-[#F1F5F9] border border-[#CBD5E1] font-mono-num text-[9px] font-bold text-[#334155]">
            CM
          </span>

          {/* Sliding Live Pointer on the Ruler */}
          <div
            className="absolute inset-x-0 z-40 flex items-center justify-end transition-all duration-700 ease-out pointer-events-none"
            style={{ bottom: `${waterPct}%`, transform: 'translateY(50%)' }}
          >
            <span
              className={`px-1.5 py-0.5 rounded-sm text-white font-mono-num text-[10px] font-bold shadow-sm mr-0.5 ${palette.needle}`}
            >
              {waterDepthCm.toFixed(0)}
            </span>
            <span
              className={`w-0 h-0 border-y-[5px] border-y-transparent border-l-[7px] ${
                alertLevel === 'RED'
                  ? 'border-l-[#DC2626]'
                  : alertLevel === 'ORANGE'
                    ? 'border-l-[#EA580C]'
                    : 'border-l-[#16A34A]'
              }`}
            />
          </div>
        </div>

        {/* Right Animated Water Tank & Ultrasonic Sensor */}
        <div className="flex-1 relative bg-[#F8FAFC] overflow-hidden">
          {/* Subtle Horizontal Grid Lines aligned to major ruler marks */}
          {ticks
            .filter((t) => t.kind === 'major')
            .map((t) => (
              <div
                key={`grid-${t.cm}`}
                className="absolute inset-x-0 border-t border-[#E2E8F0]"
                style={{ bottom: `${t.pct}%` }}
              />
            ))}

          {/* Top Mounted Ultrasonic Sensor */}
          <div className="absolute top-0 inset-x-0 flex flex-col items-center z-20 pt-2">
            <div className="px-2.5 py-1 rounded-md bg-[#4C1D95] text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-xs">
              <Radio className="w-3.5 h-3.5 text-[#E9D5FF]" />
              <span>Sensor Gap: {rawDistanceCm.toFixed(1)} cm</span>
            </div>
            <div className="w-10 h-2 bg-[#334155] rounded-b-sm" />
          </div>

          {/* Animated Sonar Pulse Waves dropping from Sensor to Water Surface */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-9 z-10 w-24 pointer-events-none transition-all duration-700 ease-out overflow-hidden"
            style={{ height: `calc(${100 - waterPct}% - 36px)` }}
          >
            <div
              className="mx-auto w-0.5 h-full border-l-2 border-dashed opacity-75"
              style={{ borderColor: palette.beam }}
            />
            {isPlaying && (
              <>
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-3 rounded-full border-2 opacity-70"
                  style={{
                    borderColor: palette.beam,
                    animation: 'sonar-drop 1.8s ease-in infinite',
                  }}
                />
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-3 rounded-full border-2 opacity-70"
                  style={{
                    borderColor: palette.beam,
                    animation: 'sonar-drop 1.8s ease-in 0.9s infinite',
                  }}
                />
              </>
            )}
          </div>

          {/* Orange Warning Threshold Marker */}
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-[#EA580C] z-20 pointer-events-none flex justify-end pr-2"
            style={{ bottom: `${orangePct}%` }}
          >
            <span className="-mt-4 px-1.5 py-0.5 rounded bg-[#FFEDD5] text-[#C2410C] text-[10px] font-semibold border border-[#FDBA74]">
              Warning ({orangeDepthCm.toFixed(0)} cm)
            </span>
          </div>

          {/* Red Critical Threshold Marker */}
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-[#DC2626] z-20 pointer-events-none flex justify-end pr-2"
            style={{ bottom: `${redPct}%` }}
          >
            <span className="-mt-4 px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-semibold border border-[#FCA5A5]">
              Critical ({redDepthCm.toFixed(0)} cm)
            </span>
          </div>

          {/* Rising & Falling Animated Water Column */}
          <div
            className="absolute bottom-0 inset-x-0 transition-[height,background] duration-700 ease-out z-10"
            style={{
              height: `${waterPct}%`,
              background: `linear-gradient(180deg, ${palette.waterTop}D9 0%, ${palette.waterMid}EE 45%, ${palette.waterDeep}F5 100%)`,
            }}
          >
            {/* Primary & Secondary Wave Crests */}
            <div className="absolute -top-3 inset-x-0 h-4 overflow-hidden pointer-events-none">
              <svg
                viewBox="0 0 400 24"
                preserveAspectRatio="none"
                className="w-[200%] h-4 animate-wave-slow opacity-95"
                aria-hidden="true"
              >
                <path
                  d="M0,12 Q50,1 100,12 T200,12 T300,12 T400,12 L400,24 L0,24 Z"
                  fill={palette.waterTop}
                />
              </svg>
            </div>
            <div className="absolute -top-2 inset-x-0 h-3 overflow-hidden pointer-events-none">
              <svg
                viewBox="0 0 400 24"
                preserveAspectRatio="none"
                className="w-[200%] h-3 animate-wave-fast opacity-55"
                aria-hidden="true"
              >
                <path
                  d="M0,12 Q50,22 100,12 T200,12 T300,12 T400,12 L400,24 L0,24 Z"
                  fill="#FFFFFF"
                />
              </svg>
            </div>

            {/* Water Surface Level Readout */}
            <div className="absolute bottom-2 inset-x-3 flex items-center justify-between text-white text-xs font-semibold drop-shadow-2xs">
              <span className="font-mono-num">
                Water Depth: {waterDepthCm.toFixed(1)} cm
              </span>
              <span className="font-mono-num opacity-95">
                {Math.round(waterPct)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Status Strip */}
      <div
        className={`mt-3 px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between ${palette.pill}`}
      >
        <span>{palette.statusText}</span>
        <span className="font-mono-num">{alertLevel}</span>
      </div>

      {/* Interactive Slider + Scenario Buttons */}
      <div className="mt-3 space-y-2.5">
        <div>
          <div className="flex items-center justify-between text-xs text-[#475569] mb-1">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Adjust Water Level (Raw Distance)
            </span>
            <span className="font-mono-num font-bold text-[#0F172A]">
              {rawDistanceCm.toFixed(1)} cm gap · {waterDepthCm.toFixed(1)} cm depth
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={maxHeight - 5}
            step={0.5}
            value={rawDistanceCm}
            onChange={(e) => onManualDistanceChange(Number(e.target.value))}
            aria-label="Simulate raw ultrasonic sensor distance in centimeters"
            className="w-full accent-[#6B21A8] cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono-num text-[#475569]">
            <span>5 cm gap (High Flood)</span>
            <span>{Math.round(maxHeight / 2)} cm</span>
            <span>{maxHeight - 5} cm gap (Low Water)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectPreset(opt.id)}
              className={`px-2 py-1.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                preset === opt.id
                  ? 'bg-[#6B21A8] text-white border-[#6B21A8]'
                  : 'bg-[#F8FAFC] text-[#334155] border-[#CBD5E1] hover:bg-[#F1F5F9]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
