import api from "@/lib/axios";
import type { AuthResponse, SignupDTO, LoginDTO, User } from "@/types";

export const authService = {
  async signup(data: SignupDTO): Promise<AuthResponse> {
    const { data: res } = await api.post("/auth/signup", data);
    return res.data;
  },

  async login(data: LoginDTO): Promise<AuthResponse> {
    const { data: res } = await api.post("/auth/login", data);
    return res.data;
  },

  async getMe(): Promise<User> {
    const { data: res } = await api.get("/auth/me");
    return res.data;
  },
};
