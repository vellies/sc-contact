export interface Contact {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactDTO {
  name: string;
  email: string;
  phone?: string;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
