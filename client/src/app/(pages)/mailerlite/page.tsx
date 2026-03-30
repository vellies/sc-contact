"use client";

import { useEffect, useState, useCallback } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { mailerLiteService } from "@/services/mailerLiteService";
import type {
  MailerLiteContact,
  MailerLiteStats,
  MailerLiteContactsResponse,
} from "@/types";
import toast from "react-hot-toast";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 250, 500, 750, 1000] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  added: "bg-green-100 text-green-700",
};

const TYPE_COLORS: Record<string, string> = {
  school: "bg-blue-100 text-blue-700",
  college: "bg-purple-100 text-purple-700",
  polytechnic: "bg-orange-100 text-orange-700",
  iti: "bg-yellow-100 text-yellow-700",
};

export default function MailerLitePage() {
  // Stats
  const [stats, setStats] = useState<MailerLiteStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Contacts table
  const [contacts, setContacts] = useState<MailerLiteContact[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [perPage, setPerPage] = useState(20);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterEmailValid, setFilterEmailValid] = useState("");
  const [filterGeneric, setFilterGeneric] = useState("");

  // Actions
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"list" | "stats">("stats");

  // Status change modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("pending");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Load stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await mailerLiteService.getStats());
    } catch {
      toast.error("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load contacts
  const loadContacts = useCallback(async () => {
    setTableLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: perPage };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.institutionType = filterType;
      if (filterState) params.state = filterState;
      if (filterDistrict) params.district = filterDistrict;
      if (filterEmailValid) params.emailValid = filterEmailValid;
      if (filterGeneric) params.isGenericEmail = filterGeneric;


      const res: MailerLiteContactsResponse = await mailerLiteService.getContacts(params);
      setContacts(res.contacts);
      setTotalPages(res.totalPages);
      setTotalCount(res.totalCount);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setTableLoading(false);
    }
  }, [page, perPage, search, filterStatus, filterType, filterState, filterDistrict, filterEmailValid, filterGeneric]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadContacts(); }, [loadContacts]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterStatus, filterType, filterState, filterDistrict, filterEmailValid, filterGeneric, perPage]);

  // Generate
  const handleGenerate = async () => {
    if (!confirm("This will process all institutions and generate/update MailerLite contacts. Continue?")) return;
    setGenerating(true);
    try {
      const result = await mailerLiteService.generate();
      toast.success(
        `Done! ${result.totalContacts} contacts (${result.uniqueEmails} unique, ${result.duplicates} duplicates)`
      );
      loadStats();
      loadContacts();
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // Export CSV — exports only the contacts currently visible on the page
  const handleExport = () => {
    if (contacts.length === 0) {
      toast.error("No contacts to export");
      return;
    }

    const headers = [
      "Email", "Phone", "Contact Name", "Designation", "Institution",
      "Type", "Website", "Address", "Area", "Pincode", "District", "State",
    ];
    const csvRows = [headers.join(",")];
    for (const r of contacts) {
      csvRows.push(
        [
          r.email, r.phone, `"${r.contactName}"`, `"${r.designation}"`,
          `"${r.institutionName}"`, r.institutionType, r.website,
          `"${r.address}"`, `"${r.areaName}"`, r.pincode, r.districtName, r.stateName,
        ].join(",")
      );
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mailerlite-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${contacts.length} contacts`);
  };

  // Bulk update status
  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0) return;
    setUpdatingStatus(true);
    try {
      await mailerLiteService.bulkUpdateStatus(Array.from(selectedIds), newStatus);
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

  // Toggle select
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c._id)));
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterType("");
    setFilterState("");
    setFilterDistrict("");
    setFilterEmailValid("");
    setFilterGeneric("");
  };

  const hasFilters = !!(search || filterStatus || filterType || filterState || filterDistrict || filterEmailValid || filterGeneric);

  return (
    <ProtectedRoute>
      <section className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">MailerLite Contacts</h1>
            <p className="text-sm text-gray-500 mt-1">Cleaned & validated contacts for email marketing</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating..." : "Generate / Refresh All"}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("stats")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "stats" ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setTab("list")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "list" ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Contacts List
          </button>
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
                    { label: "Total Contacts", value: stats.total, color: "text-blue-600" },
                    { label: "Valid Emails", value: stats.validEmails, color: "text-green-600" },
                    { label: "Sendable", value: stats.sendable, color: "text-emerald-600" },
                    { label: "With Phone", value: stats.withPhone, color: "text-purple-600" },
                  ].map((c) => (
                    <div key={c.label} className="bg-white border rounded-xl p-5 shadow-sm">
                      <span className="text-sm font-medium text-gray-500">{c.label}</span>
                      <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Warning Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Invalid Emails", value: stats.invalidEmails, color: "text-red-600" },
                    { label: "Generic Emails", value: stats.genericEmails, color: "text-orange-600" },
                    { label: "Pending", value: stats.statusBreakdown.pending, color: "text-yellow-600" },
                    { label: "Added", value: stats.statusBreakdown.added, color: "text-green-600" },
                  ].map((c) => (
                    <div key={c.label} className="bg-white border rounded-xl p-5 shadow-sm">
                      <span className="text-sm font-medium text-gray-500">{c.label}</span>
                      <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Status Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-white border rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Sync Status</h3>
                    <div className="space-y-2">
                      {Object.entries(stats.statusBreakdown).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[key] || "bg-gray-100"}`}>
                            {key}
                          </span>
                          <span className="text-sm font-semibold">{val.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">By Institution Type</h3>
                    <div className="space-y-2">
                      {stats.byType.map((t) => (
                        <div key={t._id} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_COLORS[t._id] || "bg-gray-100"}`}>
                            {t._id}
                          </span>
                          <span className="text-sm font-semibold">{t.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Top States</h3>
                    <div className="space-y-2">
                      {stats.byState.map((s) => (
                        <div key={s._id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 truncate mr-2">{s._id}</span>
                          <span className="text-sm font-semibold">{s.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top Districts */}
                <div className="bg-white border rounded-xl p-5 shadow-sm mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Districts</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {stats.byDistrict.map((d) => (
                      <div key={d._id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700 truncate mr-2">{d._id}</span>
                        <span className="text-sm font-bold text-blue-600">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quality Summary */}
                <div className="bg-white border rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Email Quality Summary</h3>
                  <div className="h-4 rounded-full bg-gray-100 overflow-hidden flex">
                    {stats.total > 0 && (
                      <>
                        <div
                          className="bg-green-500 h-full"
                          style={{ width: `${((stats.sendable) / stats.total) * 100}%` }}
                          title={`Sendable: ${stats.sendable}`}
                        />
                        <div
                          className="bg-orange-400 h-full"
                          style={{ width: `${(stats.genericEmails / stats.total) * 100}%` }}
                          title={`Generic: ${stats.genericEmails}`}
                        />
                        <div
                          className="bg-red-400 h-full"
                          style={{ width: `${(stats.invalidEmails / stats.total) * 100}%` }}
                          title={`Invalid: ${stats.invalidEmails}`}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Sendable</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Generic</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Invalid</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-400 py-16">No data. Click "Generate / Refresh All" to start.</p>
            )}
          </>
        )}

        {/* ─── LIST TAB ─── */}
        {tab === "list" && (
          <>
            {/* Filters */}
            <div className="bg-white border rounded-xl p-4 shadow-sm mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="Search email, name, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none col-span-2 lg:col-span-1"
                />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="added">Added</option>
                </select>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">All Types</option>
                  <option value="school">School</option>
                  <option value="college">College</option>
                  <option value="polytechnic">Polytechnic</option>
                  <option value="iti">ITI</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by state..."
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="Filter by district..."
                  value={filterDistrict}
                  onChange={(e) => setFilterDistrict(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <select value={filterEmailValid} onChange={(e) => setFilterEmailValid(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Email: All</option>
                  <option value="true">Valid Only</option>
                  <option value="false">Invalid Only</option>
                </select>
                <select value={filterGeneric} onChange={(e) => setFilterGeneric(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Generic: All</option>
                  <option value="true">Generic Only</option>
                  <option value="false">Non-Generic</option>
                </select>
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Actions Bar */}
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={contacts.length > 0 && selectedIds.size === contacts.length}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="px-3 py-3 w-12">S.No</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">Contact</th>
                      <th className="px-3 py-3">Institution</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Location</th>
                      <th className="px-3 py-3">Flags</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tableLoading ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                        </td>
                      </tr>
                    ) : contacts.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-gray-400">
                          No contacts found. {!hasFilters && 'Click "Generate / Refresh All" to start.'}
                        </td>
                      </tr>
                    ) : (
                      contacts.map((c, i) => (
                        <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(c._id)}
                              onChange={() => toggleSelect(c._id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">{(page - 1) * perPage + i + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-gray-900">{c.email}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={c.phoneValid ? "text-gray-900" : "text-gray-400"}>
                              {c.phone || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-gray-900">{c.contactName || "—"}</div>
                            {c.designation && (
                              <div className="text-xs text-gray-400">{c.designation}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-gray-900 max-w-[180px] truncate" title={c.institutionName}>
                              {c.institutionName}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_COLORS[c.institutionType] || ""}`}>
                              {c.institutionType}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-xs text-gray-600">
                              {[c.areaName, c.districtName, c.stateName].filter(Boolean).join(", ")}
                            </div>
                            {c.pincode && <div className="text-xs text-gray-400">{c.pincode}</div>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1 flex-wrap">
                              {!c.emailValid && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-600 rounded">INVALID</span>
                              )}
                              {c.isGenericEmail && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-600 rounded">GENERIC</span>
                              )}
                              {c.emailValid && !c.isGenericEmail && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-600 rounded">OK</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[c.status] || ""}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={c.status}
                              onChange={async (e) => {
                                const val = e.target.value;
                                try {
                                  await mailerLiteService.bulkUpdateStatus([c._id], val);
                                  toast.success(`Status → ${val}`);
                                  loadContacts();
                                  loadStats();
                                } catch { toast.error("Update failed"); }
                              }}
                              className="px-1.5 py-0.5 text-xs border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                              <option value="pending">pending</option>
                              <option value="added">added</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  {totalCount > 0 && (
                    <span>
                      Showing <strong>{(page - 1) * perPage + 1}</strong>-<strong>{Math.min(page * perPage, totalCount)}</strong> of <strong>{totalCount.toLocaleString()}</strong>
                    </span>
                  )}
                  <select
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                    className="px-2 py-1 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} / page</option>
                    ))}
                  </select>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || tableLoading}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    {(() => {
                      const pages: (number | string)[] = [];
                      const maxVisible = 5;
                      if (totalPages <= maxVisible + 2) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        const start = Math.max(2, page - 1);
                        const end = Math.min(totalPages - 1, page + 1);
                        if (start > 2) pages.push("...");
                        for (let i = start; i <= end; i++) pages.push(i);
                        if (end < totalPages - 1) pages.push("...");
                        pages.push(totalPages);
                      }
                      return pages.map((p, i) =>
                        typeof p === "string" ? (
                          <span key={`dots-${i}`} className="px-2 text-gray-400">...</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            disabled={tableLoading}
                            className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                              page === p
                                ? "bg-blue-600 text-white border-blue-600"
                                : "hover:bg-white disabled:opacity-40"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      );
                    })()}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || tableLoading}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Bulk Status Change Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-1">Change Status</h3>
            <p className="text-sm text-gray-500 mb-5">
              Update status for <strong>{selectedIds.size}</strong> selected contact{selectedIds.size > 1 ? "s" : ""}
            </p>

            <div className="space-y-3 mb-6">
              {(["pending", "added"] as const).map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer transition-colors ${
                    newStatus === s ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="bulkStatus"
                    value={s}
                    checked={newStatus === s}
                    onChange={() => setNewStatus(s)}
                    className="text-blue-600"
                  />
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[s]}`}>{s}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setStatusModalOpen(false)}
                disabled={updatingStatus}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkStatusUpdate}
                disabled={updatingStatus}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
              >
                {updatingStatus ? "Updating..." : `Update ${selectedIds.size} Contact${selectedIds.size > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
