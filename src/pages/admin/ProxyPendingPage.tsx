import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { CheckCircle2, Flag, UserCheck, Clock, AlertTriangle, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

type ProxyProfile = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  proxy_initiator_id: string | null;
  proxy_name: string;
  proxy_initiated_at: string | null;
  elder_confirmed_at: string | null;
  phone_number: string | null;
  created_at: string;
};

type AdminData = {
  pending: ProxyProfile[];
  confirmed: ProxyProfile[];
};

function daysSince(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function displayName(p: ProxyProfile): string {
  return p.preferred_name || p.full_name || `User ${p.id.slice(0, 8)}`;
}

function ProfileRow({
  profile,
  isPending,
}: {
  profile: ProxyProfile;
  isPending: boolean;
}) {
  const [flagReason, setFlagReason] = useState("");
  const [showFlagInput, setShowFlagInput] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/admin/proxy-confirm/${profile.id}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setActionMsg("Confirmed successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proxy-pending"] });
    },
    onError: () => setActionMsg("Failed to confirm — please try again"),
  });

  const flagMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/admin/proxy-flag/${profile.id}`, {
        method: "POST",
        body: JSON.stringify({ reason: flagReason || undefined }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setActionMsg("Flagged for review");
      setShowFlagInput(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proxy-pending"] });
    },
    onError: () => setActionMsg("Failed to flag — please try again"),
  });

  const dayCount = profile.proxy_initiated_at
    ? Math.floor((Date.now() - new Date(profile.proxy_initiated_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isOverdue = isPending && dayCount > 7;

  return (
    <div
      data-testid={`card-proxy-profile-${profile.id}`}
      className={`p-4 border-b border-gray-100 last:border-b-0 ${isOverdue ? "bg-red-50" : "bg-white"}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Elder info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              data-testid={`text-elder-name-${profile.id}`}
              className="font-semibold text-gray-900 text-sm"
            >
              {displayName(profile)}
            </span>
            {isOverdue && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} /> Overdue
              </span>
            )}
            {!isPending && (
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={10} /> Confirmed
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-0.5">
            <span className="text-gray-400">Set up by:</span>{" "}
            <span data-testid={`text-proxy-name-${profile.id}`} className="font-medium text-gray-700">
              {profile.proxy_name}
            </span>
          </p>

          <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              <span data-testid={`text-initiated-date-${profile.id}`}>
                Initiated {daysSince(profile.proxy_initiated_at)} ({formatDate(profile.proxy_initiated_at)})
              </span>
            </span>
            {profile.phone_number && (
              <span>{profile.phone_number}</span>
            )}
            {!isPending && profile.elder_confirmed_at && (
              <span className="text-green-600 flex items-center gap-1">
                <UserCheck size={11} />
                Confirmed {daysSince(profile.elder_confirmed_at)}
              </span>
            )}
          </div>

          <p className="text-[10px] text-gray-300 mt-1 font-mono">ID: {profile.id}</p>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              data-testid={`button-confirm-${profile.id}`}
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
            >
              <UserCheck size={13} />
              {confirmMutation.isPending ? "Confirming…" : "Confirm"}
            </button>
            <button
              data-testid={`button-flag-${profile.id}`}
              onClick={() => setShowFlagInput((v) => !v)}
              disabled={flagMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold hover:bg-amber-200 disabled:opacity-50 whitespace-nowrap"
            >
              <Flag size={13} />
              Flag
            </button>
          </div>
        )}
      </div>

      {/* Flag reason input */}
      {showFlagInput && (
        <div className="mt-3 flex gap-2 items-center" data-testid={`form-flag-reason-${profile.id}`}>
          <Input
            data-testid={`input-flag-reason-${profile.id}`}
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Optional reason for flagging…"
            className="text-xs h-8 flex-1"
          />
          <button
            data-testid={`button-flag-submit-${profile.id}`}
            onClick={() => flagMutation.mutate()}
            disabled={flagMutation.isPending}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
          >
            {flagMutation.isPending ? "Flagging…" : "Submit flag"}
          </button>
        </div>
      )}

      {actionMsg && (
        <p
          data-testid={`text-action-result-${profile.id}`}
          className="mt-2 text-xs text-green-700 font-medium"
        >
          {actionMsg}
        </p>
      )}
    </div>
  );
}

export default function ProxyPendingPage() {
  const { logout } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<AdminData>({
    queryKey: ["/api/admin/proxy-pending"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/proxy-pending");
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (res.status === 401) throw new Error("UNAUTHENTICATED");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      return res.json();
    },
    retry: false,
  });

  const pending   = data?.pending   ?? [];
  const confirmed = data?.confirmed ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <ShieldAlert size={18} className="text-purple-700" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg">Proxy accounts</h1>
              <p className="text-xs text-gray-500">Accounts set up by a carer on behalf of an elder</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="button-admin-refresh"
              onClick={() => refetch()}
              className="text-xs text-purple-700 font-medium hover:underline"
            >
              Refresh
            </button>
            <button
              data-testid="button-admin-logout"
              onClick={logout}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700" data-testid="text-admin-error">
            {(error as Error).message === "FORBIDDEN"
              ? "Access denied - your account is not an admin"
              : "Failed to load data — please refresh"}
          </div>
        )}

        {/* Pending section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold text-gray-900 text-base">Awaiting confirmation</h2>
            {isLoading ? (
              <Skeleton className="w-6 h-5 rounded-full" />
            ) : (
              <span
                data-testid="text-pending-count"
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  pending.length > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"
                }`}
              >
                {pending.length}
              </span>
            )}
          </div>

          <div
            data-testid="list-proxy-pending"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {isLoading ? (
              <div className="divide-y divide-gray-100">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-72 mb-1" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : pending.length === 0 ? (
              <div
                data-testid="text-pending-empty"
                className="py-12 text-center text-sm text-gray-400"
              >
                <CheckCircle2 size={32} className="mx-auto mb-3 text-green-400" />
                No accounts awaiting confirmation
              </div>
            ) : (
              <div>
                {pending.map((p) => (
                  <ProfileRow key={p.id} profile={p} isPending={true} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Confirmed section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold text-gray-900 text-base">Recently confirmed</h2>
            {!isLoading && (
              <span
                data-testid="text-confirmed-count"
                className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700"
              >
                {confirmed.length}
              </span>
            )}
          </div>

          <div
            data-testid="list-proxy-confirmed"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {isLoading ? (
              <div className="p-4"><Skeleton className="h-4 w-48" /></div>
            ) : confirmed.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400" data-testid="text-confirmed-empty">
                No confirmed proxy accounts yet
              </div>
            ) : (
              <div>
                {confirmed.map((p) => (
                  <ProfileRow key={p.id} profile={p} isPending={false} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
