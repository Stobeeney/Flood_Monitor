import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  Menu,
  Radio,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { BottomAnalytics } from './components/BottomAnalytics';
import { PhilippinesFloodMap } from './components/PhilippinesFloodMap';
import { Sidebar } from './components/Sidebar';
import { TopKpiRow } from './components/TopKpiRow';
import { WaterSimulationPanel } from './components/WaterSimulationPanel';
import { LRT2_STATIONS } from './data/lrt2Stations';
import { fetchManilaFloodWeather } from './lib/phFloodApi';
import {
  fetchRecentReadings,
  getActiveOperator,
  isSupabaseConfigured,
  signOutOperator,
  subscribeToStationReadings,
  supabase,
} from './lib/supabase';
import { LoginPage } from './pages/LoginPage';
import type {
  AlertEvent,
  AlertLevel,
  Lrt2Station,
  NavSection,
  OperatorUser,
  PhWeatherData,
  SimulationPreset,
  TelemetrySample,
  ThresholdConfig,
} from './types/flood';

function classifyLevel(rawDistanceCm: number, cfg: ThresholdConfig): AlertLevel {
  if (rawDistanceCm <= cfg.alertDistanceCm) return 'RED';
  if (rawDistanceCm <= cfg.warningDistanceCm) return 'ORANGE';
  return 'GREEN';
}

function buildInitialSamples(
  station: Lrt2Station,
  cfg: ThresholdConfig,
): TelemetrySample[] {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, idx) => {
    const t = new Date(now - (23 - idx) * 1000);
    const wave = Math.sin(idx * 0.45) * 4.2;
    const rawDistanceCm = Number((station.baselineDistanceCm + wave).toFixed(1));
    const waterDepthCm = Number(
      Math.max(0, cfg.mountHeightCm - rawDistanceCm).toFixed(1),
    );
    return {
      timestamp: t.toLocaleTimeString('en-PH', { hour12: false }),
      timeShort: t.toLocaleTimeString('en-PH', { hour12: false }),
      rawDistanceCm,
      waterDepthCm,
      level: classifyLevel(rawDistanceCm, cfg),
      stationId: station.id,
    };
  });
}

