"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { locationService } from "@/services/locationService";
import {
  educationService,
  type EducationInstitution,
  type SavedInstitution,
} from "@/services/educationService";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { StateType, DistrictType, AreaType } from "@/types";

// Delay utility for rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ========== ZOD SCHEMA ==========
const institutionFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be under 200 characters"),
  address: z.string().trim().max(500, "Address too long"),
  phones: z.array(
    z.object({
      value: z
        .string()
        .trim()
        .min(6, "Phone too short")
        .max(20, "Phone too long")
        .regex(
          /^(\+?\d{1,4}[\s-]?)?(\(?\d{2,5}\)?[\s-]?)?\d{4,10}$/,
          "Invalid phone format (e.g. +91 98765 43210)"
        ),
    })
  ),
  emails: z.array(
    z.object({
      value: z.string().trim().email("Invalid email format"),
    })
  ),
  contacts: z.array(
    z.object({
      value: z
        .string()
        .trim()
        .min(1, "Contact cannot be empty")
        .max(100, "Contact too long"),
    })
  ),
  website: z
    .string()
    .trim()
    .max(300, "Website too long")
    .refine(
      (val) =>
        !val || val === "" || val.startsWith("http://") || val.startsWith("https://"),
      { message: "Must start with http:// or https://" }
    ),
  types: z
    .array(z.enum(["school", "college", "polytechnic", "iti"]))
    .min(1, "Select at least one type"),
});

type InstitutionFormData = z.infer<typeof institutionFormSchema>;

type ViewMode = "search" | "saved";

