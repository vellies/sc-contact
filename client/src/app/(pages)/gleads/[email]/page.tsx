"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type PhoneEntry = { sanitized_number?: string; raw_number?: string; type?: string };

function getPhones(phoneNumbers: GLeadsContact["phoneNumbers"]): PhoneEntry[] {
  let data: unknown = phoneNumbers;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return []; }
  }
  if (Array.isArray(data)) return data as PhoneEntry[];
  return [];
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 break-all">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export default function GLeadsDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const email   = decodeURIComponent(params.email as string);

  const [lead, setLead]       = useState<GLeadsContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    gLeadsService.getByEmail(email)
      .then(setLead)
      .catch(() => toast.error("Lead not found"))
      .finally(() => setLoading(false));
  }, [email]);

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await gLeadsService.updateStatus(email, newStatus);
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
      <section className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          ← Back to gLeads
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : !lead ? (
          <div className="text-center py-24 text-gray-400">Lead not found.</div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white border rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown"}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">{lead.email}</p>
                  {lead.title && <p className="text-sm text-gray-700 mt-1">{lead.title}</p>}
                  {lead.headline && <p className="text-xs text-gray-500 mt-0.5">{lead.headline}</p>}
                </div>

                {/* Status selector */}
                <div className="flex flex-col gap-2 min-w-40">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full text-center ${STATUS_COLORS[lead.status]}`}>
                    {lead.status}
                  </span>
                  <select
                    value={lead.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={saving}
                    className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white border rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Contact Info</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Email" value={lead.email} />
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone Numbers</dt>
                  <dd className="text-sm text-gray-900">
                    {getPhones(lead.phoneNumbers).length > 0 ? (
                      <ul className="space-y-1">
                        {getPhones(lead.phoneNumbers).map((p, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="font-medium">{p.sanitized_number || p.raw_number}</span>
                            {p.type && (
                              <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{p.type.replace(/_/g, " ")}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">LinkedIn</dt>
                  <dd className="text-sm">
                    {lead.linkedinUrl ? (
                      <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all">
                        {lead.linkedinUrl}
                      </a>
                    ) : <span className="text-gray-400">—</span>}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Location */}
            <div className="bg-white border rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Location</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Field label="City"    value={lead.city} />
                <Field label="State"   value={lead.state} />
                <Field label="Country" value={lead.country} />
              </dl>
            </div>

            {/* Meta */}
            <div className="bg-white border rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Record Info</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Created" value={new Date(lead.createdAt).toLocaleString()} />
                <Field label="Updated" value={new Date(lead.updatedAt).toLocaleString()} />
              </dl>
            </div>
          </div>
        )}
      </section>
    </ProtectedRoute>
  );
}
