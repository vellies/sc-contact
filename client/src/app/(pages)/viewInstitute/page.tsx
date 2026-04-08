"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import api from "@/lib/axios";
import { gLeadsService } from "@/services/gLeadsService";
import type { MailerLiteContact, GLeadsContact } from "@/types";

interface InstitutionData {
  _id: string;
  name: string;
  address: string;
  phones: string[];
  emails: string[];
  contacts: string[];
  website: string;
  types: string[];
  area: { _id: string; pincode: string; area: string; city: string } | null;
  district: { _id: string; name: string } | null;
  state: { _id: string; name: string; code: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface LookupResponse {
  email: string;
  institutions: InstitutionData[];
  mailerLiteContact: MailerLiteContact | null;
}

const formatType = (t: string) => t === "iti" ? "ITI" : t.charAt(0).toUpperCase() + t.slice(1);

const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{children}</span>
);

const Value = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
  <span className={`text-sm text-gray-900 ${mono ? "font-mono" : ""}`}>{children || <span className="text-gray-300">--</span>}</span>
);

const Badge = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>{children}</span>
);

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

export default function ViewInstitutePage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [data, setData] = useState<LookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [glead, setGlead]           = useState<GLeadsContact | null>(null);
  const [gleadLoading, setGleadLoading] = useState(false);
  const [gleadSaving, setGleadSaving]   = useState(false);

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    setError("");
    api.get("/education/lookup-by-email", { params: { email } })
      .then((res) => setData(res.data.data))
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));

    setGleadLoading(true);
    gLeadsService.getByEmail(email)
      .then(setGlead)
      .catch(() => setGlead(null))
      .finally(() => setGleadLoading(false));
  }, [email]);

  const handleStatusChange = async (newStatus: string) => {
    if (!glead) return;
    setGleadSaving(true);
    try {
      const updated = await gLeadsService.updateStatus(glead.email, newStatus);
      setGlead(updated);
    } catch {
      // silent
    } finally {
      setGleadSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <section className="max-w-[1200px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">View Institute</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lookup by email: <span className="font-mono text-blue-600">{email || "No email provided"}</span>
          </p>
        </div>

        {!email && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700">
            No email parameter provided. Use <code className="bg-yellow-100 px-1 rounded">?email=example@test.com</code> in the URL.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600">{error}</div>
        )}

        {data && !loading && (
          <div className="space-y-6">
            {/* No results */}
            {data.institutions.length === 0 && !data.mailerLiteContact && (
              <div className="bg-gray-50 border rounded-xl p-8 text-center text-gray-500">
                No institution or MailerLite contact found for this email.
              </div>
            )}

            {/* Institution(s) Section */}
            {data.institutions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                  Institution Data
                  <span className="text-xs font-normal text-gray-400">({data.institutions.length} found)</span>
                </h2>

                <div className="space-y-4">
                  {data.institutions.map((inst) => (
                    <div key={inst._id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                      {/* Institution Header */}
                      <div className="bg-blue-50 border-b px-5 py-3 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{inst.name}</h3>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {inst._id}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {inst.types.map((t) => (
                            <Badge key={t} color="bg-blue-100 text-blue-700">{formatType(t)}</Badge>
                          ))}
                        </div>
                      </div>

                      {/* Institution Body */}
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {/* Left column */}
                        <div className="space-y-3">
                          <div>
                            <Label>Address</Label>
                            <div><Value>{inst.address}</Value></div>
                          </div>
                          <div>
                            <Label>Website</Label>
                            <div>
                              {inst.website ? (
                                <a href={inst.website} target="_blank" rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline break-all">{inst.website}</a>
                              ) : <Value>{""}</Value>}
                            </div>
                          </div>
                          <div>
                            <Label>Emails</Label>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              {inst.emails.length > 0 ? inst.emails.map((e) => (
                                <span key={e} className={`px-2 py-0.5 text-xs rounded font-mono ${e === email ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300" : "bg-gray-100 text-gray-700"}`}>
                                  {e}
                                </span>
                              )) : <Value>{""}</Value>}
                            </div>
                          </div>
                          <div>
                            <Label>Phones</Label>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              {inst.phones.length > 0 ? inst.phones.map((p, i) => (
                                <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded font-mono">{p}</span>
                              )) : <Value>{""}</Value>}
                            </div>
                          </div>
                          <div>
                            <Label>Contacts</Label>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              {inst.contacts.length > 0 ? inst.contacts.map((c, i) => (
                                <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">{c}</span>
                              )) : <Value>{""}</Value>}
                            </div>
                          </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-3">
                          <div>
                            <Label>Location</Label>
                            <div className="text-sm text-gray-900">
                              {[
                                inst.area ? `${inst.area.area}, ${inst.area.city}` : null,
                                inst.district?.name,
                                inst.state?.name,
                              ].filter(Boolean).join(" > ")}
                            </div>
                            {inst.area?.pincode && (
                              <div className="text-xs text-gray-400 mt-0.5">PIN: {inst.area.pincode}</div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Created</Label>
                              <div><Value>{formatDate(inst.createdAt)}</Value></div>
                            </div>
                            <div>
                              <Label>Updated</Label>
                              <div><Value>{formatDate(inst.updatedAt)}</Value></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          

            {/* MailerLite Contact Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                MailerLite Contact
                {!data.mailerLiteContact && <span className="text-xs font-normal text-gray-400">(not found)</span>}
              </h2>

              {data.mailerLiteContact ? (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  {/* MailerLite Header */}
                  <div className="bg-green-50 border-b px-5 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{data.mailerLiteContact.institutionName}</h3>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {data.mailerLiteContact._id}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge color={data.mailerLiteContact.status === "added" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                        {data.mailerLiteContact.status}
                      </Badge>
                      <Badge color="bg-blue-100 text-blue-700">
                        {formatType(data.mailerLiteContact.institutionType)}
                      </Badge>
                    </div>
                  </div>

                  {/* MailerLite Body */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    {/* Left column — Contact Info */}
                    <div className="space-y-3">
                      <div>
                        <Label>Email</Label>
                        <div className="flex items-center gap-2">
                          <Value mono>{data.mailerLiteContact.email}</Value>
                          {data.mailerLiteContact.emailValid ? (
                            <Badge color="bg-green-100 text-green-600">Valid</Badge>
                          ) : (
                            <Badge color="bg-red-100 text-red-600">Invalid</Badge>
                          )}
                          {data.mailerLiteContact.isGenericEmail && (
                            <Badge color="bg-orange-100 text-orange-600">Generic</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <div className="flex items-center gap-2">
                          <Value mono>{data.mailerLiteContact.phone}</Value>
                          {data.mailerLiteContact.phone && (
                            data.mailerLiteContact.phoneValid
                              ? <Badge color="bg-green-100 text-green-600">Valid</Badge>
                              : <Badge color="bg-red-100 text-red-600">Invalid</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>Contact Name</Label>
                        <div><Value>{data.mailerLiteContact.contactName}</Value></div>
                      </div>
                      <div>
                        <Label>Designation</Label>
                        <div><Value>{data.mailerLiteContact.designation}</Value></div>
                      </div>
                      <div>
                        <Label>Website</Label>
                        <div>
                          {data.mailerLiteContact.website ? (
                            <a href={data.mailerLiteContact.website} target="_blank" rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all">{data.mailerLiteContact.website}</a>
                          ) : <Value>{""}</Value>}
                        </div>
                      </div>
                    </div>

                    {/* Right column — Location & Meta */}
                    <div className="space-y-3">
                      <div>
                        <Label>Address</Label>
                        <div><Value>{data.mailerLiteContact.address}</Value></div>
                      </div>
                      <div>
                        <Label>Location</Label>
                        <div className="text-sm text-gray-900">
                          {[
                            data.mailerLiteContact.areaName,
                            data.mailerLiteContact.districtName,
                            data.mailerLiteContact.stateName,
                          ].filter(Boolean).join(" > ")}
                        </div>
                        {data.mailerLiteContact.pincode && (
                          <div className="text-xs text-gray-400 mt-0.5">PIN: {data.mailerLiteContact.pincode}</div>
                        )}
                      </div>
                      <div>
                        <Label>Institution Ref</Label>
                        <div><Value mono>{data.mailerLiteContact.institution}</Value></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Sync Status</Label>
                          <div>
                            <Badge color={data.mailerLiteContact.status === "added" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                              {data.mailerLiteContact.status}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <Label>Synced At</Label>
                          <div><Value>{data.mailerLiteContact.syncedAt ? formatDate(data.mailerLiteContact.syncedAt) : ""}</Value></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Created</Label>
                          <div><Value>{formatDate(data.mailerLiteContact.createdAt)}</Value></div>
                        </div>
                        <div>
                          <Label>Updated</Label>
                          <div><Value>{formatDate(data.mailerLiteContact.updatedAt)}</Value></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed rounded-xl p-6 text-center text-gray-400 text-sm">
                  No MailerLite contact exists for this email.
                </div>
              )}
            </div>

            {/* Comparison Summary */}
            {data.institutions.length > 0 && data.mailerLiteContact && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                  Comparison
                </h2>
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-5 py-3">Field</th>
                        <th className="px-5 py-3">Institution (Raw)</th>
                        <th className="px-5 py-3">MailerLite (Cleaned)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(() => {
                        const inst = data.institutions[0];
                        const ml = data.mailerLiteContact;
                        const rows = [
                          { field: "Name", raw: inst.name, cleaned: ml.institutionName },
                          { field: "Email", raw: inst.emails.join(", "), cleaned: ml.email },
                          { field: "Phone", raw: inst.phones.join(", "), cleaned: ml.phone },
                          { field: "Contact", raw: inst.contacts.join(", "), cleaned: `${ml.contactName}${ml.designation ? ` (${ml.designation})` : ""}` },
                          { field: "Website", raw: inst.website, cleaned: ml.website },
                          { field: "Address", raw: inst.address, cleaned: ml.address },
                          { field: "Type", raw: inst.types.map(formatType).join(", "), cleaned: formatType(ml.institutionType) },
                          {
                            field: "Location",
                            raw: [inst.area ? `${inst.area.area}, ${inst.area.city}` : "", inst.district?.name, inst.state?.name].filter(Boolean).join(" > "),
                            cleaned: [ml.areaName, ml.districtName, ml.stateName].filter(Boolean).join(" > "),
                          },
                        ];
                        return rows.map((r) => (
                          <tr key={r.field} className="hover:bg-gray-50">
                            <td className="px-5 py-2.5 font-medium text-gray-700">{r.field}</td>
                            <td className="px-5 py-2.5 text-gray-600 font-mono text-xs break-all">{r.raw || <span className="text-gray-300">--</span>}</td>
                            <td className="px-5 py-2.5 text-gray-900 font-mono text-xs break-all">{r.cleaned || <span className="text-gray-300">--</span>}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </ProtectedRoute>
  );
}
