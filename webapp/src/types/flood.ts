export type AlertLevel = 'GREEN' | 'ORANGE' | 'RED';

export type NavSection =
  | 'dashboard'
  | 'map'
  | 'simulator'
  | 'alerts'
  | 'thresholds';

export type SimulationPreset =
  | 'manual'
  | 'rise_fall_cycle'
  | 'normal_cycle'
  | 'rising_storm'
  | 'critical_flood'
  | 'receding';

export interface Lrt2Station {
  id: string;
  order: number;
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  waterway: string;
  riskProfile: 'High' | 'Moderate' | 'Low';
  mountHeightCm: number;
  baselineDistanceCm: number;
}

export interface TelemetrySample {
  timestamp: string;
  timeShort: string;
  rawDistanceCm: number;
  waterDepthCm: number;
  level: AlertLevel;
  stationId: string;
}

export interface AlertEvent {
  id: string;
  timestamp: string;
  stationName: string;
  level: AlertLevel;
  rawDistanceCm: number;
  waterDepthCm: number;
  message: string;
}

export interface ThresholdConfig {
  mountHeightCm: number;
  warningDistanceCm: number;
  alertDistanceCm: number;
}

export interface OperatorUser {
  id: string;
  username: string;
  email: string;
  role: string;
  mode: 'supabase' | 'preview';
}

export interface HourlyRainPoint {
  hourLabel: string;
  precipitationMm: number;
  temperatureC: number;
}

export interface PhWeatherData {
  fetchedAt: string;
  currentTempC: number;
  currentPrecipMm: number;
  riverDischargeM3s: number | null;
  hourly: HourlyRainPoint[];
  radarTileUrl: string | null;
  isLiveApi: boolean;
}
