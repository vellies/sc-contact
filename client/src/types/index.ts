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

// Auth types
export interface User {
  _id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SignupDTO {
  name: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

// Location types
export interface StateType {
  _id: string;
  code: string;
  name: string;
  type: "State" | "UT";
  districts?: DistrictType[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStateDTO {
  code: string;
  name: string;
  type: "State" | "UT";
}

export interface DistrictType {
  _id: string;
  name: string;
  state: { _id: string; name: string; code: string } | string;
  areas?: AreaType[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDistrictDTO {
  name: string;
  state: string;
}

export interface AreaType {
  _id: string;
  pincode: string;
  area: string;
  city: string;
  district: { _id: string; name: string } | string;
  state: { _id: string; name: string; code: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAreaDTO {
  pincode: string;
  area: string;
  city: string;
  district: string;
}
