import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { TrendingUp, TrendingDown, BadgeDollarSign, Calendar, Sparkles } from 'lucide-react';
import { Currency, CURRENCY_RATES, StayPriceTrend } from '../types';
import { api } from '../api';

interface PriceTrendCardProps {
  stayId: string;
  currency: Currency;
  onNegotiate: () => void;
}

export const PriceTrendCard: React.FC<PriceTrendCardProps> = ({
  stayId,
  currency,
  onNegotiate,
}) => {
  const [trend, setTrend] = useState<StayPriceTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getPriceTrend(stayId)
      .then(res => {
        if (active) {
          setTrend(res.trend);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [stayId]);

  const rate = CURRENCY_RATES[currency] || 1;
  const formatMoney = (kesAmount: number) => {
    const converted = kesAmount * rate;
    const rounded = currency === 'KES' ? Math.round(converted) : Math.round(converted * 10) / 10;
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'KSh';
    return `${symbol} ${rounded.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="p-4 rounded-3xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 animate-pulse space-y-2">
        <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-1/3" />
        <div className="h-24 bg-stone-200 dark:bg-stone-800 rounded-xl" />
      </div>
    );
  }

  if (!trend) return null;

  const chartData = trend.points.map(pt => ({
    date: pt.date,
    price: Math.round(pt.price * rate),
    isWeekend: pt.isWeekend,
  }));

  const isUp = trend.percentChange >= 0;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#06b6d4] to-[#8b5cf6] flex items-center justify-center text-white">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-stone-900 dark:text-white uppercase tracking-wider">
              30-Day Price Trend
            </h4>
            <p className="text-[11px] text-stone-500">Live dynamic market rate curve</p>
          </div>
        </div>

        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${
          isUp
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
        }`}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{isUp ? `+${trend.percentChange}%` : `${trend.percentChange}%`} vs 30d ago</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-stone-100 dark:border-stone-800 text-center">
        <div>
          <span className="text-[10px] text-stone-400 uppercase font-semibold">Min (30d)</span>
          <p className="text-xs font-extrabold text-stone-900 dark:text-white">{formatMoney(trend.minPrice)}</p>
        </div>
        <div>
          <span className="text-[10px] text-stone-400 uppercase font-semibold">30-Day Avg</span>
          <p className="text-xs font-extrabold text-[#8b5cf6]">{formatMoney(trend.avgPrice)}</p>
        </div>
        <div>
          <span className="text-[10px] text-stone-400 uppercase font-semibold">Max (Peak)</span>
          <p className="text-xs font-extrabold text-stone-900 dark:text-white">{formatMoney(trend.maxPrice)}</p>
        </div>
      </div>

      {/* Sparkline AreaChart */}
      <div className="h-28 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={['dataMin - 500', 'dataMax + 500']} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="p-2 bg-stone-900 text-white rounded-lg text-[10px] shadow-lg border border-stone-800">
                      <span className="font-bold text-stone-300">{data.date}</span>
                      <p className="font-extrabold text-purple-400">
                        {currency === 'KES' ? `KES ${data.price.toLocaleString()}` : `${currency} ${data.price}`}
                      </p>
                      {data.isWeekend && <span className="text-[9px] text-amber-300 font-medium">Weekend Surge</span>}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#8b5cf6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Direct Negotiation Link */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-stone-500">Notice high weekend surge rates?</span>
        <button
          onClick={onNegotiate}
          className="text-xs font-bold text-[#ff2e93] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <BadgeDollarSign className="w-3.5 h-3.5" />
          <span>Negotiate with Host</span>
        </button>
      </div>
    </div>
  );
};
