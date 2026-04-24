import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlaceResult = {
  name: string;
  full_address: string;
  phone: string;
  google_place_id: string;
  google_maps_url: string;
  types?: string[];
};

export type PlaceCategory =
  | "doctor"
  | "pharmacy"
  | "hospital"
  | "dentist"
  | "physiotherapist"
  | "health"
  | "clinic"
  | "restaurant"
  | "cafe"
  | "meal_takeaway"
  | "meal_delivery"
  | "supermarket"
  | "grocery_or_supermarket"
  | "convenience_store"
  | "shopping_mall"
  | "store"
  | "beauty_salon"
  | "hair_care"
  | "spa"
  | "gym";

interface PlacesSearchProps {
  category?: PlaceCategory;
  onSelect: (place: PlaceResult | null) => void;
  onSdkError?: () => void;
  placeholder?: string;
  className?: string;
  initialValue?: PlaceResult | null;
  showSelected?: boolean;
}

// Reference: https://developers.google.com/maps/documentation/places/web-service/place-types
// Only Table A (primary) types are valid for includedPrimaryTypes.
// Legacy types (meal_takeaway, grocery_or_supermarket, hair_care, food, health, store, etc.)
// and Table B category types are rejected by the Places API (New) and must not appear here.
export const CATEGORY_TYPES: Record<PlaceCategory, string[]> = {
  // Health
  doctor:                 ["doctor", "medical_clinic"],
  pharmacy:               ["pharmacy", "drugstore"],
  hospital:               ["hospital"],
  dentist:                ["dentist", "dental_clinic"],
  physiotherapist:        ["physiotherapist"],
  health:                 ["doctor", "dentist", "physiotherapist", "pharmacy", "medical_clinic", "hospital"], // 6 types — API allows up to 50
  clinic:                 ["medical_clinic", "doctor"],
  // Food & Drink
  restaurant:             ["restaurant"],
  cafe:                   ["cafe", "coffee_shop", "bakery"],
  meal_takeaway:          ["fast_food_restaurant", "restaurant"],
  meal_delivery:          ["restaurant", "fast_food_restaurant"],
  // Grocery & Convenience
  supermarket:            ["supermarket", "grocery_store"],
  grocery_or_supermarket: ["grocery_store", "supermarket"],
  convenience_store:      ["convenience_store"],
  // Shopping
  shopping_mall:          ["shopping_mall", "department_store"],
  store:                  ["department_store", "clothing_store", "home_goods_store"],
  // Wellness & Beauty
  beauty_salon:           ["beauty_salon", "nail_salon"],
  hair_care:              ["hair_salon", "barber_shop"],
  spa:                    ["spa"],
  gym:                    ["gym", "sports_club"],
};

interface AutocompleteSuggestion {
  placePrediction?: {
    placeId: string;
    text?: { text: string };
    structuredFormat?: {
      mainText?: { text: string };
      secondaryText?: { text: string };
    };
  } | null;
}

interface AutocompleteResponse {
  suggestions?: AutocompleteSuggestion[];
  error?: { message: string; status: string };
}

interface PlaceDetailsResponse {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  types?: string[];
  error?: { message: string };
}

const GEO_CACHE_KEY = "geo_position_cache";
const GEO_CACHE_TTL_MS = 30 * 60 * 1000;

interface GeoCacheEntry { lat: number; lng: number; timestamp: number }

function readGeoCache(): GeoCacheEntry | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as GeoCacheEntry;
    if (typeof entry.lat !== "number" || typeof entry.lng !== "number" || typeof entry.timestamp !== "number") return null;
    return entry;
  } catch { return null; }
}

function writeGeoCache(lat: number, lng: number): void {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ lat, lng, timestamp: Date.now() })); } catch { }
}

// Returns cached location instantly (null if none). Kicks off a background GPS
// request to populate the cache for next time — never blocks the search.
function getGeoPositionSync(): { lat: number; lng: number } | null {
  const cached = readGeoCache();
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL_MS) {
    return { lat: cached.lat, lng: cached.lng };
  }
  // Kick off background fetch so future searches benefit from location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => writeGeoCache(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { timeout: 10000, maximumAge: GEO_CACHE_TTL_MS }
    );
  }
  return null;
}

async function callAutocomplete(
  input: string,
  includedPrimaryTypes?: string[],
  locationBias?: { circle: { center: { lat: number; lng: number }; radius: number } }
): Promise<AutocompleteSuggestion[]> {
  const body: Record<string, unknown> = { input };
  if (includedPrimaryTypes?.length) body.includedPrimaryTypes = includedPrimaryTypes;
  if (locationBias) body.locationBias = locationBias;

  const res = await fetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as AutocompleteResponse;
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json() as AutocompleteResponse;
  return data.suggestions?.filter((s) => s.placePrediction) ?? [];
}

