export function normalizeApiUrl(rawUrl?: string): string {
  let url = (rawUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").trim();
  
  if (!url) {
    return "http://localhost:5000";
  }

  // If missing protocol (e.g., "hirevision-backend.onrender.com" provided by Render host)
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("localhost") || url.startsWith("127.0.0.1")) {
      url = `http://${url}`;
    } else {
      url = `https://${url}`;
    }
  }

  return url.replace(/\/+$/, "");
}

export const API_URL = normalizeApiUrl();
