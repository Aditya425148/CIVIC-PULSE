import json
from fastapi import APIRouter, Query as QParam
from appwrite.query import Query
from appwrite_client import databases, DATABASE_ID, COLLECTION_ID
from config import (
    REPUTATION_POINTS, REPUTATION_DEFAULT,
    TIER_THRESHOLDS, LEADERBOARD_LIMIT,
)

router = APIRouter(prefix="/api/users", tags=["users"])


def calculate_tier(reputation: int) -> int:
    for threshold, tier in TIER_THRESHOLDS:
        if reputation >= threshold:
            return tier
    return 0


def _build_user_stat(reporter_id: str, doc: dict, ward: str) -> dict:
    return {
        "id": reporter_id,
        "name": doc.get("reporterName") or "Citizen",
        "email": doc.get("reporterEmail") or f"{reporter_id}@civicpulse.local",
        "phone": doc.get("reporterPhone") or "N/A",
        "reputation": 0,
        "complaints": 0,
        "resolved": 0,
        "ward": ward,
        "badges": 0,
        "status": "Active",
    }


def _aggregate_users(docs: list) -> dict[str, dict]:
    user_stats: dict[str, dict] = {}

    for doc in docs:
        status = doc.get("status", "")
        ward = doc.get("ward") or doc.get("district") or "General"

        reporter_id = doc.get("reporterId") or doc.get("userId")
        if reporter_id:
            if reporter_id not in user_stats:
                user_stats[reporter_id] = _build_user_stat(reporter_id, doc, ward)

            points = REPUTATION_POINTS.get(status, REPUTATION_DEFAULT)
            user_stats[reporter_id]["reputation"] += points
            user_stats[reporter_id]["complaints"] += 1
            if status == "Resolved":
                user_stats[reporter_id]["resolved"] += 1
                user_stats[reporter_id]["badges"] = min(
                    user_stats[reporter_id]["resolved"] // 5 + 1, 5
                )

        # Verification points from timeline
        timeline_raw = doc.get("timeline")
        if timeline_raw:
            try:
                timeline = json.loads(timeline_raw) if isinstance(timeline_raw, str) else timeline_raw
                if isinstance(timeline, list):
                    for event in timeline:
                        note = event.get("note", "")
                        if "Verified by user:" in note:
                            v_uid = note.split("Verified by user:")[1].strip()
                            if v_uid not in user_stats:
                                user_stats[v_uid] = {
                                    "id": v_uid,
                                    "name": "Citizen",
                                    "email": f"{v_uid}@civicpulse.local",
                                    "phone": "N/A",
                                    "reputation": 0,
                                    "complaints": 0,
                                    "resolved": 0,
                                    "ward": ward,
                                    "badges": 0,
                                    "status": "Active",
                                }
                            user_stats[v_uid]["reputation"] += REPUTATION_POINTS.get("Verified", 20)
            except Exception:
                pass

    return user_stats


@router.get("")
async def get_all_users():
    """Get all users with stats aggregated from complaints."""
    try:
        resp = databases.list_documents(
            DATABASE_ID, COLLECTION_ID, queries=[Query.limit(LEADERBOARD_LIMIT)]
        )
        docs = resp["documents"]
    except Exception:
        return []

    user_stats = _aggregate_users(docs)

    all_users = []
    for uid, stats in user_stats.items():
        stats["tier"] = calculate_tier(stats["reputation"])
        stats["status"] = "Flagged" if stats["reputation"] < 0 else "Active"
        all_users.append(stats)

    return sorted(all_users, key=lambda x: x["reputation"], reverse=True)


@router.get("/{user_id}")
async def get_user(user_id: str):
    """Get details for a specific user."""
    try:
        resp = databases.list_documents(
            DATABASE_ID, COLLECTION_ID, queries=[Query.limit(LEADERBOARD_LIMIT)]
        )
        docs = resp["documents"]
    except Exception:
        return None

    user_stats = _aggregate_users([d for d in docs if (
        d.get("reporterId") == user_id or d.get("userId") == user_id
    )])

    if user_id not in user_stats:
        return None

    stats = user_stats[user_id]
    stats["tier"] = calculate_tier(stats["reputation"])
    stats["status"] = "Flagged" if stats["reputation"] < 0 else "Active"
    return stats
