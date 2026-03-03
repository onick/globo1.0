"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronDown,
  Download,
} from "lucide-react";
import { UserForm } from "@/components/admin/user-form";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  tenant: { id: string; name: string } | null;
}

interface Stats {
  total: number;
  active: number;
  operators: number;
  viewers: number;
}

const roleBadge: Record<string, { text: string; color: string; bg: string }> = {
  super_admin: { text: "Super Admin", color: "text-[#EF4444]", bg: "bg-[#FEF2F2]" },
  admin: { text: "Admin", color: "text-[#2563EB]", bg: "bg-[#EFF6FF]" },
  operator: { text: "Operator", color: "text-[#7C3AED]", bg: "bg-[#F5F3FF]" },
  viewer: { text: "Viewer", color: "text-[#94A3B8]", bg: "bg-[#F1F5F9]" },
};

const PAGE_SIZE = 5;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, operators: 0, viewers: 0 });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | undefined>();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const fetchUsers = useCallback(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users);
        setStats(data.stats);
      });
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function openCreate() {
    setEditing(undefined);
    dialogRef.current?.showModal();
  }

  function openEdit(user: User) {
    setEditing(user);
    dialogRef.current?.showModal();
  }

  function handleSaved() {
    dialogRef.current?.close();
    fetchUsers();
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete user "${user.name}"?`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) fetchUsers();
  }

  const tenantNames = [...new Set(users.map((u) => u.tenant?.name).filter(Boolean))] as string[];

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesTenant =
      tenantFilter === "all" || u.tenant?.name === tenantFilter;
    return matchesSearch && matchesRole && matchesTenant;
  });

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, tenantFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const superAdminCount = users.filter((u) => u.role === "super_admin").length;
  const operatorPct = stats.total > 0 ? ((stats.operators / stats.total) * 100).toFixed(0) : "0";

  const kpis = [
    {
      label: "Total Users",
      value: stats.total,
      sub: "+12 this month",
      subColor: "text-[#16A34A]",
    },
    {
      label: "Admins",
      value: stats.active,
      sub: `${superAdminCount} super admin${superAdminCount !== 1 ? "s" : ""}`,
      subColor: "text-[#94A3B8]",
    },
    {
      label: "Operators",
      value: stats.operators,
      sub: `${operatorPct}% of users`,
      subColor: "text-[#94A3B8]",
    },
    {
      label: "Viewers",
      value: stats.viewers,
      sub: "Read-only access",
      subColor: "text-[#94A3B8]",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#0F172A]">Users</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Manage platform users across all tenants
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-[38px] rounded-lg bg-[#2563EB] px-4 text-[13px] font-medium text-white hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add User
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

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Search + Filters */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search by name or email..."
              className="h-[34px] w-[260px] rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                className="h-[34px] appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] cursor-pointer"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
            <div className="relative">
              <select
                className="h-[34px] appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] cursor-pointer"
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
              >
                <option value="all">All Tenants</option>
                {tenantNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
            <button className="flex items-center gap-1.5 h-[34px] rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9]">
              {["Name", "Email", "Role", "Tenant", "Created", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((user) => {
              const badge = roleBadge[user.role] || roleBadge.viewer;
              return (
                <tr
                  key={user.id}
                  className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                >
                  <td className="px-5 py-3 text-[13px] font-medium text-[#0F172A]">
                    {user.name}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#64748B]">
                    {user.email}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${badge.color} ${badge.bg}`}
                    >
                      {badge.text}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#0F172A]">
                    {user.tenant?.name ?? (
                      <span className="text-[#CBD5E1]">&mdash;</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#94A3B8]">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(user)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Users className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" />
                  <p className="text-[13px] text-[#94A3B8]">
                    {users.length === 0
                      ? "No users registered yet"
                      : "No users match your filters"}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F1F5F9]">
            <span className="text-[12px] text-[#94A3B8]">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} users
            </span>
            <div className="flex items-center gap-1">
              <button
                className="h-[30px] px-3 rounded-md border border-[#E2E8F0] text-[12px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`h-[30px] w-[30px] rounded-md text-[12px] transition-colors ${
                      page === p
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    }`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="text-[12px] text-[#94A3B8] px-1">...</span>
                  <button
                    className={`h-[30px] w-[30px] rounded-md text-[12px] transition-colors ${
                      page === totalPages
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    }`}
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                className="h-[30px] px-3 rounded-md border border-[#E2E8F0] text-[12px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-semibold text-lg mb-4">
            {editing ? "Edit User" : "New User"}
          </h3>
          <UserForm
            key={editing?.id ?? "new"}
            user={editing}
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
