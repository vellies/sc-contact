import api from "@/lib/axios";
import type {
  MailerLiteContactsResponse,
  MailerLiteStats,
  MailerLiteGenerateResult,
} from "@/types";

interface ContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  institutionType?: string;
  state?: string;
  district?: string;
  area?: string;
  emailValid?: string;
  isGenericEmail?: string;
  sort?: string;
  order?: string;
}

export const mailerLiteService = {
  async getContacts(params: ContactsParams = {}): Promise<MailerLiteContactsResponse> {
    const res = await api.get("/mailerlite/contacts", { params });
    return res.data.data;
  },

  async getStats(): Promise<MailerLiteStats> {
    const res = await api.get("/mailerlite/stats");
    return res.data.data;
  },

  async generate(filter: { state?: string; district?: string; area?: string } = {}): Promise<MailerLiteGenerateResult> {
    const res = await api.post("/mailerlite/generate", filter);
    return res.data.data;
  },

  async syncOne(institutionId: string) {
    const res = await api.post(`/mailerlite/sync/${institutionId}`);
    return res.data.data;
  },

  async deleteContact(id: string) {
    const res = await api.delete(`/mailerlite/contacts/${id}`);
    return res.data;
  },

  async bulkUpdateStatus(ids: string[], status: string) {
    const res = await api.post("/mailerlite/bulk-update-status", { ids, status });
    return res.data;
  },

  async exportContacts(params: ContactsParams & {
    onlyValid?: string;
    excludeGeneric?: string;
  } = {}) {
    const res = await api.get("/mailerlite/export", { params });
    return res.data;
  },
};
