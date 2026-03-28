"use client";

import { useEffect, useState, useCallback } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { locationService } from "@/services/locationService";
import api from "@/lib/axios";
import type { StateType, DistrictType, AreaType } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

interface DashboardData {
  totals: { institutions: number; states: number; districts: number; areas: number };
  typeStats: { _id: string; count: number }[];
  coverage: { withPhone: number; withEmail: number; withContact: number; withWebsite: number; total: number };
  topStates: { _id: string; name: string; count: number }[];
  topDistricts: { _id: string; name: string; count: number }[];
  topAreas: { _id: string; name: string; pincode: string; count: number }[];
  recentActivity: { _id: string; count: number }[];
}

const TYPE_COLORS: Record<string, string> = {
  school: "#3b82f6", college: "#8b5cf6", polytechnic: "#f97316", iti: "#eab308",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [states, setStates] = useState<StateType[]>([]);
  const [districts, setDistricts] = useState<DistrictType[]>([]);
  const [areas, setAreas] = useState<AreaType[]>([]);
  const [filterState, setFilterState] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterArea, setFilterArea] = useState("");

  // Load dashboard data
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterState) params.state = filterState;
      if (filterDistrict) params.district = filterDistrict;
      if (filterArea) params.area = filterArea;
      const res = await api.get("/education/dashboard", { params });
      setData(res.data.data);
    } catch {
      console.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [filterState, filterDistrict, filterArea]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Load states
  const loadStates = useCallback(async () => {
    if (states.length > 0) return;
    try { setStates(await locationService.getStates()); } catch { /* */ }
  }, [states.length]);

  // Load districts when state changes
  useEffect(() => {
    setFilterDistrict("");
    setFilterArea("");
    setDistricts([]);
    setAreas([]);
    if (!filterState) return;
    const load = async () => {
      try { setDistricts(await locationService.getDistricts(filterState)); } catch { /* */ }
    };
    load();
  }, [filterState]);

  // Load areas when district changes
  useEffect(() => {
    setFilterArea("");
    setAreas([]);
    if (!filterDistrict) return;
    const load = async () => {
      try { setAreas(await locationService.getAreas(filterDistrict)); } catch { /* */ }
    };
    load();
  }, [filterDistrict]);

  const hasFilter = !!(filterState || filterDistrict || filterArea);
  const filterLabel = filterArea
    ? areas.find((a) => a._id === filterArea)?.area || "Area"
    : filterDistrict
    ? districts.find((d) => d._id === filterDistrict)?.name || "District"
    : filterState
    ? states.find((s) => s._id === filterState)?.name || "State"
    : "All India";

  if (!data && loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  const d = data!;
  const { totals, typeStats, coverage, topStates, topDistricts, topAreas, recentActivity } = d;

  const coverageItems = [
    { label: "Phone", value: coverage.withPhone, color: "#3b82f6" },
    { label: "Email", value: coverage.withEmail, color: "#8b5cf6" },
    { label: "Contact", value: coverage.withContact, color: "#10b981" },
    { label: "Website", value: coverage.withWebsite, color: "#f97316" },
  ];

  const activityMap = new Map(recentActivity.map((r) => [r._id, r.count]));
  const filledActivity = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().split("T")[0];
    filledActivity.push({
      date: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: activityMap.get(key) || 0,
    });
  }

  return (
    <ProtectedRoute>
      <section className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Header + Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            {hasFilter && (
              <p className="text-sm text-gray-500 mt-1">
                Showing data for <span className="font-semibold text-blue-600">{filterLabel}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterState}
              onFocus={loadStates}
              onChange={(e) => setFilterState(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">All States</option>
              {states.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))}
            </select>
            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              disabled={!filterState}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (<option key={d._id} value={d._id}>{d.name}</option>))}
            </select>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              disabled={!filterDistrict}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
            >
              <option value="">All Areas</option>
              {areas.map((a) => (<option key={a._id} value={a._id}>{a.pincode} - {a.area}</option>))}
            </select>
            {hasFilter && (
              <button
                onClick={() => { setFilterState(""); setFilterDistrict(""); setFilterArea(""); }}
                className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Updating...
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Institutions", value: totals.institutions, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "States", value: totals.states, color: "text-green-600", bg: "bg-green-50" },
            { label: "Districts", value: totals.districts, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Areas", value: totals.areas, color: "text-orange-600", bg: "bg-orange-50" },
          ].map((card) => (
            <div key={card.label} className="bg-white border rounded-xl p-5 shadow-sm">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Row: Type Distribution + Data Coverage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Type Distribution */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Institution Types</h2>
            {typeStats.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={typeStats.map((t) => ({ name: t._id, value: t.count }))}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {typeStats.map((t) => (<Cell key={t._id} fill={TYPE_COLORS[t._id] || "#94a3b8"} />))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Data Coverage */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Data Coverage</h2>
            <div className="grid grid-cols-2 gap-4">
              {coverageItems.map((item) => {
                const pct = coverage.total > 0 ? Math.round((item.value / coverage.total) * 100) : 0;
                return (
                  <div key={item.label} className="text-center">
                    <ResponsiveContainer width="100%" height={100}>
                      <PieChart>
                        <Pie
                          data={[{ value: item.value }, { value: coverage.total - item.value }]}
                          cx="50%" cy="50%" innerRadius={30} outerRadius={42}
                          startAngle={90} endAngle={-270} dataKey="value"
                        >
                          <Cell fill={item.color} />
                          <Cell fill="#e5e7eb" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="text-lg font-bold" style={{ color: item.color }}>{pct}%</p>
                    <p className="text-xs text-gray-500">{item.label} ({item.value}/{coverage.total})</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row: Top States + Top Districts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Top States</h2>
            {topStates.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topStates} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Districts</h2>
            {topDistricts.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topDistricts} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Areas */}
        <div className="bg-white border rounded-xl p-5 shadow-sm mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Areas</h2>
          {topAreas.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topAreas.map((a) => ({ name: `${a.name} (${a.pincode})`, count: a.count }))} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Institutions Added (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={filledActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </ProtectedRoute>
  );
}
