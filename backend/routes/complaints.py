import json
import math
from datetime import datetime, UTC
from typing import Optional
from fastapi import APIRouter, HTTPException, Query as FastAPIQuery
from pydantic import BaseModel
from appwrite.query import Query
from appwrite_client import databases, users as aw_users, DATABASE_ID, COLLECTION_ID
from geopy.geocoders import Nominatim
from config import (
    DELHI_ZONE_CONFIG, ZONE_LAT_LNG_RULES, DEFAULT_ZONE,
    STATE_ALIASES, SLA_HOURS, CATEGORY_PRIORITY,
    PRIORITY_BASE, PRIORITY_VERIFY_PER_VOTE, PRIORITY_VERIFY_CAP,
    COMPLAINT_LIST_LIMIT, DEFAULT_SEARCH_RADIUS_KM,
    MANAGER_ROLE_KEY, MANAGER_ROLE_VALUE, MANAGER_ZONE_KEY, MANAGER_STATE_KEY,
)

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

# Geocoder for reverse-geocoding state from coordinates
geolocator = Nominatim(user_agent="smart_crm_ps_crm")


# ── Manager fetching (from Appwrite Users) ─────────────────────────────────
_manager_cache: list[dict] | None = None
_manager_cache_ts: float = 0
_MANAGER_CACHE_TTL = 300  # 5 min

def _fetch_managers_from_appwrite() -> list[dict]:
    """Fetches all users whose prefs.role == 'manager' from Appwrite."""
    global _manager_cache, _manager_cache_ts
    import time
    now = time.time()
    if _manager_cache is not None and (now - _manager_cache_ts) < _MANAGER_CACHE_TTL:
        return _manager_cache

    try:
        result = aw_users.list(queries=[Query.limit(100)])
        managers = []
        for u in result.get("users", []):
            prefs = u.get("prefs", {})
            if prefs.get(MANAGER_ROLE_KEY) == MANAGER_ROLE_VALUE:
                managers.append({
                    "id": u["$id"],
                    "name": u.get("name", "Manager"),
                    "email": u.get("email", ""),
                    "state": prefs.get(MANAGER_STATE_KEY, "Delhi"),
                    "zone": prefs.get(MANAGER_ZONE_KEY, DEFAULT_ZONE),
                })
        _manager_cache = managers
        _manager_cache_ts = now
        return managers
    except Exception as e:
        print(f"[managers] Appwrite fetch failed: {e}")
        return _manager_cache or []


def invalidate_manager_cache():
    global _manager_cache
    _manager_cache = None


# ── Zone detection ──────────────────────────────────────────────────────────

def detect_zone_from_complaint(address: str = "", coordinates: dict = None) -> str:
    """Detects which Delhi zone a complaint belongs to based on address keywords or GPS coords."""
    if address:
        lower = address.lower()
        for zone in DELHI_ZONE_CONFIG:
            if any(kw in lower for kw in zone["keywords"]):
                return zone["id"]

    if coordinates and isinstance(coordinates, dict):
        lat = coordinates.get("lat") or coordinates.get("latitude")
        lng = coordinates.get("lng") or coordinates.get("longitude")
        if lat is not None and lng is not None:
            lat, lng = float(lat), float(lng)
            for rule in ZONE_LAT_LNG_RULES:
                if rule["lat_min"] is not None and lat < rule["lat_min"]:
                    continue
                if rule["lat_max"] is not None and lat > rule["lat_max"]:
                    continue
                if rule["lng_min"] is not None and lng < rule["lng_min"]:
                    continue
                if rule["lng_max"] is not None and lng > rule["lng_max"]:
                    continue
                return rule["zone"]

    return DEFAULT_ZONE


# ── Manager assignment ──────────────────────────────────────────────────────

