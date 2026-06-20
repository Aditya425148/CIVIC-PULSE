/**
 * Shared TypeScript type definitions for CivicPulse.
 * All mock/fake data has been removed. Data is fetched from the backend API.
 */

export type ComplaintStatus =
  | "Submitted"
  | "Assigned"
  | "In Progress"
  | "Pending Review"
  | "Resolved"
  | "Closed"
  | "Escalated"
  | "Rejected";

export type ComplaintCategory =
  | "Garbage"
  | "Streetlight"
  | "Pothole"
  | "Water"
  | "Sanitation"
  | "Construction"
  | "Safety"
  | "Other";

export interface TimelineEvent {
  status: ComplaintStatus;
  timestamp: string;
  note: string;
  actor: string;
}

export interface Complaint {
  id: string;
  category: ComplaintCategory;
  subcategory: string;
  description: string;
  status: ComplaintStatus;
  priorityScore: number;
  address: string;
  area?: string;
  ward?: string;
  state?: string;
  lat?: number;
  lng?: number;
  coordinates?: { lat: number; lng: number };
  slaDeadline?: string;
  slaHours: number;
  slaRemainingHours: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  reporterName: string;
  reporterTier?: number;
  reporterId?: string;
  reporterPhone?: string;
  assignedTo?: string;
  assignedManagerId?: string;
  assignedManagerName?: string;
  imageUrl?: string;
  photoUrl?: string;
  photos?: string[];
  aiConfidence?: number;
  isDuplicate?: boolean;
  escalated?: boolean;
  timeline: TimelineEvent[];
  verifiedBy?: string[];
}

export interface Manager {
  id: string;
  name: string;
  email?: string;
  state: string;
  zone?: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  state: string;
  area: string;
  status: "Available" | "Busy" | "Offline";
  rating?: number;
}

export interface Officer {
  id: string;
  name: string;
  avatar: string;
  activeComplaints: number;
  resolvedThisWeek: number;
  area: string;
  status: "Available" | "On Site" | "Off Duty";
}

export interface AreaStats {
  area: string;
  totalComplaints: number;
  resolved?: number;
  resolvedComplaints?: number;
  activeComplaints?: number;
  inProgress?: number;
  pending?: number;
  civicHealthScore?: number;
  avgResolutionHours?: number;
  avgResolveTime?: number;
  resolutionRate?: number;
  rank?: number;
}

/** Category → hex color for charts */
export const CATEGORY_COLORS: Record<string, string> = {
  Pothole: "#EF4444",
  Garbage: "#F59E0B",
  Streetlight: "#3B82F6",
  Water: "#06B6D4",
  Sanitation: "#8B5CF6",
  Safety: "#EC4899",
  Construction: "#10B981",
  Other: "#6B7280",
};

/** SLA hours per category (must match backend config.py SLA_HOURS) */
export const SLA_HOURS: Record<string, number> = {
  Safety: 12,
  Water: 24,
  Garbage: 48,
  Sanitation: 48,
  Streetlight: 72,
  Pothole: 96,
  Construction: 120,
  Other: 72,
};

/** All valid complaint categories */
export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  "Garbage",
  "Streetlight",
  "Pothole",
  "Water",
  "Sanitation",
  "Construction",
  "Safety",
  "Other",
];
