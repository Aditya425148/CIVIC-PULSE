import { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { MapPin, Users } from "lucide-react";
import {
  DELHI_ZONE_CONFIG,
  fetchManagers,
  inferDelhiZone,
  type DelhiZoneId,
  type AdminManager,
} from "../../utils/adminInsights";

/**
 * SVG-based Delhi Zone Map showing 5 zones with complaint stats and assigned managers.
 * Each zone is clickable and shows a tooltip with details.
 */

// SVG path data for each zone (approximate polygon boundaries of Delhi districts)
const ZONE_PATHS: Record<DelhiZoneId, string> = {
  south:
    "M 120,340 L 180,290 L 240,310 L 280,340 L 300,400 L 260,440 L 200,460 L 140,430 L 110,390 Z",
  central_new:
    "M 180,220 L 240,200 L 300,210 L 320,260 L 300,300 L 280,340 L 240,310 L 180,290 L 160,250 Z",
  east_shahdara:
    "M 300,210 L 360,180 L 420,200 L 440,270 L 420,340 L 380,370 L 340,360 L 300,400 L 280,340 L 300,300 L 320,260 Z",
  west:
    "M 60,200 L 120,170 L 180,220 L 160,250 L 180,290 L 120,340 L 80,310 L 50,260 Z",
  north_nw:
    "M 100,100 L 180,60 L 280,70 L 360,100 L 360,180 L 300,210 L 240,200 L 180,220 L 120,170 L 80,140 Z",
};

const ZONE_COLORS: Record<DelhiZoneId, { fill: string; stroke: string; hover: string; text: string }> = {
  south:         { fill: "#fce4ec", stroke: "#e91e63", hover: "#f8bbd0", text: "#880e4f" },
  central_new:   { fill: "#e8eaf6", stroke: "#3f51b5", hover: "#c5cae9", text: "#1a237e" },
  east_shahdara: { fill: "#e0f2f1", stroke: "#009688", hover: "#b2dfdb", text: "#004d40" },
  west:          { fill: "#fff3e0", stroke: "#ff9800", hover: "#ffe0b2", text: "#e65100" },
  north_nw:      { fill: "#e8f5e9", stroke: "#4caf50", hover: "#c8e6c9", text: "#1b5e20" },
};

// Label positions inside each SVG zone
const ZONE_LABELS: Record<DelhiZoneId, { x: number; y: number }> = {
  south:         { x: 200, y: 380 },
  central_new:   { x: 240, y: 260 },
  east_shahdara: { x: 365, y: 285 },
  west:          { x: 115, y: 255 },
  north_nw:      { x: 220, y: 130 },
};

interface DelhiZoneMapProps {
  complaints: any[];
}

export default function DelhiZoneMap({ complaints }: DelhiZoneMapProps) {
  const [hoveredZone, setHoveredZone] = useState<DelhiZoneId | null>(null);
  const [selectedZone, setSelectedZone] = useState<DelhiZoneId | null>(null);
  const [managers, setManagers] = useState<AdminManager[]>([]);

  useEffect(() => {
    fetchManagers().then(setManagers);
  }, []);

  // Compute stats per zone from live complaints
  const zoneStats = useMemo(() => {
    const stats: Record<DelhiZoneId, { total: number; pending: number; resolved: number; escalated: number }> = {
      south: { total: 0, pending: 0, resolved: 0, escalated: 0 },
      central_new: { total: 0, pending: 0, resolved: 0, escalated: 0 },
      east_shahdara: { total: 0, pending: 0, resolved: 0, escalated: 0 },
      west: { total: 0, pending: 0, resolved: 0, escalated: 0 },
      north_nw: { total: 0, pending: 0, resolved: 0, escalated: 0 },
    };

    complaints.forEach((c) => {
      const zone = inferDelhiZone(c);
      stats[zone].total++;
      if (["Resolved", "Closed"].includes(c.status)) {
        stats[zone].resolved++;
      } else {
        stats[zone].pending++;
      }
      if (c.escalated) {
        stats[zone].escalated++;
      }
    });

    return stats;
  }, [complaints]);

  const activeZone = selectedZone || hoveredZone;
  const activeConfig = activeZone
    ? DELHI_ZONE_CONFIG.find((z) => z.id === activeZone)
    : null;
  const activeManagers = activeZone
    ? managers.filter((m) => {
        const zoneConfig = DELHI_ZONE_CONFIG.find((z) => z.id === activeZone);
        return zoneConfig && m.zone === zoneConfig.name;
      })
    : [];
  const activeStats = activeZone ? zoneStats[activeZone] : null;

  return (
    <div className="bg-white/88 backdrop-blur-xl rounded-[1.85rem] border border-white shadow-[0_18px_45px_rgba(148,163,184,0.14)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-[700] text-slate-900">
            Delhi Zone Map
          </h3>
          <p className="text-xs text-slate-400">
            5 zones · 2 managers per zone · Click to view details
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5" />
          Delhi NCT
        </div>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* SVG Map */}
        <div className="flex-1 min-w-0">
          <svg
            viewBox="20 30 460 460"
            className="w-full h-auto max-h-[400px]"
            style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.08))" }}
          >
            {/* Delhi outline background */}
            <defs>
              <filter id="zoneShadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
              </filter>
            </defs>

            {/* Zone polygons */}
            {(Object.entries(ZONE_PATHS) as [DelhiZoneId, string][]).map(
              ([zoneId, path]) => {
                const colors = ZONE_COLORS[zoneId];
                const isActive = activeZone === zoneId;
                const stats = zoneStats[zoneId];
                return (
                  <g key={zoneId}>
                    <motion.path
                      d={path}
                      fill={isActive ? colors.hover : colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={isActive ? 3 : 1.5}
                      style={{ cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={() => setHoveredZone(zoneId)}
                      onMouseLeave={() => setHoveredZone(null)}
                      onClick={() =>
                        setSelectedZone(selectedZone === zoneId ? null : zoneId)
                      }
                      initial={false}
                      animate={{
                        scale: isActive ? 1.02 : 1,
                        opacity: activeZone && !isActive ? 0.6 : 1,
                      }}
                      filter={isActive ? "url(#zoneShadow)" : undefined}
                    />
                    {/* Zone label */}
                    <text
                      x={ZONE_LABELS[zoneId].x}
                      y={ZONE_LABELS[zoneId].y - 10}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        fill: colors.text,
                      }}
                    >
                      {DELHI_ZONE_CONFIG.find((z) => z.id === zoneId)?.name.split(" ")[0]}
                    </text>
                    {/* Stats badge */}
                    <text
                      x={ZONE_LABELS[zoneId].x}
                      y={ZONE_LABELS[zoneId].y + 8}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        fill: stats.pending > 0 ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {stats.total} complaints
                    </text>
                    {stats.escalated > 0 && (
                      <text
                        x={ZONE_LABELS[zoneId].x}
                        y={ZONE_LABELS[zoneId].y + 22}
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          fill: "#dc2626",
                        }}
                      >
                        🔴 {stats.escalated} escalated
                      </text>
                    )}
                  </g>
                );
              },
            )}

            {/* Compass rose */}
            <g transform="translate(440, 440)">
              <circle r="16" fill="white" stroke="#e2e8f0" strokeWidth="1" />
              <text
                textAnchor="middle"
                y="-4"
                style={{ fontSize: "9px", fontWeight: 800, fill: "#64748b" }}
              >
                N
              </text>
              <line x1="0" y1="2" x2="0" y2="10" stroke="#94a3b8" strokeWidth="1.5" />
            </g>
          </svg>
        </div>

        {/* Zone Details Panel */}
        <div className="w-full lg:w-64 shrink-0">
          {activeZone && activeConfig && activeStats ? (
            <motion.div
              key={activeZone}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3"
            >
              <div
                className="rounded-xl p-3 border-2"
                style={{
                  backgroundColor: ZONE_COLORS[activeZone].fill,
                  borderColor: ZONE_COLORS[activeZone].stroke,
                }}
              >
                <div
                  className="text-sm font-[800]"
                  style={{ color: ZONE_COLORS[activeZone].text }}
                >
                  {activeConfig.name}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {activeConfig.localities.join(", ")}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 italic">
                  Target: {activeConfig.target}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total", value: activeStats.total, color: "text-slate-700" },
                  { label: "Pending", value: activeStats.pending, color: "text-amber-600" },
                  { label: "Resolved", value: activeStats.resolved, color: "text-emerald-600" },
                  { label: "Escalated", value: activeStats.escalated, color: "text-red-600" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="bg-slate-50 rounded-lg p-2 text-center"
                  >
                    <div className={`text-base font-[800] ${color}`}>
                      {value}
                    </div>
                    <div className="text-[9px] font-[600] text-slate-400 uppercase">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Managers */}
              <div>
                <div className="text-[10px] font-[700] text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Zone Managers ({activeManagers.length})
                </div>
                <div className="space-y-1.5">
                  {activeManagers.map((mgr) => (
                    <div
                      key={mgr.id}
                      className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-100"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-[800] shrink-0">
                        {mgr.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-[600] text-slate-800 truncate">
                          {mgr.name}
                        </div>
                        <div className="text-[10px] text-slate-400">{mgr.id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
              <MapPin className="w-8 h-8 mb-2 text-slate-200" />
              <div className="text-sm font-[500]">Select a zone</div>
              <div className="text-xs mt-1">
                Click or hover on a zone to see details
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone Legend */}
      <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
        {DELHI_ZONE_CONFIG.map((zone) => {
          const colors = ZONE_COLORS[zone.id];
          return (
            <button
              key={zone.id}
              onClick={() =>
                setSelectedZone(selectedZone === zone.id ? null : zone.id)
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-[600] transition-all border ${
                selectedZone === zone.id
                  ? "ring-2 ring-offset-1"
                  : "hover:opacity-80"
              }`}
              style={{
                backgroundColor: colors.fill,
                borderColor: colors.stroke,
                color: colors.text,
                ...(selectedZone === zone.id ? { ringColor: colors.stroke } : {}),
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors.stroke }}
              />
              {zone.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
