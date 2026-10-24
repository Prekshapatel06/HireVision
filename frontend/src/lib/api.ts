export function normalizeApiUrl(rawUrl?: string): string {
  let url = (rawUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").trim();

  if (!url) {
    return "http://localhost:5000";
  }

  // Prepend protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("localhost") || url.startsWith("127.0.0.1")) {
      url = `http://${url}`;
    } else {
      url = `https://${url}`;
    }
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, "");

  // Render internal hosts (e.g. "hirevision-backend-6f8q") lack domain extensions
  // In a browser, they must have ".onrender.com" to be publicly reachable
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      parsed.hostname = `${parsed.hostname}.onrender.com`;
      url = parsed.toString().replace(/\/+$/, "");
    }
  } catch {
    if (!url.includes(".") && !url.includes("localhost")) {
      url = `${url}.onrender.com`;
    }
  }

  return url;
}

export const API_URL = normalizeApiUrl();
