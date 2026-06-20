"""
/api/stats — real stats computed from the complaints collection.
No hardcoded data.
"""
import json
from fastapi import APIRouter
from appwrite.query import Query
from appwrite_client import databases, DATABASE_ID, COLLECTION_ID
from config import DELHI_ZONE_CONFIG, DEFAULT_ZONE

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _map_doc_light(doc: dict) -> dict:
    """Lightweight mapping — only pulls fields we need for stats."""
    out: dict = {}
    for field in (
        "status", "category", "ward", "area", "state",
        "slaHours", "slaRemainingHours", "createdAt", "updatedAt",
        "assignedManagerId", "assignedManagerName", "coordinates",
    ):
        out[field] = doc.get(field)

    coords_raw = out.get("coordinates")
    if isinstance(coords_raw, str):
        try:
            out["coordinates"] = json.loads(coords_raw)
        except Exception:
            out["coordinates"] = None
    return out


@router.get("/areas")
async def area_statistics():
    """Returns real area/ward performance stats derived from complaints DB."""
    try:
        resp = databases.list_documents(
            DATABASE_ID, COLLECTION_ID,
            queries=[Query.limit(500)],
        )
        docs = resp["documents"]
    except Exception:
        return []

    area_map: dict[str, dict] = {}

    for doc in docs:
        area = (
            doc.get("ward")
            or doc.get("area")
            or doc.get("state")
            or "General"
        )
        status = doc.get("status", "")
        sla_rem = doc.get("slaRemainingHours")
        created = doc.get("createdAt")
        updated = doc.get("updatedAt")

        if area not in area_map:
            area_map[area] = {
                "area": area,
                "totalComplaints": 0,
                "resolvedComplaints": 0,
                "activeComplaints": 0,
                "resolutionTimes": [],
                "slaMet": 0,
            }

        area_map[area]["totalComplaints"] += 1

        if status in ("Resolved", "Closed"):
            area_map[area]["resolvedComplaints"] += 1
            # Compute resolution time in hours
            if created and updated:
                try:
                    from datetime import datetime
                    dt_c = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    dt_u = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                    hours = (dt_u - dt_c).total_seconds() / 3600
                    area_map[area]["resolutionTimes"].append(hours)
                except Exception:
                    pass
            if sla_rem is not None and sla_rem >= 0:
                area_map[area]["slaMet"] += 1
        elif status not in ("Rejected",):
            area_map[area]["activeComplaints"] += 1

    result = []
    for rank, (area_name, s) in enumerate(
        sorted(area_map.items(), key=lambda x: x[1]["resolvedComplaints"], reverse=True),
        start=1,
    ):
        total = s["totalComplaints"]
        resolved = s["resolvedComplaints"]
        times = s["resolutionTimes"]
        resolution_rate = round((resolved / total) * 100) if total > 0 else 0
        avg_resolve_time = round(sum(times) / len(times)) if times else 0

        result.append({
            "area": area_name,
            "resolutionRate": resolution_rate,
            "totalComplaints": total,
            "resolvedComplaints": resolved,
            "activeComplaints": s["activeComplaints"],
            "avgResolveTime": avg_resolve_time,
            "rank": rank,
        })

    return result[:10]  # top 10 areas


@router.get("/summary")
async def summary_statistics():
    """Returns high-level KPI summary computed from real data."""
    try:
        resp = databases.list_documents(
            DATABASE_ID, COLLECTION_ID,
            queries=[Query.limit(500)],
        )
        docs = resp["documents"]
    except Exception:
        return {}

    total = len(docs)
    resolved = sum(1 for d in docs if d.get("status") in ("Resolved", "Closed"))
    active = sum(
        1 for d in docs
        if d.get("status") not in ("Resolved", "Closed", "Rejected")
    )
    escalated = sum(1 for d in docs if d.get("escalated"))
    sla_met = sum(
        1 for d in docs
        if d.get("status") in ("Resolved", "Closed")
        and (d.get("slaRemainingHours") or 1) >= 0
    )
    sla_compliance = round((sla_met / resolved) * 100) if resolved > 0 else 0

    return {
        "total": total,
        "resolved": resolved,
        "active": active,
        "escalated": escalated,
        "slaCompliance": sla_compliance,
    }
