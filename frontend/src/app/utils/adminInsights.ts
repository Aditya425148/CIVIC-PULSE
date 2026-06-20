/**
 * adminInsights.ts
 * Shared Delhi zone configuration & admin utilities.
 * Manager data is fetched from the backend API — no hardcoded list.
 */
import { api } from "../api";

export type DelhiZoneId =
  | "south"
  | "central_new"
  | "east_shahdara"
  | "west"
  | "north_nw";

export type ZoneStats = {
  id: DelhiZoneId;
  name: string;
  localities: string[];
  target: string;
  total: number;
  pending: number;
  resolved: number;
  escalated: number;
};

export type AdminManager = {
  id: string;
  name: string;
  state: string;
  zone: string;
  email?: string;
};

// ── Delhi geographic bounds ───────────────────────────────────────────────────
export const DELHI_BOUNDS = {
  minLat: 28.39,
  maxLat: 28.89,
  minLng: 76.84,
  maxLng: 77.35,
};

// ── Zone config (single source of truth for frontend) ────────────────────────
export const DELHI_ZONE_CONFIG: Array<{
  id: DelhiZoneId;
  name: string;
  localities: string[];
  target: string;
  keywords: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  labelX: number;
  labelY: number;
}> = [
  {
    id: "south",
    name: "South Delhi",
    localities: ["Saket", "GK", "Hauz Khas", "Vasant Vihar"],
    target: "High-income households, expats, luxury consumers",
    keywords: [
      "south delhi", "saket", "gk", "greater kailash", "hauz khas",
      "vasant vihar", "malviya nagar", "defence colony",
    ],
    x: 10, y: 58, w: 38, h: 30, labelX: 12, labelY: 90,
  },
  {
    id: "central_new",
    name: "Central & New Delhi",
    localities: ["Connaught Place", "Karol Bagh", "Daryaganj", "Civil Lines"],
    target: "Corporates, high-street shoppers, tourists, government employees",
    keywords: [
      "central delhi", "new delhi", "connaught place", "cp",
      "karol bagh", "daryaganj", "civil lines", "paharganj",
    ],
    x: 30, y: 38, w: 32, h: 20, labelX: 35, labelY: 31,
  },
  {
    id: "east_shahdara",
    name: "East Delhi & Shahdara",
    localities: ["Laxmi Nagar", "Preet Vihar", "Mayur Vihar", "Gandhi Nagar"],
    target: "Young professionals, students, mid-income families",
    keywords: [
      "east delhi", "shahdara", "laxmi nagar", "preet vihar",
      "mayur vihar", "gandhi nagar", "anand vihar", "vivek vihar",
    ],
    x: 62, y: 42, w: 28, h: 34, labelX: 74, labelY: 80,
  },
  {
    id: "west",
    name: "West Delhi",
    localities: ["Rajouri Garden", "Punjabi Bagh", "Janakpuri", "Patel Nagar"],
    target: "Retail consumers, residential communities, family businesses",
    keywords: [
      "west delhi", "rajouri garden", "punjabi bagh", "janakpuri",
      "patel nagar", "tilak nagar", "vikaspuri", "dwarka",
    ],
    x: 8, y: 28, w: 28, h: 30, labelX: 7, labelY: 22,
  },
  {
    id: "north_nw",
    name: "North & North-West Delhi",
    localities: ["Rohini", "Model Town", "Delhi University Campus", "Narela"],
    target: "Students, tech-enabled youth, industrial professionals",
    keywords: [
      "north delhi", "north west delhi", "north-west delhi",
      "rohini", "model town", "narela", "delhi university",
      "du campus", "burari", "pitampura", "azadpur", "timarpur",
      "shalimar bagh", "ashok vihar",
    ],
    x: 26, y: 8, w: 42, h: 28, labelX: 66, labelY: 9,
  },
];

export const DEFAULT_ZONE =
  DELHI_ZONE_CONFIG.find((zone) => zone.id === "central_new") ||
  DELHI_ZONE_CONFIG[0];

// ── Fetch real managers from backend ─────────────────────────────────────────
let _managersCache: AdminManager[] | null = null;
let _managersCacheTs = 0;
const MANAGERS_TTL = 5 * 60 * 1000; // 5 min

export async function fetchManagers(): Promise<AdminManager[]> {
  const now = Date.now();
  if (_managersCache && now - _managersCacheTs < MANAGERS_TTL) {
    return _managersCache;
  }
  try {
    const data = await api.get<AdminManager[]>("/api/complaints/managers");
    _managersCache = data;
    _managersCacheTs = now;
    return data;
  } catch {
    return _managersCache ?? [];
  }
}

export function invalidateManagersCache() {
  _managersCache = null;
}

// ── Complaint classification helpers ─────────────────────────────────────────
export function isDelhiComplaint(complaint: any): boolean {
  const searchable = [
    complaint?.state,
    complaint?.address,
    complaint?.area,
    complaint?.ward,
    complaint?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    searchable.includes("delhi") ||
    searchable.includes("new delhi") ||
    searchable.includes("nct")
  ) {
    return true;
  }

  const coords = complaint?.coordinates;
  if (coords && typeof coords === "object") {
    const lat = Number(coords.lat ?? coords.latitude);
    const lng = Number(coords.lng ?? coords.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return (
        lat >= DELHI_BOUNDS.minLat &&
        lat <= DELHI_BOUNDS.maxLat &&
        lng >= DELHI_BOUNDS.minLng &&
        lng <= DELHI_BOUNDS.maxLng
      );
    }
  }

  return false;
}

export function inferDelhiZone(complaint: any): DelhiZoneId {
  const searchable = [
    complaint?.area,
    complaint?.ward,
    complaint?.address,
    complaint?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const zone of DELHI_ZONE_CONFIG) {
    if (zone.keywords.some((keyword) => searchable.includes(keyword))) {
      return zone.id;
    }
  }

  const coords = complaint?.coordinates;
  if (coords && typeof coords === "object") {
    const lat = Number(coords.lat ?? coords.latitude);
    const lng = Number(coords.lng ?? coords.longitude);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      if (lat >= 28.7) return "north_nw";
      if (lat <= 28.56) return "south";
      if (lng >= 77.28) return "east_shahdara";
      if (lng <= 77.08) return "west";
    }
  }

  return DEFAULT_ZONE.id;
}

export function normalizeComplaintCategory(category: string | undefined) {
  return category?.trim() || "Other";
}
