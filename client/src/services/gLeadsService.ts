import api from "@/lib/axios";
import type { GLeadsContactsResponse, GLeadsStats } from "@/types";

interface ContactsParams {
  page?:    number;
  limit?:   number;
  search?:  string;
  status?:  string;
  state?:   string;
  city?:    string;
  country?: string;
  title?:   string;
  sort?:    string;
  order?:   string;
}

export const gLeadsService = {
  async getContacts(params: ContactsParams = {}): Promise<GLeadsContactsResponse> {
    const res = await api.get("/gleads/contacts", { params });
    return res.data.data;
  },

  async getStats(): Promise<GLeadsStats> {
    const res = await api.get("/gleads/stats");
    return res.data.data;
  },

  async bulkUpdateStatus(ids: string[], status: string) {
    const res = await api.post("/gleads/bulk-update-status", { ids, status });
    return res.data;
  },

  async deleteContact(id: string) {
    const res = await api.delete(`/gleads/contacts/${id}`);
    return res.data;
  },

  async getByEmail(email: string) {
    const res = await api.get(`/gleads/contact/${encodeURIComponent(email)}`);
    return res.data.data;
  },

  async updateStatus(email: string, status: string) {
    const res = await api.patch(`/gleads/contact/${encodeURIComponent(email)}`, { status });
    return res.data.data;
  },

  async importContacts(records: Record<string, unknown>[]) {
    const res = await api.post("/gleads/import", { records });
    return res.data;
  },

  async exportContacts(params: ContactsParams & { page?: number; limit?: number } = {}) {
    const res = await api.get("/gleads/export", { params });
    return res.data;
  },
};
