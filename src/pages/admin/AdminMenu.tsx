import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();

const adminItems = [
  { label: "Lifecycle", path: "/admin/lifecycle", description: "Users, invites, consent and orgs" },
  { label: "Admins", path: "/admin/users", description: "Manage admin access" },
  { label: "Home cards", path: "/admin/home-cards", description: "Personalized Today cards" },
  { label: "Hero messages", path: "/admin/hero-messages", description: "Banner copy and rules" },
  { label: "Proxy pending", path: "/admin/proxy-pending", description: "Caregiver proxy requests" },
];

export default function AdminMenu() {
  const location = useLocation();
  const { user } = useAuth();
  const items = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL
    ? adminItems
    : adminItems.filter((item) => item.path !== "/admin/users");

  return (
    <nav className="mx-auto mt-5 grid max-w-7xl gap-3 md:grid-cols-5">
      {items.map((item) => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`rounded-3xl border px-5 py-4 shadow-sm transition ${
              active
                ? "border-[#2f2135] bg-[#2f2135] text-white"
                : "border-[#eadfd5] bg-white text-[#2f2135] hover:border-purple-200"
            }`}
          >
            <span className="block text-lg font-black">{item.label}</span>
            <span className={`mt-1 block text-sm ${active ? "text-white/75" : "text-[#7d6b65]"}`}>
              {item.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
