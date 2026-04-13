"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { locationService } from "@/services/locationService";
import {
  coachingService,
  type SavedCoachingInstitute,
  type PaginatedCoachingResult,
} from "@/services/coachingService";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { StateType, DistrictType } from "@/types";

// ========== ZOD SCHEMA ==========
const instituteFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(200),
  address: z.string().trim().max(500, "Address too long"),
  phones: z.array(z.object({
    value: z.string().trim().min(6, "Phone too short").max(20)
      .regex(/^(\+?\d{1,4}[\s-]?)?(\(?\d{2,5}\)?[\s-]?)?\d{4,10}$/, "Invalid phone format"),
  })),
  emails: z.array(z.object({ value: z.string().trim().email("Invalid email format") })),
  contacts: z.array(z.object({
    value: z.string().trim().min(1, "Contact cannot be empty").max(100),
  })),
  website: z.string().trim().max(300)
    .refine((val) => !val || val === "" || val.startsWith("http://") || val.startsWith("https://"),
      { message: "Must start with http:// or https://" }),
  types: z.array(z.enum(["coaching", "tutoring", "test_prep", "skill_training"])).min(1, "Select at least one type"),
});

type InstituteFormData = z.infer<typeof instituteFormSchema>;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 250, 500, 750, 1000] as const;
const TYPE_OPTIONS = ["coaching", "tutoring", "test_prep", "skill_training"] as const;

type FilterState = "off" | "has" | "empty";

