"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import api from "@/lib/axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

interface DashboardData {
  totals: {
    institutions: number;
    states: number;
    districts: number;
    areas: number;
  };
  typeStats: { _id: string; count: number }[];
  coverage: {
    withPhone: number;
    withEmail: number;
    withContact: number;
    withWebsite: number;
    total: number;
  };
  topStates: { _id: string; name: string; count: number }[];
  topDistricts: { _id: string; name: string; count: number }[];
  recentActivity: { _id: string; count: number }[];
}

const TYPE_COLORS: Record<string, string> = {
  school: "#3b82f6",
  college: "#8b5cf6",
  polytechnic: "#f97316",
  iti: "#eab308",
};

const COVERAGE_COLORS = ["#10b981", "#e5e7eb"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/education/dashboard");
        setData(res.data.data);
      } catch {
        console.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!data) {
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-500">Failed to load dashboard data.</div>
      </ProtectedRoute>
    );
  }

  const { totals, typeStats, coverage, topStates, topDistricts, recentActivity } = data;

  // Coverage data for pie charts
  const coverageItems = [
    { label: "Phone", value: coverage.withPhone, color: "#3b82f6" },
    { label: "Email", value: coverage.withEmail, color: "#8b5cf6" },
    { label: "Contact", value: coverage.withContact, color: "#10b981" },
    { label: "Website", value: coverage.withWebsite, color: "#f97316" },
  ];

  // Fill missing days in recent activity
  const activityMap = new Map(recentActivity.map((r) => [r._id, r.count]));
  const filledActivity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    filledActivity.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: activityMap.get(key) || 0,
    });
  }

  return (
    <ProtectedRoute>
      <section className="max-w-[1400px] mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Institutions", value: totals.institutions, color: "blue", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
            { label: "States", value: totals.states, color: "green", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" },
            { label: "Districts", value: totals.districts, color: "purple", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" },
            { label: "Areas", value: totals.areas, color: "orange", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
          ].map((card) => (
            <div key={card.label} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">{card.label}</span>
                <svg className={`w-5 h-5 text-${card.color}-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
              <p className="text-3xl font-bold">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Row: Type Distribution + Data Coverage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Type Distribution - Pie */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Institution Types</h2>
            {typeStats.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={typeStats.map((t) => ({ name: t._id, value: t.count }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {typeStats.map((t) => (
                      <Cell key={t._id} fill={TYPE_COLORS[t._id] || "#94a3b8"} />
                    ))}
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
                          data={[
                            { value: item.value },
                            { value: coverage.total - item.value },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={42}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
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
          {/* Top States */}
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

          {/* Top Districts */}
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

        {/* Recent Activity */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Institutions Added (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={filledActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </ProtectedRoute>
  );
}
