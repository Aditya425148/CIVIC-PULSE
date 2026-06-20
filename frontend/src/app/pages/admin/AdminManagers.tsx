import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { appwriteService } from "../../appwriteService";
import {
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { fetchManagers, type AdminManager } from "../../utils/adminInsights";

const STATUS_COLORS: Record<string, string> = {
  Submitted: "bg-slate-100 text-slate-600",
  Assigned: "bg-sky-100 text-sky-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Resolved: "bg-emerald-100 text-emerald-700",
  Closed: "bg-slate-100 text-slate-400",
  Escalated: "bg-red-100 text-red-700",
};

function initials(name: string) {
  if (!name) return "M";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminManagers() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<AdminManager[]>([]);
  const [selectedMgr, setSelectedMgr] = useState<AdminManager | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetchManagers().then(setManagers);

    const unsub = appwriteService.subscribeToComplaints((data) => {
      setComplaints(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Compute per-manager stats from live complaints
  const managerStats = useMemo(() => {
    return managers.map((mgr) => {
      const mine = complaints.filter((c) => c.assignedManagerId === mgr.id);
      const active = mine.filter(
        (c) => !["Resolved", "Closed"].includes(c.status),
      ).length;
      const resolved = mine.filter((c) =>
        ["Resolved", "Closed"].includes(c.status),
      ).length;
      const escalated = mine.filter((c) => c.escalated).length;
      const slaBreached = mine.filter(
        (c) =>
          (c.slaRemainingHours ?? 1) < 0 &&
          !["Resolved", "Closed"].includes(c.status),
      ).length;
      return {
        ...mgr,
        total: mine.length,
        active,
        resolved,
        escalated,
        slaBreached,
      };
    });
  }, [complaints, managers]);

  const selectedMgrComplaints = useMemo(() => {
    if (!selectedMgr) return [];
    return complaints
      .filter((c) => c.assignedManagerId === selectedMgr.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [complaints, selectedMgr]);

  const openDrawer = (mgr: AdminManager) => {
    setSelectedMgr(mgr);
    setDrawerOpen(true);
  };

  const totalManaged = complaints.filter(
    (c) => c.assignedManagerId && c.assignedManagerId !== "SYSTEM",
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-[800] text-[#ffcbd1]">Manager Overview</h1>
        <p className="text-white/90 text-sm mt-1">
          Live workload across all district managers
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Total Managers",
            value: managers.length,
            color: "text-sky-600",
          },
          {
            label: "Complaints Assigned",
            value: totalManaged,
            color: "text-violet-600",
          },
          {
            label: "Currently Active",
            value: complaints.filter(
              (c) => !["Resolved", "Closed", "Rejected"].includes(c.status),
            ).length,
            color: "text-amber-600",
          },
          {
            label: "Resolved Overall",
            value: complaints.filter((c) =>
              ["Resolved", "Closed"].includes(c.status),
            ).length,
            color: "text-emerald-600",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white/88 backdrop-blur-xl rounded-[1.75rem] p-4 border border-white shadow-[0_18px_45px_rgba(148,163,184,0.14)]"
          >
            <div className={`text-2xl font-[800] ${color}`}>
              {loading ? "—" : value}
            </div>
            <div className="text-xs text-slate-500 font-[500] mt-1">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Manager Cards Grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {managerStats.map((mgr, i) => (
          <motion.div
            key={mgr.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => openDrawer(mgr)}
            className="bg-white/88 backdrop-blur-xl rounded-[1.75rem] border border-white shadow-[0_18px_45px_rgba(148,163,184,0.14)] p-5 cursor-pointer hover:shadow-[0_24px_60px_rgba(148,163,184,0.22)] hover:-translate-y-0.5 transition-all group"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-sm font-[800] shrink-0">
                {initials(mgr.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-[700] text-slate-900 truncate">
                  {mgr.name}
                </div>
                <div className="text-xs text-slate-400">
                  {mgr.zone} · {mgr.id}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
            </div>

            {/* Badges */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {mgr.slaBreached > 0 && (
                <span className="text-[10px] font-[700] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  🔴 {mgr.slaBreached} SLA breach
                  {mgr.slaBreached > 1 ? "es" : ""}
                </span>
              )}
              {mgr.escalated > 0 && (
                <span className="text-[10px] font-[700] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                  ⚠ {mgr.escalated} escalated
                </span>
              )}
              {mgr.slaBreached === 0 && mgr.escalated === 0 && (
                <span className="text-[10px] font-[700] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
                  ✓ On track
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-2.5">
                <div className="text-base font-[800] text-amber-600">
                  {loading ? "—" : mgr.active}
                </div>
                <div className="text-[9px] font-[600] text-slate-400 uppercase mt-0.5">
                  Active
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <div className="text-base font-[800] text-emerald-600">
                  {loading ? "—" : mgr.resolved}
                </div>
                <div className="text-[9px] font-[600] text-slate-400 uppercase mt-0.5">
                  Resolved
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <div className="text-base font-[800] text-slate-700">
                  {loading ? "—" : mgr.total}
                </div>
                <div className="text-[9px] font-[600] text-slate-400 uppercase mt-0.5">
                  Total
                </div>
              </div>
            </div>

            {mgr.total > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Resolution rate</span>
                  <span className="font-[700] text-slate-600">
                    {Math.round((mgr.resolved / mgr.total) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                    style={{
                      width: `${Math.round((mgr.resolved / mgr.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {mgr.total === 0 && (
              <div className="mt-3 text-center text-xs text-slate-400 italic">
                No complaints assigned yet
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Complaint Drawer */}
      <AnimatePresence>
        {drawerOpen && selectedMgr && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Side Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-[−24px_0_60px_rgba(15,23,42,0.25)] flex flex-col"
            >
              {/* Drawer Header */}
              <div className="flex items-center gap-3 p-5 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-sm font-[800]">
                  {initials(selectedMgr.name)}
                </div>
                <div className="flex-1">
                  <div className="text-base font-[700] text-slate-900">
                    {selectedMgr.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedMgr.zone} · {selectedMgr.id}
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Stats */}
              {(() => {
                const stats = managerStats.find(
                  (m) => m.id === selectedMgr.id,
                )!;
                return (
                  <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
                    <div className="text-center">
                      <div className="text-lg font-[800] text-amber-600">
                        {stats.active}
                      </div>
                      <div className="text-[10px] text-slate-400 font-[600] uppercase">
                        Active
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-[800] text-emerald-600">
                        {stats.resolved}
                      </div>
                      <div className="text-[10px] text-slate-400 font-[600] uppercase">
                        Resolved
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-[800] text-red-500">
                        {stats.slaBreached}
                      </div>
                      <div className="text-[10px] text-slate-400 font-[600] uppercase">
                        SLA Breached
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Complaints List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 pb-2 flex items-center justify-between">
                  <span className="text-xs font-[700] text-slate-500 uppercase tracking-wider">
                    Assigned Complaints ({selectedMgrComplaints.length})
                  </span>
                </div>

                {selectedMgrComplaints.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <UserCheck className="w-10 h-10 mb-3 text-slate-200" />
                    <div className="text-sm">No complaints assigned yet</div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {selectedMgrComplaints.map((c) => (
                      <div
                        key={c.id}
                        className="px-4 py-3.5 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${
                              c.escalated
                                ? "bg-red-500"
                                : (c.slaRemainingHours ?? 1) < 0
                                  ? "bg-amber-500"
                                  : ["Resolved", "Closed"].includes(c.status)
                                    ? "bg-emerald-500"
                                    : "bg-sky-400"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-[700] text-slate-700 font-mono">
                                {c.id}
                              </span>
                              <span
                                className={`text-[10px] font-[600] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status] || "bg-slate-100 text-slate-600"}`}
                              >
                                {c.status}
                              </span>
                              {c.escalated && (
                                <span className="text-[10px] font-[700] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                                  🔴 Escalated
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-slate-500">
                                {c.category}
                              </span>
                              {c.subcategory && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-xs text-slate-400">
                                    {c.subcategory}
                                  </span>
                                </>
                              )}
                            </div>
                            {c.address && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-300 shrink-0" />
                                <span className="text-xs text-slate-400 truncate">
                                  {c.address}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              {(c.slaRemainingHours ?? 1) < 0 &&
                              !["Resolved", "Closed"].includes(c.status) ? (
                                <span className="flex items-center gap-0.5 text-[10px] font-[700] text-red-500">
                                  <AlertTriangle className="w-2.5 h-2.5" />{" "}
                                  {Math.abs(c.slaRemainingHours)}h overdue
                                </span>
                              ) : ["Resolved", "Closed"].includes(c.status) ? (
                                <span className="flex items-center gap-0.5 text-[10px] font-[600] text-emerald-600">
                                  <CheckCircle className="w-2.5 h-2.5" /> Done
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                                  <Clock className="w-2.5 h-2.5" />{" "}
                                  {c.slaRemainingHours}h left
                                </span>
                              )}
                              <span className="text-[10px] text-slate-300">
                                {new Date(c.createdAt).toLocaleDateString(
                                  "en-IN",
                                  { day: "numeric", month: "short" },
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
