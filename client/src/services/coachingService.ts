import api from "@/lib/axios";

export interface CoachingInstitute {
  name: string;
  address: string;
  phones: string[];
  emails: string[];
  contacts: string[];
  website: string;
  types: string[];
}

export interface SavedCoachingInstitute extends CoachingInstitute {
  _id: string;
  area: { _id: string; pincode: string; area: string; city: string };
  district: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachingSearchResult {
  count: number;
  data: CoachingInstitute[];
}

export interface CoachingAreaSearchResult extends CoachingSearchResult {
  query: {
    pincode: string;
    area: string;
    city: string;
    district?: string;
    state?: string;
  };
}

export interface CoachingDistrictSummaryItem {
  _id: string;
  count: number;
  coaching: number;
  test_prep: number;
  pincode: string;
  area: string;
  city: string;
}

export interface PaginatedCoachingResult {
  count: number;
  totalCount: number;
  page: number;
  totalPages: number;
  limit: number;
  data: SavedCoachingInstitute[];
}

export const coachingService = {
  // ========== GET ALL (Paginated) ==========
  async getAll(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      type?: string;
      state?: string;
      district?: string;
      area?: string;
      sort?: string;
      order?: string;
      hasPhone?: boolean;
      hasEmail?: boolean;
      hasContact?: boolean;
      hasWebsite?: boolean;
    } = {}
  ): Promise<PaginatedCoachingResult> {
    const query: Record<string, string> = {};
    if (params.page) query.page = String(params.page);
    if (params.limit) query.limit = String(params.limit);
    if (params.search) query.search = params.search;
    if (params.type) query.type = params.type;
    if (params.state) query.state = params.state;
    if (params.district) query.district = params.district;
    if (params.area) query.area = params.area;
    if (params.sort) query.sort = params.sort;
    if (params.order) query.order = params.order;
    if (params.hasPhone !== undefined) query.hasPhone = String(params.hasPhone);
    if (params.hasEmail !== undefined) query.hasEmail = String(params.hasEmail);
    if (params.hasContact !== undefined) query.hasContact = String(params.hasContact);
    if (params.hasWebsite !== undefined) query.hasWebsite = String(params.hasWebsite);
    const { data } = await api.get("/coaching/all", { params: query });
    return data;
  },

  // ========== SEARCH (Google Places) ==========
  async search(params: {
    pincode: string;
    area: string;
    city?: string;
  }): Promise<CoachingSearchResult> {
    const { data } = await api.post("/coaching/search", params);
    return data;
  },

  async searchByArea(areaId: string): Promise<CoachingAreaSearchResult> {
    const { data } = await api.post("/coaching/search-by-area", { areaId });
    return data;
  },

  async searchByDistrict(districtId: string, limit?: number) {
    const { data } = await api.post("/coaching/search-by-district", {
      districtId,
      limit,
    });
    return data;
  },

  // ========== SAVE TO DB ==========
  async saveInstitutes(
    areaId: string,
    institutes: CoachingInstitute[]
  ): Promise<{ savedCount: number; skippedCount: number }> {
    const { data } = await api.post("/coaching/save", { areaId, institutes });
    return data;
  },

  // ========== GET FROM DB ==========
  async getByArea(
    areaId: string,
    search?: string,
    type?: string
  ): Promise<{ count: number; data: SavedCoachingInstitute[] }> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (type) params.type = type;
    const { data } = await api.get(`/coaching/area/${areaId}`, { params });
    return data;
  },

  async getByDistrict(
    districtId: string,
    search?: string,
    type?: string
  ): Promise<{ count: number; data: SavedCoachingInstitute[] }> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (type) params.type = type;
    const { data } = await api.get(`/coaching/district/${districtId}`, { params });
    return data;
  },

  async getDistrictSummary(districtId: string): Promise<{
    totalCount: number;
    areasWithData: number;
    data: CoachingDistrictSummaryItem[];
  }> {
    const { data } = await api.get(`/coaching/district/${districtId}/summary`);
    return data;
  },

  // ========== CRUD ==========
  async updateInstitute(
    id: string,
    updates: Partial<CoachingInstitute>
  ): Promise<SavedCoachingInstitute> {
    const { data } = await api.put(`/coaching/${id}`, updates);
    return data.data;
  },

  async deleteInstitute(id: string): Promise<void> {
    await api.delete(`/coaching/${id}`);
  },

  async deleteAllByArea(areaId: string): Promise<{ deletedCount: number }> {
    const { data } = await api.delete(`/coaching/area/${areaId}/all`);
    return data;
  },

  async scrapeInstitute(id: string): Promise<{ found: { emails: number; phones: number }; data: SavedCoachingInstitute }> {
    const { data } = await api.post(`/coaching/${id}/scrape`);
    return data;
  },
};
