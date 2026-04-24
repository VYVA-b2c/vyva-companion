import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Building2,
  Trash2,
  Loader2,
  Plus,
  PenLine,
  MapPin,
  Phone,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlacesSearch, PlaceResult, PlaceCategory, CATEGORY_TYPES } from "@/components/onboarding/PlacesSearch";
import { CategoryFilterBar } from "@/components/onboarding/CategoryFilterBar";
import { MerchantDetailSheet, ProviderDetails } from "@/components/onboarding/MerchantDetailSheet";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";

interface ProviderCategory {
  id: string;
  label: string;
  placesType: PlaceCategory;
}

const GOOGLE_TYPE_LABELS: Record<string, string> = {
  accounting: "Accounting",
  airport: "Airport",
  amusement_park: "Amusement Park",
  aquarium: "Aquarium",
  art_gallery: "Art Gallery",
  atm: "ATM",
  bakery: "Bakery",
  bank: "Bank",
  bar: "Bar",
  barber_shop: "Barber",
  beauty_salon: "Beauty Salon",
  bicycle_store: "Bicycle Store",
  book_store: "Book Store",
  bowling_alley: "Bowling Alley",
  bus_station: "Bus Station",
  cafe: "Café",
  campground: "Campground",
  car_dealer: "Car Dealer",
  car_rental: "Car Rental",
  car_repair: "Car Repair",
  car_wash: "Car Wash",
  casino: "Casino",
  cemetery: "Cemetery",
  church: "Church",
  city_hall: "City Hall",
  clothing_store: "Clothing Store",
  coffee_shop: "Coffee Shop",
  convenience_store: "Convenience Store",
  courthouse: "Courthouse",
  dentist: "Dentist",
  dental_clinic: "Dental Clinic",
  department_store: "Department Store",
  doctor: "Doctor",
  drugstore: "Drugstore",
  electrician: "Electrician",
  electronics_store: "Electronics Store",
  embassy: "Embassy",
  emergency_room: "Emergency Room",
  fire_station: "Fire Station",
  fitness_center: "Fitness Centre",
  florist: "Florist",
  food: "Food",
  food_store: "Food Store",
  funeral_home: "Funeral Home",
  furniture_store: "Furniture Store",
  gas_station: "Petrol Station",
  grocery_or_supermarket: "Supermarket",
  gym: "Gym",
  hair_care: "Hair Salon",
  hardware_store: "Hardware Store",
  health: "Health Facility",
  hindu_temple: "Hindu Temple",
  home_goods_store: "Home Goods Store",
  hospital: "Hospital",
  insurance_agency: "Insurance Agency",
  jewelry_store: "Jewellery Store",
  laundry: "Laundry",
  lawyer: "Lawyer",
  library: "Library",
  liquor_store: "Liquor Store",
  local_government_office: "Government Office",
  locksmith: "Locksmith",
  lodging: "Lodging",
  meal_delivery: "Meal Delivery",
  meal_takeaway: "Takeaway",
  medical_clinic: "Medical Clinic",
  mosque: "Mosque",
  movie_rental: "Movie Rental",
  movie_theater: "Cinema",
  moving_company: "Moving Company",
  museum: "Museum",
  nail_salon: "Nail Salon",
  night_club: "Night Club",
  park: "Park",
  parking: "Parking",
  pet_store: "Pet Store",
  pharmacy: "Pharmacy",
  physiotherapist: "Physiotherapist",
  physical_therapist: "Physiotherapist",
  plumber: "Plumber",
  point_of_interest: "Point of Interest",
  police: "Police Station",
  post_office: "Post Office",
  primary_school: "Primary School",
  real_estate_agency: "Real Estate Agency",
  restaurant: "Restaurant",
  roofing_contractor: "Roofing Contractor",
  rv_park: "RV Park",
  school: "School",
  secondary_school: "Secondary School",
  shoe_store: "Shoe Store",
  shopping_mall: "Shopping Mall",
  spa: "Spa",
  sports_club: "Sports Club",
  stadium: "Stadium",
  storage: "Storage",
  store: "Store",
  subway_station: "Subway Station",
  supermarket: "Supermarket",
  synagogue: "Synagogue",
  taxi_stand: "Taxi Stand",
  tourist_attraction: "Tourist Attraction",
  train_station: "Train Station",
  transit_station: "Transit Station",
  travel_agency: "Travel Agency",
  university: "University",
  veterinary_care: "Vet",
  zoo: "Zoo",
};

