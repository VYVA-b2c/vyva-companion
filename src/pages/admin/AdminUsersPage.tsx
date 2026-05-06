import { useEffect, useState } from "react";
import AdminMenu from "./AdminMenu";
import { apiFetch } from "@/lib/queryClient";

type AdminUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  last_seen_at?: string | null;
  created_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [matches, setMatches] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Admin request failed");
    return data;
  }

  async function refresh(search = email) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim().length >= 3) params.set("email", search.trim());
      const data = await api(`/admin-users?${params.toString()}`);
      setAdmins(data.admins ?? []);
      setMatches(data.matches ?? []);
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load admin users");
    } finally {
      setIsLoading(false);
    }
  }

  async function setRole(user: AdminUser, role: "user" | "admin") {
    setMessage("");
    try {
      await api(`/admin-users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMessage(role === "admin" ? `${user.email} is now an admin.` : `${user.email} is now a standard user.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update role");
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resultRows = email.trim().length >= 3 ? matches : [];

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
          <h1 className="mt-2 font-serif text-4xl">Admin users</h1>
          <p className="mt-2 max-w-3xl text-[#7d6b65]">Promote trusted team members and remove admin access when it is no longer needed.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={isLoading} onClick={() => refresh().catch(() => undefined)}>
              Refresh
            </button>
            {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
          </div>
        </div>

        <AdminMenu />

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
          <h2 className="font-serif text-3xl">Find a user</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className="rounded-2xl border border-[#e4d8ce] px-4 py-3"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && refresh().catch(() => undefined)}
              placeholder="Search by email"
            />
            <button className="rounded-2xl bg-[#2f2135] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={email.trim().length < 3 || isLoading} onClick={() => refresh().catch(() => undefined)}>
              Search
            </button>
          </div>

          {email.trim().length > 0 && email.trim().length < 3 && (
            <p className="mt-3 text-sm text-[#7d6b65]">Enter at least 3 characters to search.</p>
          )}

          {resultRows.length > 0 && (
            <div className="mt-5 grid gap-3">
              {resultRows.map((user) => (
                <UserRoleRow key={user.id} user={user} onSetRole={setRole} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-3xl">Current admins</h2>
            <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">{admins.length} admins</span>
          </div>
          <div className="mt-5 grid gap-3">
            {admins.length === 0 ? (
              <p className="rounded-2xl bg-[#fbf8f5] p-4 font-bold text-[#7d6b65]">No admin users found.</p>
            ) : (
              admins.map((user) => <UserRoleRow key={user.id} user={user} onSetRole={setRole} />)
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function UserRoleRow({ user, onSetRole }: { user: AdminUser; onSetRole: (user: AdminUser, role: "user" | "admin") => void }) {
  const isAdmin = user.role === "admin";

  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#eadfd5] bg-[#fbf8f5] p-4">
      <div className="min-w-0">
        <p className="break-words font-black">{user.email}</p>
        <p className="mt-1 text-sm text-[#7d6b65]">Role: {user.role} - Last seen: {formatDate(user.last_seen_at)}</p>
      </div>
      <button
        className={`rounded-2xl px-5 py-3 font-bold ${isAdmin ? "border border-[#e4d8ce] bg-white text-[#2f2135]" : "bg-purple-700 text-white"}`}
        onClick={() => onSetRole(user, isAdmin ? "user" : "admin")}
      >
        {isAdmin ? "Remove admin" : "Make admin"}
      </button>
    </article>
  );
}