export function App() {
  const [operator, setOperator] = useState<OperatorUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [selectedStation, setSelectedStation] = useState<Lrt2Station>(
    LRT2_STATIONS[10], // Santolan (Marikina River) default focus
  );
  const [stationQuery, setStationQuery] = useState('');

  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    mountHeightCm: 180,
    warningDistanceCm: 50,
    alertDistanceCm: 25,
  });

  const [dataMode, setDataMode] = useState<'simulator' | 'live_esp32'>(
    isSupabaseConfigured ? 'live_esp32' : 'simulator',
  );
  const [lastLiveSync, setLastLiveSync] = useState<string | null>(null);
  const [preset, setPreset] = useState<SimulationPreset>('rise_fall_cycle');
  const [isPlaying, setIsPlaying] = useState(true);
  const [rawDistanceCm, setRawDistanceCm] = useState<number>(
    LRT2_STATIONS[10].baselineDistanceCm,
  );
  const [samples, setSamples] = useState<TelemetrySample[]>(() =>
    buildInitialSamples(LRT2_STATIONS[10], {
      mountHeightCm: 180,
      warningDistanceCm: 50,
      alertDistanceCm: 25,
    }),
  );
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [weatherData, setWeatherData] = useState<PhWeatherData | null>(null);
  const [tickPhase, setTickPhase] = useState(0);

  // Check Supabase / preview auth on mount
  useEffect(() => {
    let mounted = true;
    getActiveOperator().then((user) => {
      if (mounted) {
        setOperator(user);
        setAuthChecking(false);
      }
    });

    if (supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          setOperator(null);
        } else {
          const username =
            (session.user.user_metadata?.username as string | undefined) ||
            session.user.email?.split('@')[0] ||
            'Operator';
          setOperator({
            id: session.user.id,
            username,
            email: session.user.email ?? '',
            role: 'DRRMO Operator',
            mode: 'supabase',
          });
        }
      });
      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Manila weather & RainViewer radar for selected station
  useEffect(() => {
    if (!operator) return;
    let cancelled = false;
    fetchManilaFloodWeather(selectedStation.lat, selectedStation.lng).then(
      (data) => {
        if (!cancelled) setWeatherData(data);
      },
    );
    const interval = setInterval(() => {
      fetchManilaFloodWeather(selectedStation.lat, selectedStation.lng).then(
        (data) => {
          if (!cancelled) setWeatherData(data);
        },
      );
    }, 180_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [operator, selectedStation]);

  // Live ESP32 telemetry stream from Supabase (for Vercel deployment)
  useEffect(() => {
    if (!operator || dataMode !== 'live_esp32' || !isSupabaseConfigured) return;

    let cancelled = false;

    const loadLatest = async () => {
      const rows = await fetchRecentReadings(selectedStation.id, 45);
      if (cancelled || rows.length === 0) return;
      const latest = rows[rows.length - 1];
      setRawDistanceCm(Number(latest.raw_distance_cm));
      setLastLiveSync(
        new Date(latest.recorded_at).toLocaleTimeString('en-PH', {
          hour12: false,
        }),
      );
      setSamples(
        rows.map((r) => {
          const ts = new Date(r.recorded_at).toLocaleTimeString('en-PH', {
            hour12: false,
          });
          return {
            timestamp: ts,
            timeShort: ts,
            rawDistanceCm: Number(r.raw_distance_cm),
            waterDepthCm: Number(r.water_depth_cm),
            level: r.alert_level,
            stationId: r.station_id,
          };
        }),
      );
    };

    loadLatest();
    const unsubscribe = subscribeToStationReadings(selectedStation.id, (row) => {
      if (cancelled) return;
      setRawDistanceCm(Number(row.raw_distance_cm));
      setLastLiveSync(
        new Date(row.recorded_at).toLocaleTimeString('en-PH', {
          hour12: false,
        }),
      );
    });
    const poll = setInterval(loadLatest, 5000);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(poll);
    };
  }, [operator, dataMode, selectedStation.id]);

  // Simulation 1 Hz engine (runs only in Simulator mode)
  useEffect(() => {
    if (!operator || !isPlaying || dataMode !== 'simulator') return;

    const timer = setInterval(() => {
      setTickPhase((p) => p + 1);
      setRawDistanceCm((prev) => {
        let next = prev;
        if (preset === 'rise_fall_cycle') {
          // Smooth continuous rise-and-fall sweep across Green, Orange, and Red zones
          const minGap = Math.max(12, thresholds.alertDistanceCm - 8);
          const maxGap = Math.min(thresholds.mountHeightCm - 25, 138);
          const mid = (minGap + maxGap) / 2;
          const amp = (maxGap - minGap) / 2;
          next = mid + Math.cos(tickPhase * 0.22) * amp;
        } else if (preset === 'normal_cycle') {
          const center = selectedStation.baselineDistanceCm;
          next = center + Math.sin(tickPhase * 0.35) * 10;
        } else if (preset === 'rising_storm') {
          next = Math.max(14, prev - 3.2 + (Math.random() - 0.5) * 0.8);
        } else if (preset === 'critical_flood') {
          next = 18 + Math.sin(tickPhase * 0.6) * 4.5;
        } else if (preset === 'receding') {
          next = Math.min(
            selectedStation.baselineDistanceCm,
            prev + 3.0 + (Math.random() - 0.5) * 0.6,
          );
        } else {
          // Manual mode adds subtle realistic water-surface ripple
          next = Math.max(
            5,
            Math.min(thresholds.mountHeightCm - 5, prev + (Math.random() - 0.5) * 0.4),
          );
        }
        return Number(
          Math.max(5, Math.min(thresholds.mountHeightCm - 5, next)).toFixed(1),
        );
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    operator,
    isPlaying,
    dataMode,
    preset,
    selectedStation.baselineDistanceCm,
    thresholds.alertDistanceCm,
    thresholds.mountHeightCm,
    tickPhase,
  ]);

  const waterDepthCm = Number(
    Math.max(0, thresholds.mountHeightCm - rawDistanceCm).toFixed(1),
  );
  const alertLevel = classifyLevel(rawDistanceCm, thresholds);

  // Record sample history & alert state transitions
  useEffect(() => {
    if (!operator) return;
    const nowStr = new Date().toLocaleTimeString('en-PH', { hour12: false });
    const sample: TelemetrySample = {
      timestamp: nowStr,
      timeShort: nowStr,
      rawDistanceCm,
      waterDepthCm,
      level: alertLevel,
      stationId: selectedStation.id,
    };

    setSamples((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.level !== alertLevel) {
        const msg =
          alertLevel === 'RED'
            ? 'Critical flood threshold breached (RED)'
            : alertLevel === 'ORANGE'
              ? 'Pre-flood warning threshold reached (ORANGE)'
              : 'Water surface returned to safe clearance (GREEN)';
        setAlertEvents((events) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: nowStr,
            stationName: selectedStation.name,
            level: alertLevel,
            rawDistanceCm,
            waterDepthCm,
            message: msg,
          },
          ...events.slice(0, 49),
        ]);
      }
      return [...prev.slice(-59), sample];
    });
  }, [operator, rawDistanceCm, waterDepthCm, alertLevel, selectedStation]);

  const handleSelectStation = useCallback(
    (station: Lrt2Station) => {
      setSelectedStation(station);
      if (preset === 'normal_cycle') {
        setRawDistanceCm(station.baselineDistanceCm);
      }
    },
    [preset],
  );

  function handlePresetChange(nextPreset: SimulationPreset) {
    setPreset(nextPreset);
    setIsPlaying(true);
    if (nextPreset === 'critical_flood') {
      setRawDistanceCm(18);
    } else if (nextPreset === 'rising_storm') {
      setRawDistanceCm(Math.max(thresholds.warningDistanceCm + 8, 62));
    } else if (nextPreset === 'normal_cycle') {
      setRawDistanceCm(selectedStation.baselineDistanceCm);
    }
  }

  function handleManualDistance(val: number) {
    setPreset('manual');
    setRawDistanceCm(val);
  }

  async function handleLogout() {
    await signOutOperator();
    setOperator(null);
  }

  // Map station status overlay across all 13 LRT-2 stations
  const stationLevels = useMemo(() => {
    const map: Record<string, { level: AlertLevel; rawCm: number }> = {};
    LRT2_STATIONS.forEach((st) => {
      if (st.id === selectedStation.id) {
        map[st.id] = { level: alertLevel, rawCm: rawDistanceCm };
      } else {
        // Adjacent high-risk stations reflect basin pressure slightly when surge occurs
        const surgeOffset =
          alertLevel === 'RED' && st.riskProfile === 'High'
            ? -70
            : alertLevel === 'ORANGE' && st.riskProfile === 'High'
              ? -55
              : 0;
        const estRaw = Math.max(12, st.baselineDistanceCm + surgeOffset);
        map[st.id] = {
          level: classifyLevel(estRaw, thresholds),
          rawCm: estRaw,
        };
      }
    });
    return map;
  }, [selectedStation.id, alertLevel, rawDistanceCm, thresholds]);

  const filteredStations = useMemo(() => {
    const q = stationQuery.trim().toLowerCase();
    if (!q) return LRT2_STATIONS;
    return LRT2_STATIONS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.municipality.toLowerCase().includes(q) ||
        s.waterway.toLowerCase().includes(q),
    );
  }, [stationQuery]);

  const peakDepthCm = useMemo(
    () => Math.max(waterDepthCm, ...samples.map((s) => s.waterDepthCm)),
    [samples, waterDepthCm],
  );

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8] text-sm text-[#475569]">
        Verifying operator session...
      </div>
    );
  }

  if (!operator) {
    return <LoginPage onAuthenticated={setOperator} />;
  }

  const todayFormatted = new Date().toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen flex bg-[#F4F6F8] text-[#0F172A]">
      <Sidebar
        operator={operator}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onLogout={handleLogout}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility Header */}
        <header className="bg-[#6B21A8] border-b border-[#581C87] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[220px] max-w-md">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg bg-white/15 text-white border border-white/20 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={stationQuery}
                onChange={(e) => setStationQuery(e.target.value)}
                placeholder="Search LRT-2 station or waterway..."
                className="w-full pl-9 pr-3 py-1.5 rounded-full bg-white border border-white/20 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#581C87] border border-white/15 font-medium text-white">
              <Calendar className="w-3.5 h-3.5" />
              {todayFormatted}
            </span>

            <select
              aria-label="Select active LRT-2 monitoring station"
              value={selectedStation.id}
              onChange={(e) => {
                const found = LRT2_STATIONS.find((s) => s.id === e.target.value);
                if (found) handleSelectStation(found);
              }}
              className="px-3 py-1.5 rounded-full bg-[#2E1065] text-white font-semibold border border-white/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
            >
              {filteredStations.map((st) => (
                <option key={st.id} value={st.id}>
                  LRT-2: {st.name}
                </option>
              ))}
            </select>

            <span
              title="Active Warning Level"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-bold border ${
                alertLevel === 'RED'
                  ? 'bg-[#DC2626] text-white border-[#991B1B]'
                  : alertLevel === 'ORANGE'
                    ? 'bg-[#EA580C] text-white border-[#9A3412]'
                    : 'bg-[#16A34A] text-white border-[#166534]'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              {alertLevel}
            </span>
          </div>
        </header>

        {/* Main Workspace Content */}
        <main className="p-4 sm:p-6 space-y-4 max-w-[1600px] w-full mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-[#0F172A]">
                Dashboard · {selectedStation.name} Station
              </h1>
              <p className="text-xs sm:text-sm text-[#475569]">
                {selectedStation.municipality} · {selectedStation.waterway}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDataMode('simulator')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  dataMode === 'simulator'
                    ? 'bg-[#6B21A8] text-white'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Simulator
              </button>
              <button
                type="button"
                onClick={() => setDataMode('live_esp32')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  dataMode === 'live_esp32'
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                {dataMode === 'live_esp32' && lastLiveSync
                  ? `Live ESP32 (${lastLiveSync})`
                  : 'Live ESP32'}
              </button>
            </div>
          </div>

          {/* Top 5 KPI Cards (Raw Data in cm + Green/Orange/Red Warning) */}
          <TopKpiRow
            rawDistanceCm={rawDistanceCm}
            waterDepthCm={waterDepthCm}
            alertLevel={alertLevel}
            thresholds={thresholds}
            samples={samples}
            selectedStation={selectedStation}
            alertCountToday={alertEvents.length}
            peakDepthCm={peakDepthCm}
          />

          {activeSection === 'thresholds' ? (
            <section className="bg-white rounded-[10px] border border-[#E2E8F0] p-5 max-w-xl space-y-4">
              <h2 className="font-display text-base font-bold text-[#0F172A]">
                Green / Orange / Red Threshold Calibration
              </h2>
              <p className="text-xs text-[#475569]">
                Smaller raw distance means the water surface is closer to the
                overhead ultrasonic sensor.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-xs font-medium text-[#334155]">
                  Mount Height (cm)
                  <input
                    type="number"
                    min={80}
                    max={450}
                    value={thresholds.mountHeightCm}
                    onChange={(e) =>
                      setThresholds((t) => ({
                        ...t,
                        mountHeightCm: Math.max(80, Number(e.target.value) || 180),
                      }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono-num"
                  />
                </label>

                <label className="text-xs font-medium text-[#C2410C]">
                  Orange Warning ≤ (cm)
                  <input
                    type="number"
                    min={15}
                    max={thresholds.mountHeightCm - 10}
                    value={thresholds.warningDistanceCm}
                    onChange={(e) =>
                      setThresholds((t) => ({
                        ...t,
                        warningDistanceCm: Math.max(
                          t.alertDistanceCm + 5,
                          Number(e.target.value) || 50,
                        ),
                      }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] font-mono-num"
                  />
                </label>

                <label className="text-xs font-medium text-[#B91C1C]">
                  Red Critical ≤ (cm)
                  <input
                    type="number"
                    min={5}
                    max={thresholds.warningDistanceCm - 5}
                    value={thresholds.alertDistanceCm}
                    onChange={(e) =>
                      setThresholds((t) => ({
                        ...t,
                        alertDistanceCm: Math.min(
                          t.warningDistanceCm - 5,
                          Math.max(5, Number(e.target.value) || 25),
                        ),
                      }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] font-mono-num"
                  />
                </label>
              </div>
            </section>
          ) : (
            <>
              {/* Middle Row: Manila LRT-2 Flood Map (Left) + Water Level Simulation (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {(activeSection === 'dashboard' || activeSection === 'map') && (
                  <div
                    className={
                      activeSection === 'map' ? 'lg:col-span-12' : 'lg:col-span-7'
                    }
                  >
                    <PhilippinesFloodMap
                      selectedStation={selectedStation}
                      onSelectStation={handleSelectStation}
                      stationLevels={stationLevels}
                      weatherData={weatherData}
                    />
                  </div>
                )}

                {(activeSection === 'dashboard' ||
                  activeSection === 'simulator') && (
                  <div
                    className={
                      activeSection === 'simulator'
                        ? 'lg:col-span-12'
                        : 'lg:col-span-5'
                    }
                  >
                    <WaterSimulationPanel
                      rawDistanceCm={rawDistanceCm}
                      waterDepthCm={waterDepthCm}
                      alertLevel={alertLevel}
                      thresholds={thresholds}
                      selectedStation={selectedStation}
                      preset={preset}
                      isPlaying={isPlaying}
                      onTogglePlay={() => setIsPlaying((p) => !p)}
                      onSelectPreset={handlePresetChange}
                      onManualDistanceChange={handleManualDistance}
                    />
                  </div>
                )}
              </div>

              {/* Bottom Analytics Row */}
              {(activeSection === 'dashboard' || activeSection === 'alerts') && (
                <BottomAnalytics
                  samples={samples}
                  alertEvents={alertEvents}
                  weatherData={weatherData}
                  selectedStation={selectedStation}
                  thresholds={thresholds}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
