import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  MapPin,
  Clock,
  AlertCircle,
  Check,
  ChevronRight,
  Phone,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { api } from "../../api";
import { account } from "../../appwrite";
import { Complaint } from "../../data/mockData";

interface WorkerTask {
  id: string;
  category: string;
  address: string;
  description: string;
  status: string;
  createdAt: string;
  citizenName: string;
  citizenPhone?: string;
  priority: number;
  distance?: number;
  coordinates?: { lat: number; lng: number };
  timeline?: any[];
}

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState<any>(null);
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<WorkerTask | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "pending">("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check Appwrite first
    account
      .get()
      .then((user) => {
        setWorker({
          id: user.$id,
          name: user.name || "Worker",
          email: user.email,
        });
      })
      .catch(() => {
        // Fallback to session storage (mock login compatibility)
        const workerDataStr = sessionStorage.getItem("workerData");
        if (workerDataStr) {
          setWorker(JSON.parse(workerDataStr));
        } else {
          navigate("/login", { replace: true });
        }
      });
  }, [navigate]);

  useEffect(() => {
    if (!worker) return;
    
    setLoading(true);
    // Fetch assigned complaints
    api
      .get<any>("/api/complaints")
      .then((data) => {
        const workerTasks = (Array.isArray(data) ? data : [])
          .filter(
            (c: any) =>
              (c.status === "Assigned" || c.status === "In Progress") &&
              (c.assignedTo?.toLowerCase() === worker.name?.toLowerCase() ||
               c.assignedTo === worker.id)
          )
          .map((c: any) => ({
            id: c.id,
            category: c.category || "Other",
            address: c.address || "Location not provided",
            description: c.description || "",
            status: c.status || "Assigned",
            createdAt: c.createdAt || new Date().toISOString(),
            citizenName: c.reporterName || "Anonymous",
            citizenPhone: c.citizenPhone,
            priority: c.priorityScore || 0.5,
            distance: c.distance_km,
            coordinates: c.coordinates,
            timeline: c.timeline || [],
          }))
          .sort((a: any, b: any) => b.priority - a.priority);
        
        setTasks(workerTasks);
      })
      .catch((err) => {
        toast.error("Failed to load assigned tasks");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [worker]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by search term
    if (searchTerm) {
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (filter === "pending") {
      result = result.filter((t) => t.status === "Assigned");
    } else if (filter === "active") {
      result = result.filter((t) => t.status === "In Progress" || t.status === "Assigned");
    }

    return result;
  }, [tasks, searchTerm, filter]);

  const handleStartWork = (task: WorkerTask) => {
    if (task.status === "Assigned") {
      // Update status to In Progress
      api
        .patch(`/api/complaints/${task.id}/status`, {
          status: "In Progress",
          note: "Worker started work on site",
          actor: worker?.name || "Worker",
        })
        .then(() => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, status: "In Progress" } : t
            )
          );
          toast.success("Task started!");
        })
        .catch(() => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, status: "In Progress" } : t
            )
          );
          toast.success("Task started!");
        });
    }
  };

  const handleResolve = () => {
    if (!selectedTask || !resolutionNote.trim()) {
      toast.error("Please add a resolution note");
      return;
    }

    api
      .patch(`/api/complaints/${selectedTask.id}/status`, {
        status: "Pending Review",
        note: `Submitted for review: ${resolutionNote}`,
        actor: worker?.name || "Worker",
      })
      .then(() => {
        setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
        setShowResolveModal(false);
        setSelectedTask(null);
        setResolutionNote("");
        toast.success("Submitted for manager review! ✓");
      })
      .catch(() => {
        // Optimistic update
        setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
        setShowResolveModal(false);
        setSelectedTask(null);
        setResolutionNote("");
        toast.success("Submitted for manager review! ✓");
      });
  };

  const hoursWorked = useMemo(() => {
    const activeTask = tasks.find((t) => t.status === "In Progress");
    if (!activeTask) return 0;
    const elapsed = Date.now() - new Date(activeTask.createdAt).getTime();
    return Math.floor(elapsed / 3600000);
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-sky-100 flex items-center justify-center mx-auto mb-4 animate-spin">
            <Clock className="text-sky-600" size={28} />
          </div>
          <p className="text-slate-600 font-medium">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Active Tasks
              </p>
              <p className="text-3xl font-black text-slate-900 mt-1">
                {tasks.filter((t) => t.status === "In Progress").length}
              </p>
            </div>
            <AlertCircle className="text-amber-500" size={32} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Pending
              </p>
              <p className="text-3xl font-black text-slate-900 mt-1">
                {tasks.filter((t) => t.status === "Assigned").length}
              </p>
            </div>
            <Clock className="text-sky-500" size={32} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Rating
              </p>
              <p className="text-3xl font-black text-slate-900 mt-1">
                4.2<span className="text-xl">⭐</span>
              </p>
            </div>
            <Check className="text-emerald-500" size={32} />
          </div>
        </motion.div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Your Tasks</h2>
          <div className="flex gap-2">
            {(["all", "active", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  filter === f
                    ? "bg-sky-600 text-white shadow-lg shadow-sky-600/20"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition"
          />
        </div>

        {/* Tasks */}
        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12">
            <Check className="text-emerald-500 mb-4" size={40} />
            <p className="text-slate-600 font-bold text-center">
              No tasks found {searchTerm && 'matching "' + searchTerm + '"'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {filter === "all" && tasks.length === 0
                ? "Check back later for new assignments"
                : "All tasks completed!"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                    selectedTask?.id === task.id
                      ? "border-sky-500 bg-sky-50 shadow-md"
                      : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-slate-900 text-white text-[9px] font-black rounded tracking-tighter">
                          {task.category}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          #{task.id}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {task.address}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${
                        task.status === "In Progress"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {task.status}
                    </div>
                  </div>

                  {/* Task Meta */}
                  <div className="flex flex-col gap-2 mb-4 pb-4 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <MapPin size={12} className="text-sky-500" />
                      {task.distance ? `${task.distance}km away` : "Location pending"}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Clock size={12} className="text-sky-500" />
                      {new Date(task.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 items-center justify-between">
                    {task.citizenPhone && (
                      <a
                        href={`tel:${task.citizenPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition"
                      >
                        <Phone size={12} /> Call
                      </a>
                    )}
                    {task.status === "Assigned" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartWork(task);
                        }}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition"
                      >
                        <AlertCircle size={12} /> Start
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      <AnimatePresence>
        {showResolveModal && selectedTask && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
              onClick={() => setShowResolveModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Resolve Task #{selectedTask.id}
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                {selectedTask.address}
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Resolution Note *
                  </label>
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Describe what was done to resolve this issue..."
                    className="w-full h-24 rounded-lg border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="flex-1 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  className="flex-1 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                >
                  Mark Resolved
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Selected Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && !showResolveModal && (
          <div className="fixed inset-0 z-[50] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
              onClick={() => setSelectedTask(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <button
                onClick={() => setSelectedTask(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg tracking-tight">
                    {selectedTask.category}
                  </span>
                  <span className="text-xs font-mono text-slate-500">#{selectedTask.id}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  {selectedTask.address}
                </h2>
                <div
                  className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold ${
                    selectedTask.status === "In Progress"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {selectedTask.status}
                </div>
              </div>

              <div className="space-y-5 mb-8 bg-slate-50 rounded-2xl p-6">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Citizen
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {selectedTask.citizenName}
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Description
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    {selectedTask.description}
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-5 flex gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                      Location
                    </p>
                    <p className="text-slate-700 flex items-center gap-1.5">
                      <MapPin size={14} className="text-sky-500" />
                      {selectedTask.distance ? `${selectedTask.distance}km away` : "Pending"}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                      Reported
                    </p>
                    <p className="text-slate-700 flex items-center gap-1.5">
                      <Clock size={14} className="text-sky-500" />
                      {new Date(selectedTask.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="flex-1 py-3 px-4 text-slate-700 font-bold hover:bg-slate-100 rounded-xl transition"
                >
                  Close
                </button>
                <button
                  onClick={() => setShowResolveModal(true)}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Check size={18} /> Mark Resolved
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
