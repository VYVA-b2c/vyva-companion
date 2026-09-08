import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Brain,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  HeartHandshake,
  Home,
  Megaphone,
  MessageSquare,
  Mail,
  LibraryBig,
  LayoutGrid,
  Mic,
  Package,
  ScrollText,
  PhoneCall,
  GitBranch,
  Sparkles,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();

type AdminItem = {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
};

const adminItems: AdminItem[] = [
  { label: "Modules", path: "/admin", description: "All admin areas", icon: LayoutGrid },
  { label: "Lifecycle", path: "/admin/lifecycle", description: "Users, forms, consent and orgs", icon: UsersRound },
  { label: "Activity", path: "/admin/activity", description: "Admin audit trail", icon: Activity },
  { label: "Admins", path: "/admin/users", description: "Manage admin access", icon: UserRoundCog },
  { label: "Phone onboarding", path: "/admin/phone-onboarding", description: "Inbound caller intake", icon: PhoneCall },
  { label: "Home cards", path: "/admin/home-cards", description: "Personalized Today cards", icon: Home },
  { label: "Hero messages", path: "/admin/hero-messages", description: "Banner copy and rules", icon: MessageSquare },
  { label: "Marketing", path: "/admin/marketing", description: "Campaigns, contacts and sync", icon: Megaphone },
  { label: "Workflows", path: "/admin/workflows", description: "Coverage and next steps", icon: GitBranch },
  { label: "Content index", path: "/admin/content-index", description: "Readiness across content", icon: LibraryBig },
  { label: "Learning library", path: "/admin/learning-library", description: "Daily lessons and interests", icon: BookOpen },
  { label: "Content review", path: "/admin/content-review", description: "Curious Minds and Scent drafts", icon: Sparkles },
  { label: "Cognitive assessment", path: "/admin/cognitive-assessment", description: "Cognitive Compass upload", icon: Brain },
  { label: "What's On", path: "/admin/curated-activities", description: "Upload and review activities", icon: CalendarCheck },
  { label: "Room prompts", path: "/admin/room-prompts", description: "Daily room topics", icon: MessageSquare },
  { label: "Concierge readiness", path: "/admin/concierge-readiness", description: "Flow coverage and launch gates", icon: ClipboardCheck },
  { label: "Concierge queue", path: "/admin/concierge-queue", description: "Confirmed task status", icon: ClipboardList },
  { label: "Email replies", path: "/admin/concierge-email-replies", description: "Replies needing review", icon: Mail },
  { label: "Providers", path: "/admin/providers", description: "Trusted contacts", icon: ScrollText },
  { label: "Voice readiness", path: "/admin/voice-readiness", description: "Agent context contracts", icon: Mic },
  { label: "Supply packages", path: "/admin/concierge-supplies", description: "Concierge supplies and kits", icon: Package },
  { label: "Trusted partners", path: "/admin/trusted-help-partners", description: "Concierge provider catalog", icon: BadgeCheck },
  { label: "Caregivers", path: "/admin/proxy-pending", description: "Elder assignments and support", icon: HeartHandshake },
];

export default function AdminMenu() {
  const location = useLocation();
  const { user } = useAuth();
  const items = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL
    ? adminItems
    : adminItems.filter((item) => item.path !== "/admin/users");

  return (
    <nav aria-label="Admin sections" className="mt-3 rounded-[14px] border border-[#eadfd5] bg-white shadow-sm">
      <div className="flex gap-1 overflow-x-auto p-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.path === "/admin"
            ? location.pathname === item.path
            : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? "page" : undefined}
              className={`group flex min-w-[166px] shrink-0 items-center gap-3 rounded-[10px] px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 ${
                active
                  ? "bg-[#2f2135] text-white shadow-sm"
                  : "text-[#4f4352] hover:bg-[#fbf8f5] hover:text-purple-700"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border ${
                  active
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-[#eadfd5] bg-[#fffaf4] text-purple-700 group-hover:border-purple-200"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{item.label}</span>
                <span className="sr-only">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
