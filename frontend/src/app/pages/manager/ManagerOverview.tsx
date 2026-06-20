import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  ChevronRight,
  AlertCircle,
  Search,
  Check,
  Building2,
  Users,
  LayoutDashboard,
  BarChart3,
  Mail,
  Smartphone,
  Zap,
  Map,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  Complaint,
  Worker,
} from "../../data/mockData";
import { appwriteService } from "../../appwriteService";
import { account } from "../../appwrite";
import { api } from "../../api";
import { toast } from "sonner";

export default function ManagerOverview() {
  const navigate = useNavigate();
  const [manager, setManager] = useState<any>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    // Attempt to get the logged-in user from Appwrite
    account
      .get()
      .then((user) => {
        setManager({
          ...user,
          id: user.$id,
          name: user.name || "Manager",
          email: user.email,
          phone: user.prefs?.phone || user.phone || "N/A",
          managedState: user.prefs?.state || "Delhi",
          managedAreas: user.prefs?.zone ? [user.prefs.zone] : ["central_new"],
        });
      })
      .catch(() => {
        navigate("/login", { replace: true });
      });
  }, [navigate]);

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null,
  );
  const [selectedReview, setSelectedReview] = useState<Complaint | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMapView, setShowMapView] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  useEffect(() => {
    if (!manager) return;

    // Fetch live complaints assigned to this manager from the backend
    api
      .get<Complaint[]>(`/api/complaints?managerId=${manager.id}`)
      .then((data) => setComplaints(data))
      .catch((err) => {
        console.error("Failed to load manager complaints:", err);
      });

    // Fetch workers
    api
      .get<Worker[]>("/api/workers")
      .then((data) => setWorkers(data))
      .catch((err) => {
        console.error("Failed to load workers:", err);
      });
  }, [manager]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const total = complaints.length;
    const submitted = complaints.filter((c) => c.status === "Submitted").length;
    const assigned = complaints.filter(
      (c) =>
        c.status === "Assigned" ||
        c.status === "In Progress" ||
        c.status === "Pending Review",
    ).length;
    const resolved = complaints.filter(
      (c) => c.status === "Resolved" || c.status === "Closed",
    ).length;

    return [
      { name: "New (Submitted)", value: submitted, color: "#94a3b8" },
      { name: "Assigned/Active/Review", value: assigned, color: "#0ea5e9" },
      { name: "Resolved/Closed", value: resolved, color: "#10b981" },
    ];
  }, [complaints]);

  // Workers assigned to this manager's state
  const stateWorkers = useMemo(
    () =>
      manager
        ? workers.filter((w: Worker) => w.state === manager.managedState)
        : [],
    [manager, workers],
  );

  // Auto-assignment logic - smart worker selection
  const autoAssignWorker = (complaint: Complaint): Worker | null => {
    const availableWorkers = stateWorkers.filter(
      (w: Worker) => w.status === "Available",
    );

    if (availableWorkers.length === 0) return null;

    // Sort by rating (higher is better)
    const sorted = [...availableWorkers].sort((a, b) => b.rating - a.rating);
    return sorted[0];
  };

  // Auto-assign all submitted complaints
  const handleAutoAssignAll = async () => {
    const submittedComplaints = complaints.filter(
      (c) => c.status === "Submitted",
    );

    if (submittedComplaints.length === 0) {
      toast.info("No submitted complaints to assign");
      return;
    }

    setAutoAssigning(true);
    let assigned = 0;

    for (const complaint of submittedComplaints) {
      const worker = autoAssignWorker(complaint);
      if (worker) {
        try {
          // Update complaint status to Assigned
          await api.patch(`/api/complaints/${complaint.id}/status`, {
            status: "Assigned",
            note: `Auto-assigned to ${worker.name}`,
            actor: manager?.name || "Manager",
            assignedTo: worker.name,
          });

          assigned++;

          // Update local state
          setComplaints((prev) =>
            prev.map((c) =>
              c.id === complaint.id
                ? {
                    ...c,
                    status: "Assigned",
                    assignedTo: worker.name,
                  }
                : c,
            ),
          );
        } catch (error) {
          console.error("Assignment error:", error);
        }
      }
    }

    setAutoAssigning(false);
    toast.success(`Auto-assigned ${assigned} complaints`);
  };

  const handleAssign = (worker: Worker) => {
    if (!selectedComplaint) return;

    // Update API
    api
      .patch(`/api/complaints/${selectedComplaint.id}/status`, {
        status: "Assigned",
        note: `Assigned to ${worker.name}`,
        actor: manager?.name || "Manager",
        assignedTo: worker.name,
      })
      .then(() => {
        // Update local state
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedComplaint.id
              ? { ...c, status: "Assigned", assignedTo: worker.name }
              : c,
          ),
        );
        setShowAssignModal(false);
        setSelectedComplaint(null);
        toast.success(`Assigned to ${worker.name}`);
      })
      .catch(() => {
        // Optimistic update
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedComplaint.id
              ? { ...c, status: "Assigned", assignedTo: worker.name }
              : c,
          ),
        );
        setShowAssignModal(false);
        setSelectedComplaint(null);
        toast.success(`Assigned to ${worker.name}`);
      });
  };

  // Review approval/rejection handler
  const handleReviewDecision = (action: "approve" | "reject") => {
    if (!selectedReview) return;

    const newStatus = action === "approve" ? "Resolved" : "Rejected";
    const message =
      action === "approve"
        ? "Work approved! Citizen can now provide feedback."
        : "Work rejected. Worker will be notified. Now assign another worker.";

    api
      .patch(`/api/complaints/${selectedReview.id}/status`, {
        status: newStatus,
        note: `${action === "approve" ? "Approved" : "Rejected"} by manager`,
        actor: manager?.name || "Manager",
      })
      .then(() => {
        // Update local state
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedReview.id ? { ...c, status: newStatus } : c,
          ),
        );

        if (action === "approve") {
          setShowReviewModal(false);
          setSelectedReview(null);
          setReviewAction(null);
        } else {
          // For rejection, show reassignment modal
          setReviewAction(null);
          setShowReviewModal(false);
          setShowReassignModal(true);
        }

        toast.success(message);
      })
      .catch(() => {
        // Optimistic update
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedReview.id ? { ...c, status: newStatus } : c,
          ),
        );

        if (action === "approve") {
          setShowReviewModal(false);
          setSelectedReview(null);
          setReviewAction(null);
        } else {
          // For rejection, show reassignment modal
          setReviewAction(null);
          setShowReviewModal(false);
          setShowReassignModal(true);
        }

        toast.success(message);
      });
  };

  // Reassign worker after rejection
  const handleReassignWorker = (worker: Worker) => {
    if (!selectedReview) return;

    api
      .patch(`/api/complaints/${selectedReview.id}/status`, {
        status: "Assigned",
        note: `Reassigned to ${worker.name} after rejection`,
        actor: manager?.name || "Manager",
        assignedTo: worker.name,
      })
      .then(() => {
        // Update local state
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedReview.id
              ? { ...c, status: "Assigned", assignedTo: worker.name }
              : c,
          ),
        );
        setShowReassignModal(false);
        setSelectedReview(null);
        toast.success(`Reassigned to ${worker.name}`);
      })
      .catch(() => {
        // Optimistic update
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedReview.id
              ? { ...c, status: "Assigned", assignedTo: worker.name }
              : c,
          ),
        );
        setShowReassignModal(false);
        setSelectedReview(null);
        toast.success(`Reassigned to ${worker.name}`);
      });
  };

  const filteredComplaints = complaints.filter(
    (c) =>
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!manager)
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-500 font-medium">
        Loading manager details...
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* 1. Header & Manager Profile Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between gap-8">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-sky-100">
              {manager.name
                ?.split(" ")
                .map((n: string) => n[0])
                .join("") || "M"}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-[800] text-slate-900 tracking-tight">
                {manager.name || "Manager"}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-500">
                <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full">
                  <Mail size={14} className="text-sky-500" /> {manager.email}
                </span>
                <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full">
                  <Smartphone size={14} className="text-emerald-500" />{" "}
                  {manager.phone}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:w-96 bg-slate-50 rounded-3xl p-6 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <MapPin size={12} /> Official Jurisdiction
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-0.5">
                  Primary State
                </div>
                <div className="text-base font-bold text-slate-900">
                  {manager.managedState}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1.5">
                  Assigned Areas
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {manager.managedAreas.map((area: string) => (
                    <span
                      key={area}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Auto-Assignment Banner */}
      {complaints.filter((c) => c.status === "Submitted").length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-[2rem] border-2 border-amber-200 p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="text-amber-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">
                  {complaints.filter((c) => c.status === "Submitted").length}{" "}
                  New Complaints Waiting
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Use auto-assign to efficiently distribute tasks to your field
                  workers
                </p>
              </div>
            </div>
            <button
              onClick={handleAutoAssignAll}
              disabled={autoAssigning}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 flex-shrink-0 whitespace-nowrap"
            >
              <Zap size={18} />{" "}
              {autoAssigning ? "Assigning..." : "Auto Assign All"}
            </button>
          </div>
        </motion.div>
      )}

      {/* 3. Stats & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
              <BarChart3 className="text-indigo-500" /> Performance Overview
            </h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      strokeWidth={0}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <Users className="text-emerald-500" /> Field Force
          </h2>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {stateWorkers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold text-slate-700 shadow-sm">
                    {worker.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {worker.name}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      Rating: {worker.rating} ⭐
                    </div>
                  </div>
                </div>
                <div
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                    worker.status === "Available"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {worker.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Pending Review Section */}
      {complaints.filter((c) => c.status === "Pending Review").length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-[2.5rem] p-8">
          <h2 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
            <AlertCircle size={20} className="text-purple-600" />
            Work Pending Review (
            {complaints.filter((c) => c.status === "Pending Review").length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {complaints
              .filter((c) => c.status === "Pending Review")
              .map((complaint) => (
                <motion.div
                  key={complaint.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-purple-200 p-5 cursor-pointer hover:shadow-md transition-all"
                  onClick={() => {
                    setSelectedReview(complaint);
                    setShowReviewModal(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="px-2 py-1 bg-slate-900 text-white text-[9px] font-black rounded-md">
                        {complaint.category}
                      </span>
                      <p className="font-bold text-slate-900 mt-2 text-sm">
                        {complaint.address}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">
                      {complaint.assignedTo || "Unknown"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {complaint.description}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReview(complaint);
                        setReviewAction(null);
                        setShowReviewModal(true);
                      }}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                    >
                      Review Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReview(complaint);
                        setReviewAction("approve");
                        setShowReviewModal(true);
                      }}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 shadow-md shadow-emerald-600/10"
                    >
                      <Check size={14} /> Mark as Complete
                    </button>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      )}

      {/* 4. Main Operational Area */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-[800] uppercase tracking-[0.2em] text-slate-400">
              Operational Queue
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMapView(!showMapView)}
                className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600"
                title="Toggle Map View"
              >
                <Map size={18} />
              </button>
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ticket ID / address..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredComplaints
              .filter(
                (c) =>
                  c.status !== "Resolved" &&
                  c.status !== "Pending Review" &&
                  c.status !== "Closed",
              )
              .map((complaint) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={complaint.id}
                  onClick={() => setSelectedComplaint(complaint)}
                  className={`cursor-pointer rounded-3xl border p-5 transition-all ${
                    selectedComplaint?.id === complaint.id
                      ? "border-sky-500 bg-sky-50/30 shadow-md ring-1 ring-sky-500/10"
                      : "border-slate-100 bg-white hover:border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded-md tracking-tighter uppercase">
                          {complaint.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">
                          #{complaint.id}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 line-clamp-1">
                        {complaint.address}
                      </h3>
                    </div>
                    <div
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        complaint.status === "Assigned"
                          ? "bg-amber-100 text-amber-700"
                          : complaint.status === "In Progress"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {complaint.status}
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed font-medium">
                    {complaint.description}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                        <Clock size={12} />
                        {new Date(complaint.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {complaint.status === "Submitted" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedComplaint(complaint);
                          setShowAssignModal(true);
                        }}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-sky-600/20"
                      >
                        Dispatch Help <ChevronRight size={14} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">
                          <Check size={14} />
                          <span>{complaint.assignedTo}</span>
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await api.patch(`/api/complaints/${complaint.id}/status`, {
                                status: "Resolved",
                                note: "Marked as complete by manager",
                                actor: manager?.name || "Manager",
                              });
                              setComplaints((prev) =>
                                prev.map((c) =>
                                  c.id === complaint.id
                                    ? { ...c, status: "Resolved" }
                                    : c
                                )
                              );
                              if (selectedComplaint?.id === complaint.id) {
                                setSelectedComplaint((prev) =>
                                  prev ? { ...prev, status: "Resolved" } : null
                                );
                              }
                              toast.success("Complaint marked as completed! ✓");
                            } catch (err) {
                              toast.error("Failed to update status");
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all shadow-md shadow-emerald-600/10"
                          title="Mark as Complete"
                        >
                          <CheckCircle size={12} /> Complete
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
          </div>
        </div>

        {/* Issue Details View */}
        <div className="hidden lg:block">
          {selectedComplaint ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="sticky top-24 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/50"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  Ticket Overview
                </h2>
                <div className="bg-slate-50 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Active Issue
                </div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100">
                    <div className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                      Citizen
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {selectedComplaint.reporterName}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-100">
                    <div className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                      Territory
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {manager.managedState}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest px-1">
                    Evidence Narrative
                  </div>
                  <div className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-5 rounded-2xl border border-slate-100 font-medium italic">
                    "{selectedComplaint.description}"
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  {selectedComplaint.reporterPhone ? (
                    <a
                      href={`tel:${selectedComplaint.reporterPhone}`}
                      className="w-full flex items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4 text-sm font-black text-white transition hover:bg-black shadow-xl shadow-slate-900/20 group text-center"
                    >
                      <Phone size={18} className="group-hover:shake text-sky-400" /> Dial: {selectedComplaint.reporterPhone}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full flex items-center justify-center gap-3 rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-400 cursor-not-allowed border border-slate-200"
                    >
                      <Phone size={18} /> Dial: Not Provided
                    </button>
                  )}

                  {!["Resolved", "Closed", "Rejected"].includes(selectedComplaint.status) && (
                    <button
                      onClick={async () => {
                        try {
                          await api.patch(`/api/complaints/${selectedComplaint.id}/status`, {
                            status: "Resolved",
                            note: "Marked as complete by manager",
                            actor: manager?.name || "Manager",
                          });
                          setComplaints((prev) =>
                            prev.map((c) =>
                              c.id === selectedComplaint.id
                                ? { ...c, status: "Resolved" }
                                : c
                            )
                          );
                          setSelectedComplaint((prev) =>
                            prev ? { ...prev, status: "Resolved" } : null
                          );
                          toast.success("Complaint marked as completed! ✓");
                        } catch (err) {
                          toast.error("Failed to update status");
                        }
                      }}
                      className="w-full flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-4 text-sm font-black text-white transition shadow-xl shadow-emerald-600/20 mt-2"
                    >
                      <CheckCircle size={18} /> Mark as Complete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="sticky top-24 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center p-12 h-[500px] bg-slate-50/30">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-slate-50">
                <LayoutDashboard className="text-slate-200" size={32} />
              </div>
              <p className="text-slate-400 font-bold text-sm text-center">
                Select an operational ticket
                <br />
                to activate view
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
              onClick={() => setShowAssignModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Assign Worker
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Available workers for this area
              </p>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {stateWorkers.map((worker: Worker) => (
                  <button
                    key={worker.id}
                    onClick={() => handleAssign(worker)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-sky-50 hover:border-sky-100 transition-all text-left group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-sky-700">
                        {worker.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        Rating: {worker.rating} ⭐
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${worker.status === "Available" ? "bg-emerald-500" : "bg-amber-500"}`}
                      ></span>
                      <span className="text-xs font-semibold text-slate-500">
                        {worker.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAssignModal(false)}
                className="mt-6 w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-900 transition"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && selectedReview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
              onClick={() => {
                setShowReviewModal(false);
                setReviewAction(null);
              }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-lg w-full bg-gradient-to-br from-white to-slate-50 rounded-3xl p-8 shadow-2xl border border-purple-200"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                Review Work Submission
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Submitted by:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedReview.assignedTo}
                </span>
              </p>

              <div className="bg-slate-50 rounded-2xl p-6 mb-6 border border-slate-100">
                <div className="mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                    Location
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedReview.address}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                    Issue
                  </p>
                  <p className="text-sm text-slate-700">
                    {selectedReview.description}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                    Work Submitted
                  </p>
                  <p className="text-sm text-slate-700 italic">
                    "
                    {selectedReview.timeline?.[
                      selectedReview.timeline.length - 1
                    ]?.note || "Work completed and submitted for review"}
                    "
                  </p>
                </div>
              </div>

              {!reviewAction ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setReviewAction("approve")}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                  >
                    <Check size={18} /> Mark as Complete
                  </button>
                  <button
                    onClick={() => setReviewAction("reject")}
                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition"
                  >
                    Reject & Return to Worker
                  </button>
                  <button
                    onClick={() => {
                      setShowReviewModal(false);
                      setReviewAction(null);
                    }}
                    className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-900">
                      {reviewAction === "approve"
                        ? "✓ Marking this work as complete will resolve the complaint. The citizen can then submit feedback."
                        : "✓ Rejecting this work will mark it as rejected. The assigned worker will be notified."}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReviewDecision(reviewAction)}
                    className={`w-full py-3 px-4 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                      reviewAction === "approve"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    <Check size={18} />
                    {reviewAction === "approve"
                      ? "Confirm Completion"
                      : "Confirm Rejection"}
                  </button>
                  <button
                    onClick={() => setReviewAction(null)}
                    className="w-full py-2 text-slate-600 hover:text-slate-900 font-semibold transition"
                  >
                    Back
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reassign Worker Modal (after rejection) */}
      <AnimatePresence>
        {showReassignModal && selectedReview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
              onClick={() => setShowReassignModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-[2rem] bg-gradient-to-br from-white to-slate-50 p-6 shadow-2xl border border-red-200"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Assign New Worker
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                Ticket rejected from {selectedReview.assignedTo}. Select a
                different worker to reassign.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6">
                <p className="text-xs text-red-900 font-semibold">
                  📍 {selectedReview.address}
                </p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {stateWorkers
                  .filter((w) => w.name !== selectedReview.assignedTo) // Don't show the rejected worker
                  .map((worker: Worker) => (
                    <button
                      key={worker.id}
                      onClick={() => handleReassignWorker(worker)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-emerald-50 hover:border-emerald-200 transition-all text-left group"
                    >
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-emerald-700">
                          {worker.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          Rating: {worker.rating} ⭐ • {worker.status}
                        </div>
                      </div>
                      <div className="text-emerald-600 group-hover:text-emerald-700">
                        →
                      </div>
                    </button>
                  ))}
              </div>

              <button
                onClick={() => setShowReassignModal(false)}
                className="mt-6 w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-900 transition"
              >
                Cancel Reassignment
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