const GENERIC_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "premise",
  "political",
  "locality",
  "sublocality",
  "neighborhood",
  "street_address",
  "route",
  "geocode",
  "food",
]);

function formatFallbackType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getPrimaryGoogleTypeLabel(types: string[]): string | null {
  const specific = types.find((t) => !GENERIC_TYPES.has(t) && GOOGLE_TYPE_LABELS[t]);
  if (specific) return GOOGLE_TYPE_LABELS[specific];
  const mapped = types.find((t) => GOOGLE_TYPE_LABELS[t]);
  if (mapped) return GOOGLE_TYPE_LABELS[mapped];
  const fallback = types.find((t) => !GENERIC_TYPES.has(t));
  return fallback ? formatFallbackType(fallback) : null;
}

const PROVIDER_CATEGORIES: ProviderCategory[] = [
  { id: "pharmacy",        label: "Pharmacy",     placesType: "pharmacy" },
  { id: "doctor",          label: "GP / Doctor",  placesType: "doctor" },
  { id: "hospital",        label: "Hospital",     placesType: "hospital" },
  { id: "dentist",         label: "Dentist",      placesType: "dentist" },
  { id: "physiotherapist", label: "Physio",       placesType: "physiotherapist" },
  { id: "clinic",          label: "Clinic",       placesType: "health" },
  { id: "restaurant",      label: "Restaurant",   placesType: "restaurant" },
  { id: "cafe",            label: "Café",         placesType: "cafe" },
  { id: "meal_takeaway",   label: "Takeaway",     placesType: "meal_takeaway" },
  { id: "meal_delivery",   label: "Deliveries",   placesType: "meal_delivery" },
  { id: "supermarket",     label: "Supermarket",  placesType: "supermarket" },
  { id: "convenience",     label: "Convenience",  placesType: "convenience_store" },
  { id: "shopping",        label: "Shopping",     placesType: "shopping_mall" },
  { id: "beauty_salon",    label: "Beauty Salon", placesType: "beauty_salon" },
  { id: "hair_care",       label: "Hair Care",    placesType: "hair_care" },
  { id: "spa",             label: "Spa",          placesType: "spa" },
  { id: "gym",             label: "Gym",          placesType: "gym" },
];

interface ProviderEntry {
  id: string;
  category: string;
  name: string;
  address: string;
  phone: string;
  google_maps_url?: string;
  google_place_id?: string;
  lat?: number;
  lng?: number;
  website_uri?: string;
  opening_hours?: string[];
  contact_name?: string;
  contact_role?: string;
  contact_phone?: string;
  usual_order?: string;
  special_requests?: string;
  online_order_url?: string;
  menu_url?: string;
  notes?: string;
}

interface SavedProvider {
  name: string;
  role?: string;
  phone?: string;
  google_maps_url?: string;
  google_place_id?: string;
  address?: string;
  lat?: number;
  lng?: number;
  website_uri?: string;
  opening_hours?: string[];
  contact_name?: string;
  contact_role?: string;
  contact_phone?: string;
  usual_order?: string;
  special_requests?: string;
  online_order_url?: string;
  menu_url?: string;
  notes?: string;
}

interface PendingProvider {
  name: string;
  address: string;
  phone: string;
  mapsUrl: string;
  placeId: string;
  types?: string[];
}

async function saveProvidersToServer(entries: ProviderEntry[]): Promise<Response> {
  return await apiFetch("/api/onboarding/section/providers", {
    method: "POST",
    body: JSON.stringify({
      providers: entries.map((e) => ({
        name:             e.name,
        role:             e.category,
        phone:            e.phone,
        google_maps_url:  e.google_maps_url,
        google_place_id:  e.google_place_id,
        address:          e.address || undefined,
        lat:              e.lat,
        lng:              e.lng,
        website_uri:      e.website_uri || undefined,
        opening_hours:    e.opening_hours?.length ? e.opening_hours : undefined,
        contact_name:     e.contact_name || undefined,
        contact_role:     e.contact_role || undefined,
        contact_phone:    e.contact_phone || undefined,
        usual_order:      e.usual_order || undefined,
        special_requests: e.special_requests || undefined,
        online_order_url: e.online_order_url || undefined,
        menu_url:         e.menu_url || undefined,
        notes:            e.notes || undefined,
      })),
    }),
  });
}

