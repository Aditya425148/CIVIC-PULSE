import { ID, OAuthProvider } from "appwrite";
import { account } from "./appwrite";
import { api } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComplaintStatus =
  | "Submitted"
  | "Assigned"
  | "In Progress"
  | "Resolved"
  | "Closed"
  | "Escalated";

export interface UserData {
  $id: string;
  name: string;
  email: string;
  prefs?: any;
}

// ── Auth (remains Appwrite client-side) ───────────────────────────────────────

export const authService = {
  async getCurrentUser() {
    try {
      return await account.get();
    } catch {
      return null;
    }
  },

  async logout() {
    try {
      await account.deleteSessions();
    } catch {
      try {
        await account.deleteSession("current");
      } catch {}
    }
  },

  async loginWithEmail(email: string, pass: string) {
    await this.logout();
    return await account.createEmailPasswordSession(email, pass);
  },

  async signupWithEmail(email: string, pass: string, name?: string) {
    await account.create(ID.unique(), email, pass, name || email.split("@")[0]);
    return await this.loginWithEmail(email, pass);
  },

  async loginWithGoogle() {
    await this.logout();
    return account.createOAuth2Token(
      OAuthProvider.Google,
      window.location.origin + "/auth/callback",
      window.location.origin + "/login",
    );
  },

  async createSessionFromToken(userId: string, secret: string) {
    return await account.createSession(userId, secret);
  },

  async loginAnonymous() {
    await this.logout();
    return await account.createAnonymousSession();
  },
};

// ── Complaint Service (calls FastAPI backend) ──────────────────────────────────

export const appwriteService = {
  async createComplaint(complaintData: Record<string, any>): Promise<any> {
    const result = await api.post<any>(
      "/api/complaints",
      complaintData,
    );
    return result;
  },

  async getAllComplaints(
    lat?: number,
    lng?: number,
    radius?: number,
  ): Promise<any[]> {
    let url = "/api/complaints";
    const params = new URLSearchParams();
    if (lat !== undefined) params.append("lat", lat.toString());
    if (lng !== undefined) params.append("lng", lng.toString());
    if (radius !== undefined) params.append("radius", radius.toString());

    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    return api.get<any[]>(url);
  },

  subscribeToComplaints(
    callback: (complaints: any[]) => void,
    lat?: number,
    lng?: number,
    radius?: number,
  ) {
    // Initial fetch
    this.getAllComplaints(lat, lng, radius)
      .then(callback)
      .catch(() => callback([]));
    // Poll every 60s (Increased from 15s to save resources)
    const interval = setInterval(() => {
      this.getAllComplaints(lat, lng, radius)
        .then(callback)
        .catch(() => callback([]));
    }, 60_000);
    return () => clearInterval(interval);
  },

  subscribeToUserComplaints(
    userId: string,
    callback: (complaints: any[]) => void,
  ) {
    this.getComplaintsByUser(userId)
      .then(callback)
      .catch(() => callback([]));
    const interval = setInterval(() => {
      this.getComplaintsByUser(userId)
        .then(callback)
        .catch(() => callback([]));
    }, 60_000);
    return () => clearInterval(interval);
  },

  async getComplaintById(id: string): Promise<any> {
    return api.get<any>(`/api/complaints/${id}`);
  },

  async updateComplaintStatus(
    id: string,
    status: ComplaintStatus,
    note: string,
    actor: string,
    photoUrl?: string,
  ): Promise<void> {
    const payload: any = { status, note, actor };
    if (photoUrl) payload.photoUrl = photoUrl;
    await api.patch(`/api/complaints/${id}/status`, payload);
  },

  async updateComplaintShareCard(id: string, photoUrl: string): Promise<any> {
    return api.patch<any>(`/api/complaints/${id}/share-card`, { photoUrl });
  },

  async updateUserReputation(userId: string, points: number): Promise<void> {
    // This updates the user's reputation points in Appwrite Preferences
    const user = await account.get();
    const currentPrefs = user.prefs || {};
    const newPoints = (currentPrefs.reputation || 0) + points;
    await account.updatePrefs({ ...currentPrefs, reputation: newPoints });
  },

  async getComplaintsByUser(userId: string): Promise<any[]> {
    return api.get<any[]>(`/api/complaints/user/${userId}`);
  },

  async getWardStatistics(): Promise<any[]> {
    return api.get<any[]>("/api/stats/wards");
  },

  async getLeaderboard(
    tab: "National" | "District" | "Local" = "National",
  ): Promise<any[]> {
    return api.get<any[]>(`/api/leaderboard?tab=${tab}`);
  },

  async getLeaderboardSummary(): Promise<{
    totalResolved: number;
    activeCitizens: number;
  }> {
    return api.get("/api/leaderboard/summary");
  },

  async getAllUsers(): Promise<any[]> {
    return api.get<any[]>("/api/users");
  },

  async uploadPhoto(file: File): Promise<string> {
    const ALLOWED = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];
    if (!ALLOWED.includes(file.type)) {
      throw new Error("Unsupported file type.");
    }
    const maxSize = file.type.startsWith("image/")
      ? 10 * 1024 * 1024
      : 60 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("File too large.");
    }
    const result = await api.upload<{ url: string }>("/api/uploads", file);
    return result.url;
  },

  async deletePhoto(fileId: string): Promise<void> {
    const id = fileId.includes("/")
      ? fileId.split("/files/")[1]?.split("/")[0] || fileId
      : fileId;
    await api.delete(`/api/uploads/${id}`);
  },
};
