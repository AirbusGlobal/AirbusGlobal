import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { X, Sparkles, TrendingUp, Trophy, Eye, ThumbsUp, Share2, Users, Lightbulb, Clock } from 'lucide-react';
import { ViralityReport } from '../types';
import { api } from '../api';

interface ViralityModalProps {
  stayOrPostId: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ViralityModal: React.FC<ViralityModalProps> = ({
  stayOrPostId,
  title,
  isOpen,
  onClose,
}) => {
  const [report, setReport] = useState<ViralityReport | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [metric, setMetric] = useState<'views' | 'likes' | 'shares' | 'followers'>('views');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && stayOrPostId) {
      setLoading(true);
      api.getViralityReport(stayOrPostId)
        .then(res => {
          setReport(res.report);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, stayOrPostId]);

  if (!isOpen) return null;

  const activePoints = report
    ? range === '7d'
      ? report.points7d
      : range === '90d'
      ? report.points90d
      : report.points30d
    : [];

  const chartData = activePoints.map(pt => ({
    date: pt.date,
    views: pt.views,
    likes: pt.likes,
    shares: pt.shares,
    followers: pt.followersGained,
  }));

  const metricColors: Record<string, string> = {
    views: '#e4002b',
    likes: '#ff2e93',
    shares: '#8b5cf6',
    followers: '#06b6d4',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff2e93] via-[#8b5cf6] to-[#06b6d4] flex items-center justify-center text-white">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold font-heading">AirBus Virality & Growth Engine</h3>
                <span className="text-[10px] bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white font-extrabold px-2 py-0.5 rounded-full">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-stone-500 truncate max-w-xs sm:max-w-md">{title || 'Video Listing Performance'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 space-y-2">
            <Sparkles className="w-6 h-6 animate-spin mx-auto text-[#ff2e93]" />
            <p>Aggregating daily video reach & retention graph...</p>
          </div>
        ) : !report ? (
          <div className="py-8 text-center text-xs text-stone-500">Analytics temporarily unavailable.</div>
        ) : (
          <div className="space-y-4">
            {/* Score & Rank Hero Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Virality Score</span>
                <div className="text-3xl font-black text-[#ff2e93] tracking-tight">{report.score} / 100</div>
                <div className="w-full bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] h-full rounded-full transition-all duration-500"
                    style={{ width: `${report.score}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider flex items-center justify-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-500" />
                  <span>Platform Rank</span>
                </span>
                <div className="text-sm font-extrabold text-stone-900 dark:text-white mt-1">{report.rank}</div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Top 5% AirBus Network</p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Reach Growth</span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">+{report.summary.reachGrowthRate}%</div>
                <p className="text-[10px] text-stone-500">Month-over-month trajectory</p>
              </div>
            </div>

            {/* Timeframe & Metric Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {/* Metric toggles */}
              <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-900 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setMetric('views')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    metric === 'views' ? 'bg-white dark:bg-stone-800 shadow-sm text-[#e4002b] font-bold' : 'text-stone-500'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Views</span>
                </button>
                <button
                  onClick={() => setMetric('likes')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    metric === 'likes' ? 'bg-white dark:bg-stone-800 shadow-sm text-[#ff2e93] font-bold' : 'text-stone-500'
                  }`}
                >
                  <ThumbsUp className="w-3 h-3" />
                  <span>Likes</span>
                </button>
                <button
                  onClick={() => setMetric('shares')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    metric === 'shares' ? 'bg-white dark:bg-stone-800 shadow-sm text-[#8b5cf6] font-bold' : 'text-stone-500'
                  }`}
                >
                  <Share2 className="w-3 h-3" />
                  <span>Shares</span>
                </button>
                <button
                  onClick={() => setMetric('followers')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    metric === 'followers' ? 'bg-white dark:bg-stone-800 shadow-sm text-[#06b6d4] font-bold' : 'text-stone-500'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Followers</span>
                </button>
              </div>

              {/* Timeframe buttons */}
              <div className="flex items-center gap-1 text-xs">
                {(['7d', '30d', '90d'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setRange(t)}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      range === t
                        ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 border-transparent'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Line Chart */}
            <div className="p-3 sm:p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-2.5 bg-stone-900 text-white rounded-xl text-xs shadow-xl border border-stone-800 space-y-1">
                              <span className="font-bold text-stone-300">{data.date}</span>
                              <p className="font-extrabold text-white">
                                {metric === 'views' && `👀 ${data.views.toLocaleString()} Views`}
                                {metric === 'likes' && `❤️ ${data.likes.toLocaleString()} Likes`}
                                {metric === 'shares' && `🔗 ${data.shares.toLocaleString()} Shares`}
                                {metric === 'followers' && `👥 +${data.followers} Followers`}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric}
                      stroke={metricColors[metric] || '#e4002b'}
                      strokeWidth={3}
                      dot={range === '7d'}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Creator Actionable Nudges */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                <Lightbulb className="w-4 h-4" />
                <span>Creator Optimization Recommendations</span>
              </div>
              <ul className="space-y-1 text-stone-700 dark:text-stone-300 list-disc list-inside">
                {report.creatorNudges.map((nudge, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {nudge}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
