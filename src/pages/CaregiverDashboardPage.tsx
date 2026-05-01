export default function CaregiverDashboardPage() {
  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8">
      <section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 shadow-sm border border-[#eadfd5]">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-purple-700">Caregiver Dashboard</p>
        <h1 className="mt-3 font-serif text-4xl text-[#2f2135]">Panel familiar VYVA</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#7d6b65]">
          Este enlace ya está conectado al sistema de acceso familiar. Aquí se mostrará el panel completo
          del cuidador: alertas, resúmenes, consentimiento y seguimiento.
        </p>
      </section>
    </main>
  );
}
