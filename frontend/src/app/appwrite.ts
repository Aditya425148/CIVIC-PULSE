import { Client, Databases, Account, Storage } from "appwrite";

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;

if (!ENDPOINT || !PROJECT_ID) {
  throw new Error(
    "Missing VITE_APPWRITE_ENDPOINT or VITE_APPWRITE_PROJECT_ID. Check your .env.local file.",
  );
}

export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
export const COMPLAINTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_COMPLAINTS_COLLECTION_ID || "complaints";
export const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID;

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export default client;
