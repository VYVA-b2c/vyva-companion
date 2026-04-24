import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles } from "../../shared/schema.js";

const DEMO_USER_ID = "demo-user";

const router = Router();

const CACHE_TTL_MS = 30 * 60 * 1000;

interface WeatherResult {
  city: string;
  temperature: number;
  description: string;
}

const cache = new Map<string, { data: WeatherResult; expiresAt: number }>();

function wmoCodeToKey(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "partlyCloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 55) return "drizzle";
  if (code >= 61 && code <= 65) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 85 && code <= 86) return "snowShowers";
  if (code >= 95) return "thunderstorm";
  return "cloudy";
}

router.get("/by-ip", async (req: Request, res: Response) => {
  // Determine the real client IP (handle proxy headers)
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = (typeof forwarded === "string" ? forwarded.split(",")[0] : null)
    ?? req.socket?.remoteAddress
    ?? "";
  // Strip IPv6-mapped IPv4 prefix (::ffff:)
  const clientIp = rawIp.replace(/^::ffff:/, "").trim();

  const cacheKey = `ip:${clientIp}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    // freeipapi.com — HTTPS, free, no key required
    const ipApiUrl = clientIp
      ? `https://freeipapi.com/api/json/${encodeURIComponent(clientIp)}`
      : "https://freeipapi.com/api/json/";

    const ipRes = await fetch(ipApiUrl, { signal: AbortSignal.timeout(5000) });
    if (!ipRes.ok) {
      return res.status(502).json({ error: "IP geolocation failed" });
    }
    const ipData = await ipRes.json() as {
      cityName?: string;
      latitude?: number | null;
      longitude?: number | null;
    };

    if (ipData.latitude == null || ipData.longitude == null) {
      return res.status(404).json({ error: "Could not determine location from IP" });
    }

    const resolvedCity = ipData.cityName?.trim() || "Your location";
    const lat = ipData.latitude;
    const lon = ipData.longitude;

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=auto`;
    const forecastRes = await fetch(forecastUrl, { signal: AbortSignal.timeout(8000) });
    if (!forecastRes.ok) {
      return res.status(502).json({ error: "Forecast fetch failed" });
    }
    const forecastData = await forecastRes.json() as {
      current?: { temperature_2m?: number; weather_code?: number };
    };

    const temperature = Math.round(forecastData.current?.temperature_2m ?? 0);
    const weatherCode = forecastData.current?.weather_code ?? 0;
    const description = `weather.${wmoCodeToKey(weatherCode)}`;

    const result: WeatherResult = { city: resolvedCity, temperature, description };
    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return res.json(result);
  } catch (err) {
    console.error("[weather by-ip]", err);
    return res.status(500).json({ error: "Failed to fetch weather by IP" });
  }
});

router.get("/by-coords", async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  const cacheKey = `coords:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const nominatimRes = await fetch(nominatimUrl, {
      headers: { "User-Agent": "VyvaApp/1.0" },
    });
    let resolvedCity = "Your location";
    if (nominatimRes.ok) {
      const nominatimData = await nominatimRes.json() as {
        address?: {
          city?: string;
          town?: string;
          village?: string;
          hamlet?: string;
          suburb?: string;
          county?: string;
          state?: string;
        };
      };
      const addr = nominatimData.address;
      const locality = addr?.city ?? addr?.town ?? addr?.village ?? addr?.hamlet ?? addr?.suburb;
      if (locality) {
        resolvedCity = locality;
      } else {
        console.debug(`[weather by-coords] rural fallback triggered for ${lat},${lon} (addr: county=${addr?.county}, state=${addr?.state})`);
        let nearbyPlace: string | null = null;

        const zoomLevels = [14, 10];
        for (const zoom of zoomLevels) {
          const zoomUrl =
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=${zoom}`;
          const zoomRes = await fetch(zoomUrl, { headers: { "User-Agent": "VyvaApp/1.0" } });
          if (zoomRes.ok) {
            const zoomData = await zoomRes.json() as {
              name?: string;
              address?: {
                city?: string; town?: string; village?: string;
                hamlet?: string; suburb?: string; county?: string; state?: string;
              };
            };
            const zoomAddr = zoomData.address;
            const zoomLocality =
              zoomAddr?.city ?? zoomAddr?.town ?? zoomAddr?.village ??
              zoomAddr?.hamlet ?? zoomAddr?.suburb;
            if (
              zoomLocality &&
              zoomLocality !== addr?.county &&
              zoomLocality !== addr?.state
            ) {
              nearbyPlace = zoomLocality;
              break;
            }
            if (
              zoomData.name &&
              zoomData.name !== addr?.county &&
              zoomData.name !== addr?.state
            ) {
              nearbyPlace = zoomData.name;
              break;
            }
          }
        }

        if (!nearbyPlace) {
          const radiusSteps = [0.25, 0.5, 1.0];
          for (const radius of radiusSteps) {
            const minLon = lon - radius;
            const maxLon = lon + radius;
            const minLat = lat - radius;
            const maxLat = lat + radius;
            const searchParams = new URLSearchParams({
              format: "json",
              limit: "10",
              addressdetails: "1",
              viewbox: `${minLon},${maxLat},${maxLon},${minLat}`,
              bounded: "1",
              featuretype: "settlement",
            });
            if (addr?.state) searchParams.set("state", addr.state);
            const searchUrl =
              `https://nominatim.openstreetmap.org/search?${searchParams}`;
            const searchRes = await fetch(searchUrl, {
              headers: { "User-Agent": "VyvaApp/1.0" },
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json() as Array<{
                display_name?: string;
                type?: string;
                class?: string;
                lat?: string;
                lon?: string;
              }>;
              const places = searchData.filter(
                (r) =>
                  r.class === "place" &&
                  ["city", "town", "village", "hamlet", "suburb"].includes(r.type ?? "")
              );
              let nearest: { name: string; dist: number } | null = null;
              for (const place of places) {
                const name = place.display_name?.split(",")[0]?.trim();
                if (!name || !place.lat || !place.lon) continue;
                const dlat = parseFloat(place.lat) - lat;
                const dlon = parseFloat(place.lon) - lon;
                const dist = Math.sqrt(dlat * dlat + dlon * dlon);
                if (!nearest || dist < nearest.dist) {
                  nearest = { name, dist };
                }
              }
              if (nearest) {
                nearbyPlace = nearest.name;
                break;
              }
            }
          }
        }

        resolvedCity = nearbyPlace ?? addr?.county ?? addr?.state ?? "Your location";
        console.debug(`[weather by-coords] rural fallback resolved to "${resolvedCity}" (nearbyPlace=${nearbyPlace ?? "none"})`);
      }
    }

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=auto`;
    const forecastRes = await fetch(forecastUrl);
    if (!forecastRes.ok) {
      return res.status(502).json({ error: "Forecast fetch failed" });
    }
    const forecastData = await forecastRes.json() as {
      current?: { temperature_2m?: number; weather_code?: number };
    };

    const temperature = Math.round(forecastData.current?.temperature_2m ?? 0);
    const weatherCode = forecastData.current?.weather_code ?? 0;
    const description = `weather.${wmoCodeToKey(weatherCode)}`;

    const result: WeatherResult = { city: resolvedCity, temperature, description };
    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return res.json(result);
  } catch (err) {
    console.error("[weather by-coords]", err);
    return res.status(500).json({ error: "Failed to fetch weather by coords" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  const userId = req.user?.id ?? DEMO_USER_ID;

  const cached = cache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    const rows = await db
      .select({ city: profiles.city, country_code: profiles.country_code })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    const profile = rows[0];
    if (!profile?.city) {
      return res.status(404).json({ error: "No city in profile" });
    }

    const cityName = profile.city.trim();
    const countryCode = profile.country_code ?? "";

    const geoQuery = encodeURIComponent(cityName);
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${geoQuery}&count=1&language=en&format=json${countryCode ? `&country_code=${countryCode}` : ""}`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return res.status(502).json({ error: "Geocoding failed" });
    }
    const geoData = await geoRes.json() as { results?: Array<{ latitude: number; longitude: number; name: string }> };
    const geoResult = geoData.results?.[0];
    if (!geoResult) {
      return res.status(404).json({ error: "City not found" });
    }

    const { latitude, longitude, name: resolvedCity } = geoResult;

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=auto`;
    const forecastRes = await fetch(forecastUrl);
    if (!forecastRes.ok) {
      return res.status(502).json({ error: "Forecast fetch failed" });
    }
    const forecastData = await forecastRes.json() as {
      current?: { temperature_2m?: number; weather_code?: number }
    };

    const temperature = Math.round(forecastData.current?.temperature_2m ?? 0);
    const weatherCode = forecastData.current?.weather_code ?? 0;
    const description = `weather.${wmoCodeToKey(weatherCode)}`;

    const result: WeatherResult = {
      city: resolvedCity,
      temperature,
      description,
    };

    cache.set(userId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return res.json(result);
  } catch (err) {
    console.error("[weather GET]", err);
    return res.status(500).json({ error: "Failed to fetch weather" });
  }
});

export default router;
