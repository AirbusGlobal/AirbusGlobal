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

  // Format currency
  const formatMoney = (price: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(price * rate);
    if (currency === 'KES') {
      return converted >= 1000 ? `${(converted / 1000).toFixed(0)}k` : `${converted}`;
    }
    return `${currency === 'USD' ? '$' : '€'}${converted}`;
  };

  // Tile layers
  const TILE_LAYERS = {
    streets: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &mdash; Earthstar Geographics',
    },
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center default on Kenya (-1.2921, 36.8219)
      const map = L.map(mapContainerRef.current, {
        center: [-1.2921, 36.8219],
        zoom: 12,
        zoomControl: false,
      });

      L.tileLayer(TILE_LAYERS[mapType].url, {
        attribution: TILE_LAYERS[mapType].attribution,
        maxZoom: 19,
      }).addTo(map);

      // Custom zoom control in bottom right
      L.control
        .zoom({
          position: 'bottomright',
        })
        .addTo(map);

      mapInstanceRef.current = map;
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

    L.tileLayer(TILE_LAYERS[mapType].url, {
      attribution: TILE_LAYERS[mapType].attribution,
      maxZoom: 19,
    }).addTo(map);
  }, [mapType]);

  // Update Markers when stays or currency change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    if (stays.length === 0) return;

    const bounds = L.latLngBounds([]);

    stays.forEach(stay => {
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
      bounds.extend([stay.lat, stay.lng]);
    });

    if (stays.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [stays, currency, hoveredStayId]);

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
            <div className="text-[11px] text-stone-500 line-clamp-1">
              📍 {activePopupStay.location}
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
