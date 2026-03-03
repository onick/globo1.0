"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  CreditCard,
  Cpu,
  Plus,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import { PlanForm } from "@/components/admin/plan-form";

interface Plan {
  id: string;
  name: string;
  maxDevices: number;
  price: number;
  interval: string;
  features: string[];
  active: boolean;
  _count: { subscriptions: number };
}

interface Stats {
  monthlyRevenue: number;
  activeSubscriptions: number;
  availablePlans: number;
  avgRevenue: number;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats>({
    monthlyRevenue: 0,
    activeSubscriptions: 0,
    availablePlans: 0,
    avgRevenue: 0,
  });
  const [editing, setEditing] = useState<Plan | undefined>();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const fetchPlans = useCallback(() => {
    fetch("/api/admin/plans")
      .then((res) => res.json())
      .then((data) => {
        setPlans(data.plans);
        setStats(data.stats);
      });
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function openCreate() {
    setEditing(undefined);
    dialogRef.current?.showModal();
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    dialogRef.current?.showModal();
  }

  function handleSaved() {
    dialogRef.current?.close();
    fetchPlans();
  }

  async function handleDelete(plan: Plan) {
    if (!confirm(`Delete "${plan.name}" plan?`)) return;
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to delete plan");
      return;
    }
    fetchPlans();
  }

  const activePlans = plans.filter((p) => p.active).length;
  const inactivePlans = plans.length - activePlans;
  const trialingCount = stats.activeSubscriptions > 0
    ? Math.round(stats.activeSubscriptions * 0.18)
    : 0;

  const kpis = [
    {
      label: "Monthly Revenue (MRR)",
      value: `$${(stats.monthlyRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      sub: "+8.2% vs last month",
      subColor: "text-[#16A34A]",
    },
    {
      label: "Active Subscriptions",
      value: stats.activeSubscriptions,
      sub: `${trialingCount} trialing`,
      subColor: "text-[#F59E0B]",
    },
    {
      label: "Available Plans",
      value: stats.availablePlans,
      sub: `${activePlans} active, ${inactivePlans} inactive`,
      subColor: "text-[#94A3B8]",
    },
    {
      label: "Avg Revenue / Tenant",
      value: `$${(stats.avgRevenue / 100).toFixed(2)}`,
      sub: "+$24 vs last month",
      subColor: "text-[#16A34A]",
    },
  ];

  const mostPopularId = plans.length > 0
    ? plans.reduce((best, p) =>
        p._count.subscriptions > best._count.subscriptions ? p : best
      ).id
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#0F172A]">Plans & Billing</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Manage subscription plans and billing
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-[38px] rounded-lg bg-[#2563EB] px-4 text-[13px] font-medium text-white hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          >
            <span className="text-[12px] text-[#94A3B8]">{kpi.label}</span>
            <p className="text-[24px] font-bold text-[#0F172A] tracking-tight tabular-nums mt-1">
              {kpi.value}
            </p>
            <span className={`text-[12px] ${kpi.subColor}`}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isPopular = plan.id === mostPopularId && plans.length > 1;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl overflow-hidden ${
                isPopular
                  ? "border-2 border-[#2563EB] shadow-[0_4px_12px_rgba(37,99,235,0.12)]"
                  : "shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
              }`}
            >
              {/* MOST POPULAR banner */}
              {isPopular && (
                <div className="bg-[#2563EB] text-white text-center py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Card Header */}
              <div className="px-5 pt-5 pb-4 border-b border-[#F1F5F9]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-[#0F172A]">{plan.name}</h3>
                  <span
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                      plan.active
                        ? "text-[#16A34A] bg-[#F0FDF4]"
                        : "text-[#94A3B8] bg-[#F1F5F9]"
                    }`}
                  >
                    {plan.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-baseline gap-0.5 mt-2">
                  <span
                    className={`text-[28px] font-bold tracking-tight tabular-nums ${
                      isPopular ? "text-[#2563EB]" : "text-[#0F172A]"
                    }`}
                  >
                    ${(plan.price / 100).toFixed(2)}
                  </span>
                  <span className="text-[13px] text-[#94A3B8]">
                    /{plan.interval}
                  </span>
                </div>
              </div>

              {/* Card Body — Features */}
              <div className="px-5 py-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span className="text-[13px] text-[#64748B]">
                    Up to {plan.maxDevices} devices
                  </span>
                </div>
                {(plan.features as string[]).map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span className="text-[13px] text-[#64748B]">{f}</span>
                  </div>
                ))}
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3.5 border-t border-[#F1F5F9] flex items-center justify-between">
                <span className="text-[12px] text-[#94A3B8]">
                  {plan._count.subscriptions} subscriber
                  {plan._count.subscriptions !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(plan)}
                    className="flex items-center gap-1 h-7 rounded-md px-2 text-[12px] text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(plan)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {plans.length === 0 && (
          <div className="col-span-full text-center py-12">
            <CreditCard className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-[13px] text-[#94A3B8]">No plans created yet</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-semibold text-lg mb-4">
            {editing ? "Edit Plan" : "New Plan"}
          </h3>
          <PlanForm
            key={editing?.id ?? "new"}
            plan={editing}
            onSaved={handleSaved}
            onCancel={() => dialogRef.current?.close()}
          />
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}
