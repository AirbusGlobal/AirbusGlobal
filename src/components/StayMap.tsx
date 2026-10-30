import React, { useEffect, useRef, useState } from 'react';
import { Stay, Currency, CURRENCY_RATES } from '../types';
import L from 'leaflet';
import {
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface StayMapProps {
  stays: Stay[];
  hoveredStayId: string | null;
  onHoverStay: (id: string | null) => void;
  onSelectStay: (id: string) => void;
  currency: Currency;
  className?: string;
}

export const StayMap: React.FC<StayMapProps> = ({
  stays,
  hoveredStayId,
  onHoverStay,
  onSelectStay,
  currency,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const [mapType, setMapType] = useState<'streets' | 'satellite' | 'dark'>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePopupStay, setActivePopupStay] = useState<Stay | null>(null);

  const [enableClustering, setEnableClustering] = useState<boolean>(true);
  const activeMarkersRef = useRef<L.Marker[]>([]);

  // Format currency
  const formatMoney = (price: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(price * rate);
    if (currency === 'KES') {
      return converted >= 1000 ? `${(converted / 1000).toFixed(0)}k` : `${converted}`;
    }
    return `${currency === 'USD' ? '$' : '€'}${converted}`;
  };

  // OpenStreetMap Tile Layer Configuration (replaces deprecated CARTO endpoints)
  const OSM_TILE_URL =
    (typeof process !== 'undefined' && process.env?.VITE_MAP_TILE_URL) ||
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const OSM_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const TILE_LAYERS = {
    streets: {
      url: OSM_TILE_URL,
      attribution: OSM_ATTRIBUTION,
      className: '',
    },
    dark: {
      url: OSM_TILE_URL,
      attribution: OSM_ATTRIBUTION,
      className: 'dark-tiles-filter',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &mdash; Earthstar Geographics',
      className: '',
    },
  };

  const createTileLayer = (type: 'streets' | 'satellite' | 'dark') => {
    const config = TILE_LAYERS[type];
    const layer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: 19,
      className: config.className,
    });

    layer.on('tileerror', error => {
      console.warn('Map tile load notice:', error);
    });

    return layer;
  };

  // Re-cluster and render markers on map
  const renderMarkers = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    activeMarkersRef.current.forEach(m => m.remove());
    activeMarkersRef.current = [];
    markersRef.current = {};

    if (stays.length === 0) return;

    const currentZoom = map.getZoom();

    // Group listings into clusters if clustering is active and zoom < 16
    type ClusterItem =
      | { isCluster: false; stay: Stay }
      | { isCluster: true; stays: Stay[]; lat: number; lng: number; bounds: L.LatLngBounds };

    const items: ClusterItem[] = [];

    if (!enableClustering || currentZoom >= 16) {
      stays.forEach(stay => items.push({ isCluster: false, stay }));
    } else {
      const assigned = new Set<string>();
      // Threshold in pixels (closer than 65px on screen are clustered)
      const thresholdPixels = 65;

      for (let i = 0; i < stays.length; i++) {
        const s1 = stays[i];
        if (assigned.has(s1.id)) continue;

        const p1 = map.latLngToLayerPoint([s1.lat, s1.lng]);
        const group: Stay[] = [s1];
        assigned.add(s1.id);

        for (let j = i + 1; j < stays.length; j++) {
          const s2 = stays[j];
          if (assigned.has(s2.id)) continue;

          const p2 = map.latLngToLayerPoint([s2.lat, s2.lng]);
          const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

          if (dist <= thresholdPixels) {
            group.push(s2);
            assigned.add(s2.id);
          }
        }

        if (group.length > 1) {
          const avgLat = group.reduce((acc, s) => acc + s.lat, 0) / group.length;
          const avgLng = group.reduce((acc, s) => acc + s.lng, 0) / group.length;
          const bounds = L.latLngBounds(group.map(s => [s.lat, s.lng]));
          items.push({
            isCluster: true,
            stays: group,
            lat: avgLat,
            lng: avgLng,
            bounds,
          });
        } else {
          items.push({ isCluster: false, stay: s1 });
        }
      }
    }

    // Render items on map
    items.forEach(item => {
      if (item.isCluster) {
        // Multi-stay cluster pin
        const minPrice = Math.min(...item.stays.map(s => s.price));
        const priceText = formatMoney(minPrice);
        const containsHovered = hoveredStayId && item.stays.some(s => s.id === hoveredStayId);

        const html = `
          <div class="airbus-cluster-pin ${containsHovered ? 'active' : ''}" style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: linear-gradient(135deg, #e4002b 0%, #ff2e93 100%);
            color: #ffffff;
            padding: 5px 12px;
            border-radius: 9999px;
            font-family: inherit;
            font-weight: 800;
            font-size: 11px;
            box-shadow: 0 4px 14px rgba(228, 0, 43, 0.45);
            border: 2px solid ${containsHovered ? '#ffd700' : '#ffffff'};
            white-space: nowrap;
            cursor: pointer;
            transform: ${containsHovered ? 'scale(1.12)' : 'scale(1)'};
            transition: all 0.2s ease-out;
          ">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:17px; height:17px; border-radius:50%; background:rgba(255,255,255,0.28); font-size:10px; font-weight:900;">
              ${item.stays.length}
            </span>
            <span>${item.stays.length} stays · from ${priceText}</span>
          </div>
        `;

        const icon = L.divIcon({
          className: 'airbus-custom-cluster-icon',
          html,
          iconSize: [120, 28],
          iconAnchor: [60, 14],
        });

        const marker = L.marker([item.lat, item.lng], { icon }).addTo(map);

        marker.on('click', () => {
          // Smoothly zoom in to expand the cluster
          if (item.bounds.isValid() && (item.bounds.getNorth() !== item.bounds.getSouth() || item.bounds.getEast() !== item.bounds.getWest())) {
            map.fitBounds(item.bounds.pad(0.3), { padding: [50, 50], maxZoom: 16 });
          } else {
            map.setView([item.lat, item.lng], Math.min(map.getZoom() + 2, 16));
            setActivePopupStay(item.stays[0]);
          }
        });

        activeMarkersRef.current.push(marker);
      } else {
        // Individual single stay pin
        const stay = item.stay;
        const isHovered = hoveredStayId === stay.id;
        const priceText = formatMoney(stay.price);

        const html = `
          <div class="airbus-map-pin ${isHovered ? 'active' : ''}" style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: ${isHovered ? '#e4002b' : '#ffffff'};
            color: ${isHovered ? '#ffffff' : '#0f172a'};
            padding: 4px 10px;
            border-radius: 9999px;
            font-family: inherit;
            font-weight: 800;
            font-size: 11px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.22);
            border: 1.5px solid ${isHovered ? '#c90026' : '#cbd5e1'};
            white-space: nowrap;
            cursor: pointer;
            transform: ${isHovered ? 'scale(1.15)' : 'scale(1)'};
            transition: all 0.15s ease-out;
          ">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${
              isHovered ? '#ffffff' : '#e4002b'
            };"></span>
            <span>${priceText}</span>
          </div>
        `;

        const icon = L.divIcon({
          className: 'airbus-custom-div-icon',
          html,
          iconSize: [60, 26],
          iconAnchor: [30, 13],
        });

        const marker = L.marker([stay.lat, stay.lng], { icon }).addTo(map);

        marker.on('click', () => {
          setActivePopupStay(stay);
          onSelectStay(stay.id);
        });

        marker.on('mouseover', () => {
          onHoverStay(stay.id);
        });

        marker.on('mouseout', () => {
          onHoverStay(null);
        });

        markersRef.current[stay.id] = marker;
        activeMarkersRef.current.push(marker);
      }
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-1.2921, 36.8219],
        zoom: 12,
        zoomControl: false,
      });

      const initialLayer = createTileLayer(mapType);
      initialLayer.addTo(map);

      L.control
        .zoom({
          position: 'bottomright',
        })
        .addTo(map);

      mapInstanceRef.current = map;

      // Event listener for zoom and pan to recalculate clusters dynamically
      map.on('zoomend moveend', () => {
        renderMarkers();
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when mapType changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const newLayer = createTileLayer(mapType);
    newLayer.addTo(map);
  }, [mapType]);

  // Update markers when stays, currency, hoveredStayId, or enableClustering changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    renderMarkers();

    if (stays.length > 0) {
      const bounds = L.latLngBounds(stays.map(s => [s.lat, s.lng]));
      if (bounds.isValid() && !mapContainerRef.current?.dataset.boundsFitted) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        if (mapContainerRef.current) {
          mapContainerRef.current.dataset.boundsFitted = 'true';
        }
      }
    }
  }, [stays, currency, hoveredStayId, enableClustering]);

  // Center on Kenya function
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map || stays.length === 0) return;
    const bounds = L.latLngBounds(stays.map(s => [s.lat, s.lng]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-[#e6e6e1] dark:border-[#262934] shadow-sm select-none transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50 h-[calc(100vh-32px)] shadow-2xl'
          : className || 'h-[420px] md:h-[calc(100vh-140px)] min-h-[420px]'
      }`}
    >
      {/* Map Control Bar: Layers, Recenter, Fullscreen */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-stone-200 dark:border-stone-800 text-xs">
        {/* Layer Switcher */}
        <button
          onClick={() => setMapType(mapType === 'streets' ? 'satellite' : mapType === 'satellite' ? 'dark' : 'streets')}
          className="px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
          title="Switch map layer (Streets / Satellite / Dark)"
        >
          <Layers className="w-3.5 h-3.5 text-[#e4002b]" />
          <span className="capitalize">{mapType}</span>
        </button>

        <div className="w-px h-4 bg-stone-200 dark:bg-stone-700" />

        {/* Recenter */}
        <button
          onClick={handleRecenter}
          className="p-1.5 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title="Recenter all stays"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>

        {/* Marker Clustering Toggle */}
        <button
          onClick={() => setEnableClustering(!enableClustering)}
          className={`px-2 py-1 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
            enableClustering
              ? 'bg-[#e4002b]/10 text-[#e4002b] dark:bg-[#e4002b]/20 font-extrabold'
              : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400'
          }`}
          title={enableClustering ? 'Marker Clustering: Enabled (tap to show all individual pins)' : 'Marker Clustering: Disabled (tap to cluster nearby pins)'}
        >
          <Sparkles className="w-3 h-3" />
          <span>{enableClustering ? 'Clusters' : 'Pins'}</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={() => {
            setIsFullscreen(!isFullscreen);
            setTimeout(() => {
              mapInstanceRef.current?.invalidateSize();
            }, 300);
          }}
          className="p-1.5 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit fullscreen' : 'Expand map'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Floating Counter Badge */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 dark:bg-stone-900/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-stone-200 dark:border-stone-800 flex items-center gap-1.5 text-xs font-extrabold text-stone-800 dark:text-stone-200">
        <MapPin className="w-3.5 h-3.5 text-[#e4002b]" />
        <span>{stays.length} Live Stays Mapped</span>
      </div>

      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Selected Stay Quick Preview Drawer (when pin is tapped) */}
      {activePopupStay && (
        <div className="absolute bottom-4 left-4 right-4 max-w-sm z-[1000] bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl p-3 shadow-2xl border border-stone-200 dark:border-stone-800 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-stone-900 relative flex items-center justify-center cursor-pointer"
            onClick={() => onSelectStay(activePopupStay.id)}
          >
            {activePopupStay.thumbnailUrl ? (
              <img
                src={activePopupStay.thumbnailUrl}
                alt={activePopupStay.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] text-white font-bold">AIRBUS</span>
            )}
            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
              ▶ Tour
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h4
              onClick={() => onSelectStay(activePopupStay.id)}
              className="text-xs font-bold text-stone-900 dark:text-white line-clamp-1 hover:text-[#e4002b] cursor-pointer"
            >
              {activePopupStay.title}
            </h4>
            <div className="text-[11px] text-stone-500 line-clamp-1 flex items-center gap-1.5 flex-wrap">
              <span>📍 {activePopupStay.location}</span>
              {activePopupStay.isPromoted && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white rounded">
                  🚀 Promoted
                </span>
              )}
              {activePopupStay.welcomeGifts && activePopupStay.welcomeGifts.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-300 rounded flex items-center gap-0.5">
                  🎁 {activePopupStay.welcomeGifts[0]}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-black text-stone-900 dark:text-white">
                {currency} {activePopupStay.price.toLocaleString()}
                <span className="text-[10px] font-normal text-stone-400">/night</span>
              </span>
              <button
                onClick={() => onSelectStay(activePopupStay.id)}
                className="px-2.5 py-1 bg-[#e4002b] text-white rounded-full text-[10px] font-bold hover:bg-[#c90026] transition-colors cursor-pointer"
              >
                View stay →
              </button>
            </div>
          </div>

          <button
            onClick={() => setActivePopupStay(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-stone-900 text-white rounded-full flex items-center justify-center text-xs shadow-md hover:bg-black cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
