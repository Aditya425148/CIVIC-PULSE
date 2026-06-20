import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Users,
  MoreHorizontal,
  RefreshCw,
  Download,
  ChevronDown,
  UserCheck,
  Loader2,
} from "lucide-react";
import { appwriteService } from "../../appwriteService";
import { api } from "../../api";
import { exportDataToPDF } from "../../utils/pdfExport";
import { Complaint } from "../../data/mockData";
import { toast } from "sonner";

const slaStatus = (remaining: number, status: string) => {
  if (["Resolved", "Closed"].includes(status))
    return {
      label: "Resolved",
      class: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  if (remaining < 0)
    return {
      label: "⚠ Breached",
      class: "bg-red-100 text-red-700 border-red-200",
    };
  if (remaining < 12)
    return {
      label: "🟡 At Risk",
      class: "bg-amber-100 text-amber-700 border-amber-200",
    };
  return {
    label: "🟢 On Track",
    class: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };
};

const priorityBadge = (score: number) => {
  if (score >= 0.75) return { label: "High", class: "bg-red-50 text-red-600" };
  if (score >= 0.4)
    return { label: "Med", class: "bg-amber-50 text-amber-600" };
  return { label: "Low", class: "bg-slate-100 text-slate-500" };
};

export default function AdminQueue() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignLoading, setAssignLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSLA, setFilterSLA] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterWard, setFilterWard] = useState("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedRejectedComplaint, setSelectedRejectedComplaint] =
    useState<Complaint | null>(null);
  const [selectedReassignManager, setSelectedReassignManager] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [complaintsData, managersData] = await Promise.all([
          appwriteService.getAllComplaints(),
          api.get<any[]>("/api/complaints/managers"),
        ]);
        setComplaints(complaintsData);
        setManagers(managersData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = complaints.filter((c) => {
    const matchSearch =
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    const matchSLA =
      filterSLA === "All" ||
      (filterSLA === "Breached" && c.slaRemainingHours < 0) ||
      (filterSLA === "At Risk" &&
        c.slaRemainingHours >= 0 &&
        c.slaRemainingHours < 12) ||
      (filterSLA === "On Track" && c.slaRemainingHours >= 12);
    const matchCat = filterCategory === "All" || c.category === filterCategory;
    const matchWard = filterWard === "All" || c.area === filterWard;
    return matchSearch && matchSLA && matchCat && matchWard;
  });

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Loading complaint queue...
      </div>
    );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.length === filtered.length ? [] : filtered.map((c) => c.id),
    );
  };

  const categories = [
    "All",
    "Garbage",
    "Streetlight",
    "Pothole",
    "Water",
    "Sanitation",
    "Construction",
    "Safety",
    "Other",
  ];
  const wards = [
    "All",
    "South Delhi",
    "Central & New Delhi",
    "East Delhi & Shahdara",
    "West Delhi",
    "North & North-West Delhi",
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-[800] text-[#ffcbd1]">
            Complaint Queue
          </h1>
          <p className="text-white/90 text-sm mt-1">
            {filtered.length} of {complaints.length} complaints
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white/85 backdrop-blur-xl border border-white rounded-2xl hover:bg-white transition-colors shadow-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={async () => {
              try {
                setIsExporting(true);
                const breachedCount = filtered.filter(
                  (c) => c.slaRemainingHours < 0,
                ).length;
                const atRiskCount = filtered.filter(
                  (c) => c.slaRemainingHours >= 0 && c.slaRemainingHours < 12,
                ).length;
                const onTrackCount = filtered.filter(
                  (c) => c.slaRemainingHours >= 12,
                ).length;

                const columns = [
                  { label: "Complaint ID", key: "id" },
                  { label: "Category", key: "category" },
                  { label: "Area/Zone", key: "area" },
                  { label: "Current Status", key: "status" },
                  { label: "Priority", key: "priority" },
                  { label: "SLA", key: "slaStatus" },
                  { label: "Created On", key: "createdAt" },
                ];
                const displayData = filtered.map((c) => ({
                  ...c,
                  priority:
                    c.priorityScore >= 0.75
                      ? "High"
                      : c.priorityScore >= 0.4
                        ? "Medium"
                        : "Low",
                  slaStatus:
                    c.slaRemainingHours < 0
                      ? `Breached by ${Math.abs(c.slaRemainingHours)}h`
                      : c.slaRemainingHours < 12
                        ? `At Risk (${c.slaRemainingHours}h left)`
                        : `On Track (${c.slaRemainingHours}h left)`,
                  createdAt: new Date(c.createdAt).toLocaleDateString(),
                }));

                await exportDataToPDF(
                  displayData,
                  columns,
                  "complaint-queue",
                  "Complaint Queue Report",
                  {
                    subtitle:
                      "Operational snapshot for complaint monitoring and SLA tracking",
                    generatedBy: "Admin Portal",
                    logoPath: "/logo.svg",
                    filters: [
                      `Search: ${search || "None"}`,
                      `SLA: ${filterSLA}`,
                      `Category: ${filterCategory}`,
                      `Ward: ${filterWard}`,
                    ],
                    summary: [
                      { label: "Total Shown", value: filtered.length },
                      { label: "Breached", value: breachedCount },
                      { label: "At Risk", value: atRiskCount },
                      { label: "On Track", value: onTrackCount },
                      {
                        label: "Escalated",
                        value: filtered.filter((c) => c.escalated).length,
                      },
                    ],
                    footerSignature: "Prepared for CivicPulse Admin",
                    footerNote: "Digitally generated complaint queue report",
                    maxCellChars: 36,
                  },
                );
                toast.success("Export completed successfully");
              } catch (error) {
                console.error("Export failed:", error);
                toast.error("Failed to export data");
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting || complaints.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white/85 backdrop-blur-xl border border-white rounded-2xl hover:bg-white transition-colors shadow-sm disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? "Exporting..." : "Export PDF"}
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setAssignModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[linear-gradient(90deg,#7c3aed,#2563eb)] rounded-2xl transition-all font-[700] shadow-[0_16px_32px_rgba(76,29,149,0.24)]"
            >
              <UserCheck className="w-4 h-4" /> Assign {selectedIds.length}{" "}
              selected
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/88 backdrop-blur-xl rounded-[1.85rem] border border-white shadow-[0_18px_45px_rgba(148,163,184,0.14)] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID, address, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 transition-colors"
            />
          </div>
          <select
            value={filterSLA}
            onChange={(e) => setFilterSLA(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700 cursor-pointer"
          >
            <option value="All">All SLA Status</option>
            <option value="Breached">Breached</option>
            <option value="At Risk">At Risk</option>
            <option value="On Track">On Track</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700 cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700 cursor-pointer"
          >
            {wards.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/88 backdrop-blur-xl rounded-[1.85rem] border border-white shadow-[0_18px_45px_rgba(148,163,184,0.14)] overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-[700] text-slate-500 uppercase tracking-wider">
          <input
            type="checkbox"
            checked={
              selectedIds.length === filtered.length && filtered.length > 0
            }
            onChange={toggleAll}
            className="w-4 h-4 rounded cursor-pointer accent-violet-600"
          />
          <div className="flex-1">Complaint</div>
          <div className="hidden md:block w-24">Category</div>
          <div className="hidden lg:block w-28">Priority</div>
          <div className="hidden md:block w-28">SLA Status</div>
          <div className="w-24">Status</div>
          <div className="w-8"></div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm text-slate-500">
              No complaints match your filters
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((c, i) => {
              const sla = slaStatus(c.slaRemainingHours, c.status);
              const prio = priorityBadge(c.priorityScore);
              const isSelected = selectedIds.includes(c.id);

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors ${isSelected ? "bg-violet-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(c.id)}
                    className="w-4 h-4 rounded cursor-pointer accent-violet-600"
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/admin/queue/${c.id}`)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-[700] text-slate-800">
                        {c.id}
                      </span>
                      {c.escalated && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-[700]">
                          🔴 Escalated
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{c.address}</span>
                    </div>
                  </div>

                  <div className="hidden md:block w-24">
                    <span className="text-xs font-[600] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {c.category}
                    </span>
                  </div>

                  <div className="hidden lg:flex items-center gap-1.5 w-28">
                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${c.priorityScore >= 0.75 ? "bg-red-500" : c.priorityScore >= 0.4 ? "bg-amber-500" : "bg-slate-400"}`}
                        style={{ width: `${c.priorityScore * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-[700] px-1.5 py-0.5 rounded ${prio.class}`}
                    >
                      {prio.label}
                    </span>
                  </div>

                  <div className="hidden md:block w-28">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-[600] border ${sla.class}`}
                    >
                      {sla.label}
                    </span>
                    {!["Resolved", "Closed"].includes(c.status) && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {c.slaRemainingHours < 0
                          ? `${Math.abs(c.slaRemainingHours)}h over`
                          : `${c.slaRemainingHours}h left`}
                      </div>
                    )}
                  </div>

                  <div className="w-24">
                    {c.status === "Rejected" ? (
                      <button
                        onClick={() => {
                          setSelectedRejectedComplaint(c);
                          setReassignModalOpen(true);
                        }}
                        className="text-xs px-2 py-1 rounded-full font-[600] bg-pink-100 text-pink-700 hover:bg-pink-200 transition-all cursor-pointer"
                      >
                        {c.status}
                      </button>
                    ) : (
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded-full font-[600] ${
                          c.status === "Resolved" || c.status === "Closed"
                            ? "bg-emerald-100 text-emerald-700"
                            : c.status === "In Progress"
                              ? "bg-amber-100 text-amber-700"
                              : c.status === "Escalated"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    )}
                  </div>

                  <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reassign Rejected Complaint Modal */}
      {reassignModalOpen && selectedRejectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/95 backdrop-blur-xl rounded-[1.85rem] p-6 max-w-md w-full shadow-[0_24px_60px_rgba(15,23,42,0.28)] border border-white"
          >
            <h3 className="text-lg font-[700] text-slate-900 mb-2">
              Reassign Rejected Complaint
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ID: {selectedRejectedComplaint.id}
            </p>
            <div className="text-sm text-slate-700 mb-4 p-3 bg-pink-50 rounded-xl border border-pink-100">
              <strong>Category:</strong> {selectedRejectedComplaint.category}
              <br />
              <strong>Location:</strong> {selectedRejectedComplaint.address}
              <br />
              <strong>Status:</strong> {selectedRejectedComplaint.status}
            </div>
            <p className="text-xs text-slate-600 font-[600] mb-3">
              Select a manager to reassign:
            </p>
            <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
              {managers.map((mgr) => (
                <label
                  key={mgr.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedReassignManager === mgr.id
                      ? "bg-violet-50 border-violet-200"
                      : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="reassign-manager"
                    value={mgr.id}
                    checked={selectedReassignManager === mgr.id}
                    onChange={() => setSelectedReassignManager(mgr.id)}
                    className="accent-violet-600"
                  />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center text-xs font-[700]">
                    {mgr.name
                      ? mgr.name
                          .split(" ")
                          .filter(Boolean)
                          .map((n: string) => n[0])
                          .join("")
                      : "M"}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-[600] text-slate-800">
                      {mgr.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {mgr.state || "Delhi"} • Zone: {mgr.zone ? mgr.zone.toUpperCase() : "None"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!selectedReassignManager || !selectedRejectedComplaint)
                    return;

                  const manager = managers.find(
                    (m) => m.id === selectedReassignManager,
                  );
                  if (!manager) {
                    toast.error("Manager not found");
                    return;
                  }

                  // Oh! This manager doesn't work here warning prompt
                  if (
                    selectedRejectedComplaint.area &&
                    manager.zone &&
                    selectedRejectedComplaint.area.toLowerCase() !== manager.zone.toLowerCase()
                  ) {
                    const proceed = window.confirm(
                      `Oh! This manager doesn't work here!\n\n${manager.name} manages the ${manager.zone.toUpperCase()} zone, but this complaint is in the ${selectedRejectedComplaint.area.toUpperCase()} zone.\n\nDo you still want to reassign it?`
                    );
                    if (!proceed) return;
                  }

                  setReassignLoading(true);
                  try {
                    // Reassign complaint to new manager
                    await api.patch(
                      `/api/complaints/${selectedRejectedComplaint.id}/assign`,
                      {
                        managerId: selectedReassignManager,
                        managerName: manager.name,
                      },
                    );

                    toast.success(`Complaint reassigned to ${manager.name}`);

                    // Refresh complaints list
                    const data = await appwriteService.getAllComplaints();
                    setComplaints(data);

                    setReassignModalOpen(false);
                    setSelectedRejectedComplaint(null);
                    setSelectedReassignManager("");
                  } catch (error) {
                    console.error("Reassignment error:", error);
                    toast.error("Failed to reassign complaint");
                  } finally {
                    setReassignLoading(false);
                  }
                }}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-[600] rounded-xl transition-colors disabled:opacity-40"
                disabled={!selectedReassignManager || reassignLoading}
              >
                {reassignLoading ? "Reassigning..." : "Confirm Reassignment"}
              </button>
              <button
                onClick={() => {
                  setReassignModalOpen(false);
                  setSelectedRejectedComplaint(null);
                  setSelectedReassignManager("");
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-[500] rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/95 backdrop-blur-xl rounded-[1.85rem] p-6 max-w-md w-full shadow-[0_24px_60px_rgba(15,23,42,0.28)] border border-white"
          >
            <h3 className="text-lg font-[700] text-slate-900 mb-4">
              Assign {selectedIds.length} Complaint
              {selectedIds.length > 1 ? "s" : ""}
            </h3>
            <div className="text-xs text-slate-500 mb-4">
              IDs: {selectedIds.join(", ")}
            </div>
            <div className="space-y-2 mb-5">
              {managers.map((mgr) => (
                <label
                  key={mgr.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedOfficer === mgr.id
                      ? "bg-violet-50 border-violet-200"
                      : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="officer"
                    value={mgr.id}
                    checked={selectedOfficer === mgr.id}
                    onChange={() => setSelectedOfficer(mgr.id)}
                    className="accent-violet-600"
                  />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center text-xs font-[700]">
                    {mgr.name
                      ? mgr.name
                          .split(" ")
                          .filter(Boolean)
                          .map((n: string) => n[0])
                          .join("")
                      : "M"}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-[600] text-slate-800">
                      {mgr.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {mgr.state || "Delhi"} • Zone: {mgr.zone ? mgr.zone.toUpperCase() : "None"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!selectedOfficer) return;

                  const manager = managers.find(
                    (m) => m.id === selectedOfficer,
                  );
                  if (!manager) {
                    toast.error("Manager not found");
                    return;
                  }

                  // Oh! This manager doesn't work here warning prompt for bulk assignment
                  const selectedComplaints = complaints.filter((c) =>
                    selectedIds.includes(c.id),
                  );
                  const mismatched = selectedComplaints.filter(
                    (c) =>
                      c.area &&
                      manager.zone &&
                      c.area.toLowerCase() !== manager.zone.toLowerCase(),
                  );

                  if (mismatched.length > 0) {
                    const mismatchedAreas = Array.from(
                      new Set(mismatched.map((c) => c.area?.toUpperCase())),
                    ).join(", ");
                    const proceed = window.confirm(
                      `Oh! This manager doesn't work here!\n\n${manager.name} manages the ${manager.zone.toUpperCase()} zone, but some selected complaints are in the following mismatching zone(s): ${mismatchedAreas}.\n\nDo you still want to assign them anyway?`
                    );
                    if (!proceed) return;
                  }

                  setAssignLoading(true);
                  try {
                    // Assign each selected complaint to the manager
                    for (const complaintId of selectedIds) {
                      await api.patch(`/api/complaints/${complaintId}/assign`, {
                        managerId: selectedOfficer,
                        managerName: manager.name,
                      });
                    }

                    toast.success(
                      `Assigned ${selectedIds.length} complaint${selectedIds.length > 1 ? "s" : ""} to ${manager.name}`,
                    );

                    // Refresh complaints list
                    const data = await appwriteService.getAllComplaints();
                    setComplaints(data);

                    setAssignModalOpen(false);
                    setSelectedIds([]);
                    setSelectedOfficer("");
                  } catch (error) {
                    console.error("Assignment error:", error);
                    toast.error("Failed to assign complaints");
                  } finally {
                    setAssignLoading(false);
                  }
                }}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-[600] rounded-xl transition-colors disabled:opacity-40"
                disabled={!selectedOfficer || assignLoading}
              >
                {assignLoading ? "Assigning..." : "Confirm Assignment"}
              </button>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-[500] rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
