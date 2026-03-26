"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { locationService } from "@/services/locationService";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { StateType, DistrictType } from "@/types";

interface DistrictsTabProps {
  selectedState: StateType | null;
  onSelectDistrict: (district: DistrictType | null) => void;
  selectedDistrictId: string | null;
}

export default function DistrictsTab({
  selectedState,
  onSelectDistrict,
  selectedDistrictId,
}: DistrictsTabProps) {
  const [districts, setDistricts] = useState<DistrictType[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<DistrictType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDistricts = useCallback(async () => {
    if (!selectedState) {
      setDistricts([]);
      return;
    }
    try {
      setLoading(true);
      const data = await locationService.getDistricts(
        selectedState._id,
        search || undefined
      );
      setDistricts(data);
    } catch {
      toast.error("Failed to load districts");
    } finally {
      setLoading(false);
    }
  }, [selectedState, search]);

  useEffect(() => {
    fetchDistricts();
    onSelectDistrict(null);
  }, [selectedState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedState) fetchDistricts();
  }, [fetchDistricts]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setName("");
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (d: DistrictType) => {
    setName(d.name);
    setEditingId(d._id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedState) return;
    setSaving(true);
    try {
      if (editingId) {
        await locationService.updateDistrict(editingId, { name });
        toast.success("District updated");
      } else {
        await locationService.createDistrict({ name, state: selectedState._id });
        toast.success("District created");
      }
      setShowModal(false);
      fetchDistricts();
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
      await locationService.deleteDistrict(deleteTarget._id);
      toast.success("District deleted");
      if (selectedDistrictId === deleteTarget._id) onSelectDistrict(null);
      setDeleteTarget(null);
      fetchDistricts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  if (!selectedState) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>Select a state to view districts</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Districts</h2>
          <p className="text-xs text-gray-500">
            of{" "}
            <span className="font-medium text-blue-600">{selectedState.name}</span>
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add District
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search districts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : districts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No districts found</div>
      ) : (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {districts.map((d) => (
            <div
              key={d._id}
              onClick={() => onSelectDistrict(d)}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors group ${
                selectedDistrictId === d._id
                  ? "bg-blue-50 border border-blue-200"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <span className="font-medium text-sm">{d.name}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(d);
                  }}
                  className="px-2 py-1 text-xs border rounded hover:bg-white transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(d);
                  }}
                  className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit District" : "Add District"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              District Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Coimbatore"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <p className="text-xs text-gray-500">
            State: <span className="font-medium">{selectedState.name}</span>
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
        title="Delete District"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all its areas.`}
        loading={deleting}
      />
    </div>
  );
}
