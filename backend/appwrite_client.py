import os
import sys
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.services.users import Users

load_dotenv()

ENDPOINT      = os.getenv("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1")
PROJECT_ID    = os.getenv("APPWRITE_PROJECT_ID", "")
API_KEY       = os.getenv("APPWRITE_API_KEY", "")
DATABASE_ID   = os.getenv("APPWRITE_DATABASE_ID", "")
COLLECTION_ID = os.getenv("APPWRITE_COLLECTION_ID", "complaints")
BUCKET_ID     = os.getenv("APPWRITE_BUCKET_ID", "")

# Fail fast on missing required config (skip in test env)
if os.getenv("RUNNING_TESTS") != "1":
    _missing = [k for k, v in {
        "APPWRITE_PROJECT_ID": PROJECT_ID,
        "APPWRITE_API_KEY": API_KEY,
        "APPWRITE_DATABASE_ID": DATABASE_ID,
        "APPWRITE_BUCKET_ID": BUCKET_ID,
    }.items() if not v]
    if _missing:
        print(f"[ERROR] Missing required env vars: {', '.join(_missing)}", file=sys.stderr)
        sys.exit(1)

client = Client()
client.set_endpoint(ENDPOINT)
client.set_project(PROJECT_ID)
client.set_key(API_KEY)

databases = Databases(client)
storage   = Storage(client)
users     = Users(client)
