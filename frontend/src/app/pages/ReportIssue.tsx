import { useState, type ChangeEvent, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ImagePlus,
  LocateFixed,
  MapPin,
  Shield,
  Trash2,
  Wrench,
  Droplets,
  AlertTriangle,
  HardHat,
  Lightbulb,
  Plus,
  UserCheck,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { appwriteService } from "../appwriteService";
import { account } from "../appwrite";
import { fetchManagers, type AdminManager } from "../utils/adminInsights";

const categories = [
  { id: "Garbage", icon: Trash2, description: "Overflow, dumping, litter" },
  { id: "Streetlight", icon: Lightbulb, description: "Lights not working" },
  { id: "Pothole", icon: Wrench, description: "Road or footpath damage" },
  { id: "Water", icon: Droplets, description: "Burst pipe or low supply" },
  {
    id: "Sanitation",
    icon: AlertTriangle,
    description: "Drain, sewage, toilet issue",
  },
  {
    id: "Construction",
    icon: HardHat,
    description: "Illegal work or debris",
  },
  { id: "Safety", icon: Shield, description: "Hazards and risks" },
  { id: "Other", icon: MapPin, description: "Any other civic issue" },
];

const subcategories: Record<string, string[]> = {
  Pothole: ["Road", "Footpath", "Bridge", "Parking Area", "Other"],
  Garbage: ["Overflow", "Illegal Dumping", "Litter", "Dead Animal", "Other"],
  Streetlight: ["Main Road", "Residential Lane", "Underpass", "Park", "Other"],
  Water: [
    "Supply Failure",
    "Pipe Burst",
    "Contamination",
    "Low Pressure",
    "Other",
  ],
  Sanitation: [
    "Drainage Clog",
    "Sewage Overflow",
    "Public Toilet",
    "Manhole Issue",
    "Other",
  ],
  Construction: [
    "Illegal Building",
    "Road Damage",
    "Encroachment",
    "Debris",
    "Other",
  ],
  Safety: [
    "Exposed Wires",
    "Tree Fall Risk",
    "Broken Barrier",
    "Open Manhole",
    "Other",
  ],
  Other: ["Noise", "Animal Menace", "Illegal Parking", "General", "Other"],
};

type Step = 1 | 2 | 3 | 4;

// Manager preview is now derived from real managers fetched from the API using zone logic
function getManagerPreview(
  text: string,
  coords: { lat: number; lng: number } | null,
  managers: AdminManager[],
): AdminManager | null {
  if (managers.length === 0) return null;
  const lower = text.toLowerCase();

  let zoneId = "central_new"; // Default zone
  let foundByText = false;

  const delhiZones = [
    {
      id: "south",
      keywords: ["south delhi", "saket", "gk", "greater kailash", "hauz khas", "vasant vihar", "malviya nagar", "defence colony", "mehrauli", "chhatarpur", "qutub"]
    },
    {
      id: "central_new",
      keywords: ["central delhi", "new delhi", "connaught place", "cp", "karol bagh", "daryaganj", "civil lines", "paharganj", "india gate", "rajpath", "chandni chowk"]
    },
    {
      id: "east_shahdara",
      keywords: ["east delhi", "shahdara", "laxmi nagar", "preet vihar", "mayur vihar", "gandhi nagar", "anand vihar", "vivek vihar", "dilshad garden", "seelampur"]
    },
    {
      id: "west",
      keywords: ["west delhi", "rajouri garden", "punjabi bagh", "janakpuri", "patel nagar", "tilak nagar", "vikaspuri", "dwarka", "uttam nagar", "najafgarh"]
    },
    {
      id: "north_nw",
      keywords: ["north delhi", "north west delhi", "north-west delhi", "rohini", "model town", "narela", "delhi university", "du campus", "burari", "pitampura", "azadpur", "timarpur", "shalimar bagh", "ashok vihar"]
    }
  ];

  for (const zone of delhiZones) {
    if (zone.keywords.some((kw) => lower.includes(kw))) {
      zoneId = zone.id;
      foundByText = true;
      break;
    }
  }

  if (!foundByText && coords) {
    const lat = coords.lat;
    const lng = coords.lng;
    const rules = [
      { zone: "north_nw",      lat_min: 28.70, lat_max: null,  lng_min: null,  lng_max: null },
      { zone: "south",         lat_min: null,  lat_max: 28.56, lng_min: null,  lng_max: null },
      { zone: "east_shahdara", lat_min: null,  lat_max: null,  lng_min: 77.28, lng_max: null },
      { zone: "west",          lat_min: null,  lat_max: null,  lng_min: null,  lng_max: 77.08 }
    ];

    for (const rule of rules) {
      if (rule.lat_min !== null && lat < rule.lat_min) continue;
      if (rule.lat_max !== null && lat > rule.lat_max) continue;
      if (rule.lng_min !== null && lng < rule.lng_min) continue;
      if (rule.lng_max !== null && lng > rule.lng_max) continue;
      zoneId = rule.zone;
      break;
    }
  }

  // Find a Delhi manager matching the zone
  const zoneManager = managers.find((m) => m.zone === zoneId && m.state.toLowerCase().includes("delhi"));
  if (zoneManager) return zoneManager;

  // Fallback to any Delhi manager
  const delhiManager = managers.find((m) => m.state.toLowerCase().includes("delhi"));
  return delhiManager || managers[0];
}

export default function ReportIssue() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [locationDetected, setLocationDetected] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complaintId, setComplaintId] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [assignedManagerName, setAssignedManagerName] = useState("");
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Real managers fetched from backend
  const [managers, setManagers] = useState<AdminManager[]>([]);
  useEffect(() => {
    fetchManagers().then(setManagers).catch(() => {});
  }, []);

  // Live manager preview — recomputed whenever address/area text or coords change
  const managerPreview = useMemo(
    () => getManagerPreview(`${address} ${area}`, coords, managers),
    [address, area, coords, managers],
  );

  const steps = ["Details", "Location", "Photos", "Done"];
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  // Hidden Card Template for Image Generation — Renders as soon as we have enough data
  const ReportCardTemplate = () => (
    <div className="fixed -left-[2000px] top-0">
      <div
        ref={reportRef}
        className="w-[800px] bg-white p-12 rounded-[3rem] border-[12px] border-orange-100 shadow-2xl relative overflow-hidden"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-32 -mb-32" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-12 border-b border-slate-100 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-orange-500 rounded-[1.5rem] flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                  CivicPulse
                </h1>
                <p className="text-emerald-700 font-bold uppercase tracking-widest text-xs">
                  Official Issue Report
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Report ID
              </span>
              <p className="text-xl font-bold text-slate-900 leading-tight">
                #{complaintId || "PENDING"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-slate-50">
                {selectedCategory === "Garbage"
                  ? "🗑️"
                  : selectedCategory === "Streetlight"
                    ? "💡"
                    : selectedCategory === "Pothole"
                      ? "🔧"
                      : selectedCategory === "Water"
                        ? "💧"
                        : "📍"}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Issue Type
                </p>
                <p className="text-xl font-black text-slate-800">
                  {selectedCategory || "Other"}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-50">
                <MapPin className="w-8 h-8 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Status
                </p>
                <p className="text-xl font-black text-emerald-700">Submitted</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="p-8 bg-white border-2 border-slate-100 rounded-[2.5rem]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Report Description
              </p>
              <p className="text-2xl font-bold text-slate-900 leading-relaxed italic">
                "{description || "No description provided"}"
              </p>
            </div>

            <div className="flex items-start gap-5 p-6 border-l-4 border-orange-500 bg-orange-50/60 rounded-r-[2rem]">
              <MapPin className="w-8 h-8 text-orange-600 mt-1 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Full Location
                </p>
                <p className="text-xl font-bold text-slate-800">
                  {`${address}${area ? `, ${area}` : ""}${pincode ? ` - ${pincode}` : ""}` ||
                    "Location unavailable"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-bold text-slate-500">
                Validated on{" "}
                <span className="text-slate-900 font-black">
                  {new Date().toLocaleDateString()}
                </span>{" "}
                via CivicPulse Network
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                Scanned via Web App
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Geofence boundaries for Delhi NCT only
  const GEOFENCE_BOUNDS = {
    minLat: 28.39, // South boundary of Delhi
    maxLat: 28.89, // North boundary of Delhi
    minLng: 76.84, // West boundary of Delhi
    maxLng: 77.35, // East boundary of Delhi
  };

  const isLocationAllowed = (lat: number, lng: number): boolean => {
    const { minLat, maxLat, minLng, maxLng } = GEOFENCE_BOUNDS;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  };

  const getLocationErrorMessage = (_lat: number, _lng: number): string => {
    return "❌ This location is outside Delhi. Please select a location within Delhi NCT.";
  };

  // Initialize Leaflet map when map picker opens
  useEffect(() => {
    if (!showMapPicker) return;

    const initializeMap = () => {
      const mapEl = document.getElementById("map");
      if (!mapEl) return;

      const L = (window as any).L;
      const defaultLat = coords?.lat || 28.7041;
      const defaultLng = coords?.lng || 77.1025;
      const defaultZoom = coords ? 18 : 12;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Delhi NCT bounds — restrict map to Delhi only
      const delhiBounds = L.latLngBounds(
        [28.39, 76.84], // SW corner
        [28.89, 77.35], // NE corner
      );

      const map = L.map("map", {
        maxBounds: delhiBounds.pad(0.1), // small padding so edges aren't cut off
        maxBoundsViscosity: 1.0, // prevent panning outside Delhi
        minZoom: 10, // prevent zooming out too far
      }).setView([defaultLat, defaultLng], defaultZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (coords) {
        L.marker([coords.lat, coords.lng])
          .addTo(map)
          .bindPopup("Selected Location");
      }

      map.on("click", (e: any) => {
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        if (mapInstanceRef.current?.getLayers) {
          const layers = mapInstanceRef.current.getLayers();
          layers.forEach((layer: any) => {
            if (layer instanceof (window as any).L.Marker) {
              mapInstanceRef.current.removeLayer(layer);
            }
          });
        }
        L.marker([e.latlng.lat, e.latlng.lng])
          .addTo(map)
          .bindPopup("Selected Location");
      });

      mapInstanceRef.current = map;
    };

    // Load Leaflet CSS and JS if not already loaded
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }

    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.async = true;
      script.onload = () => {
        initializeMap();
      };
      document.body.appendChild(script);
    } else {
      initializeMap();
    }
  }, [showMapPicker, coords]);

  // Geocode typed location and determine manager based on actual coordinates
  useEffect(() => {
    const searchText = `${address}${area ? `, ${area}` : ""}`.trim();

    // Only geocode if we have meaningful text and NO coordinates yet (not from map/GPS)
    if (searchText.length < 5 || coords) return;

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&limit=1`,
        );
        const data = await response.json();

        if (data && data.length > 0) {
          const result = data[0];
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lng);

          // Get state from coordinates using backend's logic
          try {
            const stateResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            );
            const stateData = await stateResponse.json();

            if (stateData && stateData.address) {
              const addr = stateData.address;
              // Extract state/province from response
              const state =
                addr.state ||
                (addr.address.includes("Delhi")
                  ? "Delhi"
                  : addr.address.includes("Uttar Pradesh")
                    ? "Uttar Pradesh"
                    : "Unknown");

              // Show manager preview based on detected state/address
              const preview = getManagerPreview(`${address} ${area}`, { lat, lng }, managers);
              if (preview) {
                setAssignedManagerName(preview.name);
              }
            }
          } catch (error) {
            console.error("State detection failed:", error);
          }
        }
      } catch (error) {
        console.error("Geocoding failed:", error);
      }
    }, 800); // Debounce 800ms while typing

    return () => clearTimeout(timeoutId);
  }, [address, area, coords, managers]);

  // Auto-assign manager: prioritize coordinates-based detection, fall back to text preview
  useEffect(() => {
    if (coords) {
      if (managerPreview) {
        setAssignedManagerName(managerPreview.name);
      }
    } else if (managerPreview) {
      setAssignedManagerName(managerPreview.name);
    }
  }, [managerPreview, coords]);

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    if (uploadedPhotos.length + files.length > 5) {
      toast.error("You can only upload up to 5 photos in total.");
      event.target.value = "";
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const photoUrls: string[] = [];
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
      ];

      for (const file of Array.from(files)) {
        if (!allowedTypes.includes(file.type)) {
          toast.error(
            `Invalid file type: ${file.name}. Only images are allowed.`,
          );
          continue;
        }

        try {
          const photoUrl = await appwriteService.uploadPhoto(file);
          if (photoUrl) photoUrls.push(photoUrl);
        } catch (error: any) {
          toast.error(`Could not upload ${file.name}: ${error.message}`);
        }
      }

      if (photoUrls.length > 0) {
        setUploadedPhotos((prev) => [...prev, ...photoUrls]);
      }
    } catch (error: any) {
      toast.error(error.message || "Upload failed.");
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const handleManualGeocode = async (
    manualAddress: string,
    manualArea: string,
  ) => {
    if (!manualAddress && !manualArea) return;
    const fullSearch = `${manualAddress} ${manualArea}`.trim();
    if (fullSearch.length < 5) return;

    try {
      // Use Nominatim (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullSearch + ", Delhi, India")}&limit=1`,
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setCoords({ lat, lng });
      }
    } catch (error) {
      console.error("Manual geocoding failed:", error);
    }
  };

  const handleDetectLocation = () => {
    setIsDetectingLocation(true);

    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser.");
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Validate location is within allowed service area
        if (!isLocationAllowed(latitude, longitude)) {
          toast.error(getLocationErrorMessage(latitude, longitude));
          setIsDetectingLocation(false);
          return;
        }

        setCoords({ lat: latitude, lng: longitude });

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );
          const data = await response.json();

          if (data && data.address) {
            const addr = data.address;
            const locationName =
              addr.building ||
              addr.poi ||
              addr.road ||
              addr.residential ||
              data.name ||
              data.display_name.split(",")[0];

            setAddress(locationName);

            const areaName =
              addr.suburb ||
              addr.village ||
              addr.town ||
              addr.city ||
              addr.county;

            if (areaName) setArea(areaName);

            if (addr.postcode) setPincode(addr.postcode);
          } else {
            setAddress(
              `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            );
          }
        } catch (error) {
          console.error("Geocoding failed:", error);
          setAddress(
            `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          );
        }

        setLocationDetected(true);
        setIsDetectingLocation(false);
        toast.success("Location detected.");
      },
      (error) => {
        let errorMessage =
          "Could not detect location. Please enter it manually.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage =
            "Location access was denied. Please allow location permission.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Location detection timed out. Please try again.";
        }
        toast.error(errorMessage);
        setLocationDetected(false);
        setIsDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  // Handle when user selects a location from the map
  const handleMapLocationSelect = async (lat: number, lng: number) => {
    // Validate location is within allowed service area
    if (!isLocationAllowed(lat, lng)) {
      toast.error(getLocationErrorMessage(lat, lng));
      setCoords(null);
      return;
    }

    setCoords({ lat, lng });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        const locationName =
          addr.building ||
          addr.poi ||
          addr.road ||
          addr.residential ||
          data.name ||
          data.display_name.split(",")[0];

        setAddress(locationName);

        const areaName =
          addr.suburb || addr.village || addr.town || addr.city || addr.county;

        if (areaName) setArea(areaName);

        if (addr.postcode) setPincode(addr.postcode);
      } else {
        setAddress(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
      setAddress(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }

    setLocationDetected(true);
    setShowMapPicker(false);
    toast.success("Location selected from map.");
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a location to search.");
      return;
    }

    try {
      const searchTerm = `${searchQuery}`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=5&viewbox=76.84,28.39,77.35,28.89&bounded=1`,
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        // Validate location is within allowed bounds before proceeding
        if (!isLocationAllowed(lat, lng)) {
          toast.error(
            `"${result.display_name}" is outside our service area. Please search for a location in Delhi-NCR or Uttar Pradesh.`,
          );
          return;
        }

        // Found valid location - proceed with selection
        setSearchQuery("");
        handleMapLocationSelect(lat, lng);
        toast.success(`Found: ${result.display_name}`);
      } else {
        toast.error(
          "Location not found in our service area. Try searching for a specific address, landmark, or city (Delhi, Noida, Lucknow, etc.)",
        );
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error(
        "Search failed. Please try again or click on the map instead.",
      );
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const user = await account.get();

      // If no coordinates yet, geocode the typed location
      let finalCoords = coords;
      if (!finalCoords && address) {
        try {
          const searchText = `${address}${area ? `, ${area}` : ""}`;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&limit=1`,
          );
          const data = await response.json();
          if (data && data.length > 0) {
            finalCoords = {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lng),
            };
          }
        } catch (error) {
          console.error("Auto-geocoding failed:", error);
          // Continue without coords, backend will try
        }
      }

      // Validate the location (either from user selection or auto-geocoding)
      if (finalCoords && !isLocationAllowed(finalCoords.lat, finalCoords.lng)) {
        toast.error(
          `The location "${address || area}" is outside our service area. Please select a location within Delhi-NCR or Uttar Pradesh.`,
        );
        setIsSubmitting(false);
        return;
      }

      const payload = {
        category: "Other",
        subcategory: "",
        description: description.trim() || "No description provided",
        address: `${address}${area ? `, ${area}` : ""}${pincode ? ` - ${pincode}` : ""}`,
        coordinates: finalCoords
          ? { lat: finalCoords.lat, lng: finalCoords.lng }
          : null,
        photos: uploadedPhotos,
        ward: area || "General",
        reporterName: user.name || "Anonymous",
        reporterId: user.$id || "anon",
        // Only send frontend manager if NO coordinates available (backend has better geolocation from coords)
        assignedManagerName: finalCoords
          ? null
          : assignedManagerName || managerPreview?.name || null,
        assignedManagerState: finalCoords
          ? null
          : managerPreview?.state || null,
      };

      const result = await appwriteService.createComplaint(payload as any);
      // result may be a string (id) or object {id, assignedManager, category, subcategory}
      const newId = typeof result === "string" ? result : (result as any).id;
      const mgr =
        typeof result === "object"
          ? (result as any).assignedManager
          : assignedManagerName || managerPreview?.name || "";
      const cat = typeof result === "object" ? (result as any).category : null;
      const sub = typeof result === "object" ? (result as any).subcategory : null;
      setComplaintId(newId);
      setAssignedManagerName(mgr);
      if (cat) setSelectedCategory(cat);
      if (sub) setSelectedSubcategory(sub);
      setStep(4);
      toast.success("Complaint submitted successfully.");

      // Post-submission: Generate and upload the CivicPulse Report Card
      if (reportRef.current) {
        setIsGeneratingCard(true);
        try {
          // Wait for a small delay to ensure the card's ticket ID is rendered
          await new Promise((r) => setTimeout(r, 500));

          const dataUrl = await toPng(reportRef.current, {
            cacheBust: true,
            quality: 1,
            backgroundColor: "#fff",
          });

          // Convert dataUrl to File
          const blob = await fetch(dataUrl).then((r) => r.blob());
          const file = new File([blob], `report-${newId}.png`, {
            type: "image/png",
          });

          // Upload the generated card
          const reportPhotoUrl = await appwriteService.uploadPhoto(file);

          // Save generated share-card URL for Profile Gallery visibility.
          await appwriteService.updateComplaintStatus(
            newId,
            "Submitted",
            `Auto share card saved | SHARE_CARD_URL:${reportPhotoUrl}`,
            "System",
            reportPhotoUrl,
          );

          console.log("Report card generated and linked successfully");
        } catch (genError) {
          console.error("Failed to generate/upload report card:", genError);
        } finally {
          setIsGeneratingCard(false);
        }
      }
    } catch (error: any) {
      toast.error(`Submission failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ReportCardTemplate />
      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-blue-100 px-6 py-7 shadow-sm">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-sky-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </button>
        <div className="space-y-2">
          <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
            Report issue
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Report a civic issue
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            A short, guided form to report the problem clearly. The flow is
            simple: choose type, add location, describe it, and upload photos if
            needed.
          </p>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-5">
          {steps.map((label, index) => {
            const current = index + 1;
            const active = step === current;
            const complete = step > current;

            return (
              <div
                key={label}
                className={`rounded-2xl border px-4 py-3 text-sm transition-all duration-300 ${
                  active
                    ? "border-sky-300 bg-sky-200 text-sky-900 shadow-md"
                    : complete
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <div
                  className={`text-[10px] font-bold uppercase tracking-widest ${active ? "text-sky-800" : "text-slate-400"}`}
                >
                  Step {current}
                </div>
                <div className="mt-0.5 font-bold tracking-tight">{label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {step === 1 && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Describe the issue
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Keep it short and practical. Mention what is happening and why it
            matters.
          </p>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value.slice(0, 500))
            }
            rows={4}
            className="mt-6 w-full rounded-3xl border border-slate-200 px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
            placeholder="Example: There is a large pothole near the main gate of the school. It is causing traffic and is dangerous for bikes."
          />

          <div className="mt-2 text-right text-xs text-slate-400">
            {description.length} / 500
          </div>

          <div className="mt-6 rounded-2xl bg-sky-50 p-4 text-sm text-slate-600">
            Your report details are used only to process and route the issue.
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-sky-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!description.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Add location</h2>
          <p className="mt-1 text-sm text-slate-500">
            Share your location automatically or select it on a map.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            {/* Location Detection Panel */}
            <div
              className={`rounded-2xl p-5 transition-all ${
                coords
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-sky-50 border border-sky-100"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <LocateFixed className="h-4 w-4 text-sky-700" />
                {coords ? "✓ Location Detected" : "Current Location"}
              </div>
              <p className="text-sm text-slate-500 mb-4">
                {coords
                  ? "Coordinates found. You can refine using the map below."
                  : "Auto-detect with GPS or pick on map."}
              </p>
              <div className="space-y-2 mb-4">
                <button
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation || coords !== null}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                    isDetectingLocation
                      ? "bg-slate-400"
                      : coords
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-sky-700 hover:bg-sky-800"
                  }`}
                >
                  {isDetectingLocation ? (
                    <>
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                      Detecting...
                    </>
                  ) : coords ? (
                    <>
                      <CheckCircle2 size={16} />
                      Location Confirmed
                    </>
                  ) : (
                    <>
                      <LocateFixed size={16} />
                      Use My Location
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowMapPicker(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-sky-700 bg-sky-100 hover:bg-sky-200 transition border border-sky-300"
                >
                  <MapPin size={16} />
                  Select on Map
                </button>
              </div>
              {coords && (
                <div className="rounded-lg bg-white/60 p-3 text-xs font-mono text-slate-600 border border-emerald-100">
                  📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </div>
              )}
            </div>

            {/* Manual Address Entry */}
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Address or landmark
                </label>
                <input
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    if (!locationDetected) setLocationDetected(true);
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="House number, street, building, landmark"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Area or locality
                  </label>
                  <input
                    value={area}
                    onChange={(event) => {
                      setArea(event.target.value);
                      if (!locationDetected) setLocationDetected(true);
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    placeholder="Required"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Pincode
                  </label>
                  <input
                    value={pincode}
                    onChange={(event) => {
                      setPincode(event.target.value);
                      if (!locationDetected) setLocationDetected(true);
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Manager Assignment Preview */}
          {managerPreview && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-sky-700">
                  Will be assigned to
                </div>
                <div className="mt-0.5 text-base font-bold text-slate-900">
                  {managerPreview.name}
                </div>
                <div className="text-xs text-slate-500">
                  {managerPreview.state}
                  {managerPreview.zone ? ` · ${managerPreview.zone}` : ""}
                  {" — "}
                  {managers.filter((m) => m.state === managerPreview.state).length} manager(s) available
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-sky-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={async () => {
                if (!coords) await handleManualGeocode(address, area);
                setStep(3);
              }}
              disabled={!area.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Add photos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Photos are optional, but they help verify the issue quickly.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 transition-all hover:bg-white hover:border-sky-300 group">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="photo-upload"
              disabled={isUploadingPhoto || uploadedPhotos.length >= 5}
            />
            <label
              htmlFor="photo-upload"
              className={`flex flex-col items-center justify-center cursor-pointer text-center ${uploadedPhotos.length >= 5 ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-sky-700 shadow-sm transition-transform group-hover:scale-110">
                <ImagePlus className="h-8 w-8" />
              </div>
              <div className="text-lg font-bold text-slate-900">
                {uploadedPhotos.length >= 5 ? "Limit reached" : "Upload images"}
              </div>
              <p className="mt-2 text-sm text-slate-500 max-w-[240px]">
                {uploadedPhotos.length >= 5
                  ? "You have already added 5 photos"
                  : "Tap to select up to 5 photos from your gallery or camera"}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-700 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-900/10">
                <Plus className="h-3.5 w-3.5" /> Select Files
              </div>
            </label>
          </div>

          {isUploadingPhoto && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-sky-50 px-5 py-4 text-sm font-medium text-sky-800 animate-pulse">
              <div className="h-2 w-2 rounded-full bg-sky-700 animate-bounce" />
              Processing and uploading photos...
            </div>
          )}

          {uploadedPhotos.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {uploadedPhotos.map((photoUrl) => (
                <div
                  key={photoUrl}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <img
                    src={photoUrl}
                    alt="Evidence"
                    className="h-40 w-full object-cover"
                  />
                  <button
                    onClick={() =>
                      setUploadedPhotos((prev) =>
                        prev.filter((url) => url !== photoUrl),
                      )
                    }
                    className="w-full border-t border-slate-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove photo
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-sky-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Submitting..." : "Submit report"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-900">
            Report submitted
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Your issue has been added successfully. You can now track its status
            from the complaints page.
          </p>
          <div className="mx-auto mt-6 max-w-sm space-y-3">
            <div className="rounded-2xl bg-sky-50 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                Ticket ID
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {complaintId}
              </div>
            </div>
            {assignedManagerName && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Assigned Manager
                  </div>
                  <div className="mt-0.5 text-base font-bold text-slate-900">
                    {assignedManagerName}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() =>
                navigate(
                  complaintId
                    ? `/dashboard/complaints/${complaintId}`
                    : "/dashboard/complaints",
                )
              }
              className="rounded-full bg-sky-700 px-5 py-3 text-sm font-semibold text-white"
            >
              Track complaint
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to home
            </button>
          </div>

          {isGeneratingCard && (
            <div className="mt-8 flex items-center justify-center gap-3 rounded-2xl bg-sky-50 px-6 py-4 text-sm font-bold text-sky-800 animate-pulse border border-sky-200">
              <div className="h-2.5 w-2.5 rounded-full bg-sky-700 animate-ping" />
              Finalizing your Official Report Card...
            </div>
          )}
        </section>
      )}

      {/* Map Picker Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl animate-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Select Location on Map
              </h3>
              <button
                onClick={() => setShowMapPicker(false)}
                className="text-slate-500 hover:text-slate-700 transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              Click on the map to select your location, or search for an
              address.
            </p>

            {/* Search Box */}
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Search address or landmark (e.g. 'Lotus Temple, Delhi')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchLocation();
                  }
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              <button
                onClick={() => handleSearchLocation()}
                disabled={!searchQuery.trim()}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition"
              >
                Search
              </button>
            </div>

            {/* Leaflet Map */}
            <div className="w-full">
              <div
                id="map"
                className="relative w-full h-96 rounded-2xl overflow-hidden border border-slate-200 mb-4 bg-slate-100"
                ref={mapRef}
              />
              {coords && (
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      handleMapLocationSelect(coords.lat, coords.lng)
                    }
                    className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 transition"
                  >
                    Confirm Location
                  </button>
                  <button
                    onClick={() => setCoords(null)}
                    className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-4 text-center">
              📍 Powered by OpenStreetMap &amp; Leaflet
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
