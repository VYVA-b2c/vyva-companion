import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Phone,
  Clock,
  User,
  ShoppingCart,
  Globe,
  UtensilsCrossed,
  StickyNote,
  Loader2,
  ExternalLink,
} from "lucide-react";

export interface ProviderDetails {
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

interface FullPlaceDetails {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  location?: { latitude: number; longitude: number };
  error?: { message: string };
}

interface MerchantDetailSheetProps {
  provider: ProviderDetails | null;
  categoryLabel: string;
  open: boolean;
  onClose: () => void;
  onSave: (updated: ProviderDetails) => Promise<void>;
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 font-body text-[12px] font-medium text-vyva-text-2">
        {icon}
        {label}
      </label>
      {children}
      {hint && (
        <p className="font-body text-[11px] text-vyva-text-3">{hint}</p>
      )}
    </div>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function MerchantDetailSheet({
  provider,
  categoryLabel,
  open,
  onClose,
  onSave,
}: MerchantDetailSheetProps) {
  const [form, setForm] = useState<ProviderDetails | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapError, setMapError] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (provider) {
      setForm({ ...provider });
      setMapError(false);
      if (provider.google_place_id) {
        fetchFullDetails(provider.google_place_id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const fetchFullDetails = async (placeId: string) => {
    setLoadingPlace(true);
    try {
      const res = await fetch(`/api/places/details/${encodeURIComponent(placeId)}?full=1`);
      if (!res.ok) return;
      const data = await res.json() as FullPlaceDetails;
      setForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lat:          data.location?.latitude  ?? prev.lat,
          lng:          data.location?.longitude ?? prev.lng,
          website_uri:  prev.website_uri  || data.websiteUri  || "",
          opening_hours: prev.opening_hours?.length
            ? prev.opening_hours
            : (data.regularOpeningHours?.weekdayDescriptions ?? []),
          phone:   prev.phone   || data.nationalPhoneNumber || data.internationalPhoneNumber || "",
          address: prev.address || data.formattedAddress || "",
        };
      });
    } catch {
    } finally {
      setLoadingPlace(false);
    }
  };

  const handleSave = async () => {
    if (!form || saving) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof ProviderDetails, value: string) => {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const setHours = (raw: string) => {
    const lines = raw.split("\n").map((l) => l.trimEnd());
    setForm((prev) => prev ? { ...prev, opening_hours: lines } : prev);
  };

  if (!form) return null;

  const mapUrl = form.lat && form.lng
    ? `/api/places/staticmap?lat=${form.lat}&lng=${form.lng}`
    : null;

  const mapsLink = form.google_maps_url
    || (form.google_place_id ? `https://www.google.com/maps/place/?q=place_id:${form.google_place_id}` : null);

  const sheetSide = isDesktop ? "right" : "bottom";
  const sheetClass = isDesktop
    ? "w-[440px] h-full p-0 flex flex-col"
    : "h-[90vh] rounded-t-[20px] p-0 flex flex-col";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side={sheetSide}
        className={sheetClass}
        data-testid="sheet-merchant-detail"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-vyva-border flex-shrink-0">
          <SheetTitle className="font-display text-[18px] font-semibold text-vyva-text-1 text-left">
            {form.name}
          </SheetTitle>
          <p className="font-body text-[13px] text-vyva-text-3 text-left">{categoryLabel}</p>
        </SheetHeader>

        <Tabs defaultValue="place" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 flex-shrink-0 grid grid-cols-3 bg-vyva-cream rounded-full h-9">
            <TabsTrigger value="place"       className="rounded-full text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-merchant-place">Place</TabsTrigger>
            <TabsTrigger value="contact"     className="rounded-full text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-merchant-contact">Contact</TabsTrigger>
            <TabsTrigger value="preferences" className="rounded-full text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-merchant-preferences">My Prefs</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* ── PLACE TAB ── */}
            <TabsContent value="place" className="px-5 pt-4 pb-6 space-y-4 mt-0">
              {mapUrl && !mapError ? (
                <div className="rounded-[14px] overflow-hidden border border-vyva-border relative">
                  <img
                    src={mapUrl}
                    alt="Map"
                    className="w-full object-cover"
                    style={{ height: 160 }}
                    data-testid="img-merchant-map"
                    onError={() => setMapError(true)}
                  />
                  {mapsLink && (
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-body text-[11px] text-vyva-purple shadow-sm"
                      data-testid="link-merchant-maps"
                    >
                      <ExternalLink size={10} />
                      Open in Maps
                    </a>
                  )}
                </div>
              ) : loadingPlace ? (
                <Skeleton className="w-full rounded-[14px]" style={{ height: 160 }} />
              ) : mapsLink ? (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-[14px] border border-vyva-border bg-white px-4 py-3 font-body text-[13px] text-vyva-purple"
                  data-testid="link-merchant-maps-fallback"
                >
                  <MapPin size={14} />
                  View on Google Maps
                  <ExternalLink size={12} className="ml-auto" />
                </a>
              ) : null}

