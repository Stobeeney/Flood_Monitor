import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  Menu,
  Radio,
  Search,
} from 'lucide-react';
import { BottomAnalytics } from './components/BottomAnalytics';
import { PhilippinesFloodMap } from './components/PhilippinesFloodMap';
import { Sidebar } from './components/Sidebar';
import { TopKpiRow } from './components/TopKpiRow';
import { WaterSimulationPanel } from './components/WaterSimulationPanel';
import { LRT2_STATIONS } from './data/lrt2Stations';
import { fetchManilaFloodWeather } from './lib/phFloodApi';
import {
  fetchLatestAnyStation,
  fetchRecentReadings,
  getActiveOperator,
  isSupabaseConfigured,
  saveOperatorSnapshot,
  signOutOperator,
  subscribeToStationReadings,
  supabase,
  type LiveReadingRow,
} from './lib/supabase';
import { LoginPage } from './pages/LoginPage';
import type {
  AlertLevel,
  Lrt2Station,
  NavSection,
  OperatorUser,
  PhWeatherData,
  TelemetrySample,
  ThresholdConfig,
} from './types/flood';

function classifyLevel(rawDistanceCm: number, cfg: ThresholdConfig): AlertLevel {
  const waterDepthCm = Math.max(0, cfg.mountHeightCm - rawDistanceCm);
  if (waterDepthCm >= cfg.alertDistanceCm) return 'RED';
  if (waterDepthCm >= cfg.warningDistanceCm) return 'ORANGE';
  return 'GREEN';
}

