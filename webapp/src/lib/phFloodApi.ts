import type { HourlyRainPoint, PhWeatherData } from '../types/flood';

interface OpenMeteoForecastResponse {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
  };
  hourly?: {
    time?: string[];
    precipitation?: number[];
    temperature_2m?: number[];
  };
}

interface OpenMeteoFloodResponse {
  daily?: {
    river_discharge?: (number | null)[];
  };
}

interface RainViewerResponse {
  host?: string;
  radar?: {
    past?: Array<{ path: string; time: number }>;
  };
}

function buildFallbackWeather(): PhWeatherData {
  const now = new Date();
  const hourly: HourlyRainPoint[] = Array.from({ length: 8 }, (_, idx) => {
    const dt = new Date(now.getTime() + idx * 3600_000);
    const hr = dt.getHours().toString().padStart(2, '0') + ':00';
    return {
      hourLabel: hr,
      precipitationMm: Number((0.4 + ((idx * 7) % 5) * 0.6).toFixed(1)),
      temperatureC: Number((28.5 + (idx % 3) * 0.7).toFixed(1)),
    };
  });

  return {
    fetchedAt: now.toLocaleTimeString('en-PH', { hour12: false }),
    currentTempC: 29.4,
    currentPrecipMm: 1.8,
    riverDischargeM3s: 42.5,
    hourly,
    radarTileUrl: null,
    isLiveApi: false,
  };
}

export async function fetchManilaFloodWeather(
  lat: number,
  lng: number,
): Promise<PhWeatherData> {
  const fallback = buildFallbackWeather();

  try {
    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}` +
      `&longitude=${lng.toFixed(4)}&current=temperature_2m,precipitation` +
      `&hourly=temperature_2m,precipitation&forecast_days=1&timezone=Asia%2FManila`;

    const floodUrl =
      `https://flood-api.open-meteo.com/v1/flood?latitude=${lat.toFixed(4)}` +
      `&longitude=${lng.toFixed(4)}&daily=river_discharge&forecast_days=1`;

    const radarUrl = 'https://api.rainviewer.com/public/weather-maps.json';

    const [forecastRes, floodRes, radarRes] = await Promise.allSettled([
      fetch(forecastUrl, { signal: AbortSignal.timeout(5000) }),
      fetch(floodUrl, { signal: AbortSignal.timeout(5000) }),
      fetch(radarUrl, { signal: AbortSignal.timeout(5000) }),
    ]);

    let currentTempC = fallback.currentTempC;
    let currentPrecipMm = fallback.currentPrecipMm;
    let hourly = fallback.hourly;
    let isLiveApi = false;

    if (forecastRes.status === 'fulfilled' && forecastRes.value.ok) {
      const json = (await forecastRes.value.json()) as OpenMeteoForecastResponse;
      if (json.current) {
        currentTempC = json.current.temperature_2m ?? currentTempC;
        currentPrecipMm = json.current.precipitation ?? currentPrecipMm;
        isLiveApi = true;
      }
      if (json.hourly?.time && json.hourly.precipitation && json.hourly.temperature_2m) {
        const currentHour = new Date().getHours();
        const sliced: HourlyRainPoint[] = [];
        for (let i = currentHour; i < Math.min(currentHour + 8, json.hourly.time.length); i++) {
          const iso = json.hourly.time[i];
          sliced.push({
            hourLabel: iso.slice(11, 16),
            precipitationMm: Number((json.hourly.precipitation[i] ?? 0).toFixed(1)),
            temperatureC: Number((json.hourly.temperature_2m[i] ?? 29).toFixed(1)),
          });
        }
        if (sliced.length > 0) {
          hourly = sliced;
        }
      }
    }

    let riverDischargeM3s: number | null = fallback.riverDischargeM3s;
    if (floodRes.status === 'fulfilled' && floodRes.value.ok) {
      const floodJson = (await floodRes.value.json()) as OpenMeteoFloodResponse;
      const val = floodJson.daily?.river_discharge?.[0];
      if (typeof val === 'number') {
        riverDischargeM3s = Number(val.toFixed(2));
        isLiveApi = true;
      }
    }

    let radarTileUrl: string | null = null;
    if (radarRes.status === 'fulfilled' && radarRes.value.ok) {
      const radarJson = (await radarRes.value.json()) as RainViewerResponse;
      const frames = radarJson.radar?.past;
      if (radarJson.host && frames && frames.length > 0) {
        const latest = frames[frames.length - 1];
        radarTileUrl = `${radarJson.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;
        isLiveApi = true;
      }
    }

    return {
      fetchedAt: new Date().toLocaleTimeString('en-PH', { hour12: false }),
      currentTempC,
      currentPrecipMm,
      riverDischargeM3s,
      hourly,
      radarTileUrl,
      isLiveApi,
    };
  } catch {
    return fallback;
  }
}
