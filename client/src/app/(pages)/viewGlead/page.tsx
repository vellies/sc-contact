"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { gLeadsService } from "@/services/gLeadsService";
import type { GLeadsContact } from "@/types";
import toast from "react-hot-toast";

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  contacted: "bg-blue-100 text-blue-700",
  replied:   "bg-indigo-100 text-indigo-700",
  demo:      "bg-pink-100 text-pink-700",
  closed:    "bg-green-100 text-green-700",
  invalid:   "bg-red-100 text-red-700",
};

const STATUSES = ["pending", "contacted", "replied", "demo", "closed", "invalid"] as const;

function extractPhones(phoneNumbers: GLeadsContact["phoneNumbers"]): string[] {
  let data: unknown = phoneNumbers;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return data ? [data as string] : []; }
  }
  if (Array.isArray(data)) {
    return (data as Array<{ sanitized_number?: string; raw_number?: string }>)
      .map((p) => (p.sanitized_number || p.raw_number || "").trim())
      .filter(Boolean);
  }
  return [];
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{children}</span>
);

const Value = ({ children }: { children: React.ReactNode }) => (
  <span className="text-sm text-gray-900">{children || <span className="text-gray-300">--</span>}</span>
);

export default function ViewGleadPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [lead, setLead]     = useState<GLeadsContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    setNotFound(false);
    gLeadsService.getByEmail(email)
      .then(setLead)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [email]);

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await gLeadsService.updateStatus(lead.email, newStatus);
      setLead(updated);
      toast.success(`Status → ${newStatus}`);
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <section className="max-w-[900px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">gLead Contact</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lookup by email:{" "}
            <span className="font-mono text-indigo-600">{email || "No email provided"}</span>
          </p>
        </div>

        {/* No email param */}
        {!email && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700">
            No email parameter provided. Use{" "}
            <code className="bg-yellow-100 px-1 rounded">?email=example@domain.com</code> in the URL.
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        )}

        {/* Not found */}
        {notFound && !loading && (
          <div className="bg-gray-50 border border-dashed rounded-xl p-10 text-center text-gray-400">
            No gLeads contact found for <span className="font-mono">{email}</span>
          </div>
        )}

        {/* Lead Detail */}
        {lead && !loading && (
          <div className="space-y-5">
            {/* Hero card */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="bg-indigo-50 border-b px-6 py-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown"}
                  </h2>
                  <p className="text-sm text-gray-500 font-mono mt-0.5">{lead.email}</p>
                  {lead.title && <p className="text-sm text-gray-700 mt-1">{lead.title}</p>}
                  {lead.headline && <p className="text-xs text-gray-400 mt-0.5">{lead.headline}</p>}
                </div>
                <span className={`shrink-0 mt-1 px-3 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[lead.status]}`}>
                  {lead.status}
                </span>
              </div>

              {/* Status change */}
              <div className="px-6 py-4 bg-gray-50 border-b">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Change Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={saving || lead.status === s}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                        lead.status === s
                          ? "bg-gray-200 border-gray-300 text-gray-600 cursor-default"
                          : "bg-white hover:bg-gray-100 border-gray-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
                {/* Left */}
                <div className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <div className="mt-0.5">
                      <span className="text-sm text-gray-900 font-mono break-all">{lead.email}</span>
                    </div>
                  </div>

                  {extractPhones(lead.phoneNumbers).length > 0 && (
                    <div>
                      <Label>Phone Numbers</Label>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {extractPhones(lead.phoneNumbers).map((p, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded font-mono">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {lead.linkedinUrl && (
                    <div>
                      <Label>LinkedIn</Label>
                      <div className="mt-0.5">
                        <a
                          href={lead.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          {lead.linkedinUrl}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right */}
                <div className="space-y-4">
                  <div>
                    <Label>Location</Label>
                    <div className="mt-0.5">
                      <Value>{[lead.city, lead.state, lead.country].filter(Boolean).join(", ")}</Value>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Created</Label>
                      <div className="mt-0.5">
                        <Value>{new Date(lead.createdAt).toLocaleString()}</Value>
                      </div>
                    </div>
                    <div>
                      <Label>Updated</Label>
                      <div className="mt-0.5">
                        <Value>{new Date(lead.updatedAt).toLocaleString()}</Value>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </ProtectedRoute>
  );
}
