import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { setToken } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

export default function AccessLinkPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Estamos preparando su acceso seguro a VYVA...");

  useEffect(() => {
    let cancelled = false;

    async function consumeLink() {
      if (!token) {
        setMessage("Este enlace no es válido.");
        return;
      }

      try {
        const res = await fetch("/api/auth/access-link/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "No se ha podido abrir este enlace.");
        }

        setToken(data.token);
        await queryClient.invalidateQueries();
        if (!cancelled) {
          navigate(data.destination || "/onboarding", { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : "No se ha podido abrir este enlace.");
        }
      }
    }

    consumeLink();
    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  return (
    <main className="min-h-screen bg-[#f7f2eb] flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-xl text-center border border-[#eadfd5]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-100 text-3xl font-black text-purple-700">
          V
        </div>
        <h1 className="font-serif text-3xl text-[#2f2135]">Enlace seguro VYVA</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#7d6b65]">{message}</p>
      </section>
    </main>
  );
}