const ProvidersSection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeCategory, setActiveCategory] = useState<string>(PROVIDER_CATEGORIES[0].id);
  const [providers, setProviders] = useState<ProviderEntry[]>([]);

  const [pending, setPending] = useState<PendingProvider | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  const [searchKey, setSearchKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderEntry | null>(null);
  const counterRef = useRef(0);
  const loadedRef = useRef(false);

  const { data, isLoading } = useQuery<{
    profile: { data_sharing_consent?: { providers?: { providers?: SavedProvider[] } } } | null;
  }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (loadedRef.current) return;
    const saved = data?.profile?.data_sharing_consent?.providers?.providers;
    if (Array.isArray(saved) && saved.length > 0) {
      loadedRef.current = true;
      const entries: ProviderEntry[] = saved.map((p, i) => {
        counterRef.current = i + 1;
        const categoryMatch = PROVIDER_CATEGORIES.find(
          (c) => c.id === p.role || c.placesType === p.role || c.label.toLowerCase() === (p.role ?? "").toLowerCase()
        );
        return {
          id: `provider-${i + 1}`,
          category: categoryMatch?.id ?? "pharmacy",
          name: p.name,
          address: p.address ?? "",
          phone: p.phone ?? "",
          google_maps_url: p.google_maps_url,
          google_place_id: p.google_place_id,
          lat: p.lat,
          lng: p.lng,
          website_uri: p.website_uri,
          opening_hours: p.opening_hours,
          contact_name: p.contact_name,
          contact_role: p.contact_role,
          contact_phone: p.contact_phone,
          usual_order: p.usual_order,
          special_requests: p.special_requests,
          online_order_url: p.online_order_url,
          menu_url: p.menu_url,
          notes: p.notes,
        };
      });
      setProviders(entries);
    } else if (data && !isLoading) {
      loadedRef.current = true;
    }
  }, [data, isLoading]);

  const activeCategoryDef = PROVIDER_CATEGORIES.find((c) => c.id === activeCategory)!;

  const handleSearchSelect = (p: PlaceResult | null) => {
    if (!p) {
      setPending(null);
      return;
    }
    setPending({
      name: p.name,
      address: p.full_address,
      phone: p.phone,
      mapsUrl: p.google_maps_url ?? "",
      placeId: p.google_place_id ?? "",
      types: p.types,
    });
    setShowManualForm(false);
    setSearchKey((k) => k + 1);
  };

  const addFromPending = async () => {
    if (!pending || !pending.name.trim() || adding || saving) return;
    setAdding(true);
    counterRef.current += 1;
    const resolvedMapsUrl =
      pending.mapsUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [pending.name.trim(), pending.address.trim()].filter(Boolean).join(" ")
      )}`;
    const entry: ProviderEntry = {
      id: `provider-${counterRef.current}`,
      category: activeCategory,
      name: pending.name,
      address: pending.address,
      phone: pending.phone,
      google_maps_url: resolvedMapsUrl,
      google_place_id: pending.placeId || undefined,
    };
    const updated = [...providers, entry];
    setProviders(updated);
    const snapshot = pending;
    setPending(null);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setProviders(providers);
      setPending(snapshot);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not add provider", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const addFromManual = async () => {
    if (!manualName.trim() || adding || saving) return;
    setAdding(true);
    counterRef.current += 1;
    const resolvedMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [manualName.trim(), manualAddress.trim()].filter(Boolean).join(" ")
    )}`;
    const entry: ProviderEntry = {
      id: `provider-${counterRef.current}`,
      category: activeCategory,
      name: manualName,
      address: manualAddress,
      phone: manualPhone,
      google_maps_url: resolvedMapsUrl,
    };
    const updated = [...providers, entry];
    setProviders(updated);
    const snapshotName = manualName;
    const snapshotAddress = manualAddress;
    const snapshotPhone = manualPhone;
    setManualName("");
    setManualAddress("");
    setManualPhone("");
    setShowManualForm(false);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setProviders(providers);
      setManualName(snapshotName);
      setManualAddress(snapshotAddress);
      setManualPhone(snapshotPhone);
      setShowManualForm(true);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not add provider", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeProvider = async (id: string) => {
    if (removingId || saving) return;
    setRemovingId(id);
    const previous = providers;
    const updated = providers.filter((p) => p.id !== id);
    setProviders(updated);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setProviders(previous);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not remove provider", description: msg, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(providers);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/complete/providers");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save providers", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (updated: ProviderDetails) => {
    const entry: ProviderEntry = {
      id:              updated.id,
      category:        updated.category,
      name:            updated.name,
      address:         updated.address,
      phone:           updated.phone,
      google_maps_url: updated.google_maps_url,
      google_place_id: updated.google_place_id,
      lat:             updated.lat,
      lng:             updated.lng,
      website_uri:     updated.website_uri,
      opening_hours:   updated.opening_hours,
      contact_name:    updated.contact_name,
      contact_role:    updated.contact_role,
      contact_phone:   updated.contact_phone,
      usual_order:     updated.usual_order,
      special_requests: updated.special_requests,
      online_order_url: updated.online_order_url,
      menu_url:        updated.menu_url,
      notes:           updated.notes,
    };
    const updatedList = providers.map((p) => p.id === entry.id ? entry : p);
    setProviders(updatedList);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(updatedList);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Provider updated" });
    } catch (err) {
      setProviders(providers);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not update provider", description: msg, variant: "destructive" });
      throw err;
    }
  };

  const categoryLabel = activeCategoryDef?.label ?? "provider";

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-providers-back"
          onClick={() => navigate("/onboarding/profile")}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0"
            style={{ background: "#F5F3FF" }}
          >
            <Building2 size={18} style={{ color: "#6B21A8" }} />
          </div>
          <h1 className="font-display text-[20px] font-semibold text-vyva-text-1">My Providers</h1>
        </div>
      </div>

      <div className="flex-1 px-5 space-y-4 pb-4">
        <p className="font-body text-[14px] text-vyva-text-2 leading-relaxed">
          Add your go-to places — pharmacies, restaurants, salons, gyms and more — so VYVA always knows where to direct you.
        </p>

        <CategoryFilterBar
          categories={PROVIDER_CATEGORIES}
          active={activeCategory}
          onChange={(id) => {
            setActiveCategory(id);
            setPending(null);
            setShowManualForm(false);
            setSearchKey((k) => k + 1);
          }}
        />

        <div data-testid="search-providers-places">
          <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
            Search for a {categoryLabel}
          </label>
          <PlacesSearch
            key={searchKey}
            category={activeCategoryDef?.placesType}
            onSelect={handleSearchSelect}
            onSdkError={() => setShowManualForm(true)}
            placeholder={`Search ${categoryLabel}…`}
            showSelected={false}
          />
        </div>

        {pending && (
          <div
            className="bg-white rounded-[18px] border border-vyva-purple/30 p-4 space-y-3"
            style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
            data-testid="card-provider-confirm"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-body text-[13px] font-semibold text-vyva-purple">
                Confirm this {categoryLabel}
              </p>
              {pending.types && pending.types.length > 0 &&
                !CATEGORY_TYPES[activeCategoryDef.placesType]?.some((t) =>
                  pending.types!.includes(t)
                ) && (() => {
                  const googleLabel = getPrimaryGoogleTypeLabel(pending.types!);
                  return (
                    <span
                      className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 font-body text-[11px] text-amber-700"
                      data-testid="chip-category-mismatch"
                    >
                      May not be a {categoryLabel}
                      {googleLabel && (
                        <> · Google identifies this as: {googleLabel}</>
                      )}
                    </span>
                  );
                })()}
            </div>

            <div className="space-y-2">
              <div>
                <label className="font-body text-[12px] text-vyva-text-3 mb-0.5 block">Name</label>
                <Input
                  data-testid="input-pending-name"
                  value={pending.name}
                  onChange={(e) => setPending({ ...pending, name: e.target.value })}
                  className="bg-white text-[14px]"
                />
              </div>
              <div>
                <label className="font-body text-[12px] text-vyva-text-3 mb-0.5 flex items-center gap-1">
                  <MapPin size={11} className="text-vyva-text-3" />
                  Address <span className="font-normal">(optional)</span>
                </label>
                <Input
                  data-testid="input-pending-address"
                  value={pending.address}
                  onChange={(e) => setPending({ ...pending, address: e.target.value })}
                  placeholder="Full address"
                  className="bg-white text-[13px]"
                />
              </div>
              <div>
                <label className="font-body text-[12px] text-vyva-text-3 mb-0.5 flex items-center gap-1">
                  <Phone size={11} className="text-vyva-text-3" />
                  Phone <span className="font-normal">(optional)</span>
                </label>
                <Input
                  data-testid="input-pending-phone"
                  type="tel"
                  value={pending.phone}
                  onChange={(e) => setPending({ ...pending, phone: e.target.value })}
                  placeholder="+44 1234 567890"
                  className="bg-white text-[13px]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                data-testid="button-pending-add"
                onClick={addFromPending}
                disabled={!pending.name.trim() || adding || saving}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 font-body text-[14px] font-semibold text-white disabled:opacity-40"
                style={{ background: "#6B21A8" }}
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {adding ? "Adding…" : "Add provider"}
              </button>
              <button
                data-testid="button-pending-cancel"
                onClick={() => { setPending(null); setSearchKey((k) => k + 1); }}
                className="rounded-full px-4 py-2 font-body text-[14px] text-vyva-text-2 border border-vyva-border"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!pending && (
          <button
            data-testid="button-add-manually"
            onClick={() => { setShowManualForm((v) => !v); }}
            className="flex items-center gap-1.5 font-body text-[13px] text-vyva-purple"
          >
            <PenLine size={14} />
            {showManualForm ? "Hide manual entry" : "Can't find it? Add manually"}
          </button>
        )}

        {showManualForm && !pending && (
          <div
            className="bg-white rounded-[18px] border border-vyva-border p-4 space-y-3"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            data-testid="form-provider-manual"
          >
            <p className="font-body text-[13px] font-semibold text-vyva-text-1">
              Add {categoryLabel} manually
            </p>
            <div>
              <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 block">
                Name <span className="text-vyva-red">*</span>
              </label>
              {isLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Input
                  data-testid="input-manual-name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder={`e.g. My local ${categoryLabel}`}
                  className="bg-white"
                />
              )}
            </div>
            <div>
              <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 block">
                Address <span className="text-vyva-text-3 font-normal">(optional)</span>
              </label>
              {isLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Input
                  data-testid="input-manual-address"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Full address"
                  className="bg-white"
                />
              )}
            </div>
            <div>
              <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 block">
                Phone <span className="text-vyva-text-3 font-normal">(optional)</span>
              </label>
              {isLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Input
                  data-testid="input-manual-phone"
                  type="tel"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="+44 1234 567890"
                  className="bg-white"
                />
              )}
            </div>
            <button
              data-testid="button-manual-add"
              onClick={addFromManual}
              disabled={!manualName.trim() || isLoading || adding || saving}
              className="flex items-center gap-2 rounded-full px-4 py-2 font-body text-[14px] font-medium text-vyva-purple border border-vyva-purple disabled:opacity-40"
            >
              <Plus size={16} />
              {adding ? "Adding…" : "Add provider"}
            </button>
          </div>
        )}

        {isLoading ? (
          <div
            className="bg-white rounded-[18px] border border-vyva-border p-4 space-y-3"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            data-testid="skeleton-saved-providers"
          >
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : providers.length > 0 ? (
          <div
            className="bg-white rounded-[18px] border border-vyva-border overflow-hidden"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            data-testid="list-saved-providers"
          >
            {providers.map((p) => {
              const catLabel = PROVIDER_CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category;
              const hasPrefs = p.usual_order || p.special_requests || p.contact_name || p.opening_hours?.length;
              return (
                <div
                  key={p.id}
                  data-testid={`item-provider-${p.id}`}
                  className="flex items-start gap-3 px-4 py-3 border-b border-vyva-border last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[14px] font-medium text-vyva-text-1">{p.name}</p>
                    <p className="font-body text-[11px] text-vyva-text-3">{catLabel}</p>
                    {p.address && (
                      <p className="font-body text-[12px] text-vyva-text-2 truncate">{p.address}</p>
                    )}
                    {hasPrefs && (
                      <p className="font-body text-[11px] text-vyva-purple mt-0.5">Details saved</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      data-testid={`button-providers-edit-${p.id}`}
                      onClick={() => setEditingProvider(p)}
                      disabled={!!removingId || saving}
                      className="p-1.5 rounded-full text-vyva-text-3 hover:text-vyva-purple flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Edit details"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      data-testid={`button-providers-remove-${p.id}`}
                      onClick={() => removeProvider(p.id)}
                      disabled={!!removingId || saving}
                      className="p-1.5 rounded-full text-vyva-text-3 hover:text-vyva-red flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {removingId === p.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="px-5 py-6">
        <button
          data-testid="button-providers-save"
          onClick={handleSave}
          disabled={saving || adding || !!removingId}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
          style={{ background: "#6B21A8" }}
        >
          {saving ? "Saving…" : "Save providers"}
        </button>
      </div>

      {editingProvider && (
        <MerchantDetailSheet
          provider={editingProvider}
          categoryLabel={PROVIDER_CATEGORIES.find((c) => c.id === editingProvider.category)?.label ?? editingProvider.category}
          open={!!editingProvider}
          onClose={() => setEditingProvider(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
};

export default ProvidersSection;