export default function EducationPage() {
  // Location dropdowns
  const [states, setStates] = useState<StateType[]>([]);
  const [districts, setDistricts] = useState<DistrictType[]>([]);
  const [areas, setAreas] = useState<AreaType[]>([]);
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]); // MULTI-SELECT support

  // Manual search
  const [manualPincode, setManualPincode] = useState("");
  const [manualArea, setManualArea] = useState("");
  const [manualCity, setManualCity] = useState("");

  // Mode & UI States
  const [searchMode, setSearchMode] = useState<"dropdown" | "manual">("dropdown");
  const [viewMode, setViewMode] = useState<ViewMode>("search");
  const [areaSelectOpen, setAreaSelectOpen] = useState(false);

  // Search results
  const [results, setResults] = useState<EducationInstitution[]>([]);
  const [searching, setSearching] = useState(false);
  const [progressText, setProgressText] = useState(""); // Progress tracking
  const [searchInfo, setSearchInfo] = useState("");

  // Saved data
  const [savedData, setSavedData] = useState<SavedInstitution[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<SavedInstitution | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<SavedInstitution | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Scraper
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);

  // ========== REACT-HOOK-FORM ==========
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<InstitutionFormData>({
    resolver: zodResolver(institutionFormSchema),
    defaultValues: {
      name: "",
      address: "",
      phones: [],
      emails: [],
      contacts: [],
      website: "",
      types: ["school"],
    },
  });

  const {
    fields: phoneFields,
    append: appendPhone,
    remove: removePhone,
  } = useFieldArray({ control, name: "phones" });

  const {
    fields: emailFields,
    append: appendEmail,
    remove: removeEmail,
  } = useFieldArray({ control, name: "emails" });

  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({ control, name: "contacts" });

  const watchedTypes = watch("types");

  // ========== LOAD STATES ==========
  const loadStates = useCallback(async () => {
    if (states.length > 0) return;
    try {
      const data = await locationService.getStates();
      setStates(data);
    } catch {
      toast.error("Failed to load states");
    }
  }, [states.length]);

  // Clear all results when any filter changes
  const clearResults = () => {
    setResults([]);
    setSavedData([]);
    setSearchInfo("");
    setSavedCount(null);
    setViewMode("search");
  };

  const handleStateChange = async (stateId: string) => {
    setSelectedState(stateId);
    setSelectedDistrict("");
    setSelectedAreas([]);
    setDistricts([]);
    setAreas([]);
    clearResults();
    if (!stateId) return;
    try {
      const data = await locationService.getDistricts(stateId);
      setDistricts(data);
    } catch {
      toast.error("Failed to load districts");
    }
  };

  const handleDistrictChange = async (districtId: string) => {
    setSelectedDistrict(districtId);
    setSelectedAreas([]);
    setAreas([]);
    clearResults();
    if (!districtId) return;
    try {
      const data = await locationService.getAreas(districtId);
      setAreas(data);
    } catch {
      toast.error("Failed to load areas");
    }
  };

  // Clear results + check saved count when first area changes
  useEffect(() => {
    setResults([]);
    setSavedData([]);
    setSearchInfo("");
    setViewMode("search");
    if (selectedAreas.length === 0) { setSavedCount(null); return; }
    
    // We only check the primary/first selected area for quick stat display
    const check = async () => {
      try {
        const res = await educationService.getByArea(selectedAreas[0]);
        setSavedCount(res.count);
      } catch { setSavedCount(0); }
    };
    check();
  }, [selectedAreas]);

  // ========== AUTO-SAVE ==========
  const autoSave = async (areaId: string, institutions: EducationInstitution[]) => {
    if (!areaId || institutions.length === 0) return;
    try {
      const res = await educationService.saveInstitutions(areaId, institutions);
      toast.success(`Auto-saved ${res.savedCount} institutions${res.skippedCount > 0 ? ` (${res.skippedCount} duplicates skipped)` : ""}`, { icon: "💾" });
      const countRes = await educationService.getByArea(areaId);
      setSavedCount(countRes.count);
    } catch {
      toast.error("Auto-save failed");
    }
  };

  // ========== SEARCH ==========
  const handleDropdownSearch = async () => {
    if (selectedAreas.length === 0) { toast.error("Please select at least one area"); return; }
    setSearching(true);
    setResults([]);
    setViewMode("search");
    
    let totalResults: EducationInstitution[] = [];
    
    try {
      for (let index = 0; index < selectedAreas.length; index++) {
        const currentAreaId = selectedAreas[index];
        setProgressText(`Processing area ${index + 1} of ${selectedAreas.length}...`);
        
        const res = await educationService.searchByArea(currentAreaId);
        totalResults = [...totalResults, ...res.data];
        setSearchInfo(`${res.query.area}, ${res.query.city} - ${res.query.pincode} (${res.query.district}, ${res.query.state})`);
        
        if (res.count > 0) {
          setProgressText(`Auto-saving ${res.count} institutions for area ${res.query.area}...`);
          await autoSave(currentAreaId, res.data);
          
          // Fetch the newly saved ones to get their DB _id for scraping
          setProgressText(`Getting DB records to start scraping for ${res.query.area}...`);
          const savedRes = await educationService.getByArea(currentAreaId);
          
          // Filter to only items with websites
          const itemsToScrape = savedRes.data.filter(i => !!i.website);
          
          for (let i = 0; i < itemsToScrape.length; i++) {
            const target = itemsToScrape[i];
            setProgressText(`Area: ${res.query.area} | Scraping website ${i + 1} of ${itemsToScrape.length}`);
            setScrapingId(target._id);
            try {
              await educationService.scrapeInstitution(target._id);
              // Wait 2.5 seconds between scrapes to avoid backend/target server rate-limits
              if (i < itemsToScrape.length - 1) {
                setProgressText(`Area: ${res.query.area} | Cooling down before next scrape...`);
                await delay(2500);
              }
            } catch (err) {
              console.error(`Scrape failed for ${target.name}`, err);
            }
          }
          setScrapingId(null);
        }
        
        // Wait 3 seconds between Area searches to avoid Google API 429 Too Many Requests
        if (index < selectedAreas.length - 1) {
          setProgressText(`Cooling down before searching next area...`);
          await delay(3000);
        }
      }
      setResults(totalResults);
      if (totalResults.length > 0) {
        toast.success(`Search & Scrape completed! Found ${totalResults.length} total institutions.`);
      } else {
        toast("No institutions found", { icon: "ℹ️" });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Search sequence failed");
    } finally {
      setSearching(false);
      setProgressText("");
    }
  };

  const handleManualSearch = async () => {
    if (!manualPincode || !manualArea) { toast.error("Pincode and area are required"); return; }
    
    // Support multiple pincodes via comma separate
    const pincodesToProcess = manualPincode.split(",").map(p => p.replace(/\D/g, "").trim()).filter(p => p.length >= 6);
    if (pincodesToProcess.length === 0) { toast.error("Please provide valid 6-digit pincode(s)"); return; }
    
    setSearching(true);
    setResults([]);
    setViewMode("search");
    
    let totalResults: EducationInstitution[] = [];

    try {
      for (let idx = 0; idx < pincodesToProcess.length; idx++) {
        const pcode = pincodesToProcess[idx];
        setProgressText(`Searching pincode ${pcode} (${idx + 1} of ${pincodesToProcess.length})...`);
        
        const res = await educationService.search({ pincode: pcode, area: manualArea, city: manualCity || undefined });
        totalResults = [...totalResults, ...res.data];
        setSearchInfo(`Searched: ${manualArea}, ${manualCity || ""} - Pincodes: ${pincodesToProcess.join(", ")}`);
        
        if (res.count > 0 && selectedAreas.length > 0) {
          const areaForSave = selectedAreas[0];
          setProgressText(`Auto-saving results for pincode ${pcode}...`);
          await autoSave(areaForSave, res.data);
          
          setProgressText(`Fetching DB records for scraping...`);
          const savedRes = await educationService.getByArea(areaForSave);
          // To be safe, try to match by name or just scrape all that have websites locally.
          const itemsToScrape = savedRes.data.filter(i => !!i.website);
          
          for (let i = 0; i < itemsToScrape.length; i++) {
            const target = itemsToScrape[i];
            setProgressText(`Pincode: ${pcode} | Scraping website ${i + 1} of ${itemsToScrape.length}`);
            setScrapingId(target._id);
            try {
              await educationService.scrapeInstitution(target._id);
              // Wait 2.5 seconds between scrapes to avoid rate-limiting
              if (i < itemsToScrape.length - 1) {
                setProgressText(`Pincode: ${pcode} | Cooling down before next scrape...`);
                await delay(2500);
              }
            } catch (err) {
              console.error(`Scrape faield for ${target.name}`, err);
            }
          }
          setScrapingId(null);
        }
        
        // Wait 3 seconds between Pincode searches to avoid Google API 429
        if (idx < pincodesToProcess.length - 1) {
          setProgressText(`Cooling down before searching next pincode...`);
          await delay(3000);
        }
      }
      setResults(totalResults);
      if (totalResults.length > 0) {
        if (selectedAreas.length === 0) {
          toast.success(`Found ${totalResults.length} total institutions. (Not saved/scraped because no area was selected in dropdown)`);
        } else {
          toast.success(`Found ${totalResults.length} total institutions. Auto-saved & Scraped!`);
        }
      } else {
        toast("No institutions found", { icon: "ℹ️" });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Search sequence failed");
    } finally {
      setSearching(false);
      setProgressText("");
    }
  };

  // ========== LOAD SAVED ==========
  const handleLoadSaved = async () => {
    if (selectedAreas.length === 0) { toast.error("Select an area first"); return; }
    setSavedLoading(true);
    setViewMode("saved");
    try {
      const res = await educationService.getByArea(selectedAreas[0]);
      setSavedData(res.data);
      setSavedCount(res.count);
    } catch {
      toast.error("Failed to load saved data");
    } finally {
      setSavedLoading(false);
    }
  };

  // ========== EDIT ==========
  const openEdit = (inst: SavedInstitution) => {
    setEditTarget(inst);
    reset({
      name: inst.name,
      address: inst.address || "",
      phones: (inst.phones || []).map((p) => ({ value: p })),
      emails: (inst.emails || []).map((e) => ({ value: e })),
      contacts: (inst.contacts || []).map((c) => ({ value: c })),
      website: inst.website || "",
      types: (inst.types as InstitutionFormData["types"]) || ["school"],
    });
  };

  const onEditSubmit = async (data: InstitutionFormData) => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await educationService.updateInstitution(editTarget._id, {
        name: data.name,
        address: data.address || "",
        phones: data.phones.map((p) => p.value),
        emails: data.emails.map((e) => e.value),
        contacts: data.contacts.map((c) => c.value),
        website: data.website || "",
        types: data.types,
      });
      toast.success("Institution updated");
      setEditTarget(null);
      handleLoadSaved();
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
      await educationService.deleteInstitution(deleteTarget._id);
      toast.success("Deleted");
      setDeleteTarget(null);
      handleLoadSaved();
    } catch { toast.error("Delete failed"); }
    finally { setDeleting(false); }
  };

  const handleDeleteAll = async () => {
    if (selectedAreas.length === 0) return;
    setDeletingAll(true);
    try {
      const res = await educationService.deleteAllByArea(selectedAreas[0]);
      toast.success(`Deleted ${res.deletedCount} institutions`);
      setShowDeleteAll(false);
      setSavedData([]);
      setSavedCount(0);
    } catch { toast.error("Delete failed"); }
    finally { setDeletingAll(false); }
  };

  // ========== SCRAPE SINGLE ==========
  const handleScrapeOne = async (inst: SavedInstitution) => {
    if (!inst.website) { toast.error("No website to scrape"); return; }
    setScrapingId(inst._id);
    try {
      const res = await educationService.scrapeInstitution(inst._id);
      if (res.scraped) {
        const newItems = [];
        if (res.newContacts.length > 0) newItems.push(`${res.newContacts.length} contact(s)`);
        if (res.newEmails.length > 0) newItems.push(`${res.newEmails.length} email(s)`);
        if (newItems.length > 0) {
          toast.success(`Found ${newItems.join(" & ")} from ${inst.name}`);
        } else {
          toast("No new contacts found", { icon: "ℹ️" });
        }
      } else {
        toast.error(res.message);
      }
      handleLoadSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Scrape failed");
    } finally {
      setScrapingId(null);
    }
  };

  // ========== SCRAPE ALL ==========
  const handleScrapeAll = async () => {
    if (selectedAreas.length === 0) return;
    setScrapingAll(true);
    try {
      // For Scrape All button we just trigger backend bulk or we can also loop. Let's do backend bulk for manual clicks if desired.
      const res = await educationService.scrapeAllByArea(selectedAreas[0]);
      toast.success(res.message, { duration: 5000 });
      handleLoadSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Batch scrape failed");
    } finally {
      setScrapingAll(false);
    }
  };

  // ========== CSV ==========
  const exportCSV = (data: EducationInstitution[]) => {
    const csv = [
      "Name,Address,Phones,Emails,Contacts,Website,Type",
      ...data.map(
        (r) =>
          `"${r.name}","${r.address}","${(r.phones || []).join("; ")}","${(r.emails || []).join("; ")}","${(r.contacts || []).join("; ")}","${r.website}","${r.types.join(", ")}"`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `education-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  // ========== TYPE TOGGLE ==========
  const toggleType = (type: InstitutionFormData["types"][number]) => {
    const current = watchedTypes || [];
    if (current.includes(type)) {
      const filtered = current.filter((t) => t !== type);
      if (filtered.length > 0) setValue("types", filtered, { shouldValidate: true });
    } else {
      setValue("types", [...current, type], { shouldValidate: true });
    }
  };

  // ========== BADGE ==========
  const typeBadge = (type: string) => {
    switch (type) {
      case "college": return "bg-purple-100 text-purple-700";
      case "polytechnic": return "bg-orange-100 text-orange-700";
      case "iti": return "bg-yellow-100 text-yellow-700";
      default: return "bg-blue-100 text-blue-700";
    }
  };

  // ========== MULTI-VALUE DISPLAY ==========
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

  // ========== TABLE ROW ==========
  const renderRow = (
    r: EducationInstitution,
    i: number,
    saved?: SavedInstitution
  ) => (
    <tr key={saved?._id || i} className="hover:bg-gray-50 transition-colors group">
      <td className="p-3 text-gray-400 text-xs">{i + 1}</td>
      <td className="p-3 font-medium max-w-[180px] text-sm">{r.name}</td>
      <td className="p-3 text-gray-500 max-w-[200px] text-xs">{r.address}</td>
      <td className="p-3">{renderMulti(r.phones || [], "phone")}</td>
      <td className="p-3">{renderMulti(r.emails || [], "email")}</td>
      <td className="p-3">{renderMulti(r.contacts || [], "text")}</td>
      <td className="p-3">
        {r.website ? (
          <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate block max-w-[120px]">
            {r.website.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        ) : <span className="text-gray-300">-</span>}
      </td>
      <td className="p-3">
        <div className="flex gap-1 flex-wrap">
          {r.types.map((t) => (
            <span key={t} className={`px-2 py-0.5 text-xs rounded-full font-medium ${typeBadge(t)}`}>{t}</span>
          ))}
        </div>
      </td>
      {saved && (
        <td className="p-3 text-right">
          <div className="flex gap-1 justify-end">
            {saved.website && (
              <button
                onClick={() => handleScrapeOne(saved)}
                disabled={scrapingId === saved._id}
                className="px-2 py-1 text-xs border border-emerald-200 text-emerald-600 rounded hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                {scrapingId === saved._id ? "..." : "Scrape"}
              </button>
            )}
            <button onClick={() => openEdit(saved)} className="px-2 py-1 text-xs border rounded hover:bg-white transition-colors">Edit</button>
            <button onClick={() => setDeleteTarget(saved)} className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors">Del</button>
          </div>
        </td>
      )}
    </tr>
  );

  // ========== TABLE HEADER ==========
  const tableHeaders = (showActions: boolean) => (
    <thead className="bg-gray-50 sticky top-0">
      <tr>
        <th className="text-left p-3 font-medium text-gray-600 w-8">#</th>
        <th className="text-left p-3 font-medium text-gray-600">Name</th>
        <th className="text-left p-3 font-medium text-gray-600">Address</th>
        <th className="text-left p-3 font-medium text-gray-600">Phone(s)</th>
        <th className="text-left p-3 font-medium text-gray-600">Email(s)</th>
        <th className="text-left p-3 font-medium text-gray-600">Contact(s)</th>
        <th className="text-left p-3 font-medium text-gray-600">Website</th>
        <th className="text-left p-3 font-medium text-gray-600">Type</th>
        {showActions && <th className="text-right p-3 font-medium text-gray-600">Actions</th>}
      </tr>
    </thead>
  );

  return (
    <ProtectedRoute>
      <section className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Education Finder</h1>
          <p className="text-gray-500 text-sm mt-1">Search via Google Places — results auto-save to database</p>
        </div>

        {/* Search Panel */}
        <div className="bg-white border rounded-xl p-6 shadow-sm mb-6">
          <div className="flex gap-2 mb-6">
            <button onClick={() => setSearchMode("dropdown")} className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${searchMode === "dropdown" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Select from Locations
            </button>
            <button onClick={() => setSearchMode("manual")} className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${searchMode === "manual" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Manual Search
            </button>
          </div>

          {searchMode === "dropdown" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <select value={selectedState} onFocus={loadStates} onChange={(e) => handleStateChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                    <option value="">Select State</option>
                    {states.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                  <select value={selectedDistrict} onChange={(e) => handleDistrictChange(e.target.value)} disabled={!selectedState} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50">
                    <option value="">Select District</option>
                    {districts.map((d) => (<option key={d._id} value={d._id}>{d.name}</option>))}
                  </select>
                </div>
                {/* Custom Multi-Select for Area */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area / Pincode</label>
                  <button
                    type="button"
                    disabled={!selectedDistrict}
                    onClick={() => setAreaSelectOpen(!areaSelectOpen)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 text-left bg-white flex items-center justify-between shadow-sm"
                  >
                    <span className="truncate">
                      {selectedAreas.length === 0 ? "Select Area(s)" : `${selectedAreas.length} area(s) selected`}
                    </span>
                    <span className="ml-2 text-gray-400 text-xs">▼</span>
                  </button>

                  {areaSelectOpen && selectedDistrict && (
                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      <div className="p-2 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                        <span className="text-xs font-semibold text-gray-600">Select Multiple</span>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (selectedAreas.length === areas.length && areas.length > 0) setSelectedAreas([]);
                            else setSelectedAreas(areas.map(a => a._id));
                          }} 
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          {selectedAreas.length === areas.length && areas.length > 0 ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      {areas.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">No areas available</div>
                      ) : (
                        areas.map((a) => (
                          <label key={a._id} className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedAreas.includes(a._id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedAreas([...selectedAreas, a._id]);
                                else setSelectedAreas(selectedAreas.filter(id => id !== a._id));
                              }}
                              className="mr-3 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{a.pincode} - {a.area}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  {/* Invisible backdrop to close the dropdown */}
                  {areaSelectOpen && (
                    <div className="fixed inset-0 z-10" onClick={() => setAreaSelectOpen(false)} />
                  )}
                </div>
                
                <div className="flex items-end">
                  <button onClick={() => { setAreaSelectOpen(false); handleDropdownSearch(); }} disabled={searching || selectedAreas.length === 0} className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm relative z-0">
                    {searching ? "Processing..." : "Get From Google API"}
                  </button>
                </div>
              </div>
              {selectedAreas.length > 0 && savedCount !== null && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2.5 h-2.5 rounded-full ${savedCount > 0 ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="text-sm text-gray-600">
                    {savedCount > 0 ? <><strong>{savedCount}</strong> institutions saved in Primary Area</> : "No saved data for area"}
                  </span>
                  {savedCount > 0 && (
                    <button onClick={handleLoadSaved} className="px-3 py-1 text-xs bg-white border rounded-lg hover:bg-gray-100 transition-colors font-medium text-blue-600">View Saved Data</button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode(s) *</label>
                <input type="text" value={manualPincode} onChange={(e) => setManualPincode(e.target.value)} placeholder="e.g. 641001, 641002" className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                <p className="text-[10px] text-gray-500 mt-1">Comma separated for multiple</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area *</label>
                <input type="text" value={manualArea} onChange={(e) => setManualArea(e.target.value)} placeholder="e.g. Town Hall" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={manualCity} onChange={(e) => setManualCity(e.target.value)} placeholder="e.g. Coimbatore" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              <div className="flex items-end h-[62px]">
                <button onClick={handleManualSearch} disabled={searching || !manualPincode || !manualArea} className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {(searching || savedLoading) && (
          <div className="bg-white border rounded-xl p-12 shadow-sm text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500 font-medium">{progressText || (searching ? "Searching Google Places API..." : "Loading saved data...")}</p>
            {searching && <p className="text-xs text-blue-500 mt-2">Do not close this page until completed.</p>}
          </div>
        )}

        {/* ===== SEARCH RESULTS ===== */}
        {!searching && !savedLoading && viewMode === "search" && results.length > 0 && (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">
                  {results.length} Institution{results.length !== 1 && "s"} Found
                  <span className="text-xs font-normal text-green-600 ml-2">Auto-saved to DB</span>
                </h2>
                {searchInfo && <p className="text-xs text-gray-500 mt-0.5">{searchInfo}</p>}
              </div>
              <div className="flex gap-2">
                {selectedAreas.length > 0 && savedCount !== null && savedCount > 0 && (
                  <button onClick={handleLoadSaved} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors font-medium">View Saved ({savedCount})</button>
                )}
                <button onClick={() => exportCSV(results)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Export CSV</button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
              <table className="w-full text-sm">
                {tableHeaders(false)}
                <tbody className="divide-y">{results.map((r, i) => renderRow(r, i))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== SAVED DATA ===== */}
        {!searching && !savedLoading && viewMode === "saved" && (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">
                  {savedData.length} Saved Institution{savedData.length !== 1 && "s"}
                  <span className="text-xs font-normal text-emerald-600 ml-2">(Database)</span>
                </h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setViewMode("search")} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Back to Search</button>
                {savedData.length > 0 && (
                  <button
                    onClick={handleScrapeAll}
                    disabled={scrapingAll}
                    className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {scrapingAll ? "Scraping..." : "Scrape All Websites"}
                  </button>
                )}
                <button onClick={() => exportCSV(savedData)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Export CSV</button>
                {savedData.length > 0 && (
                  <button onClick={() => setShowDeleteAll(true)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete All</button>
                )}
              </div>
            </div>
            {savedData.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No saved institutions for this area.</div>
            ) : (
              <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                <table className="w-full text-sm">
                  {tableHeaders(true)}
                  <tbody className="divide-y">{savedData.map((r, i) => renderRow(r, i, r))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {!searching && !savedLoading && viewMode === "search" && results.length === 0 && searchInfo && (
          <div className="bg-white border rounded-xl p-12 shadow-sm text-center text-gray-400">
            <p>No education institutions found for this area.</p>
          </div>
        )}

        {/* ===== EDIT MODAL (Zod + react-hook-form + useFieldArray) ===== */}
        <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Institution">
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

            {/* ========== PHONES (multi) ========== */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Phone Numbers</label>
                <button type="button" onClick={() => appendPhone({ value: "" })} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Phone</button>
              </div>
              {phoneFields.length === 0 && (
                <p className="text-xs text-gray-400 italic">No phone numbers added</p>
              )}
              <div className="space-y-2">
                {phoneFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`phones.${index}.value`)}
                      placeholder="+91 98765 43210"
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono ${errors.phones?.[index]?.value ? "border-red-400" : ""}`}
                    />
                    <button type="button" onClick={() => removePhone(index)} className="px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors text-sm">
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              {errors.phones && typeof errors.phones === "object" && !Array.isArray(errors.phones) && (
                <p className="text-xs text-red-500 mt-1">{(errors.phones as any).message}</p>
              )}
              {phoneFields.map((_, index) =>
                errors.phones?.[index]?.value ? (
                  <p key={index} className="text-xs text-red-500 mt-0.5">Phone {index + 1}: {errors.phones[index]?.value?.message}</p>
                ) : null
              )}
            </div>

            {/* ========== EMAILS (multi) ========== */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Email Addresses</label>
                <button type="button" onClick={() => appendEmail({ value: "" })} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Email</button>
              </div>
              {emailFields.length === 0 && (
                <p className="text-xs text-gray-400 italic">No email addresses added</p>
              )}
              <div className="space-y-2">
                {emailFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`emails.${index}.value`)}
                      placeholder="info@school.edu"
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.emails?.[index]?.value ? "border-red-400" : ""}`}
                    />
                    <button type="button" onClick={() => removeEmail(index)} className="px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors text-sm">
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              {emailFields.map((_, index) =>
                errors.emails?.[index]?.value ? (
                  <p key={index} className="text-xs text-red-500 mt-0.5">Email {index + 1}: {errors.emails[index]?.value?.message}</p>
                ) : null
              )}
            </div>

            {/* ========== CONTACTS (multi) ========== */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Contact Persons</label>
                <button type="button" onClick={() => appendContact({ value: "" })} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Contact</button>
              </div>
              {contactFields.length === 0 && (
                <p className="text-xs text-gray-400 italic">No contact persons added</p>
              )}
              <div className="space-y-2">
                {contactFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`contacts.${index}.value`)}
                      placeholder="Principal - Mr. John"
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.contacts?.[index]?.value ? "border-red-400" : ""}`}
                    />
                    <button type="button" onClick={() => removeContact(index)} className="px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors text-sm">
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              {contactFields.map((_, index) =>
                errors.contacts?.[index]?.value ? (
                  <p key={index} className="text-xs text-red-500 mt-0.5">Contact {index + 1}: {errors.contacts[index]?.value?.message}</p>
                ) : null
              )}
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input {...register("website")} placeholder="https://example.com" className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.website ? "border-red-400" : ""}`} />
              {errors.website && <p className="text-xs text-red-500 mt-1">{errors.website.message}</p>}
            </div>

            {/* Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
              <div className="flex gap-2 flex-wrap">
                {(["school", "college", "polytechnic", "iti"] as const).map((type) => (
                  <button key={type} type="button" onClick={() => toggleType(type)}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-colors ${watchedTypes?.includes(type) ? `${typeBadge(type)} border-current` : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"}`}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
              {errors.types && <p className="text-xs text-red-500 mt-1">{errors.types.message}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-3 border-t sticky bottom-0 bg-white">
              <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {editSaving ? "Saving..." : "Update Institution"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirm */}
        <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Institution" message={`Delete "${deleteTarget?.name}"?`} loading={deleting} />
        <ConfirmDialog isOpen={showDeleteAll} onClose={() => setShowDeleteAll(false)} onConfirm={handleDeleteAll} title="Delete All Institutions" message={`Delete all ${savedData.length} saved institutions? This cannot be undone.`} loading={deletingAll} confirmText="Delete All" />
      </section>
    </ProtectedRoute>
  );
}
