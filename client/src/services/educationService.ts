import api from "@/lib/axios";

export interface EducationInstitution {
  name: string;
  address: string;
  phones: string[];
  emails: string[];
  contacts: string[];
  website: string;
  types: string[];
}

export interface SavedInstitution extends EducationInstitution {
  _id: string;
  area: { _id: string; pincode: string; area: string; city: string };
  district: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

export interface EducationSearchResult {
  count: number;
  data: EducationInstitution[];
}

export interface AreaSearchResult extends EducationSearchResult {
  query: {
    pincode: string;
    area: string;
    city: string;
    district?: string;
    state?: string;
  };
}

export interface DistrictSummaryItem {
  _id: string;
  count: number;
  schools: number;
  colleges: number;
  pincode: string;
  area: string;
  city: string;
}

export const educationService = {
  // ========== SEARCH (Google Places) ==========
  async search(params: {
    pincode: string;
    area: string;
    city?: string;
  }): Promise<EducationSearchResult> {
    const { data } = await api.post("/education/search", params);
    return data;
  },

  async searchByArea(areaId: string): Promise<AreaSearchResult> {
    const { data } = await api.post("/education/search-by-area", { areaId });
    return data;
  },

  async searchByDistrict(districtId: string, limit?: number) {
    const { data } = await api.post("/education/search-by-district", {
      districtId,
      limit,
    });
    return data;
  },

  // ========== SAVE TO DB ==========
  async saveInstitutions(
    areaId: string,
    institutions: EducationInstitution[]
  ): Promise<{ savedCount: number; skippedCount: number }> {
    const { data } = await api.post("/education/save", {
      areaId,
      institutions,
    });
    return data;
  },

  // ========== GET FROM DB ==========
  async getByArea(
    areaId: string,
    search?: string,
    type?: string
  ): Promise<{ count: number; data: SavedInstitution[] }> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (type) params.type = type;
    const { data } = await api.get(`/education/area/${areaId}`, { params });
    return data;
  },

  async getByDistrict(
    districtId: string,
    search?: string,
    type?: string
  ): Promise<{ count: number; data: SavedInstitution[] }> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (type) params.type = type;
    const { data } = await api.get(`/education/district/${districtId}`, {
      params,
    });
    return data;
  },

  async getDistrictSummary(
    districtId: string
  ): Promise<{
    totalCount: number;
    areasWithData: number;
    data: DistrictSummaryItem[];
  }> {
    const { data } = await api.get(
      `/education/district/${districtId}/summary`
    );
    return data;
  },

  // ========== CRUD ==========
  async updateInstitution(
    id: string,
    updates: Partial<EducationInstitution>
  ): Promise<SavedInstitution> {
    const { data } = await api.put(`/education/${id}`, updates);
    return data.data;
  },

  async deleteInstitution(id: string): Promise<void> {
    await api.delete(`/education/${id}`);
  },

  async deleteAllByArea(areaId: string): Promise<{ deletedCount: number }> {
    const { data } = await api.delete(`/education/area/${areaId}/all`);
    return data;
  },

  // ========== SCRAPER ==========
  async scrapeInstitution(id: string): Promise<{
    scraped: boolean;
    message: string;
    newContacts: string[];
    newEmails: string[];
    data: SavedInstitution;
  }> {
    const { data } = await api.post(`/education/${id}/scrape`);
    return data;
  },

  async scrapeAllByArea(areaId: string): Promise<{
    message: string;
    total: number;
    successCount: number;
    failCount: number;
    totalNewContacts: number;
    totalNewEmails: number;
  }> {
    const { data } = await api.post(`/education/area/${areaId}/scrape-all`);
    return data;
  },
};
