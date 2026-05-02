import { FileText, Clock, Eye, CheckCircle2 } from "lucide-react";

export default function AdminDashboardPage() {
  // TODO week 3: live data uit `sessions`-tabel
  const stats = [
    { label: "Totaal sessies", value: 0, icon: FileText },
    { label: "Lopend", value: 0, icon: Clock },
    { label: "Voor review", value: 0, icon: Eye },
    { label: "Goedgekeurd", value: 0, icon: CheckCircle2 },
  ];

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-gray-600">
          Beheer sessies, prompts en gebruikers.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  {stat.label}
                </span>
                <Icon className="h-4 w-4 text-gray-400" />
              </div>
              <div className="mt-2 text-3xl font-bold">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        Sessies-tabel komt in week 3 (na Website Check end-to-end in week 2).
      </div>
    </>
  );
}
