import { Link, useLocation } from "react-router-dom";

const adminItems = [
  { label: "Lifecycle", path: "/admin/lifecycle", description: "Users, invites, consent and orgs" },
  { label: "Home cards", path: "/admin/home-cards", description: "Personalized Today cards" },
  { label: "Hero messages", path: "/admin/hero-messages", description: "Banner copy and rules" },
  { label: "Proxy pending", path: "/admin/proxy-pending", description: "Caregiver proxy requests" },
];

export default function AdminMenu() {
  const location = useLocation();

  return (
    <nav className="mx-auto mt-5 grid max-w-7xl gap-3 md:grid-cols-4">
      {adminItems.map((item) => {
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