def assign_manager_to_complaint(
    complaint_state: str, address: str = "", coordinates: dict = None
) -> dict:
    """Assigns the least-loaded manager from the correct zone for the given complaint."""
    all_managers = _fetch_managers_from_appwrite()
    state_managers = [
        m for m in all_managers
        if m["state"].lower() == complaint_state.lower()
    ]

    if not state_managers:
        return {"id": "SYSTEM", "name": "SystemAdmin"}

    zone_id = detect_zone_from_complaint(address, coordinates)
    zone_managers = [m for m in state_managers if m.get("zone") == zone_id]
    if not zone_managers:
        zone_managers = state_managers

    # Pick the manager with the fewest active (non-resolved) complaints
    manager_workloads = []
    for mgr in zone_managers:
        try:
            resp = databases.list_documents(
                DATABASE_ID, COLLECTION_ID,
                queries=[
                    Query.equal("assignedManagerId", mgr["id"]),
                    Query.not_equal("status", "Resolved"),
                    Query.not_equal("status", "Closed"),
                    Query.limit(1),
                ]
            )
            count = resp.get("total", 0)
        except Exception:
            count = 0
        manager_workloads.append((mgr, count))

    best_manager = min(manager_workloads, key=lambda x: x[1])[0]
    return best_manager


# ── State resolution ────────────────────────────────────────────────────────

def _resolve_state_from_address(addr: dict) -> str:
    candidates = [
        addr.get("state", ""),
        addr.get("state_district", ""),
        addr.get("county", ""),
        addr.get("ISO3166-2-lvl4", ""),
        addr.get("city", ""),
        addr.get("town", ""),
        addr.get("village", ""),
    ]
    for val in candidates:
        if not val:
            continue
        key = val.strip().lower()
        if key in STATE_ALIASES:
            return STATE_ALIASES[key]
        for alias, state_name in STATE_ALIASES.items():
            if alias in key or key in alias:
                return state_name
    return "Unknown"


def get_state_from_coords(lat: float, lng: float) -> str:
    try:
        location = geolocator.reverse((lat, lng), exactly_one=True, timeout=10)
        if location and "address" in location.raw:
            return _resolve_state_from_address(location.raw["address"])
    except Exception:
        pass
    return "Unknown"


def get_state_from_address_text(address: str) -> str:
    lower = address.lower()
    for alias, state_name in STATE_ALIASES.items():
        if alias in lower:
            return state_name
    return "Unknown"


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


# ── Business logic helpers ──────────────────────────────────────────────────

def get_sla_hours(category: str) -> int:
    return SLA_HOURS.get(category, 72)


def calculate_priority(category: str, verification_count: int = 0) -> float:
    score = (
        PRIORITY_BASE
        + CATEGORY_PRIORITY.get(category, 0.0)
        + min(PRIORITY_VERIFY_CAP, verification_count * PRIORITY_VERIFY_PER_VOTE)
    )
    return round(min(1.0, score), 3)


def _map_doc(doc: dict) -> dict:
    internal = {"$id", "$collectionId", "$databaseId", "$createdAt", "$updatedAt", "$permissions"}
    out = {k: v for k, v in doc.items() if k not in internal}
    out["id"] = doc["$id"]
    for field in ("timeline", "coordinates", "location", "photos"):
        if isinstance(out.get(field), str):
            try:
                out[field] = json.loads(out[field])
            except Exception:
                pass

    verified_by = []
    timeline = out.get("timeline")
    if isinstance(timeline, list):
        for event in timeline:
            note_content = event.get("note", "")
            if "Verified by user:" in note_content:
                verifier_id = note_content.split("Verified by user:")[1].strip()
                verified_by.append(verifier_id)
    out["verifiedBy"] = list(set(verified_by))
    return out


# ── Pydantic models ─────────────────────────────────────────────────────────

class ComplaintCreate(BaseModel):
    category: str
    subcategory: Optional[str] = ""
    description: Optional[str] = ""
    address: Optional[str] = ""
    ward: Optional[str] = "General"
    coordinates: Optional[dict] = None
    photos: Optional[list] = []
    reporterName: Optional[str] = "Anonymous"
    reporterId: Optional[str] = "anon"
    assignedManagerName: Optional[str] = None
    assignedManagerState: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""
    actor: Optional[str] = "System"
    assignedTo: Optional[str] = None
    photoUrl: Optional[str] = None


