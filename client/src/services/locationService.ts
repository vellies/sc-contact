import api from "@/lib/axios";
import type {
  StateType,
  CreateStateDTO,
  DistrictType,
  CreateDistrictDTO,
  AreaType,
  CreateAreaDTO,
} from "@/types";

export const locationService = {
  // ========== STATES ==========
  async getStates(search?: string): Promise<StateType[]> {
    const params = search ? { search } : {};
    const { data } = await api.get("/locations/states", { params });
    return data.data;
  },

  async getState(id: string): Promise<StateType> {
    const { data } = await api.get(`/locations/states/${id}`);
    return data.data;
  },

  async createState(dto: CreateStateDTO): Promise<StateType> {
    const { data } = await api.post("/locations/states", dto);
    return data.data;
  },

  async updateState(id: string, dto: Partial<CreateStateDTO>): Promise<StateType> {
    const { data } = await api.put(`/locations/states/${id}`, dto);
    return data.data;
  },

  async deleteState(id: string): Promise<void> {
    await api.delete(`/locations/states/${id}`);
  },

  // ========== DISTRICTS ==========
  async getDistricts(stateId: string, search?: string): Promise<DistrictType[]> {
    const params = search ? { search } : {};
    const { data } = await api.get(`/locations/states/${stateId}/districts`, { params });
    return data.data;
  },

  async getDistrict(id: string): Promise<DistrictType> {
    const { data } = await api.get(`/locations/districts/${id}`);
    return data.data;
  },

  async createDistrict(dto: CreateDistrictDTO): Promise<DistrictType> {
    const { data } = await api.post("/locations/districts", dto);
    return data.data;
  },

  async updateDistrict(id: string, dto: Partial<CreateDistrictDTO>): Promise<DistrictType> {
    const { data } = await api.put(`/locations/districts/${id}`, dto);
    return data.data;
  },

  async deleteDistrict(id: string): Promise<void> {
    await api.delete(`/locations/districts/${id}`);
  },

  // ========== AREAS ==========
  async getAreas(districtId: string, search?: string): Promise<AreaType[]> {
    const params = search ? { search } : {};
    const { data } = await api.get(`/locations/districts/${districtId}/areas`, { params });
    return data.data;
  },

  async createArea(dto: CreateAreaDTO): Promise<AreaType> {
    const { data } = await api.post("/locations/areas", dto);
    return data.data;
  },

  async updateArea(id: string, dto: Partial<CreateAreaDTO>): Promise<AreaType> {
    const { data } = await api.put(`/locations/areas/${id}`, dto);
    return data.data;
  },

  async deleteArea(id: string): Promise<void> {
    await api.delete(`/locations/areas/${id}`);
  },

  async getDistrictAreaCount(districtId: string): Promise<number> {
    const { data } = await api.get(`/locations/districts/${districtId}/area-count`);
    return data.data.count;
  },

  async autoGeneratePreview(districtId: string): Promise<{
    districtName: string;
    existingCount: number;
    availableCount: number;
    canGenerate: boolean;
  }> {
    const { data } = await api.get(`/locations/districts/${districtId}/auto-generate-preview`);
    return data.data;
  },

  async autoGenerateAreas(districtId: string): Promise<{ count: number }> {
    const { data } = await api.post(`/locations/districts/${districtId}/auto-generate-areas`);
    return { count: data.count };
  },
};