export function App() {
  const [operator, setOperator] = useState<OperatorUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Default to Marikina-Pasig (auto-switches if ESP32 streams under another LRT-2 station)
  const [selectedStation, setSelectedStation] = useState<Lrt2Station>(
    LRT2_STATIONS[11],
  );
  const [stationQuery, setStationQuery] = useState('');

  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    mountHeightCm: 45,
    warningDistanceCm: 15,
    alertDistanceCm: 30,
  });

  const [rawDistanceCm, setRawDistanceCm] = useState<number>(
    LRT2_STATIONS[11].baselineDistanceCm,
  );
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [savedLogs, setSavedLogs] = useState<LiveReadingRow[]>([]);
  const [weatherData, setWeatherData] = useState<PhWeatherData | null>(null);
  const [lastLiveSync, setLastLiveSync] = useState<string | null>(null);

  // Check Supabase auth session on mount
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

  // Auto-detect whichever LRT-2 station the ESP32 is actively streaming to on first load
  useEffect(() => {
    if (!operator || !isSupabaseConfigured) return;
    let cancelled = false;
    fetchLatestAnyStation().then((latest) => {
      if (cancelled || !latest) return;
      const matched = LRT2_STATIONS.find((s) => s.id === latest.station_id);
      if (matched) {
        setSelectedStation(matched);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [operator]);

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

  // Real-time ESP32 telemetry stream from Supabase (Realtime + 2s polling)
  useEffect(() => {
    if (!operator || !isSupabaseConfigured) return;

    let cancelled = false;

    const applyIncomingRow = (
      rawCm: number,
      recordedAt: string,
      stationId: string,
    ) => {
      const depthCm = Number(
        Math.max(0, thresholds.mountHeightCm - rawCm).toFixed(1),
      );
      const lvl = classifyLevel(rawCm, thresholds);
      const ts = new Date(recordedAt).toLocaleTimeString('en-PH', {
        hour12: false,
      });

      setRawDistanceCm(rawCm);
      setLastLiveSync(ts);

      setSamples((prev) => [
        ...prev.slice(-59),
        {
          timestamp: ts,
          timeShort: ts,
          rawDistanceCm: rawCm,
          waterDepthCm: depthCm,
          level: lvl,
          stationId,
        },
      ]);
    };

    const loadLatest = async () => {
      const rows = await fetchRecentReadings(selectedStation.id, 150);
      if (cancelled || rows.length === 0) return;
      const latest = rows[rows.length - 1];
      const latestRaw = Number(latest.raw_distance_cm);
      setRawDistanceCm(latestRaw);
      setLastLiveSync(
        new Date(latest.recorded_at).toLocaleTimeString('en-PH', {
          hour12: false,
        }),
      );
      setSavedLogs([...rows].reverse());
      setSamples(
        rows.slice(-60).map((r) => {
          const ts = new Date(r.recorded_at).toLocaleTimeString('en-PH', {
            hour12: false,
          });
          const rawVal = Number(r.raw_distance_cm);
          const depthVal = Number(
            Math.max(0, thresholds.mountHeightCm - rawVal).toFixed(1),
          );
          return {
            timestamp: ts,
            timeShort: ts,
            rawDistanceCm: rawVal,
            waterDepthCm: depthVal,
            level: classifyLevel(rawVal, thresholds),
            stationId: r.station_id,
          };
        }),
      );
    };

    loadLatest();
    const unsubscribe = subscribeToStationReadings(selectedStation.id, (row) => {
      if (cancelled) return;
      setSavedLogs((prev) => [row, ...prev.filter((r) => r.id !== row.id)].slice(0, 150));
      applyIncomingRow(
        Number(row.raw_distance_cm),
        row.recorded_at,
        row.station_id,
      );
    });
    const poll = setInterval(loadLatest, 1200);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(poll);
    };
  }, [operator, selectedStation, thresholds]);

  const waterDepthCm = Number(
    Math.max(0, thresholds.mountHeightCm - rawDistanceCm).toFixed(1),
  );
  const alertLevel = classifyLevel(rawDistanceCm, thresholds);

  const handleSelectStation = useCallback((station: Lrt2Station) => {
    setSelectedStation(station);
    setSamples([]);
    setSavedLogs([]);
    setLastLiveSync(null);
  }, []);

  async function handleSaveSnapshot() {
    await saveOperatorSnapshot(
      selectedStation.id,
      rawDistanceCm,
      waterDepthCm,
      alertLevel,
    );
    const rows = await fetchRecentReadings(selectedStation.id, 150);
    if (rows.length > 0) {
      setSavedLogs([...rows].reverse());
    }
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
        map[st.id] = {
          level: classifyLevel(st.baselineDistanceCm, thresholds),
          rawCm: st.baselineDistanceCm,
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
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                lastLiveSync
                  ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
                  : 'bg-white border-[#E2E8F0] text-[#475569]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {lastLiveSync
                ? `Live ESP32 · Last reading ${lastLiveSync}`
                : 'Waiting for live ESP32 readings...'}
            </span>
          </div>

          {/* Top 5 KPI Cards (Raw Data in cm + Green/Orange/Red Warning) */}
          <TopKpiRow
            rawDistanceCm={rawDistanceCm}
            waterDepthCm={waterDepthCm}
            alertLevel={alertLevel}
            thresholds={thresholds}
            samples={samples}
            selectedStation={selectedStation}
            alertCountToday={
              savedLogs.filter((r) => r.alert_level !== 'GREEN').length
            }
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
                  Orange Warning ≥ (cm)
                  <input
                    type="number"
                    min={5}
                    max={thresholds.alertDistanceCm - 5}
                    value={thresholds.warningDistanceCm}
                    onChange={(e) =>
                      setThresholds((t) => ({
                        ...t,
                        warningDistanceCm: Math.min(
                          t.alertDistanceCm - 5,
                          Math.max(5, Number(e.target.value) || 15),
                        ),
                      }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] font-mono-num"
                  />
                </label>

                <label className="text-xs font-medium text-[#B91C1C]">
                  Red Critical ≥ (cm)
                  <input
                    type="number"
                    min={thresholds.warningDistanceCm + 5}
                    max={thresholds.mountHeightCm}
                    value={thresholds.alertDistanceCm}
                    onChange={(e) =>
                      setThresholds((t) => ({
                        ...t,
                        alertDistanceCm: Math.max(
                          t.warningDistanceCm + 5,
                          Number(e.target.value) || 30,
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
              {/* Middle Row: Manila LRT-2 Flood Map (Left) + Real-Time Water Staff Gauge (Right) */}
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
                      lastUpdated={lastLiveSync}
                      isLiveConnected={Boolean(lastLiveSync)}
                    />
                  </div>
                )}
              </div>

              {/* Bottom Analytics Row */}
              {(activeSection === 'dashboard' || activeSection === 'alerts') && (
                <BottomAnalytics
                  samples={samples}
                  savedLogs={savedLogs}
                  weatherData={weatherData}
                  selectedStation={selectedStation}
                  thresholds={thresholds}
                  onSaveSnapshot={handleSaveSnapshot}
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
