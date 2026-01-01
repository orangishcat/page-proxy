import axios from 'axios';

const appwriteEndpoint = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const appwriteProjectId = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;

const appwriteHeaders = appwriteProjectId ? {'X-Appwrite-Project': appwriteProjectId} : undefined;

const http = axios.create({
  baseURL: appwriteEndpoint || undefined,
  withCredentials: true,
  headers: appwriteHeaders
});

export const isAppwriteConfigured = () =>
  Boolean(appwriteEndpoint && appwriteProjectId);

export default http;
