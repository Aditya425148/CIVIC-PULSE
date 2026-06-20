import { useState, useEffect } from "react";
import { CheckCircle2, Award, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { api } from "../../api";
import { account } from "../../appwrite";
import { Complaint } from "../../data/mockData";

export default function WorkerResolved() {
  const [worker, setWorker] = useState<any>(null);
  const [resolvedTasks, setResolvedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch worker session
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
        const workerDataStr = sessionStorage.getItem("workerData");
        if (workerDataStr) {
          setWorker(JSON.parse(workerDataStr));
        } else {
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!worker) return;

    setLoading(true);
    // Fetch resolved complaints
    api
      .get<any>("/api/complaints")
      .then((data) => {
        const resolved = (Array.isArray(data) ? data : [])
          .filter(
            (c: any) =>
              (c.status === "Resolved" || c.status === "Closed") &&
              (c.assignedTo?.toLowerCase() === worker.name?.toLowerCase() ||
               c.assignedTo === worker.id)
          )
          .map((c: any) => ({
            id: c.id,
            category: c.category || "Other",
            address: c.address || "Location not provided",
            status: c.status,
            createdAt: c.createdAt,
            resolvedAt: c.resolvedAt || c.updatedAt,
            citizenName: c.reporterName || "Anonymous",
          }))
          .sort(
            (a, b) =>
              new Date(b.resolvedAt).getTime() -
              new Date(a.resolvedAt).getTime()
          );
        setResolvedTasks(resolved);
      })
      .catch(() => setResolvedTasks([]))
      .finally(() => setLoading(false));
  }, [worker]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <CheckCircle2 className="text-emerald-500 mx-auto mb-4 animate-spin" size={40} />
          <p className="text-slate-600 font-medium">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Resolved This Month
              </p>
              <p className="text-3xl font-black text-emerald-900 mt-1">
                {resolvedTasks.filter((t) =>
                  new Date(t.resolvedAt).getMonth() === new Date().getMonth()
                ).length}
              </p>
            </div>
            <CheckCircle2 className="text-emerald-600" size={40} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-2xl border border-sky-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                Total Resolved
              </p>
              <p className="text-3xl font-black text-sky-900 mt-1">
                {resolvedTasks.length}
              </p>
            </div>
            <TrendingUp className="text-sky-600" size={40} />
          </div>
        </motion.div>
      </div>

      {/* Resolved List */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Completion History</h2>

        {resolvedTasks.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12">
            <Award className="text-slate-300 mb-4" size={40} />
            <p className="text-slate-600 font-bold text-center">
              No completed tasks yet
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Your resolved tasks will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {resolvedTasks.map((task, index) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                key={task.id}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span className="text-[10px] font-mono text-slate-500">
                        #{task.id}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900">
                      {task.address}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {task.category} • Reported by {task.citizenName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                      ✓ Resolved
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(task.resolvedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