              <Field label="Address" icon={<MapPin size={12} />}>
                <Input
                  data-testid="input-merchant-address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Full address"
                  className="bg-white text-[13px]"
                />
              </Field>

              <Field label="Website" icon={<Globe size={12} />}>
                <Input
                  data-testid="input-merchant-website"
                  type="url"
                  value={form.website_uri ?? ""}
                  onChange={(e) => set("website_uri", e.target.value)}
                  placeholder="https://example.com"
                  className="bg-white text-[13px]"
                />
              </Field>

              <Field
                label="Opening hours"
                icon={<>
                  <Clock size={12} />
                  {loadingPlace && <Loader2 size={11} className="animate-spin text-vyva-text-3 ml-1" />}
                </>}
                hint="One line per day, e.g. Monday: 9am – 6pm. Auto-filled from Google when available."
              >
                <Textarea
                  data-testid="input-merchant-opening-hours"
                  value={(form.opening_hours ?? []).join("\n")}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder={"Monday: 9am – 6pm\nTuesday: 9am – 6pm\n…"}
                  className="bg-white text-[13px] min-h-[140px] resize-none font-mono"
                />
              </Field>
            </TabsContent>

            {/* ── CONTACT TAB ── */}
            <TabsContent value="contact" className="px-5 pt-4 pb-6 space-y-4 mt-0">
              <div
                className="rounded-[14px] bg-vyva-cream border border-vyva-border px-4 py-3 font-body text-[12px] text-vyva-text-2"
                data-testid="banner-contact-hint"
              >
                Add a contact person so VYVA can reach the right person when helping you.
              </div>

              <Field label="Main phone" icon={<Phone size={12} />}>
                <Input
                  data-testid="input-merchant-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+44 1234 567890"
                  className="bg-white text-[13px]"
                />
              </Field>

              <Field label="Contact person name" icon={<User size={12} />}>
                <Input
                  data-testid="input-merchant-contact-name"
                  value={form.contact_name ?? ""}
                  onChange={(e) => set("contact_name", e.target.value)}
                  placeholder="e.g. Margaret"
                  className="bg-white text-[13px]"
                />
              </Field>

              <Field label="Their role" icon={<User size={12} />}>
                <Input
                  data-testid="input-merchant-contact-role"
                  value={form.contact_role ?? ""}
                  onChange={(e) => set("contact_role", e.target.value)}
                  placeholder="e.g. Pharmacist, Manager, Reception"
                  className="bg-white text-[13px]"
                />
              </Field>

              <Field label="Their direct phone" icon={<Phone size={12} />}>
                <Input
                  data-testid="input-merchant-contact-phone"
                  type="tel"
                  value={form.contact_phone ?? ""}
                  onChange={(e) => set("contact_phone", e.target.value)}
                  placeholder="+44 1234 567890"
                  className="bg-white text-[13px]"
                />
              </Field>
            </TabsContent>

            {/* ── MY PREFS TAB ── */}
            <TabsContent value="preferences" className="px-5 pt-4 pb-6 space-y-4 mt-0">
              <Field label="Usual order / regular items" icon={<ShoppingCart size={12} />}>
                <Textarea
                  data-testid="input-merchant-usual-order"
                  value={form.usual_order ?? ""}
                  onChange={(e) => set("usual_order", e.target.value)}
                  placeholder="e.g. Large semi-skimmed milk, sourdough loaf, orange juice"
                  className="bg-white text-[13px] min-h-[80px] resize-none"
                />
              </Field>

              <Field label="Special requests / standing preferences" icon={<StickyNote size={12} />}>
                <Textarea
                  data-testid="input-merchant-special-requests"
                  value={form.special_requests ?? ""}
                  onChange={(e) => set("special_requests", e.target.value)}
                  placeholder="e.g. Always ask for the generic version of medication, no onions"
                  className="bg-white text-[13px] min-h-[80px] resize-none"
                />
              </Field>

              <Field label="Online ordering link" icon={<Globe size={12} />}>
                <Input
                  data-testid="input-merchant-order-url"
                  type="url"
                  value={form.online_order_url ?? ""}
                  onChange={(e) => set("online_order_url", e.target.value)}
                  placeholder="https://order.example.com"
                  className="bg-white text-[13px]"
                />
              </Field>

              <Field label="Menu link" icon={<UtensilsCrossed size={12} />}>
                <Input
                  data-testid="input-merchant-menu-url"
                  type="url"
                  value={form.menu_url ?? ""}
                  onChange={(e) => set("menu_url", e.target.value)}
                  placeholder="https://menu.example.com"
                  className="bg-white text-[13px]"
                />
              </Field>

              <Field label="Notes & insights" icon={<StickyNote size={12} />}>
                <Textarea
                  data-testid="input-merchant-notes"
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="e.g. Best time to call is mornings. Ask for Margaret."
                  className="bg-white text-[13px] min-h-[80px] resize-none"
                />
              </Field>
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-5 py-4 border-t border-vyva-border flex-shrink-0">
          <button
            data-testid="button-merchant-save"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-full font-body text-[16px] font-semibold text-white disabled:opacity-40"
            style={{ background: "#6B21A8" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