class AssignManager(BaseModel):
    managerId: str
    managerName: Optional[str] = ""


class ShareCardUpdate(BaseModel):
    photoUrl: str


# ── Routes ──────────────────────────────────────────────────────────────────

@router.get("")
async def list_complaints(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = DEFAULT_SEARCH_RADIUS_KM,
    managerId: Optional[str] = None,
):
    try:
        queries = [Query.order_desc("createdAt"), Query.limit(COMPLAINT_LIST_LIMIT)]
        if managerId:
            queries.append(Query.equal("assignedManagerId", managerId))

        resp = databases.list_documents(DATABASE_ID, COLLECTION_ID, queries=queries)
        complaints = [_map_doc(d) for d in resp["documents"]]

        if lat is not None and lng is not None:
            filtered = []
            for c in complaints:
                coords = c.get("coordinates")
                if coords and isinstance(coords, dict):
                    c_lat = coords.get("lat") or coords.get("latitude")
                    c_lng = coords.get("lng") or coords.get("longitude")
                    if c_lat is not None and c_lng is not None:
                        dist = haversine_distance(lat, lng, c_lat, c_lng)
                        if dist <= radius:
                            c["distance_km"] = round(dist, 2)
                            filtered.append(c)
            return filtered

        return complaints
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/managers")
async def get_managers():
    """Returns all managers fetched from Appwrite users (role=manager)."""
    managers = _fetch_managers_from_appwrite()
    return managers


