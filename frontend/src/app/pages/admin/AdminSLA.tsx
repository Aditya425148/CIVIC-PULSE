import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Clock, Edit3, Save, X, Info, AlertTriangle } from "lucide-react";
import { api } from "../../api";

export default function AdminSLA() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<number, any>>({});

  useEffect(() => {
    api.get<any[]>("/api/config/sla")
      .then((data) => {
        setConfigs(data.map((s, i) => ({ ...s, id: i, editing: false })));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load SLA configurations");
        setLoading(false);
      });
  }, []);

  const startEdit = (id: number, config: any) => {
    setEditValues({ ...editValues, [id]: { ...config } });
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, editing: true } : c)),
    );
  };

  const cancelEdit = (id: number) => {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, editing: false } : c)),
    );
  };

  const saveEdit = async (id: number) => {
    const updatedConfigs = configs.map((c) => {
      if (c.id === id) {
        return { ...c, ...editValues[id], editing: false };
      }
      return c;
    });

    // Remove client-side helper fields like 'id' and 'editing' before sending to backend
    const payload = updatedConfigs.map(({ category, defaultSLA, escalationSLA, emergencySLA }) => ({
      category,
      defaultSLA,
      escalationSLA,
      emergencySLA: emergencySLA === "" ? null : emergencySLA,
    }));

    try {
      setLoading(true);
      const saved = await api.patch<any[]>("/api/config/sla", payload);
      setConfigs(saved.map((s, i) => ({ ...s, id: i, editing: false })));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to save SLA configuration");
    } finally {
      setLoading(false);
    }
  };

  if (loading && configs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-8 text-slate-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-[1.75rem] p-4 flex gap-3 shadow-[0_18px_40px_rgba(239,68,68,0.08)]">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-[600]">Error</div>
            <div className="text-xs mt-0.5">{error}</div>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-[800] text-[#ffcbd1]">
          SLA Configuration
        </h1>
        <p className="text-white/90 text-sm mt-1">
          Configure service level agreements per complaint category
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-[linear-gradient(90deg,rgba(239,246,255,0.96),rgba(255,255,255,0.92))] border border-sky-200 rounded-[1.75rem] p-4 flex gap-3 shadow-[0_18px_40px_rgba(14,165,233,0.08)]">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-[600] text-blue-800">
            Public SLA Visibility
          </div>
          <div className="text-xs text-blue-600 mt-0.5">
            Citizens see the SLA deadline for their complaint category at
            submission time. Changes to SLA apply to new complaints only.
          </div>
        </div>
      </div>

      {/* SLA Table */}
      <div className="bg-white/88 backdrop-blur-xl rounded-[1.85rem] border border-white shadow-[0_18px_45px_rgba(148,163,184,0.14)] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-base font-[700] text-slate-900">
            SLA Rules by Category
          </h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-[600]">
            Times in hours
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-[700] text-slate-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="text-center px-4 py-3 text-xs font-[700] text-slate-500 uppercase tracking-wider">
                  Default SLA
                </th>
                <th className="text-center px-4 py-3 text-xs font-[700] text-slate-500 uppercase tracking-wider">
                  Escalation SLA
                </th>
                <th className="text-center px-4 py-3 text-xs font-[700] text-slate-500 uppercase tracking-wider">
                  Emergency SLA
                </th>
                <th className="text-center px-4 py-3 text-xs font-[700] text-slate-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {configs.map((config) => (
                <motion.tr
                  key={config.id}
                  layout
                  className={`hover:bg-slate-50 transition-colors ${config.editing ? "bg-blue-50/30" : ""}`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          config.emergencySLA ? "bg-red-500" : "bg-amber-400"
                        }`}
                      />
                      <span className="font-[600] text-slate-800">
                        {config.category}
                      </span>
                    </div>
                  </td>

                  {config.editing ? (
                    <>
                      <td className="px-4 py-4 text-center">
                        <input
                          type="number"
                          value={
                            editValues[config.id]?.defaultSLA ||
                            config.defaultSLA
                          }
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              [config.id]: {
                                ...prev[config.id],
                                defaultSLA: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-16 text-center text-sm border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <input
                          type="number"
                          value={
                            editValues[config.id]?.escalationSLA ||
                            config.escalationSLA
                          }
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              [config.id]: {
                                ...prev[config.id],
                                escalationSLA: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-16 text-center text-sm border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        {config.emergencySLA !== null ? (
                          <input
                            type="number"
                            value={
                              editValues[config.id]?.emergencySLA ??
                              config.emergencySLA
                            }
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [config.id]: {
                                  ...prev[config.id],
                                  emergencySLA: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-16 text-center text-sm border border-red-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-400 bg-white"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => saveEdit(config.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-[600] rounded-lg transition-colors"
                          >
                            <Save className="w-3 h-3" /> Save
                          </button>
                          <button
                            onClick={() => cancelEdit(config.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-[500] rounded-lg transition-colors"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-[700] text-slate-800">
                            {config.defaultSLA}h
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-amber-600 font-[700]">
                          {config.escalationSLA}h
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {config.emergencySLA ? (
                          <span className="text-red-600 font-[700] flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {config.emergencySLA}h
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => startEdit(config.id, config)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-[600] rounded-lg transition-colors mx-auto"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      </td>
                    </>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
