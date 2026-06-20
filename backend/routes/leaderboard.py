import json
from fastapi import APIRouter, Query as QParam
from appwrite.query import Query
from appwrite_client import databases, DATABASE_ID, COLLECTION_ID
from config import REPUTATION_POINTS, REPUTATION_DEFAULT, LEADERBOARD_LIMIT

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


def _score(status: str) -> int:
    return REPUTATION_POINTS.get(status, REPUTATION_DEFAULT)


@router.get("")
async def leaderboard(tab: str = QParam(default="National")):
    try:
        resp = databases.list_documents(
            DATABASE_ID, COLLECTION_ID,
            queries=[Query.limit(LEADERBOARD_LIMIT)],
        )
        docs = resp["documents"]
    except Exception:
        return []

    user_stats: dict[str, dict] = {}
    for doc in docs:
        status = doc.get("status", "")
        district = doc.get("district") or doc.get("ward") or "General"

        reporter_id = doc.get("reporterId") or doc.get("userId")
        if reporter_id:
            if reporter_id not in user_stats:
                user_stats[reporter_id] = {
                    "uid": reporter_id,
                    "name": doc.get("reporterName") or "Citizen",
                    "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={reporter_id}",
                    "impact": 0,
                    "resolved": 0,
                    "district": district,
                }
            user_stats[reporter_id]["impact"] += _score(status)
            if status == "Resolved":
                user_stats[reporter_id]["resolved"] += 1

        # Verification points parsed from timeline
        timeline_raw = doc.get("timeline")
        if timeline_raw:
            try:
                timeline = json.loads(timeline_raw) if isinstance(timeline_raw, str) else timeline_raw
                if isinstance(timeline, list):
                    for event in timeline:
                        note_content = event.get("note", "")
                        if "Verified by user:" in note_content:
                            v_uid = note_content.split("Verified by user:")[1].strip()
                            if v_uid not in user_stats:
                                user_stats[v_uid] = {
                                    "uid": v_uid,
                                    "name": "Citizen",
                                    "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={v_uid}",
                                    "impact": 0,
                                    "resolved": 0,
                                    "district": district,
                                }
                            user_stats[v_uid]["impact"] += REPUTATION_POINTS.get("Verified", 20)
            except Exception:
                pass

    return sorted(user_stats.values(), key=lambda x: x["impact"], reverse=True)[:10]


@router.get("/summary")
async def leaderboard_summary():
    try:
        resp = databases.list_documents(
            DATABASE_ID, COLLECTION_ID,
            queries=[Query.limit(LEADERBOARD_LIMIT)],
        )
        docs = resp["documents"]
        resolved = sum(1 for d in docs if d.get("status") == "Resolved")
        active_citizens = len({
            d.get("reporterId") or d.get("userId")
            for d in docs
            if d.get("reporterId") or d.get("userId")
        })
        return {"totalResolved": resolved, "activeCitizens": active_citizens}
    except Exception:
        return {"totalResolved": 0, "activeCitizens": 0}
