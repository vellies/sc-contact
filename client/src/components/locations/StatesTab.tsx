"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { locationService } from "@/services/locationService";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { StateType, CreateStateDTO } from "@/types";

interface StatesTabProps {
  onSelectState: (state: StateType | null) => void;
  selectedStateId: string | null;
}

const emptyForm: CreateStateDTO = { code: "", name: "", type: "State" };

export default function StatesTab({ onSelectState, selectedStateId }: StatesTabProps) {
  const [states, setStates] = useState<StateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<CreateStateDTO>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<StateType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await locationService.getStates(search || undefined);
      setStates(data);
    } catch {
      toast.error("Failed to load states");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  const openCreate = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (state: StateType) => {
    setFormData({ code: state.code, name: state.name, type: state.type });
    setEditingId(state._id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await locationService.updateState(editingId, formData);
        toast.success("State updated");
      } else {
        await locationService.createState(formData);
        toast.success("State created");
      }
      setShowModal(false);
      fetchStates();
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
      await locationService.deleteState(deleteTarget._id);
      toast.success("State deleted");
      if (selectedStateId === deleteTarget._id) onSelectState(null);
      setDeleteTarget(null);
      fetchStates();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">States / UTs</h2>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add State
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search states..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : states.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No states found</div>
      ) : (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {states.map((state) => (
            <div
              key={state._id}
              onClick={() => onSelectState(state)}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors group ${
                selectedStateId === state._id
                  ? "bg-blue-50 border border-blue-200"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{state.name}</span>
                  <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    {state.code}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded ${
                      state.type === "State"
                        ? "bg-green-100 text-green-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {state.type}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(state);
                  }}
                  className="px-2 py-1 text-xs border rounded hover:bg-white transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(state);
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
        title={editingId ? "Edit State" : "Add State"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State Code *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))
              }
              required
              maxLength={4}
              placeholder="e.g. TN"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              required
              placeholder="e.g. Tamil Nadu"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData((p) => ({ ...p, type: e.target.value as "State" | "UT" }))
              }
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="State">State</option>
              <option value="UT">Union Territory</option>
            </select>
          </div>
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
        title="Delete State"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all its districts and areas.`}
        loading={deleting}
      />
    </div>
  );
}
