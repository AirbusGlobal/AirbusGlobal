import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Stay, Currency, CURRENCY_RATES } from '../types';
import L from 'leaflet';
import 'leaflet.markercluster';
import {
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  RotateCcw,
  Sparkles,
  Zap,
  Home,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface StayMapProps {
  stays: Stay[];
  hoveredStayId: string | null;
  onHoverStay: (id: string | null) => void;
  onSelectStay: (id: string) => void;
  currency: Currency;
  className?: string;
  // Part B Floating Filter Overlay Props
  instantBookOnly?: boolean;
  onToggleInstantBook?: () => void;
  entireHomeOnly?: boolean;
  onToggleEntireHome?: () => void;
  minPrice?: number;
  maxPrice?: number;
  absoluteMinPrice?: number;
  absoluteMaxPrice?: number;
  onPriceRangeChange?: (min: number, max: number) => void;
  onResetOverlayFilters?: () => void;
  activeFilterCount?: number;
}

export const StayMap: React.FC<StayMapProps> = ({
  stays,
  hoveredStayId,
  onHoverStay,
  onSelectStay,
  currency,
  className = '',
  instantBookOnly = false,
  onToggleInstantBook,
  entireHomeOnly = false,
  onToggleEntireHome,
  minPrice = 0,
  maxPrice = 0,
  absoluteMinPrice = 1000,
  absoluteMaxPrice = 35000,
  onPriceRangeChange,
  onResetOverlayFilters,
  activeFilterCount = 0,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const filterOverlayRef = useRef<HTMLDivElement>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite' | 'dark'>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePopupStay, setActivePopupStay] = useState<Stay | null>(null);
  const [overlayExpanded, setOverlayExpanded] = useState<boolean>(true);

  // Local debounced state for dual-handle price range slider
  const [localMinPrice, setLocalMinPrice] = useState<number>(minPrice || absoluteMinPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState<number>(maxPrice || absoluteMaxPrice);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync incoming props to local slider states
  useEffect(() => {
    setLocalMinPrice(minPrice || absoluteMinPrice);
  }, [minPrice, absoluteMinPrice]);

  useEffect(() => {
    setLocalMaxPrice(maxPrice || absoluteMaxPrice);
  }, [maxPrice, absoluteMaxPrice]);

  // Debounced notification of price change (150ms)
  const handleMinSliderChange = (val: number) => {
    const clamped = Math.min(val, localMaxPrice - 500);
    setLocalMinPrice(clamped);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onPriceRangeChange?.(clamped, localMaxPrice);
    }, 150);
  };

  const handleMaxSliderChange = (val: number) => {
    const clamped = Math.max(val, localMinPrice + 500);
    setLocalMaxPrice(clamped);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onPriceRangeChange?.(localMinPrice, clamped);
    }, 150);
  };

  // Format currency helper
  const formatMoney = (price: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const converted = Math.round(price * rate);
    if (currency === 'KES') {
      return converted >= 1000 ? `${(converted / 1000).toFixed(0)}k` : `${converted}`;
    }
    return `${currency === 'USD' ? '$' : '€'}${converted}`;
  };

  // Prevent Leaflet map from capturing clicks or wheel scrolling inside the Filter Overlay
  useEffect(() => {
    if (!filterOverlayRef.current) return;
    const el = filterOverlayRef.current;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  // OpenStreetMap Tile Layer Configuration
  const OSM_TILE_URL =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MAP_TILE_URL) ||
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
    return layer;
  };

  // Initialize Leaflet Map and Marker Cluster Group
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

      // Part C: Initialize L.markerClusterGroup with AirBus brand styling
      const clusterGroup = (L as any).markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 60,
        disableClusteringAtZoom: 16,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          const html = `
            <div class="airbus-cluster-marker" style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 5px;
              background: linear-gradient(135deg, #e4002b 0%, #ff2e93 100%);
              color: #ffffff;
              padding: 5px 12px;
              border-radius: 9999px;
              font-family: inherit;
              font-weight: 800;
              font-size: 11px;
              box-shadow: 0 4px 14px rgba(228, 0, 43, 0.45);
              border: 2px solid #ffffff;
              white-space: nowrap;
              cursor: pointer;
              transition: transform 0.15s ease-out;
            ">
              <span style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; background:rgba(255,255,255,0.28); font-size:10px; font-weight:900;">
                ${count}
              </span>
              <span>${count} stays</span>
            </div>
          `;
          return L.divIcon({
            html,
            className: 'airbus-custom-markercluster-icon',
            iconSize: [95, 28],
            iconAnchor: [47, 14],
          });
        },
      });

      clusterGroup.on('clusterclick', (a: any) => {
        a.layer.zoomToBounds({ padding: [40, 40] });
      });

      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (clusterGroupRef.current && mapInstanceRef.current) {
        clusterGroupRef.current.clearLayers();
        mapInstanceRef.current.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
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

  // Batch update markers into cluster group (Part C: Batch clearLayers & addLayers)
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    const map = mapInstanceRef.current;
    if (!clusterGroup || !map) return;

    clusterGroup.clearLayers();

    if (stays.length === 0) return;

    const markers: L.Marker[] = [];

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

      const marker = L.marker([stay.lat, stay.lng], { icon });

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

      markers.push(marker);
    });

    // Batch add all markers to cluster group
    clusterGroup.addLayers(markers);

    // Initial bounds fit once
    if (!mapContainerRef.current?.dataset.boundsFitted && stays.length > 0) {
      const bounds = L.latLngBounds(stays.map(s => [s.lat, s.lng]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        if (mapContainerRef.current) {
          mapContainerRef.current.dataset.boundsFitted = 'true';
        }
      }
    }
  }, [stays, currency, hoveredStayId]);

  // Recenter map
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map || stays.length === 0) return;
    const bounds = L.latLngBounds(stays.map(s => [s.lat, s.lng]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-[#e6e6e1] dark:border-[#262934] shadow-sm select-none transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50 h-[calc(100vh-32px)] shadow-2xl'
          : className || 'h-[440px] md:h-[calc(100vh-140px)] min-h-[440px]'
      }`}
    >
      {/* ============================================================ */}
      {/* PART B: Floating Filter Overlay on Leaflet Map (Top-Left)    */}
      {/* ============================================================ */}
      <div
        ref={filterOverlayRef}
        className="absolute top-3 left-3 z-[1000] w-72 max-w-[calc(100vw-36px)] bg-white/95 dark:bg-[#15171e]/95 backdrop-blur-md rounded-2xl shadow-lg border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 transition-all select-none"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 dark:border-stone-800/80">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#e4002b]" />
            <span className="text-xs font-bold">Map Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-[#e4002b] text-white text-[10px] font-black rounded-full px-1.5 py-0.2 animate-pulse">
                {activeFilterCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {activeFilterCount > 0 && onResetOverlayFilters && (
              <button
                type="button"
                onClick={onResetOverlayFilters}
                className="text-[10px] font-bold text-stone-500 hover:text-[#e4002b] flex items-center gap-0.5 cursor-pointer transition-colors"
                title="Reset filters"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setOverlayExpanded(!overlayExpanded)}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title={overlayExpanded ? 'Collapse filters' : 'Expand filters'}
            >
              {overlayExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Controls Body */}
        {overlayExpanded && (
          <div className="p-3 space-y-3 text-xs">
            {/* Quick Toggles: Instant Book & Entire Home */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleInstantBook}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl font-bold border transition-all cursor-pointer text-[11px] ${
                  instantBookOnly
                    ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 font-extrabold shadow-2xs'
                    : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${instantBookOnly ? 'text-amber-500 fill-amber-500' : 'text-stone-400'}`} />
                <span>Instant Book</span>
              </button>

              <button
                type="button"
                onClick={onToggleEntireHome}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl font-bold border transition-all cursor-pointer text-[11px] ${
                  entireHomeOnly
                    ? 'bg-[#e4002b]/10 border-[#e4002b] text-[#e4002b] font-extrabold shadow-2xs'
                    : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100'
                }`}
              >
                <Home className={`w-3.5 h-3.5 ${entireHomeOnly ? 'text-[#e4002b]' : 'text-stone-400'}`} />
                <span>Entire Home</span>
              </button>
            </div>

            {/* Dual-Handle Price Range Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-500 font-medium">Price Range:</span>
                <span className="font-extrabold text-[#e4002b]">
                  {currency} {localMinPrice.toLocaleString()} – {currency} {localMaxPrice.toLocaleString()}
                </span>
              </div>

              {/* Min slider */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <span>Min: {formatMoney(localMinPrice)}</span>
                </div>
                <input
                  type="range"
                  min={absoluteMinPrice}
                  max={absoluteMaxPrice - 1000}
                  step={500}
                  value={localMinPrice}
                  onChange={e => handleMinSliderChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-[#e4002b]"
                />
              </div>

              {/* Max slider */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <span>Max: {formatMoney(localMaxPrice)}</span>
                </div>
                <input
                  type="range"
                  min={absoluteMinPrice + 1000}
                  max={absoluteMaxPrice}
                  step={500}
                  value={localMaxPrice}
                  onChange={e => handleMaxSliderChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-[#e4002b]"
                />
              </div>
            </div>

            {/* Live Matches Counter Footer */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Live on map:</span>
              <span className="font-bold text-stone-900 dark:text-white bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                {stays.length} {stays.length === 1 ? 'stay matches' : 'stays match'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Map Control Bar (Layers, Recenter, Fullscreen) in Top Right */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-stone-200 dark:border-stone-800 text-xs">
        {/* Layer Switcher */}
        <button
          onClick={() =>
            setMapType(mapType === 'streets' ? 'satellite' : mapType === 'satellite' ? 'dark' : 'streets')
          }
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
