"""
Shared configuration & business logic constants for CivicPulse backend.
Single source of truth — import from here, never hardcode in route files.
"""
import os

# ── Deployment URLs (read from env) ──────────────────────────────────────────
BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "https://smart-public-service-crm-ps-crm.onrender.com",
)

# ── Delhi Geographic Bounds ───────────────────────────────────────────────────
DELHI_BOUNDS = {
    "minLat": 28.39,
    "maxLat": 28.89,
    "minLng": 76.84,
    "maxLng": 77.35,
}

# ── Delhi Zone Definitions ────────────────────────────────────────────────────
DELHI_ZONE_CONFIG = [
    {
        "id": "south",
        "name": "South Delhi",
        "keywords": [
            "south delhi", "saket", "gk", "greater kailash", "hauz khas",
            "vasant vihar", "malviya nagar", "defence colony", "mehrauli",
            "chhatarpur", "qutub",
        ],
    },
    {
        "id": "central_new",
        "name": "Central & New Delhi",
        "keywords": [
            "central delhi", "new delhi", "connaught place", "cp",
            "karol bagh", "daryaganj", "civil lines", "paharganj",
            "india gate", "rajpath", "chandni chowk",
        ],
    },
    {
        "id": "east_shahdara",
        "name": "East Delhi & Shahdara",
        "keywords": [
            "east delhi", "shahdara", "laxmi nagar", "preet vihar",
            "mayur vihar", "gandhi nagar", "anand vihar", "vivek vihar",
            "dilshad garden", "seelampur",
        ],
    },
    {
        "id": "west",
        "name": "West Delhi",
        "keywords": [
            "west delhi", "rajouri garden", "punjabi bagh", "janakpuri",
            "patel nagar", "tilak nagar", "vikaspuri", "dwarka",
            "uttam nagar", "najafgarh",
        ],
    },
    {
        "id": "north_nw",
        "name": "North & North-West Delhi",
        "keywords": [
            "north delhi", "north west delhi", "north-west delhi",
            "rohini", "model town", "narela", "delhi university",
            "du campus", "burari", "pitampura", "azadpur", "timarpur",
            "shalimar bagh", "ashok vihar",
        ],
    },
]

# ── Zone lat/lng thresholds (bounding-box heuristics) ────────────────────────
ZONE_LAT_LNG_RULES = [
    {"zone": "north_nw",      "lat_min": 28.70, "lat_max": None,  "lng_min": None,  "lng_max": None},
    {"zone": "south",         "lat_min": None,  "lat_max": 28.56, "lng_min": None,  "lng_max": None},
    {"zone": "east_shahdara", "lat_min": None,  "lat_max": None,  "lng_min": 77.28, "lng_max": None},
    {"zone": "west",          "lat_min": None,  "lat_max": None,  "lng_min": None,  "lng_max": 77.08},
]
DEFAULT_ZONE = "central_new"

# ── State aliases (Nominatim → internal state names) ─────────────────────────
STATE_ALIASES: dict[str, str] = {
    "IN-DL": "Delhi",
    "nct of delhi": "Delhi",
    "delhi": "Delhi",
    "new delhi": "Delhi",
}

# ── SLA hours per category ────────────────────────────────────────────────────
SLA_HOURS: dict[str, int] = {
    "Safety": 12,
    "Water": 24,
    "Garbage": 48,
    "Sanitation": 48,
    "Streetlight": 72,
    "Pothole": 96,
    "Construction": 120,
    "Other": 72,
}

# ── Priority scoring weights ──────────────────────────────────────────────────
CATEGORY_PRIORITY: dict[str, float] = {
    "Safety": 0.4,
    "Water": 0.3,
    "Sanitation": 0.25,
    "Construction": 0.20,
    "Pothole": 0.15,
    "Streetlight": 0.1,
    "Garbage": 0.05,
    "Other": 0.0,
}
PRIORITY_BASE = 0.5
PRIORITY_VERIFY_PER_VOTE = 0.05
PRIORITY_VERIFY_CAP = 0.15

# ── Reputation / leaderboard scoring ─────────────────────────────────────────
REPUTATION_POINTS: dict[str, int] = {
    "Resolved": 50,
    "Verified": 20,
}
REPUTATION_DEFAULT = 10  # any other status

# ── User tier thresholds ──────────────────────────────────────────────────────
TIER_THRESHOLDS = [
    (400, 2),
    (150, 1),
    (0,   0),
]

# ── Complaint list limits ─────────────────────────────────────────────────────
COMPLAINT_LIST_LIMIT = 100
LEADERBOARD_LIMIT = 500
DEFAULT_SEARCH_RADIUS_KM = 5.0

# ── Manager role identifier stored in Appwrite user prefs ────────────────────
MANAGER_ROLE_KEY = "role"
MANAGER_ROLE_VALUE = "manager"
MANAGER_ZONE_KEY = "zone"        # e.g. "south", "north_nw"
MANAGER_STATE_KEY = "state"      # e.g. "Delhi"


# ── Load persisted SLA config if available ───────────────────────────────────
try:
    import json
    _base_dir = os.path.dirname(os.path.abspath(__file__))
    _sla_path = os.path.join(_base_dir, "sla_config.json")
    if os.path.exists(_sla_path):
        with open(_sla_path, "r") as _f:
            _cfg = json.load(_f)
            for _item in _cfg:
                _cat = _item.get("category")
                _val = _item.get("defaultSLA")
                if _cat and _val is not None:
                    SLA_HOURS[_cat] = int(_val)
except Exception as _e:
    print(f"[config] Warning: Failed to load SLA config on startup: {_e}")