@router.post("", status_code=201)
async def create_complaint(body: ComplaintCreate):
    try:
        now = datetime.now(UTC).isoformat()
        sla_hours = get_sla_hours(body.category)
        priority = calculate_priority(body.category)
        timeline = json.dumps([{
            "status": "Submitted",
            "timestamp": now,
            "note": "Complaint submitted successfully",
            "actor": "Citizen",
        }])

        # Resolve state
        state = "Unknown"
        if body.coordinates:
            state = get_state_from_coords(
                body.coordinates["lat"], body.coordinates["lng"]
            )
        if state == "Unknown" and body.address:
            state = get_state_from_address_text(body.address)

        # Assign manager
        if body.assignedManagerName and body.assignedManagerState:
            all_managers = _fetch_managers_from_appwrite()
            found_mgr = next(
                (m for m in all_managers if m["name"] == body.assignedManagerName), None
            )
            if found_mgr:
                assigned_manager = found_mgr
            else:
                # Manager name provided but not found in Appwrite; create a stub
                assigned_manager = {
                    "id": f"MGR-{body.assignedManagerState[:3].upper()}",
                    "name": body.assignedManagerName,
                }
        else:
            coords_dict = body.coordinates if body.coordinates else None
            assigned_manager = assign_manager_to_complaint(
                state, body.address or "", coords_dict
            )

        payload_dict = body.model_dump()
        payload_dict.pop("assignedManagerName", None)
        payload_dict.pop("assignedManagerState", None)

        payload = {
            **payload_dict,
            "status": "Submitted",
            "createdAt": now,
            "updatedAt": now,
            "timeline": timeline,
            "priorityScore": float(priority),
            "slaHours": int(sla_hours),
            "slaRemainingHours": int(sla_hours),
            "coordinates": json.dumps(body.coordinates) if body.coordinates else None,
            "photos": json.dumps(body.photos) if body.photos else "[]",
            "state": state,
            "assignedManagerId": assigned_manager["id"],
            "assignedManagerName": assigned_manager["name"],
        }
        doc = databases.create_document(DATABASE_ID, COLLECTION_ID, "unique()", payload)
        return {"id": doc["$id"], "assignedManager": assigned_manager["name"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}")
async def complaints_by_user(user_id: str, email: Optional[str] = None):
    try:
        r1 = databases.list_documents(
            DATABASE_ID, COLLECTION_ID,
            queries=[
                Query.equal("reporterId", user_id),
                Query.order_desc("createdAt"),
                Query.limit(COMPLAINT_LIST_LIMIT),
            ],
        )
        r2 = databases.list_documents(
            DATABASE_ID, COLLECTION_ID,
            queries=[
                Query.equal("userId", user_id),
                Query.order_desc("createdAt"),
                Query.limit(COMPLAINT_LIST_LIMIT),
            ],
        )
        all_docs = r1["documents"] + r2["documents"]
        seen, unique = set(), []
        for d in all_docs:
            if d["$id"] not in seen:
                seen.add(d["$id"])
                unique.append(_map_doc(d))
        return unique
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{complaint_id}")
async def get_complaint(complaint_id: str):
    try:
        doc = databases.get_document(DATABASE_ID, COLLECTION_ID, complaint_id)
        return _map_doc(doc)
    except Exception:
        raise HTTPException(status_code=404, detail="Complaint not found")


@router.patch("/{complaint_id}/status")
async def update_status(complaint_id: str, body: StatusUpdate):
    try:
        doc = databases.get_document(DATABASE_ID, COLLECTION_ID, complaint_id)
        timeline = doc.get("timeline", "[]")
        if isinstance(timeline, str):
            try:
                timeline = json.loads(timeline)
            except Exception:
                timeline = []
        timeline.append({
            "status": body.status,
            "timestamp": datetime.now(UTC).isoformat(),
            "note": body.note,
            "actor": body.actor,
        })

        update_payload = {
            "status": body.status,
            "timeline": json.dumps(timeline),
            "updatedAt": datetime.now(UTC).isoformat(),
        }
        if body.assignedTo:
            update_payload["assignedTo"] = body.assignedTo
        if body.photoUrl:
            update_payload["photoUrl"] = body.photoUrl

        databases.update_document(DATABASE_ID, COLLECTION_ID, complaint_id, update_payload)
        updated = databases.get_document(DATABASE_ID, COLLECTION_ID, complaint_id)
        return _map_doc(updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{complaint_id}/share-card")
async def update_share_card(complaint_id: str, body: ShareCardUpdate):
    try:
        if not body.photoUrl:
            raise HTTPException(status_code=400, detail="photoUrl is required")
        databases.update_document(DATABASE_ID, COLLECTION_ID, complaint_id, {
            "photoUrl": body.photoUrl,
            "updatedAt": datetime.now(UTC).isoformat(),
        })
        updated = databases.get_document(DATABASE_ID, COLLECTION_ID, complaint_id)
        return _map_doc(updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{complaint_id}/assign")
async def assign_manager(complaint_id: str, body: AssignManager):
    """Assign a complaint to a specific manager."""
    try:
        all_managers = _fetch_managers_from_appwrite()
        manager = next((m for m in all_managers if m["id"] == body.managerId), None)
        if not manager:
            raise HTTPException(status_code=400, detail="Manager not found")

        doc = databases.get_document(DATABASE_ID, COLLECTION_ID, complaint_id)
        timeline = doc.get("timeline", "[]")
        if isinstance(timeline, str):
            try:
                timeline = json.loads(timeline)
            except Exception:
                timeline = []

        timeline.append({
            "status": "Assigned",
            "timestamp": datetime.now(UTC).isoformat(),
            "note": f"Assigned to {manager['name']}",
            "actor": "Admin",
        })

        databases.update_document(DATABASE_ID, COLLECTION_ID, complaint_id, {
            "assignedManagerId": body.managerId,
            "assignedManagerName": manager["name"],
            "status": "Assigned",
            "timeline": json.dumps(timeline),
            "updatedAt": datetime.now(UTC).isoformat(),
        })

        updated = databases.get_document(DATABASE_ID, COLLECTION_ID, complaint_id)
        return _map_doc(updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
