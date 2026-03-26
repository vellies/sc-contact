"use client";

import Modal from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
  confirmText?: string;
  loadingText?: string;
  confirmClassName?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  confirmText = "Delete",
  loadingText,
  confirmClassName,
}: ConfirmDialogProps) {
  const defaultLoadingText = loadingText || `${confirmText}...`;
  const defaultClassName =
    confirmClassName ||
    "px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={defaultClassName}
        >
          {loading ? defaultLoadingText : confirmText}
        </button>
      </div>
    </Modal>
  );
}
