from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
import os
from appwrite.query import Query
from appwrite_client import users as aw_users, databases, DATABASE_ID
WORKERS_COLLECTION_ID = os.getenv("APPWRITE_WORKERS_COLLECTION_ID", "workers")

router = APIRouter(prefix="/api/workers", tags=["workers"])

class WorkerCreate(BaseModel):
    name: str
    phone: str
    area: str
    state: str = "Delhi"
    rating: float = 4.5

class WorkerResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: str
    area: str
    state: str
    status: str
    rating: float

@router.get("", response_model=List[WorkerResponse])
async def list_workers():
    try:
        # Fetch directly from the database collection
        try:
            resp = databases.list_documents(DATABASE_ID, WORKERS_COLLECTION_ID, queries=[Query.limit(100)])
            workers_list = []
            for doc in resp.get("documents", []):
                workers_list.append(
                    WorkerResponse(
                        id=doc["$id"],
                        name=doc.get("name") or "Field Agent",
                        phone=doc.get("phone") or "N/A",
                        email=doc.get("email") or "",
                        area=doc.get("area") or "General",
                        state=doc.get("state") or "Delhi",
                        status=doc.get("status") or "Available",
                        rating=float(doc.get("rating", 4.5)),
                    )
                )
            return workers_list
        except Exception as db_err:
            print(f"[workers] DB list failed, falling back to Auth list: {db_err}")
            # Fallback to Auth Users list for backwards compatibility
            result = aw_users.list(queries=[Query.limit(100)])
            workers_list = []
            for u in result.get("users", []):
                prefs = u.get("prefs", {})
                if prefs.get("role") == "worker":
                    workers_list.append(
                        WorkerResponse(
                            id=u["$id"],
                            name=u.get("name", "Field Agent"),
                            phone=prefs.get("phone") or u.get("phone") or "N/A",
                            email=u.get("email", ""),
                            area=prefs.get("area") or "General",
                            state=prefs.get("state") or "Delhi",
                            status="Available",
                            rating=float(prefs.get("rating", 4.5)),
                        )
                    )
            return workers_list
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch workers: {str(e)}"
        )

@router.post("", response_model=WorkerResponse, status_code=status.HTTP_201_CREATED)
async def create_worker(body: WorkerCreate):
    try:
        # Clean phone to create a valid email
        safe_phone = body.phone.replace("+", "").replace(" ", "").strip()
        email = f"wkr_{safe_phone}@civicpulse.local"
        password = "workerPassword123"  # Standard default password for workers

        # Create user account in Appwrite
        new_user = aw_users.create(
            user_id="unique()",
            email=email,
            password=password,
            name=body.name
        )

        user_id = new_user["$id"]

        # Set user preferences/roles
        aw_users.update_prefs(
            user_id=user_id,
            prefs={
                "role": "worker",
                "phone": body.phone,
                "area": body.area,
                "state": body.state,
                "rating": body.rating
            }
        )

        # Insert worker into the database collection
        try:
            databases.create_document(
                database_id=DATABASE_ID,
                collection_id=WORKERS_COLLECTION_ID,
                document_id=user_id,
                data={
                    "name": body.name,
                    "phone": body.phone,
                    "email": email,
                    "area": body.area,
                    "state": body.state,
                    "status": "Available",
                    "rating": body.rating
                }
            )
        except Exception as db_err:
            print(f"[workers] Failed to create database document for worker: {db_err}")

        return WorkerResponse(
            id=user_id,
            name=body.name,
            phone=body.phone,
            email=email,
            area=body.area,
            state=body.state,
            status="Available",
            rating=body.rating
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deploy field worker: {str(e)}"
        )

@router.delete("/{worker_id}")
async def delete_worker(worker_id: str):
    try:
        # Delete from Auth
        try:
            aw_users.delete(user_id=worker_id)
        except Exception as auth_err:
            print(f"[workers] Auth delete failed for {worker_id}: {auth_err}")

        # Delete from Database
        try:
            databases.delete_document(
                database_id=DATABASE_ID,
                collection_id=WORKERS_COLLECTION_ID,
                document_id=worker_id
            )
        except Exception as db_err:
            print(f"[workers] DB delete failed for {worker_id}: {db_err}")

        return {"status": "success", "message": "Worker account removed successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove worker account: {str(e)}"
        )
