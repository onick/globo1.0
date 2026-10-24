import type { LucideIcon } from "lucide-react";

const TONES = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-500",
};

// Small figure with an icon, as on the devices page
export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="bg-card rounded-xl border px-4 py-3.5 flex items-center gap-3">
      <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone]}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground leading-tight tabular-nums truncate">{value}</p>
        <p className="text-xs text-muted-foreground truncate">
          {label}
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>
    </div>
  );
}
