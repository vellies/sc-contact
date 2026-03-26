"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { locationService } from "@/services/locationService";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { DistrictType, AreaType, CreateAreaDTO } from "@/types";

interface AreasTabProps {
  selectedDistrict: DistrictType | null;
  stateName: string;
}

const emptyForm = { pincode: "", area: "", city: "" };

export default function AreasTab({ selectedDistrict, stateName }: AreasTabProps) {
  const [areas, setAreas] = useState<AreaType[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<AreaType | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-generate
  const [showAutoGenConfirm, setShowAutoGenConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);

  const fetchAreas = useCallback(async () => {
    if (!selectedDistrict) {
      setAreas([]);
      return;
    }
    try {
      setLoading(true);
      const data = await locationService.getAreas(
        selectedDistrict._id,
        search || undefined
      );
      setAreas(data);
    } catch {
      toast.error("Failed to load areas");
    } finally {
      setLoading(false);
    }
  }, [selectedDistrict, search]);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  // Fetch preview when district changes and has no areas
  useEffect(() => {
    const fetchPreview = async () => {
      if (!selectedDistrict) return;
      try {
        const preview = await locationService.autoGeneratePreview(selectedDistrict._id);
        setPreviewCount(preview.availableCount);
        setCanGenerate(preview.canGenerate);
      } catch {
        setPreviewCount(null);
        setCanGenerate(false);
      }
    };
    fetchPreview();
  }, [selectedDistrict, areas.length]);

  const openCreate = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (a: AreaType) => {
    setFormData({ pincode: a.pincode, area: a.area, city: a.city });
    setEditingId(a._id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistrict) return;
    setSaving(true);
    try {
      if (editingId) {
        await locationService.updateArea(editingId, formData);
        toast.success("Area updated");
      } else {
        await locationService.createArea({
          ...formData,
          district: selectedDistrict._id,
        });
        toast.success("Area created");
      }
      setShowModal(false);
      fetchAreas();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await locationService.deleteArea(deleteTarget._id);
      toast.success("Area deleted");
      setDeleteTarget(null);
      fetchAreas();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!selectedDistrict) return;
    setGenerating(true);
    try {
      const result = await locationService.autoGenerateAreas(selectedDistrict._id);
      toast.success(`Created ${result.count} areas for "${selectedDistrict.name}"`);
      setShowAutoGenConfirm(false);
      fetchAreas();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to auto-generate areas");
    } finally {
      setGenerating(false);
    }
  };

  if (!selectedDistrict) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>Select a district to view areas</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Areas / Pincodes</h2>
          <p className="text-xs text-gray-500">
            <span className="font-medium text-blue-600">
              {selectedDistrict.name}
            </span>
            {stateName && <span>, {stateName}</span>}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Area
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by pincode, area or city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : areas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-4">No areas found for this district</p>
          {canGenerate && previewCount && previewCount > 0 ? (
            <>
              <button
                onClick={() => setShowAutoGenConfirm(true)}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                Auto-Create All Areas ({previewCount})
              </button>
              <p className="text-xs text-gray-400 mt-2">
                Will create {previewCount} areas with real pincodes for &quot;{selectedDistrict.name}&quot;
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              No master data available for this district. Add areas manually.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Pincode</th>
                <th className="text-left p-3 font-medium text-gray-600">Area</th>
                <th className="text-left p-3 font-medium text-gray-600">City</th>
                <th className="text-right p-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {areas.map((a) => (
                <tr key={a._id} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-3">
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">
                      {a.pincode}
                    </span>
                  </td>
                  <td className="p-3">{a.area}</td>
                  <td className="p-3 text-gray-500">{a.city}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(a)}
                        className="px-2 py-1 text-xs border rounded hover:bg-white transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(a)}
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
      )}

      <div className="mt-3 text-xs text-gray-400 text-right">
        {areas.length} area{areas.length !== 1 && "s"}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit Area" : "Add Area"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pincode *
            </label>
            <input
              type="text"
              value={formData.pincode}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                }))
              }
              required
              maxLength={6}
              placeholder="e.g. 641001"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area Name *
            </label>
            <input
              type="text"
              value={formData.area}
              onChange={(e) => setFormData((p) => ({ ...p, area: e.target.value }))}
              required
              placeholder="e.g. Town Hall"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
              required
              placeholder="e.g. Coimbatore"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <p className="text-xs text-gray-500">
            District: <span className="font-medium">{selectedDistrict.name}</span>
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Area"
        message={`Are you sure you want to delete "${deleteTarget?.area}" (${deleteTarget?.pincode})?`}
        loading={deleting}
      />

      {/* Auto-Generate Confirm */}
      <ConfirmDialog
        isOpen={showAutoGenConfirm}
        onClose={() => setShowAutoGenConfirm(false)}
        onConfirm={handleAutoGenerate}
        title="Auto-Create All Areas"
        message={`This will create ${previewCount} areas with real pincodes for "${selectedDistrict.name}". Continue?`}
        loading={generating}
        confirmText={`Create ${previewCount} Areas`}
        loadingText="Creating areas..."
        confirmClassName="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
      />
    </div>
  );
}
