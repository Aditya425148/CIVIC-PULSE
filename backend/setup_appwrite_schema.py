import os
import sys
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.exception import AppwriteException

# Load environment variables
load_dotenv()

ENDPOINT      = os.getenv("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1")
PROJECT_ID    = os.getenv("APPWRITE_PROJECT_ID")
API_KEY       = os.getenv("APPWRITE_API_KEY")
DATABASE_ID   = os.getenv("APPWRITE_DATABASE_ID", "civicpulse_db")
COLLECTION_ID = os.getenv("APPWRITE_COLLECTION_ID", "complaints")
WORKERS_COLLECTION_ID = os.getenv("APPWRITE_WORKERS_COLLECTION_ID", "workers")

if not PROJECT_ID or not API_KEY:
    print("Error: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set in .env")
    sys.exit(1)

client = Client()
client.set_endpoint(ENDPOINT)
client.set_project(PROJECT_ID)
client.set_key(API_KEY)

databases = Databases(client)

complaint_attributes = [
    {"id": "reporterName", "type": "string", "size": 100, "required": False},
    {"id": "reporterId", "type": "string", "size": 100, "required": False},
    {"id": "reporterPhone", "type": "string", "size": 50, "required": False},
    {"id": "priorityScore", "type": "float", "required": False},
    {"id": "slaHours", "type": "integer", "required": False},
    {"id": "slaRemainingHours", "type": "integer", "required": False},
    {"id": "state", "type": "string", "size": 100, "required": False},
    {"id": "assignedTo", "type": "string", "size": 200, "required": False},
]

worker_attributes = [
    {"id": "name", "type": "string", "size": 100, "required": True},
    {"id": "phone", "type": "string", "size": 50, "required": True},
    {"id": "email", "type": "string", "size": 100, "required": True},
    {"id": "area", "type": "string", "size": 100, "required": True},
    {"id": "state", "type": "string", "size": 100, "required": False},
    {"id": "status", "type": "string", "size": 50, "required": False},
    {"id": "rating", "type": "float", "required": False},
]

def setup_collection_attributes(coll_id, attrs):
    print(f"\nStarting schema update for collection: {coll_id} in database: {DATABASE_ID}")
    for attr in attrs:
        try:
            print(f"Adding attribute '{attr['id']}' to '{coll_id}'...")
            if attr["type"] == "string":
                databases.create_string_attribute(
                    database_id=DATABASE_ID,
                    collection_id=coll_id,
                    key=attr["id"],
                    size=attr["size"],
                    required=attr["required"]
                )
            elif attr["type"] == "integer":
                databases.create_integer_attribute(
                    database_id=DATABASE_ID,
                    collection_id=coll_id,
                    key=attr["id"],
                    required=attr["required"]
                )
            elif attr["type"] == "float":
                databases.create_float_attribute(
                    database_id=DATABASE_ID,
                    collection_id=coll_id,
                    key=attr["id"],
                    required=attr["required"]
                )
            print(f"Successfully added '{attr['id']}'")
        except AppwriteException as e:
            if "already exists" in str(e).lower():
                print(f"Attribute '{attr['id']}' already exists. Skipping.")
            else:
                print(f"Failed to add '{attr['id']}': {str(e)}")

def setup_schema():
    # 1. Ensure workers collection exists
    try:
        print(f"Creating collection '{WORKERS_COLLECTION_ID}' in database '{DATABASE_ID}'...")
        databases.create_collection(
            database_id=DATABASE_ID,
            collection_id=WORKERS_COLLECTION_ID,
            name="Workers",
        )
        print(f"Collection '{WORKERS_COLLECTION_ID}' created successfully.")
    except AppwriteException as e:
        if "already exists" in str(e).lower():
            print(f"Collection '{WORKERS_COLLECTION_ID}' already exists. Skipping.")
        else:
            print(f"Failed to create collection '{WORKERS_COLLECTION_ID}': {e}")

    # 2. Setup attributes for complaints
    setup_collection_attributes(COLLECTION_ID, complaint_attributes)

    # 3. Setup attributes for workers
    setup_collection_attributes(WORKERS_COLLECTION_ID, worker_attributes)

if __name__ == "__main__":
    setup_schema()
    print("\nSchema update complete.")

