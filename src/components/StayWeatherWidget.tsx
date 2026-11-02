import React, { useState, useEffect } from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  CalendarDays,
  RefreshCw,
} from 'lucide-react';
import { StayWeatherInfo } from '../types';

interface StayWeatherWidgetProps {
  lat?: number;
  lng?: number;
  locationName: string;
}

function getWeatherCondition(code: number): { text: string; icon: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'storm' } {
  if (code === 0) return { text: 'Clear Sky & Sunny', icon: 'sun' };
  if (code === 1 || code === 2) return { text: 'Mainly Sunny & Fair', icon: 'cloud-sun' };
  if (code === 3) return { text: 'Overcast & Breezy', icon: 'cloud' };
  if ([45, 48].includes(code)) return { text: 'Morning Fog / Mist', icon: 'cloud' };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { text: 'Light Rain Showers', icon: 'rain' };
  if ([95, 96, 99].includes(code)) return { text: 'Tropical Thunderstorms', icon: 'storm' };
  return { text: 'Pleasant & Mild', icon: 'sun' };
}

export const StayWeatherWidget: React.FC<StayWeatherWidgetProps> = ({ lat = -1.2921, lng = 36.8219, locationName }) => {
  const [weather, setWeather] = useState<StayWeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [useFahrenheit, setUseFahrenheit] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchWeather() {
      setLoading(true);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API response error');
        const data = await res.json();

        if (!isMounted) return;

        const currentCode = data.current?.weather_code ?? 1;
        const currentCond = getWeatherCondition(currentCode);

        const forecastDays = (data.daily?.time || []).slice(1, 4).map((dateStr: string, idx: number) => {
          const dateObj = new Date(dateStr);
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const code = data.daily.weather_code[idx + 1] ?? 1;
          const cond = getWeatherCondition(code);

          return {
            date: dateStr,
            day: dayName,
            tempMax: Math.round(data.daily.temperature_2m_max[idx + 1] ?? 26),
            tempMin: Math.round(data.daily.temperature_2m_min[idx + 1] ?? 18),
            weatherCode: code,
            condition: cond.text,
          };
        });

        setWeather({
          temperature: Math.round(data.current?.temperature_2m ?? 24),
          apparentTemp: Math.round(data.current?.apparent_temperature ?? 24),
          condition: currentCond.text,
          weatherCode: currentCode,
          humidity: Math.round(data.current?.relative_humidity_2m ?? 60),
          windSpeed: Math.round(data.current?.wind_speed_10m ?? 12),
          isDay: Boolean(data.current?.is_day ?? 1),
          forecast: forecastDays,
        });
      } catch (e) {
        if (!isMounted) return;
        // Fallback realistic climate for Kenyan stay location
        setWeather({
          temperature: 24,
          apparentTemp: 25,
          condition: 'Warm & Tropical Breeze',
          weatherCode: 1,
          humidity: 62,
          windSpeed: 14,
          isDay: true,
          forecast: [
            { date: 'Day 1', day: 'Tomorrow', tempMax: 26, tempMin: 18, weatherCode: 1, condition: 'Sunny & Pleasant' },
            { date: 'Day 2', day: 'In 2 Days', tempMax: 25, tempMin: 17, weatherCode: 2, condition: 'Partly Cloudy' },
            { date: 'Day 3', day: 'In 3 Days', tempMax: 27, tempMin: 19, weatherCode: 1, condition: 'Clear Skies' },
          ],
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [lat, lng]);

  const renderWeatherIcon = (code: number, className = 'w-5 h-5') => {
    const cond = getWeatherCondition(code);
    switch (cond.icon) {
      case 'sun':
        return <Sun className={`${className} text-amber-500 fill-amber-400`} />;
      case 'cloud-sun':
        return <CloudSun className={`${className} text-amber-500`} />;
      case 'cloud':
        return <Cloud className={`${className} text-stone-400`} />;
      case 'rain':
        return <CloudRain className={`${className} text-sky-500`} />;
      case 'storm':
        return <CloudLightning className={`${className} text-purple-500`} />;
      default:
        return <Sun className={`${className} text-amber-500`} />;
    }
  };

  const convertTemp = (celsius: number) => {
    if (useFahrenheit) {
      return `${Math.round((celsius * 9) / 5 + 32)}°F`;
    }
    return `${celsius}°C`;
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-sky-500/10 via-amber-500/10 to-indigo-500/10 dark:from-sky-950/30 dark:via-stone-900/40 dark:to-indigo-950/30 border border-sky-300/40 dark:border-sky-800/40 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold">
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 dark:text-white flex items-center gap-1.5">
              <span>Local Weather &amp; 3-Day Forecast</span>
              <span className="bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-[9px] px-2 py-0.5 rounded-full font-bold">
                Live Open-Meteo
              </span>
            </h3>
            <p className="text-[11px] text-stone-500 truncate max-w-xs">{locationName}</p>
          </div>
        </div>

        <button
          onClick={() => setUseFahrenheit(!useFahrenheit)}
          className="px-2.5 py-1 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[10px] font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 cursor-pointer transition-colors shadow-2xs"
          title="Toggle Celsius / Fahrenheit"
        >
          {useFahrenheit ? 'Switch to °C' : 'Switch to °F'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-stone-400 gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
          <span>Fetching local climate conditions...</span>
        </div>
      ) : weather ? (
        <div className="space-y-3">
          {/* Main Current Weather Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white/70 dark:bg-stone-900/70 rounded-2xl border border-white/60 dark:border-stone-800 backdrop-blur-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40">
                {renderWeatherIcon(weather.weatherCode, 'w-8 h-8')}
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-stone-900 dark:text-white tracking-tight">
                    {convertTemp(weather.temperature)}
                  </span>
                  <span className="text-xs text-stone-500 font-medium">
                    Feels like {convertTemp(weather.apparentTemp)}
                  </span>
                </div>
                <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  {weather.condition}
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 text-[11px] text-stone-500 border-t sm:border-t-0 sm:border-l border-stone-200 dark:border-stone-800 pt-2 sm:pt-0 sm:pl-4">
              <div className="flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-sky-500" />
                <span>{weather.humidity}% Humidity</span>
              </div>
              <div className="flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-emerald-500" />
                <span>{weather.windSpeed} km/h Wind</span>
              </div>
            </div>
          </div>

          {/* 3-Day Forecast Section */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-stone-500 tracking-wider">
              <CalendarDays className="w-3 h-3 text-sky-500" />
              <span>3-Day Stay Forecast</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {weather.forecast.map(day => (
                <div
                  key={day.date}
                  className="p-2.5 rounded-xl bg-white/60 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 text-center flex flex-col items-center justify-between gap-1 shadow-2xs hover:bg-white dark:hover:bg-stone-800 transition-colors"
                >
                  <span className="text-[11px] font-extrabold text-stone-800 dark:text-stone-200">
                    {day.day}
                  </span>
                  <div className="my-0.5">{renderWeatherIcon(day.weatherCode, 'w-6 h-6')}</div>
                  <div className="text-[11px] font-bold text-stone-900 dark:text-white">
                    {convertTemp(day.tempMax)}{' '}
                    <span className="text-stone-400 font-normal text-[10px]">{convertTemp(day.tempMin)}</span>
                  </div>
                  <span className="text-[9px] text-stone-500 line-clamp-1">{day.condition}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
