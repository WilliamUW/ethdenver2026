"use client";

import { useMemo } from "react";

export type CreditDashboardProfile = {
  country: string;
  ageMonths: number;
  cards: number;
  totalAccounts: number;
  utilization: string;
  delinquencies: number;
  timestamp?: number;
  score?: string;
  name?: string;
};

const DEFAULT_COUNTRY_FLAGS: Record<string, string> = {
  Canada: "🇨🇦",
  USA: "🇺🇸",
  Mexico: "🇲🇽",
  UK: "🇬🇧",
  Germany: "🇩🇪",
  Japan: "🇯🇵",
  Singapore: "🇸🇬",
};

function computeDashboardStats(profiles: CreditDashboardProfile[]) {
  if (profiles.length === 0) {
    return {
      totalHistoryMonths: 0,
      totalAccounts: 0,
      totalCards: 0,
      avgUtilizationPct: null as number | null,
      totalDelinquencies: 0,
      profileCount: 0,
      countries: [] as string[],
    };
  }
  const totalHistoryMonths = profiles.reduce((s, p) => s + p.ageMonths, 0);
  const totalAccounts = profiles.reduce((s, p) => s + p.totalAccounts, 0);
  const totalCards = profiles.reduce((s, p) => s + p.cards, 0);
  const totalDelinquencies = profiles.reduce((s, p) => s + p.delinquencies, 0);
  const utilValues = profiles
    .map(p => parseFloat(String(p.utilization).replace(/[^0-9.]/g, "")))
    .filter(n => !Number.isNaN(n));
  const avgUtilizationPct =
    utilValues.length > 0 ? utilValues.reduce((a, b) => a + b, 0) / utilValues.length : null;
  const countries = [...new Set(profiles.map(p => p.country))];
  return {
    totalHistoryMonths,
    totalAccounts,
    totalCards,
    avgUtilizationPct,
    totalDelinquencies,
    profileCount: profiles.length,
    countries,
  };
}

type CreditDashboardProps = {
  profiles: CreditDashboardProfile[];
  title?: string;
  countryFlags?: Record<string, string>;
  className?: string;
};

export function CreditDashboard({ profiles, title = "Dashboard", countryFlags, className = "" }: CreditDashboardProps) {
  const flags = countryFlags ?? DEFAULT_COUNTRY_FLAGS;
  const stats = useMemo(() => computeDashboardStats(profiles), [profiles]);

  return (
    <section
      className={`card bg-white/10 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 overflow-hidden ${className}`}
    >
      <div className="card-body p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Credit history</p>
            <p className="text-xl font-bold text-white mt-1">
              {stats.totalHistoryMonths < 12
                ? `${stats.totalHistoryMonths} mo`
                : `${(stats.totalHistoryMonths / 12).toFixed(1)} yr`}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Accounts</p>
            <p className="text-xl font-bold text-white mt-1">{stats.totalAccounts}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Cards</p>
            <p className="text-xl font-bold text-white mt-1">{stats.totalCards}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Avg utilization</p>
            <p className="text-xl font-bold text-white mt-1">
              {stats.avgUtilizationPct != null ? `${stats.avgUtilizationPct.toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Delinquencies</p>
            <p className="text-xl font-bold text-white mt-1">{stats.totalDelinquencies}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Profiles</p>
            <p className="text-xl font-bold text-white mt-1">{stats.profileCount}</p>
            {stats.countries.length > 0 && (
              <p className="text-sm text-indigo-200 mt-2 flex flex-wrap gap-1">
                {stats.countries.map(c => (
                  <span key={c} title={c}>
                    {flags[c] ?? "🌍"}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
        {stats.profileCount > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider mb-2">Credit profiles by country</p>
            <div className="flex flex-wrap gap-2">
              {profiles.map((p, i) => (
                <span
                  key={`${p.country}-${p.timestamp ?? i}-${i}`}
                  className="inline-flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                  title={p.score ? `${p.country} · ${p.score}` : p.country}
                >
                  <span>{flags[p.country] ?? "🌍"}</span>
                  <span>{p.country}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
