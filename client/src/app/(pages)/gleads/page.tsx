"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { gLeadsService } from "@/services/gLeadsService";
import type { GLeadsContact, GLeadsStats, GLeadsContactsResponse } from "@/types";
import toast from "react-hot-toast";

const PAGE_SIZE_OPTIONS = [2,5,10, 20, 50, 100, 250, 500, 750, 1000] as const;

function Pager({
  page, totalPages, totalCount, perPage, loading,
  onPage, onPerPage, border,
}: {
  page: number; totalPages: number; totalCount: number; perPage: number; loading: boolean;
  onPage: (p: number) => void; onPerPage: (n: number) => void; border?: "top" | "bottom";
}) {
  const pages: (number | string)[] = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    const start = Math.max(2, page - 1);
    const end   = Math.min(totalPages - 1, page + 1);
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-gray-50 ${border === "bottom" ? "border-t" : "border-b"}`}>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        {totalCount > 0 && (
          <span>
            Showing <strong>{(page - 1) * perPage + 1}</strong>–<strong>{Math.min(page * perPage, totalCount)}</strong> of <strong>{totalCount.toLocaleString()}</strong>
          </span>
        )}
        <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}
          className="px-2 py-1 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
          {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1 || loading}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-white transition-colors disabled:opacity-40">
            Prev
          </button>
          {pages.map((p, i) =>
            typeof p === "string" ? (
              <span key={`d${i}`} className="px-2 text-gray-400">{p}</span>
            ) : (
              <button key={p} onClick={() => onPage(p)} disabled={loading}
                className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${page === p ? "bg-blue-600 text-white border-blue-600" : "hover:bg-white disabled:opacity-40"}`}>
                {p}
              </button>
            )
          )}
          <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-white transition-colors disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  contacted:  "bg-blue-100 text-blue-700",
  replied:    "bg-indigo-100 text-indigo-700",
  demo:       "bg-pink-100 text-pink-700",
  closed:     "bg-green-100 text-green-700",
  invalid:    "bg-red-100 text-red-700",
};

const STATUSES = ["pending", "contacted", "replied", "demo", "closed", "invalid"] as const;

type PhoneEntry = { sanitized_number?: string; raw_number?: string; [key: string]: unknown };

function extractPhones(phoneNumbers: unknown): string[] {
  let data = phoneNumbers;

  // Handle JSON string (server sometimes returns stringified array)
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return data ? [data as string] : []; }
  }

  // Apollo array format: [{sanitized_number, raw_number, type}, ...]
  if (Array.isArray(data)) {
    return (data as PhoneEntry[])
      .map((p) => (p.sanitized_number || p.raw_number || "").toString().trim())
      .filter(Boolean);
  }

  // Plain object fallback
  if (data && typeof data === "object") {
    return Object.values(data as Record<string, string>).filter(Boolean);
  }

  return [];
}

function phoneList(phoneNumbers: unknown): string {
  const nums = extractPhones(phoneNumbers);
  return nums.length > 0 ? nums.join(", ") : "—";
}

