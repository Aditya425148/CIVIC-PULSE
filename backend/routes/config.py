import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import config

router = APIRouter(prefix="/api/config", tags=["config"])

SLA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sla_config.json")

class SLACategoryConfig(BaseModel):
    category: str
    defaultSLA: int
    escalationSLA: int
    emergencySLA: Optional[int] = None

# Default settings matching config.py and frontend requirements
DEFAULT_SLA_CONFIG = [
    {"category": "Safety", "defaultSLA": 12, "escalationSLA": 24, "emergencySLA": 6},
    {"category": "Water", "defaultSLA": 24, "escalationSLA": 48, "emergencySLA": 12},
    {"category": "Garbage", "defaultSLA": 48, "escalationSLA": 72, "emergencySLA": 24},
    {"category": "Sanitation", "defaultSLA": 48, "escalationSLA": 72, "emergencySLA": 24},
    {"category": "Streetlight", "defaultSLA": 72, "escalationSLA": 96, "emergencySLA": 36},
    {"category": "Pothole", "defaultSLA": 96, "escalationSLA": 120, "emergencySLA": 48},
    {"category": "Construction", "defaultSLA": 120, "escalationSLA": 168, "emergencySLA": None},
    {"category": "Other", "defaultSLA": 72, "escalationSLA": 96, "emergencySLA": 36},
]

def load_sla_config() -> List[dict]:
    if os.path.exists(SLA_FILE):
        try:
            with open(SLA_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"[config] Failed to read {SLA_FILE}: {e}")
    # Write default if not present
    try:
        with open(SLA_FILE, "w") as f:
            json.dump(DEFAULT_SLA_CONFIG, f, indent=2)
    except Exception as e:
        print(f"[config] Failed to write default SLA config: {e}")
    return DEFAULT_SLA_CONFIG

def update_global_sla_dict(cfg_list: List[dict]):
    """Sync the global config.SLA_HOURS dictionary so new complaints use the new values."""
    for item in cfg_list:
        cat = item.get("category")
        val = item.get("defaultSLA")
        if cat and val is not None:
            config.SLA_HOURS[cat] = int(val)

# Initialize SLA_HOURS on import
update_global_sla_dict(load_sla_config())


@router.get("/sla")
async def get_sla_configs():
    return load_sla_config()


@router.patch("/sla")
async def update_sla_configs(body: List[SLACategoryConfig]):
    updated_data = [item.model_dump() for item in body]
    try:
        with open(SLA_FILE, "w") as f:
            json.dump(updated_data, f, indent=2)
        
        # Sync in-memory configuration
        update_global_sla_dict(updated_data)
        return updated_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save SLA configurations: {str(e)}")
