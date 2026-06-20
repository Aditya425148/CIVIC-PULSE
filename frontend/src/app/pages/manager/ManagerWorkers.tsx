import { useState, useEffect } from "react";
import {
  Phone,
  MapPin,
  Shield,
  Star,
  Activity,
  UserPlus,
  X,
  Smartphone,
  CheckCircle2,
  Trash2,
  Plus,
} from "lucide-react";
import { Worker } from "../../data/mockData";
import { account } from "../../appwrite";
import { api } from "../../api";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export default function ManagerWorkers() {
  const [manager, setManager] = useState<any>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Worker Form State
  const [newWorker, setNewWorker] = useState({
    name: "",
    phone: "",
    area: "",
    rating: 4.5,
  });

  const fetchWorkers = () => {
    setLoading(true);
    api.get<Worker[]>("/api/workers")
      .then((data) => {
        setWorkers(data);
      })
      .catch((err) => {
        toast.error("Failed to load field workforce");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    account
      .get()
      .then((user) => {
        const managerData = {
          ...user,
          managedState: user.prefs?.state || "Delhi",
          managedAreas: user.prefs?.zone ? [user.prefs.zone] : ["central_new"],
        };
        setManager(managerData);
        fetchWorkers();
      })
      .catch(() => {
        setManager({
          name: "Sanjay Sharma",
          managedState: "Delhi",
          managedAreas: ["central_new"],
        });
        fetchWorkers();
      });
  }, []);

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorker.name || !newWorker.phone || !newWorker.area) {
      toast.error("Please fill all fields");
      return;
    }

    const payload = {
      name: newWorker.name,
      phone: newWorker.phone,
      area: newWorker.area,
      state: manager.managedState,
      rating: newWorker.rating,
    };

    api.post<Worker>("/api/workers", payload)
      .then((created) => {
        setWorkers((prev) => [created, ...prev]);
        setShowAddModal(false);
        setNewWorker({ name: "", phone: "", area: "", rating: 4.5 });
        toast.success(newWorker.name + " deployed to field force");
      })
      .catch((err) => {
        toast.error("Failed to add worker: " + err.message);
      });
  };

  const removeWorker = (id: string) => {
    api.delete(`/api/workers/${id}`)
      .then(() => {
        setWorkers((prev) => prev.filter((w) => w.id !== id));
        toast.info("Worker removed from your list");
      })
      .catch((err) => {
        toast.error("Failed to remove worker: " + err.message);
      });
  };

  if (!manager || loading)
    return <div className="p-8 text-slate-500">Loading workforce...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-[800] text-slate-900 tracking-tight">
            Workforce Overview
          </h1>
          <p className="text-slate-500 font-medium mt-1 inline-flex items-center gap-2">
            <Shield size={14} className="text-sky-500" /> Managing staff in{" "}
            {manager.managedAreas.join(", ")}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-8 text-sm font-bold text-white transition hover:bg-sky-800 shadow-lg shadow-sky-900/10 active:scale-95"
        >
          <UserPlus size={18} /> Add New Worker
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {workers.map((worker) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={worker.id}
              className="group rounded-[2.5rem] bg-white border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:border-sky-100 transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="h-16 w-16 rounded-[1.5rem] bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center text-sky-700 font-bold text-2xl group-hover:from-sky-700 group-hover:to-indigo-800 group-hover:text-white transition-all duration-500 shadow-inner">
                  {worker.name.charAt(0)}
                </div>
                <div
                  className={
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider " +
                    (worker.status === "Available"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700")
                  }
                >
                  <Activity size={12} /> {worker.status}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-sky-700 transition-colors">
                  {worker.name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mt-1.5 bg-slate-50 w-fit px-3 py-1 rounded-lg">
                  <MapPin size={12} className="text-sky-500" /> {worker.area}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-2xl border border-slate-50 bg-slate-50/50 p-2 text-center transition hover:bg-white hover:border-sky-100">
                  <div className="text-[9px] font-bold uppercase text-slate-400 mb-1 tracking-widest">
                    Satisfaction
                  </div>
                  <div className="font-bold text-slate-900 flex items-center justify-center gap-1 text-sm">
                    <Star size={12} className="text-amber-500 fill-amber-500" />{" "}
                    {worker.rating}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-50 bg-slate-50/50 p-2 text-center transition hover:bg-white hover:border-sky-100">
                  <div className="text-[9px] font-bold uppercase text-slate-400 mb-1 tracking-widest">
                    Load
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {worker.status === "Busy" ? "Heavy" : "None"}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={"tel:" + worker.phone}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-slate-900 py-3 text-white transition hover:bg-black shadow-lg shadow-slate-900/10"
                >
                  <div className="text-[10px] uppercase font-black tracking-tighter opacity-60">
                    Field Contact
                  </div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Phone size={10} className="text-sky-400" /> {worker.phone}
                  </div>
                </a>
                <button
                  onClick={() => removeWorker(worker.id)}
                  className="flex items-center justify-center w-14 rounded-2xl border border-slate-200 bg-white transition hover:border-red-500 hover:bg-red-50 text-slate-400 hover:text-red-600 shadow-sm"
                  title="Remove Worker"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Worker Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] p-8 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-[900] text-slate-900 tracking-tight">
                    Expand Force
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">
                    Add a new field agent to your jurisdiction
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddWorker} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <Plus
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      autoFocus
                      type="text"
                      required
                      value={newWorker.name}
                      onChange={(e) =>
                        setNewWorker({ ...newWorker, name: e.target.value })
                      }
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-sky-500/20 transition-all"
                      placeholder="e.g. Ramesh Kumar"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Smartphone
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="tel"
                        required
                        value={newWorker.phone}
                        onChange={(e) =>
                          setNewWorker({ ...newWorker, phone: e.target.value })
                        }
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-sky-500/20 transition-all"
                        placeholder="+91..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Assigned Area
                    </label>
                    <div className="relative">
                      <MapPin
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <select
                        required
                        value={newWorker.area}
                        onChange={(e) =>
                          setNewWorker({ ...newWorker, area: e.target.value })
                        }
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-sky-500/20 transition-all appearance-none"
                      >
                        <option value="">Select Area</option>
                        {manager?.managedAreas?.map((area: string) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-sky-700 hover:bg-sky-800 text-white font-bold py-5 rounded-2xl shadow-xl shadow-sky-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} /> Deploy Agent
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