export default function GLeadsPage() {
  const [stats, setStats]               = useState<GLeadsStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [contacts, setContacts]         = useState<GLeadsContact[]>([]);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalCount, setTotalCount]     = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [perPage, setPerPage]           = useState(20);

  // Filters
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterState, setFilterState]     = useState("");
  const [filterCity, setFilterCity]       = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterTitle, setFilterTitle]     = useState("");

  // Actions
  const [importing, setImporting]       = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [tab, setTab]                   = useState<"list" | "stats">("stats");

  // Status modal
  const [statusModalOpen, setStatusModalOpen]   = useState(false);
  const [newStatus, setNewStatus]               = useState("pending");
  const [updatingStatus, setUpdatingStatus]     = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await gLeadsService.getStats());
    } catch {
      toast.error("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setTableLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: perPage };
      if (search)        params.search  = search;
      if (filterStatus)  params.status  = filterStatus;
      if (filterState)   params.state   = filterState;
      if (filterCity)    params.city    = filterCity;
      if (filterCountry) params.country = filterCountry;
      if (filterTitle)   params.title   = filterTitle;

      const res: GLeadsContactsResponse = await gLeadsService.getContacts(params);
      setContacts(res.contacts);
      setTotalPages(res.totalPages);
      setTotalCount(res.totalCount);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setTableLoading(false);
    }
  }, [page, perPage, search, filterStatus, filterState, filterCity, filterCountry, filterTitle]);

  useEffect(() => { loadStats(); },    [loadStats]);
  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { setPage(1); }, [search, filterStatus, filterState, filterCity, filterCountry, filterTitle, perPage]);

  const [importProgress, setImportProgress] = useState("");

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setImporting(true);

    let totalInserted = 0;
    let totalSkipped  = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setImportProgress(`File ${i + 1}/${files.length}: ${file.name}`);

        let parsed: unknown;
        try {
          parsed = JSON.parse(await file.text());
        } catch {
          toast.error(`Invalid JSON: ${file.name}`);
          continue;
        }

        const records = Array.isArray(parsed) ? parsed : [parsed];
        const result  = await gLeadsService.importContacts(records as Record<string, unknown>[]);

        totalInserted += result.data?.inserted ?? 0;
        totalSkipped  += result.data?.skipped  ?? 0;
        toast.success(`${file.name}: ${result.data?.inserted ?? 0} inserted`);
      }

      toast.success(`All done — ${totalInserted} inserted, ${totalSkipped} skipped`);
      loadStats();
      loadContacts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      setImportProgress("");
      e.target.value = "";
    }
  };

  const handleExport = () => {
    if (contacts.length === 0) { toast.error("No contacts to export"); return; }

    const cell = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const headers = ["First Name", "Last Name", "Email", "Phone 1", "Phone 2", "Phone 3", "Title", "Headline", "LinkedIn", "City", "State", "Country", "Status"];
    const rows = [headers.join(",")];

    for (const r of contacts) {
      const phones = extractPhones(r.phoneNumbers);
      rows.push([
        cell(r.firstName), cell(r.lastName), cell(r.email),
        cell(phones[0] ?? ""), cell(phones[1] ?? ""), cell(phones[2] ?? ""),
        cell(r.title), cell(r.headline), cell(r.linkedinUrl),
        cell(r.city), cell(r.state), cell(r.country), cell(r.status),
      ].join(","));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `gleads-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${contacts.length} contacts`);
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0) return;
    setUpdatingStatus(true);
    try {
      await gLeadsService.bulkUpdateStatus(Array.from(selectedIds), newStatus);
      toast.success(`${selectedIds.size} contacts updated to "${newStatus}"`);
      setSelectedIds(new Set());
      setStatusModalOpen(false);
      loadContacts();
      loadStats();
    } catch {
      toast.error("Status update failed");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const toggleSelect    = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => selectedIds.size === contacts.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(contacts.map((c) => c._id)));

  const clearFilters = () => { setSearch(""); setFilterStatus(""); setFilterState(""); setFilterCity(""); setFilterCountry(""); setFilterTitle(""); };
  const hasFilters   = !!(search || filterStatus || filterState || filterCity || filterCountry || filterTitle);

  return (
    <ProtectedRoute>
      <section className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">gLeads</h1>
            <p className="text-sm text-gray-500 mt-1">Apollo / scraped leads from the geto_leads collection</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Import JSON */}
            <label className={`px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer max-w-[220px] truncate ${importing ? "opacity-70 pointer-events-none" : ""}`}
              title={importProgress || "Import JSON"}>
              {importing ? (importProgress || "Importing...") : "Import JSON"}
              <input
                type="file"
                accept=".json"
                multiple
                className="hidden"
                onChange={handleImport}
                disabled={importing}
              />
            </label>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {(["stats", "list"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t === "stats" ? "Dashboard" : "Contacts List"}
            </button>
          ))}
        </div>

        {/* ─── STATS TAB ─── */}
        {tab === "stats" && (
          <>
            {statsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            ) : stats ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total Leads",    value: stats.total,        color: "text-blue-600" },
                    { label: "With Phone",      value: stats.withPhone,    color: "text-purple-600" },
                    { label: "With LinkedIn",   value: stats.withLinkedin, color: "text-indigo-600" },
                    { label: "Pending",         value: stats.statusBreakdown.pending, color: "text-yellow-600" },
                  ].map((c) => (
                    <div key={c.label} className="bg-white border rounded-xl p-5 shadow-sm">
                      <span className="text-sm font-medium text-gray-500">{c.label}</span>
                      <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Status Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  {(Object.entries(stats.statusBreakdown) as [string, number][]).map(([key, val]) => (
                    <div key={key} className="bg-white border rounded-xl p-4 shadow-sm text-center">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[key] || "bg-gray-100"}`}>{key}</span>
                      <p className="text-2xl font-bold mt-2">{val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Bottom Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { title: "Top Countries", data: stats.byCountry },
                    { title: "Top States",    data: stats.byState },
                    { title: "Top Cities",    data: stats.byCity },
                    { title: "Top Titles",    data: stats.byTitle },
                  ].map(({ title, data }) => (
                    <div key={title} className="bg-white border rounded-xl p-5 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
                      <div className="space-y-2">
                        {data.map((item) => (
                          <div key={item._id} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 truncate mr-2">{item._id}</span>
                            <span className="text-sm font-semibold">{item.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-gray-400 py-16">No data available.</p>
            )}
          </>
        )}

        {/* ─── LIST TAB ─── */}
        {tab === "list" && (
          <>
            {/* Filters */}
            <div className="bg-white border rounded-xl p-4 shadow-sm mb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <input
                  type="text" placeholder="Search name, email, title..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none col-span-2 lg:col-span-2"
                />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">All Status</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <input type="text" placeholder="Country..." value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="text" placeholder="State..." value={filterState} onChange={(e) => setFilterState(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="text" placeholder="City..." value={filterCity} onChange={(e) => setFilterCity(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="text" placeholder="Title..." value={filterTitle} onChange={(e) => setFilterTitle(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 flex items-center justify-between">
                <span className="text-sm text-blue-700 font-medium">{selectedIds.size} selected</span>
                <button
                  onClick={() => { setNewStatus("pending"); setStatusModalOpen(true); }}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Change Status
                </button>
              </div>
            )}

            {/* Table */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              {/* Pagination — TOP */}
              <Pager
                page={page} totalPages={totalPages} totalCount={totalCount}
                perPage={perPage} loading={tableLoading}
                onPage={setPage} onPerPage={setPerPage}
                border="bottom"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-3 py-3 w-8">
                        <input type="checkbox" checked={contacts.length > 0 && selectedIds.size === contacts.length} onChange={toggleSelectAll} className="rounded" />
                      </th>
                      <th className="px-3 py-3 w-12">S.No</th>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">Title</th>
                      <th className="px-3 py-3">Location</th>
                      <th className="px-3 py-3">LinkedIn</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tableLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                        </td>
                      </tr>
                    ) : contacts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-gray-400">
                          No contacts found{hasFilters ? " — try clearing filters." : "."}
                        </td>
                      </tr>
                    ) : (
                      contacts.map((c, i) => (
                        <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={selectedIds.has(c._id)} onChange={() => toggleSelect(c._id)} className="rounded" />
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">{(page - 1) * perPage + i + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-gray-900">
                              {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/gleads/${encodeURIComponent(c.email)}`}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {c.email}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[130px] truncate">
                            {phoneList(c.phoneNumbers)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-gray-900 max-w-[160px] truncate text-xs" title={c.title}>{c.title || "—"}</div>
                            {c.headline && <div className="text-[11px] text-gray-400 max-w-[160px] truncate" title={c.headline}>{c.headline}</div>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-xs text-gray-600">
                              {[c.city, c.state, c.country].filter(Boolean).join(", ") || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {c.linkedinUrl ? (
                              <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline">
                                View
                              </a>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={c.status}
                              onChange={async (e) => {
                                const val = e.target.value;
                                try {
                                  await gLeadsService.bulkUpdateStatus([c._id], val);
                                  toast.success(`Status → ${val}`);
                                  loadContacts();
                                  loadStats();
                                } catch { toast.error("Update failed"); }
                              }}
                              className="px-1.5 py-0.5 text-xs border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination — BOTTOM */}
              <Pager
                page={page} totalPages={totalPages} totalCount={totalCount}
                perPage={perPage} loading={tableLoading}
                onPage={setPage} onPerPage={setPerPage}
                border="top"
              />
            </div>
          </>
        )}
      </section>

      {/* Bulk Status Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-1">Change Status</h3>
            <p className="text-sm text-gray-500 mb-5">
              Update status for <strong>{selectedIds.size}</strong> selected contact{selectedIds.size > 1 ? "s" : ""}
            </p>
            <div className="space-y-3 mb-6">
              {STATUSES.map((s) => (
                <label key={s}
                  className={`flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer transition-colors ${newStatus === s ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}>
                  <input type="radio" name="bulkStatus" value={s} checked={newStatus === s} onChange={() => setNewStatus(s)} className="text-blue-600" />
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[s]}`}>{s}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setStatusModalOpen(false)} disabled={updatingStatus}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleBulkStatusUpdate} disabled={updatingStatus}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium">
                {updatingStatus ? "Updating..." : `Update ${selectedIds.size} Contact${selectedIds.size > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
