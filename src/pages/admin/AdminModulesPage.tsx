import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  GitBranch,
  HeartHandshake,
  Home,
  LibraryBig,
  Mail,
  Megaphone,
  MessageSquare,
  Mic,
  Package,
  PhoneCall,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import AdminPageHeader from "./AdminPageHeader";
import { useAuth } from "@/contexts/AuthContext";

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();

type ModuleTool = {
  label: string;
  path: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
};

type AdminModule = {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  tone: "purple" | "green" | "blue" | "amber" | "rose";
  tools: ModuleTool[];
};

const modules: AdminModule[] = [
  {
    title: "People & access",
    description: "Users, caregivers, onboarding and admin access.",
    path: "/admin/lifecycle",
    icon: UsersRound,
    tone: "purple",
    tools: [
      { label: "Users", path: "/admin/lifecycle", icon: UsersRound },
      { label: "Admin users", path: "/admin/users", icon: UserRoundCog, superAdminOnly: true },
      { label: "Caregivers", path: "/admin/proxy-pending", icon: HeartHandshake },
      { label: "Phone onboarding", path: "/admin/phone-onboarding", icon: PhoneCall },
    ],
  },
  {
    title: "Marketing & communications",
    description: "Campaigns, audiences, messages and replies.",
    path: "/admin/marketing",
    icon: Megaphone,
    tone: "green",
    tools: [
      { label: "Marketing", path: "/admin/marketing", icon: Megaphone },
      { label: "Email replies", path: "/admin/concierge-email-replies", icon: Mail },
      { label: "Hero messages", path: "/admin/hero-messages", icon: MessageSquare },
    ],
  },
  {
    title: "Content & experiences",
    description: "Learning, activities and in-app content.",
    path: "/admin/content-index",
    icon: LibraryBig,
    tone: "blue",
    tools: [
      { label: "Content index", path: "/admin/content-index", icon: LibraryBig },
      { label: "Learning library", path: "/admin/learning-library", icon: BookOpen },
      { label: "Content review", path: "/admin/content-review", icon: Sparkles },
      { label: "What's On", path: "/admin/curated-activities", icon: CalendarCheck },
      { label: "Cognitive assessment", path: "/admin/cognitive-assessment", icon: Brain },
      { label: "Home cards", path: "/admin/home-cards", icon: Home },
      { label: "Room prompts", path: "/admin/room-prompts", icon: MessageSquare },
    ],
  },
  {
    title: "Concierge operations",
    description: "Live work, providers and fulfilment.",
    path: "/admin/concierge-queue",
    icon: ClipboardList,
    tone: "amber",
    tools: [
      { label: "Task queue", path: "/admin/concierge-queue", icon: ClipboardList },
      { label: "Providers", path: "/admin/providers", icon: ScrollText },
      { label: "Supply packages", path: "/admin/concierge-supplies", icon: Package },
    ],
  },
  {
    title: "Platform readiness",
    description: "Coverage, launch controls and voice setup.",
    path: "/admin/workflows",
    icon: ShieldCheck,
    tone: "rose",
    tools: [
      { label: "Workflows", path: "/admin/workflows", icon: GitBranch },
      { label: "Concierge readiness", path: "/admin/concierge-readiness", icon: ClipboardCheck },
      { label: "Voice readiness", path: "/admin/voice-readiness", icon: Mic },
    ],
  },
];

const toneClasses: Record<AdminModule["tone"], { panel: string; icon: string; accent: string }> = {
  purple: { panel: "hover:border-purple-300", icon: "bg-purple-50 text-purple-700", accent: "bg-purple-600" },
  green: { panel: "hover:border-emerald-300", icon: "bg-emerald-50 text-emerald-700", accent: "bg-emerald-500" },
  blue: { panel: "hover:border-sky-300", icon: "bg-sky-50 text-sky-700", accent: "bg-sky-500" },
  amber: { panel: "hover:border-amber-300", icon: "bg-amber-50 text-amber-700", accent: "bg-amber-500" },
  rose: { panel: "hover:border-rose-300", icon: "bg-rose-50 text-rose-700", accent: "bg-rose-500" },
};

export default function AdminModulesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Admin modules"
          subtitle="Choose the area you want to manage."
          showAdminHome={false}
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const ModuleIcon = module.icon;
            const tone = toneClasses[module.tone];
            const tools = module.tools.filter((tool) => isSuperAdmin || !tool.superAdminOnly);

            return (
              <article
                key={module.title}
                className={`group relative overflow-hidden rounded-[12px] border border-[#e5d9cf] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.panel}`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`} aria-hidden="true" />
                <div className="p-5">
                  <Link
                    to={module.path}
                    className="block rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-4"
                    aria-label={`Open ${module.title}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${tone.icon}`}>
                        <ModuleIcon size={22} aria-hidden="true" />
                      </span>
                      <ArrowRight
                        size={20}
                        className="mt-2 text-[#a4938c] transition group-hover:translate-x-1 group-hover:text-purple-700"
                        aria-hidden="true"
                      />
                    </div>
                    <h2 className="mt-5 font-serif text-xl font-bold text-[#2f2135]">{module.title}</h2>
                    <p className="sr-only">{module.description}</p>
                  </Link>

                  <div className="mt-5 border-t border-[#f0e7df] pt-4">
                    <div className="flex flex-wrap gap-2">
                      {tools.map((tool) => {
                        const ToolIcon = tool.icon;
                        return (
                          <Link
                            key={tool.path}
                            to={tool.path}
                            className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#eadfd5] bg-[#fffaf4] px-3 text-xs font-bold text-[#5b4a46] transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                          >
                            <ToolIcon size={14} aria-hidden="true" />
                            {tool.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