export function PlacesSearch({
  category,
  onSelect,
  onSdkError,
  placeholder = "Search for a place…",
  className,
  initialValue,
  showSelected = true,
}: PlacesSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(initialValue ?? null);

  useEffect(() => {
    setSelectedPlace(initialValue ?? null);
  }, [initialValue]);

  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [fetchingPlace, setFetchingPlace] = useState(false);
  const [open, setOpen] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!input.trim() || sdkError) {
      setSuggestions([]);
      setOpen(false);
      setIsFallback(false);
      return;
    }

    try {
      const geo = getGeoPositionSync();
      const locationBias = geo
        ? { circle: { center: { latitude: geo.lat, longitude: geo.lng }, radius: 50000 } }
        : undefined;

      const types = category ? CATEGORY_TYPES[category] : undefined;

      let results = await callAutocomplete(input, types, locationBias);

      if (results.length === 0 && types?.length) {
        results = await callAutocomplete(input, undefined, locationBias);
        setIsFallback(results.length > 0);
      } else {
        setIsFallback(false);
      }

      setSuggestions(results);
      setOpen(results.length > 0);
    } catch (err) {
      console.warn("[PlacesSearch] autocomplete error:", err);
      try {
        const geo = getGeoPositionSync();
        const locationBias = geo
          ? { circle: { center: { latitude: geo.lat, longitude: geo.lng }, radius: 50000 } }
          : undefined;
        const results = await callAutocomplete(input, undefined, locationBias);
        setIsFallback(results.length > 0);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch (err2) {
        console.warn("[PlacesSearch] fallback also failed:", err2);
        const isServerDown = err instanceof Error && (err.message.includes("503") || err.message.includes("fetch"));
        if (isServerDown) {
          setSdkError("Place search unavailable — add details manually below.");
          onSdkError?.();
        }
        setSuggestions([]);
        setOpen(false);
        setIsFallback(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = async (suggestion: AutocompleteSuggestion) => {
    const pred = suggestion.placePrediction;
    if (!pred) return;

    const displayText =
      pred.structuredFormat?.mainText?.text ?? pred.text?.text ?? "";
    const secondary = pred.structuredFormat?.secondaryText?.text ?? "";

    setQuery(displayText);
    setOpen(false);
    setSuggestions([]);
    setFetchingPlace(true);

    try {
      const res = await fetch(`/api/places/details/${encodeURIComponent(pred.placeId)}`);
      const details = await res.json() as PlaceDetailsResponse;

      const placeId = details.id ?? pred.placeId;
      const result: PlaceResult = {
        name: details.displayName?.text ?? displayText,
        full_address: details.formattedAddress ?? secondary,
        phone: details.nationalPhoneNumber ?? "",
        google_place_id: placeId,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        types: details.types,
      };

      setSelectedPlace(result);
      onSelect(result);
    } catch {
      const placeId = pred.placeId;
      const fallback: PlaceResult = {
        name: displayText,
        full_address: secondary,
        phone: "",
        google_place_id: placeId,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
      };
      setSelectedPlace(fallback);
      onSelect(fallback);
    } finally {
      setFetchingPlace(false);
    }
  };

  const handleClear = () => {
    setSelectedPlace(null);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onSelect(null);
  };

  if (sdkError) {
    return (
      <div
        className={cn(
          "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700",
          className
        )}
        data-testid="places-search-error"
      >
        {sdkError}
      </div>
    );
  }

  if (showSelected && selectedPlace) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2",
          className
        )}
        data-testid="places-search-selected"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" data-testid="places-search-selected-name">
            {selectedPlace.name}
          </p>
          {selectedPlace.full_address && (
            <p
              className="truncate text-xs text-muted-foreground"
              data-testid="places-search-selected-address"
            >
              {selectedPlace.full_address}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleClear}
          data-testid="places-search-clear"
          aria-label="Clear selected place"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        data-testid="places-search-input"
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        disabled={fetchingPlace}
        autoComplete="off"
      />

      {fetchingPlace && (
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          data-testid="places-search-fetching"
        >
          Loading…
        </div>
      )}

      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-md"
          data-testid="places-search-suggestions"
        >
          {suggestions.map((s, i) => {
            const pred = s.placePrediction;
            if (!pred) return null;
            const main = pred.structuredFormat?.mainText?.text ?? pred.text?.text ?? "";
            const secondary = pred.structuredFormat?.secondaryText?.text ?? "";

            return (
              <li
                key={pred.placeId}
                data-testid={`places-suggestion-${i}`}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s);
                }}
              >
                <span className="font-medium">{main}</span>
                {secondary && (
                  <span className="ml-1 text-muted-foreground">{secondary}</span>
                )}
              </li>
            );
          })}
          {isFallback && (
            <li
              className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground"
              data-testid="places-search-fallback-notice"
            >
              Showing all place types
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
