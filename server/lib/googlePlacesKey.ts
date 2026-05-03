const GOOGLE_PLACES_ENV_NAMES = [
  "GOOGLE_PLACES_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "PLACES_API_KEY",
  "VITE_GOOGLE_PLACES_API_KEY",
] as const;

export function getGooglePlacesApiKey(): string {
  for (const name of GOOGLE_PLACES_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

export function getGooglePlacesApiKeySource(): string | null {
  for (const name of GOOGLE_PLACES_ENV_NAMES) {
    if (process.env[name]?.trim()) return name;
  }
  return null;
}

