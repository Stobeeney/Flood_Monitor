import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { CloudRain, Layers, MapPin, Navigation } from 'lucide-react';
import { LRT2_STATIONS, MANILA_FLOOD_HOTSPOTS } from '../data/lrt2Stations';
import type { AlertLevel, Lrt2Station, PhWeatherData } from '../types/flood';

interface PhilippinesFloodMapProps {
  selectedStation: Lrt2Station;
  onSelectStation: (station: Lrt2Station) => void;
  stationLevels: Record<string, { level: AlertLevel; rawCm: number }>;
  weatherData: PhWeatherData | null;
}

const LEVEL_COLORS: Record<AlertLevel, string> = {
  GREEN: '#16A34A',
  ORANGE: '#EA580C',
  RED: '#DC2626',
};

const QUICK_JUMPS = [
  { label: 'Full LRT-2', lat: 14.6145, lng: 121.048, zoom: 12 },
  { label: 'Recto / Manila', lat: 14.6022, lng: 120.988, zoom: 15 },
  { label: 'V. Mapa / San Juan', lat: 14.604, lng: 121.0156, zoom: 15 },
  { label: 'Cubao', lat: 14.6227, lng: 121.0527, zoom: 15 },
  { label: 'Santolan / Marikina', lat: 14.6215, lng: 121.091, zoom: 14 },
];

export function PhilippinesFloodMap({
  selectedStation,
  onSelectStation,
  stationLevels,
  weatherData,
}: PhilippinesFloodMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);

  const [showRoute, setShowRoute] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showRadar, setShowRadar] = useState(true);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [14.6145, 121.048],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = L.layerGroup().addTo(map);
    stationsLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update LRT-2 route polyline
  useEffect(() => {
    const group = routeLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showRoute) return;

    const latLngs = LRT2_STATIONS.map((s) => [s.lat, s.lng] as [number, number]);
    L.polyline(latLngs, {
      color: '#6B21A8',
      weight: 5,
      opacity: 0.85,
    }).addTo(group);
  }, [showRoute]);

  // Update Manila flood hotspot circles
  useEffect(() => {
    const group = hotspotsLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showHotspots) return;

    MANILA_FLOOD_HOTSPOTS.forEach((zone) => {
      L.circle([zone.lat, zone.lng], {
        radius: zone.radiusMeters,
        color: '#EA580C',
        weight: 1.5,
        fillColor: '#FB923C',
        fillOpacity: 0.16,
      })
        .bindPopup(
          `<div style="font-size:12px"><strong>${zone.label}</strong><br/>${zone.description}</div>`,
        )
        .addTo(group);
    });
  }, [showHotspots]);

  // Update RainViewer live radar overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (radarLayerRef.current) {
      map.removeLayer(radarLayerRef.current);
      radarLayerRef.current = null;
    }

    if (showRadar && weatherData?.radarTileUrl) {
      radarLayerRef.current = L.tileLayer(weatherData.radarTileUrl, {
        opacity: 0.45,
        zIndex: 400,
        attribution: 'RainViewer PH Radar',
      }).addTo(map);
    }
  }, [showRadar, weatherData?.radarTileUrl]);

  // Update LRT-2 station markers & live status colors
  useEffect(() => {
    const group = stationsLayerRef.current;
    if (!group) return;
    group.clearLayers();

    LRT2_STATIONS.forEach((station) => {
      const reading = stationLevels[station.id] ?? {
        level: 'GREEN' as AlertLevel,
        rawCm: station.baselineDistanceCm,
      };
      const color = LEVEL_COLORS[reading.level];
      const isSelected = station.id === selectedStation.id;

      const marker = L.circleMarker([station.lat, station.lng], {
        radius: isSelected ? 10 : 7,
        color: isSelected ? '#0F172A' : '#FFFFFF',
        weight: isSelected ? 3 : 2,
        fillColor: color,
        fillOpacity: 0.95,
      });

      marker.bindTooltip(
        `<div style="font-size:12px">
          <strong>${station.name}</strong> (${reading.level})<br/>
          Raw: <b>${reading.rawCm.toFixed(1)} cm</b> · ${station.waterway}
        </div>`,
        { direction: 'top', offset: [0, -6] },
      );

      marker.on('click', () => {
        onSelectStation(station);
      });

      marker.addTo(group);
    });
  }, [selectedStation.id, stationLevels, onSelectStation]);

  function flyToArea(lat: number, lng: number, zoom: number) {
    mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.7 });
  }

  return (
    <article className="bg-white rounded-[10px] border border-[#E2E8F0] p-4 flex flex-col">
      {/* Header + Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-[#0F172A] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#0284C7]" />
            Manila LRT-2 Flood Monitoring Map
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            OpenStreetMap · Open-Meteo Hydro/Weather · RainViewer Radar (Philippines)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-[#334155]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
            Normal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
            Warning
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
            Critical
          </span>
        </div>
      </div>

      {/* Map Viewport + Floating Layer Filter Card */}
      <div className="relative mt-3 h-[340px] sm:h-[380px] rounded-lg overflow-hidden border border-[#E2E8F0]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Top-Right Floating Map Controls (matching reference layout) */}
        <div className="absolute top-3 right-3 z-[400] bg-white/95 border border-[#E2E8F0] rounded-lg p-2.5 shadow-sm w-44 text-xs">
          <p className="font-semibold text-[#0F172A] flex items-center gap-1.5 pb-1.5 border-b border-[#E2E8F0]">
            <Layers className="w-3.5 h-3.5" />
            Map Layers
          </p>
          <div className="mt-2 space-y-1.5">
            <label className="flex items-center justify-between cursor-pointer text-[#334155]">
              <span>LRT-2 Corridor</span>
              <input
                type="checkbox"
                checked={showRoute}
                onChange={(e) => setShowRoute(e.target.checked)}
                className="accent-[#111827] cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer text-[#334155]">
              <span>Flood Hotspots</span>
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(e) => setShowHotspots(e.target.checked)}
                className="accent-[#111827] cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer text-[#334155]">
              <span className="inline-flex items-center gap-1">
                <CloudRain className="w-3 h-3 text-[#0284C7]" />
                PH Rain Radar
              </span>
              <input
                type="checkbox"
                checked={showRadar}
                onChange={(e) => setShowRadar(e.target.checked)}
                className="accent-[#111827] cursor-pointer"
              />
            </label>
          </div>
          {weatherData?.riverDischargeM3s !== null && weatherData && (
            <div className="mt-2 pt-1.5 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#475569]">
              <span>Basin Flow</span>
              <span className="font-mono-num font-semibold text-[#0F172A]">
                {weatherData.riverDischargeM3s} m³/s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Corridor Quick-Jump Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#475569] inline-flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5" />
          Corridor Focus:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_JUMPS.map((jump) => (
            <button
              key={jump.label}
              type="button"
              onClick={() => flyToArea(jump.lat, jump.lng, jump.zoom)}
              className="px-2.5 py-1 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-medium text-[#0F172A] transition-colors cursor-pointer"
            >
              {jump.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
