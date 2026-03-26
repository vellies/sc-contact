import api from "@/lib/axios";
import type { Contact, CreateContactDTO } from "@/types";

export const contactService = {
  async getAll(): Promise<Contact[]> {
    const { data } = await api.get("/contacts");
    return data.data;
  },

  async getById(id: string): Promise<Contact> {
    const { data } = await api.get(`/contacts/${id}`);
    return data.data;
  },

  async create(contact: CreateContactDTO): Promise<Contact> {
    const { data } = await api.post("/contacts", contact);
    return data.data;
  },

  async update(id: string, contact: Partial<CreateContactDTO>): Promise<Contact> {
    const { data } = await api.put(`/contacts/${id}`, contact);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/contacts/${id}`);
  },
};