export default function CoachingListPage() {
  // Data
  const [data, setData] = useState<SavedCoachingInstitute[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [perPage, setPerPage] = useState(20);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [hasPhone, setHasPhone] = useState<FilterState>("off");
  const [hasEmail, setHasEmail] = useState<FilterState>("off");
  const [hasContact, setHasContact] = useState<FilterState>("off");
  const [hasWebsite, setHasWebsite] = useState<FilterState>("off");

  // Filter dropdown data
  const [states, setStates] = useState<StateType[]>([]);
  const [districts, setDistricts] = useState<DistrictType[]>([]);

  // Edit modal
  const [editTarget, setEditTarget] = useState<SavedCoachingInstitute | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<SavedCoachingInstitute | null>(null);
  const [deleting, setDeleting] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ========== REACT-HOOK-FORM ==========
  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } =
    useForm<InstituteFormData>({
      resolver: zodResolver(instituteFormSchema),
      defaultValues: { name: "", address: "", phones: [], emails: [], contacts: [], website: "", types: ["coaching"] },
    });

  const { fields: phoneFields, append: appendPhone, remove: removePhone } = useFieldArray({ control, name: "phones" });
  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({ control, name: "emails" });
  const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({ control, name: "contacts" });
  const watchedTypes = watch("types");

  // ========== FETCH ==========
  const fetchData = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const res: PaginatedCoachingResult = await coachingService.getAll({
        page: pageNum,
        limit: perPage,
        search: search || undefined,
        type: filterType || undefined,
        state: filterState || undefined,
        district: filterDistrict || undefined,
        sort: sortField,
        order: sortOrder,
        hasPhone: hasPhone === "has" ? true : hasPhone === "empty" ? false : undefined,
        hasEmail: hasEmail === "has" ? true : hasEmail === "empty" ? false : undefined,
        hasContact: hasContact === "has" ? true : hasContact === "empty" ? false : undefined,
        hasWebsite: hasWebsite === "has" ? true : hasWebsite === "empty" ? false : undefined,
      });
      setData(res.data);
      setTotalCount(res.totalCount);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch {
      toast.error("Failed to load coaching institutes");
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterState, filterDistrict, sortField, sortOrder, hasPhone, hasEmail, hasContact, hasWebsite, perPage]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  // ========== STATES ==========
  const loadStates = useCallback(async () => {
    if (states.length > 0) return;
    try {
      const data = await locationService.getStates();
      setStates(data);
    } catch { /* ignore */ }
  }, [states.length]);

  useEffect(() => {
    setFilterDistrict("");
    setDistricts([]);
    if (!filterState) return;
    const load = async () => {
      try {
        const data = await locationService.getDistricts(filterState);
        setDistricts(data);
      } catch { /* ignore */ }
    };
    load();
  }, [filterState]);

  // ========== SEARCH DEBOUNCE ==========
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearch(val), 400);
  };

  // ========== SORT ==========
  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortOrder("asc"); }
  };
  const sortIcon = (field: string) => sortField !== field ? "" : sortOrder === "asc" ? " ↑" : " ↓";

  // ========== EDIT ==========
  const openEdit = (inst: SavedCoachingInstitute) => {
    setEditTarget(inst);
    reset({
      name: inst.name,
      address: inst.address || "",
      phones: (inst.phones || []).map((p) => ({ value: p })),
      emails: (inst.emails || []).map((e) => ({ value: e })),
      contacts: (inst.contacts || []).map((c) => ({ value: c })),
      website: inst.website || "",
      types: (inst.types as InstituteFormData["types"]) || ["coaching"],
    });
  };

  const onEditSubmit = async (formData: InstituteFormData) => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await coachingService.updateInstitute(editTarget._id, {
        name: formData.name,
        address: formData.address || "",
        phones: formData.phones.map((p) => p.value),
        emails: formData.emails.map((e) => e.value),
        contacts: formData.contacts.map((c) => c.value),
        website: formData.website || "",
        types: formData.types,
      });
      toast.success("Institute updated");
      setEditTarget(null);
      fetchData(page);
    } catch (err: any) {
      const msg = err.response?.data?.errors
        ? err.response.data.errors.map((e: any) => e.message).join(", ")
        : err.response?.data?.message || "Update failed";
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  // ========== DELETE ==========
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await coachingService.deleteInstitute(deleteTarget._id);
      toast.success("Deleted");
      setDeleteTarget(null);
      fetchData(page);
    } catch { toast.error("Delete failed"); }
    finally { setDeleting(false); }
  };

  // ========== CSV ==========
  const exportCSV = () => {
    if (data.length === 0) return;
    const csv = [
      "Name,Address,Phones,Emails,Contacts,Website,Type,Area,Pincode",
      ...data.map(
        (r) =>
          `"${r.name}","${r.address}","${(r.phones || []).join("; ")}","${(r.emails || []).join("; ")}","${(r.contacts || []).join("; ")}","${r.website}","${r.types.join(", ")}","${r.area?.area || ""}","${r.area?.pincode || ""}"`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coaching-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  // ========== TYPE TOGGLE ==========
  const toggleType = (type: InstituteFormData["types"][number]) => {
    const current = watchedTypes || [];
    if (current.includes(type)) {
      const filtered = current.filter((t) => t !== type);
      if (filtered.length > 0) setValue("types", filtered, { shouldValidate: true });
    } else {
      setValue("types", [...current, type], { shouldValidate: true });
    }
  };

  // ========== HELPERS ==========
  const typeBadge = (type: string) => {
    switch (type) {
      case "test_prep":      return "bg-orange-100 text-orange-700";
      case "skill_training": return "bg-green-100 text-green-700";
      case "tutoring":       return "bg-purple-100 text-purple-700";
      default:               return "bg-blue-100 text-blue-700";
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "test_prep":      return "Test Prep";
      case "skill_training": return "Skill Training";
      case "tutoring":       return "Tutoring";
      default:               return "Coaching";
    }
  };

  const renderMulti = (items: string[], type: "phone" | "email" | "text") => {
    if (!items || items.length === 0) return <span className="text-gray-300">-</span>;
    return (
      <div className="flex flex-col gap-0.5">
        {items.map((item, i) => (
          <span key={i}>
            {type === "phone" ? (
              <a href={`tel:${item}`} className="text-blue-600 hover:underline text-xs">{item}</a>
            ) : type === "email" ? (
              <a href={`mailto:${item}`} className="text-blue-600 hover:underline text-xs">{item}</a>
            ) : (
              <span className="text-xs text-gray-600">{item}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  // ========== PAGINATION ==========
  const renderPagination = () => {
    if (totalCount === 0) return null;
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            Showing <strong>{(page - 1) * perPage + 1}</strong>–<strong>{Math.min(page * perPage, totalCount)}</strong> of <strong>{totalCount}</strong>
          </span>
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className="px-2 py-1 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchData(page - 1)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {pages.map((p, i) =>
              typeof p === "string" ? (
                <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => fetchData(p)}
                  disabled={loading}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    p === page ? "bg-blue-600 text-white" : "border hover:bg-white"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => fetchData(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <section className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">All Coaching Institutes</h1>
            <p className="text-gray-500 text-sm mt-1">
              Browse, search, filter and manage all saved coaching institutes
            </p>
          </div>
          {data.length > 0 && (
            <button
              onClick={exportCSV}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Export CSV
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white border rounded-xl p-4 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="md:col-span-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search name, address, phone, email..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Type filter */}
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">All Types</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{typeLabel(t)}</option>
                ))}
              </select>
            </div>

            {/* State filter */}
            <div>
              <select
                value={filterState}
                onFocus={loadStates}
                onChange={(e) => setFilterState(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">All States</option>
                {states.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* District filter */}
            <div>
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                disabled={!filterState}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
              >
                <option value="">All Districts</option>
                {districts.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Data filter toggles: off → has → empty → off */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Filter by:</span>
            {([
              { key: "phone",   label: "Phone",   value: hasPhone,   set: setHasPhone },
              { key: "email",   label: "Email",   value: hasEmail,   set: setHasEmail },
              { key: "contact", label: "Contact", value: hasContact, set: setHasContact },
              { key: "website", label: "Website", value: hasWebsite, set: setHasWebsite },
            ] as { key: string; label: string; value: FilterState; set: (v: FilterState) => void }[]).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => f.set(f.value === "off" ? "has" : f.value === "has" ? "empty" : "off")}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors ${
                  f.value === "has"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : f.value === "empty"
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {f.value === "has" ? "✓ " : f.value === "empty" ? "✗ " : ""}{f.label}
                {f.value !== "off" && (
                  <span className="ml-1 text-[10px] opacity-70">
                    {f.value === "has" ? "(has)" : "(empty)"}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {(search || filterType || filterState || hasPhone !== "off" || hasEmail !== "off" || hasContact !== "off" || hasWebsite !== "off") && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
              <span className="text-xs text-gray-500">Active:</span>
              {search && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full flex items-center gap-1">
                  &quot;{search}&quot;
                  <button onClick={() => { setSearchInput(""); setSearch(""); }} className="hover:text-blue-900">&times;</button>
                </span>
              )}
              {filterType && (
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full flex items-center gap-1">
                  {typeLabel(filterType)}
                  <button onClick={() => setFilterType("")} className="hover:text-purple-900">&times;</button>
                </span>
              )}
              {filterState && (
                <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full flex items-center gap-1">
                  {states.find((s) => s._id === filterState)?.name || "State"}
                  <button onClick={() => setFilterState("")} className="hover:text-green-900">&times;</button>
                </span>
              )}
              {filterDistrict && (
                <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-full flex items-center gap-1">
                  {districts.find((d) => d._id === filterDistrict)?.name || "District"}
                  <button onClick={() => setFilterDistrict("")} className="hover:text-orange-900">&times;</button>
                </span>
              )}
              {(["phone", "email", "contact", "website"] as const).map((key) => {
                const stateMap = { phone: hasPhone, email: hasEmail, contact: hasContact, website: hasWebsite };
                const setMap = { phone: setHasPhone, email: setHasEmail, contact: setHasContact, website: setHasWebsite };
                const val = stateMap[key];
                if (val === "off") return null;
                return (
                  <span key={key} className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${val === "has" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}: {val === "has" ? "has data" : "empty"}
                    <button onClick={() => setMap[key]("off")} className="hover:opacity-70">&times;</button>
                  </span>
                );
              })}
              <button
                onClick={() => {
                  setSearchInput(""); setSearch(""); setFilterType(""); setFilterState("");
                  setFilterDistrict(""); setHasPhone("off"); setHasEmail("off");
                  setHasContact("off"); setHasWebsite("off");
                }}
                className="text-xs text-red-500 hover:text-red-700 ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mb-4">
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${totalCount} coaching institute${totalCount !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white border rounded-xl p-12 shadow-sm text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500">Loading coaching institutes...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && data.length === 0 && (
          <div className="bg-white border rounded-xl p-12 shadow-sm text-center text-gray-400">
            No coaching institutes found. Use the{" "}
            <a href="/coaching" className="text-blue-600 hover:underline">Coaching Finder</a>{" "}
            to search and save institutes.
          </div>
        )}

        {/* Table */}
        {!loading && data.length > 0 && (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            {renderPagination()}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600 w-8">#</th>
                    <th
                      className="text-left p-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600 select-none"
                      onClick={() => handleSort("name")}
                    >
                      Name{sortIcon("name")}
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">Address</th>
                    <th className="text-left p-3 font-medium text-gray-600">Area</th>
                    <th className="text-left p-3 font-medium text-gray-600">Phone(s)</th>
                    <th className="text-left p-3 font-medium text-gray-600">Email(s)</th>
                    <th className="text-left p-3 font-medium text-gray-600">Contact(s)</th>
                    <th className="text-left p-3 font-medium text-gray-600">Website</th>
                    <th className="text-left p-3 font-medium text-gray-600">Type</th>
                    <th
                      className="text-left p-3 font-medium text-gray-600 cursor-pointer hover:text-blue-600 select-none"
                      onClick={() => handleSort("createdAt")}
                    >
                      Added{sortIcon("createdAt")}
                    </th>
                    <th className="text-right p-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((inst, i) => (
                    <tr key={inst._id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-gray-400 text-xs">{(page - 1) * perPage + i + 1}</td>
                      <td className="p-3 font-medium max-w-[180px] text-sm">{inst.name}</td>
                      <td className="p-3 text-gray-500 max-w-[180px] text-xs">{inst.address}</td>
                      <td className="p-3 text-xs text-gray-500">
                        {inst.area ? (
                          <div>
                            <div className="font-medium text-gray-700">{inst.area.area}</div>
                            <div>{inst.area.pincode} – {inst.area.city}</div>
                          </div>
                        ) : "-"}
                      </td>
                      <td className="p-3">{renderMulti(inst.phones || [], "phone")}</td>
                      <td className="p-3">{renderMulti(inst.emails || [], "email")}</td>
                      <td className="p-3">{renderMulti(inst.contacts || [], "text")}</td>
                      <td className="p-3">
                        {inst.website ? (
                          <a
                            href={inst.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs truncate block max-w-[120px]"
                          >
                            {inst.website.replace(/^https?:\/\/(www\.)?/, "")}
                          </a>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {inst.types.map((t) => (
                            <span
                              key={t}
                              className={`px-2 py-0.5 text-xs rounded-full font-medium ${typeBadge(t)}`}
                            >
                              {typeLabel(t)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(inst.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => openEdit(inst)}
                            className="px-2 py-1 text-xs border rounded hover:bg-white transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(inst)}
                            className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        )}

        {/* ===== EDIT MODAL ===== */}
        <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Coaching Institute">
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input {...register("name")} className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.name ? "border-red-400" : ""}`} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input {...register("address")} className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.address ? "border-red-400" : ""}`} />
              {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>}
            </div>

            {/* Phones */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Phone Numbers</label>
                <button type="button" onClick={() => appendPhone({ value: "" })} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Phone</button>
              </div>
              {phoneFields.length === 0 && <p className="text-xs text-gray-400 italic">No phone numbers added</p>}
              <div className="space-y-2">
                {phoneFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input {...register(`phones.${index}.value`)} placeholder="+91 98765 43210"
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono ${errors.phones?.[index]?.value ? "border-red-400" : ""}`} />
                    <button type="button" onClick={() => removePhone(index)} className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm">&times;</button>
                  </div>
                ))}
              </div>
              {phoneFields.map((_, index) => errors.phones?.[index]?.value ? (
                <p key={index} className="text-xs text-red-500 mt-0.5">Phone {index + 1}: {errors.phones[index]?.value?.message}</p>
              ) : null)}
            </div>

            {/* Emails */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Email Addresses</label>
                <button type="button" onClick={() => appendEmail({ value: "" })} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Email</button>
              </div>
              {emailFields.length === 0 && <p className="text-xs text-gray-400 italic">No email addresses added</p>}
              <div className="space-y-2">
                {emailFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input {...register(`emails.${index}.value`)} placeholder="info@coaching.com"
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.emails?.[index]?.value ? "border-red-400" : ""}`} />
                    <button type="button" onClick={() => removeEmail(index)} className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm">&times;</button>
                  </div>
                ))}
              </div>
              {emailFields.map((_, index) => errors.emails?.[index]?.value ? (
                <p key={index} className="text-xs text-red-500 mt-0.5">Email {index + 1}: {errors.emails[index]?.value?.message}</p>
              ) : null)}
            </div>

            {/* Contacts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Contact Persons</label>
                <button type="button" onClick={() => appendContact({ value: "" })} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Contact</button>
              </div>
              {contactFields.length === 0 && <p className="text-xs text-gray-400 italic">No contact persons added</p>}
              <div className="space-y-2">
                {contactFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input {...register(`contacts.${index}.value`)} placeholder="Director - Mr. Kumar"
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.contacts?.[index]?.value ? "border-red-400" : ""}`} />
                    <button type="button" onClick={() => removeContact(index)} className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm">&times;</button>
                  </div>
                ))}
              </div>
              {contactFields.map((_, index) => errors.contacts?.[index]?.value ? (
                <p key={index} className="text-xs text-red-500 mt-0.5">Contact {index + 1}: {errors.contacts[index]?.value?.message}</p>
              ) : null)}
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input {...register("website")} placeholder="https://example.com"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.website ? "border-red-400" : ""}`} />
              {errors.website && <p className="text-xs text-red-500 mt-1">{errors.website.message}</p>}
            </div>

            {/* Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
              <div className="flex gap-2 flex-wrap">
                {(["coaching", "tutoring", "test_prep", "skill_training"] as const).map((type) => (
                  <button key={type} type="button" onClick={() => toggleType(type)}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-colors ${
                      watchedTypes?.includes(type) ? `${typeBadge(type)} border-current` : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                    }`}>
                    {typeLabel(type)}
                  </button>
                ))}
              </div>
              {errors.types && <p className="text-xs text-red-500 mt-1">{errors.types.message}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-3 border-t sticky bottom-0 bg-white">
              <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {editSaving ? "Saving..." : "Update Institute"}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Institute"
          message={`Delete "${deleteTarget?.name}"?`}
          loading={deleting}
        />
      </section>
    </ProtectedRoute>
  );
}
