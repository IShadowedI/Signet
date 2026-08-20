const TONES: Record<string, string> = {
  // invoices
  open: "bg-slate-100 text-slate-600",
  partially_paid: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  past_due: "bg-red-100 text-red-700",
  locked: "bg-violet-100 text-violet-700",
  void: "bg-slate-100 text-slate-400 line-through",
  // quotes
  rep_new: "bg-indigo-100 text-indigo-700",
  rep_saved: "bg-slate-100 text-slate-600",
  rep_queued: "bg-amber-100 text-amber-700",
  user_queued: "bg-blue-100 text-blue-700",
  user_saved: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-400",
  converted: "bg-green-100 text-green-700",
  // returns / requests / shipments
  requested: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  waiting_on_customer: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-400",
  pending: "bg-slate-100 text-slate-600",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  urgent: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-700",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[value] ?? "bg-slate-100 text-slate-600"}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function money(value: number | null | undefined): string {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export function shortDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}
