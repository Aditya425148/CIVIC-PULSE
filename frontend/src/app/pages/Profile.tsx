import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router";
import {
  ChevronRight,
  LogOut,
  Mail,
  MapPin,
  Award,
  Clock,
  CheckCircle2,
  TrendingUp,
  Camera,
  Star,
  Settings,
  FileText,
  Image as ImageIcon,
  Share2,
  Downloads,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { appwriteService } from "../appwriteService";
import { account } from "../appwrite";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

function formatDate(value: any) {
  if (!value) return "Recently";
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function resolveGalleryImageUrl(complaint: any): string {
  if (
    typeof complaint?.photoUrl === "string" &&
    complaint.photoUrl.trim().startsWith("http")
  ) {
    return complaint.photoUrl.trim();
  }

  const timeline = complaint?.timeline;
  if (Array.isArray(timeline)) {
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
      const note = String(timeline[i]?.note || "");
      const marker = "SHARE_CARD_URL:";
      const idx = note.indexOf(marker);
      if (idx >= 0) {
        const url = note.slice(idx + marker.length).trim();
        if (url.startsWith("http")) return url;
      }
    }
  }

  return "";
}

const badgeTemplates = [
  {
    id: 1,
    name: "Civic Watcher",
    description: "Reported your 1st civic issue",
    icon: "👁️",
    color: "bg-sky-100 text-sky-700 border-sky-200",
    milestone: 1,
  },
  {
    id: 2,
    name: "Active Citizen",
    description: "Vocal about 5 community issues",
    icon: "📢",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    milestone: 5,
  },
  {
    id: 3,
    name: "Area Sentinel",
    description: "Consistent reporting (10 issues)",
    icon: "🛡️",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    milestone: 10,
  },
  {
    id: 4,
    name: "City Guard",
    description: "Top-tier contributor (25 issues)",
    icon: "🏛️",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    milestone: 25,
  },
];

export default function Profile() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "history" | "gallery" | "badges" | "settings"
  >("overview");
  const [userStats, setUserStats] = useState({
    reported: 0,
    resolved: 0,
    reputationScore: 0,
  });
  const [currentUser, setCurrentUser] = useState<any>({
    name: "Citizen",
    ward: "New Delhi",
    joinedDate: "Recently",
    reputationLevel: "Bronze Citizen",
    nextMilestone: 1000,
  });
  const [newName, setNewName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isGeneratingBadge, setIsGeneratingBadge] = useState<number | null>(
    null,
  );
  const [showAllHistory, setShowAllHistory] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const applyComplaintsData = (userComplaints: any[]) => {
    const sorted = [...userComplaints].sort(
      (a, b) =>
        new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime(),
    );
    setComplaints(sorted);

    const score =
      sorted.length * 10 +
      sorted.filter((c) => c.status === "Resolved").length * 50;
    setUserStats({
      reported: sorted.length,
      resolved: sorted.filter((c) => ["Resolved", "Closed"].includes(c.status))
        .length,
      reputationScore: score,
    });

    const level =
      score >= 1000
        ? "Gold Citizen"
        : score >= 500
          ? "Silver Citizen"
          : "Bronze Citizen";
    setCurrentUser((prev: any) => ({ ...prev, reputationLevel: level }));
    setLoading(false);
  };

  useEffect(() => {
    account
      .get()
      .then((user) => {
        setCurrentUser((prev: any) => ({
          ...prev,
          name: user.name || user.email?.split("@")[0] || "Citizen",
          email: user.email || "",
          uid: user.$id,
          joinedDate: formatDate(user.registration || user.$createdAt),
        }));
        setNewName(user.name || "");
        return appwriteService.subscribeToUserComplaints(
          user.$id,
          (userComplaints) => {
            applyComplaintsData(userComplaints);
          },
        );
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "gallery" || !currentUser?.uid) return;

    appwriteService
      .getComplaintsByUser(currentUser.uid)
      .then((latestComplaints) => {
        applyComplaintsData(latestComplaints || []);
      })
      .catch((err) => {
        console.error("Failed to refresh gallery data:", err);
      });
  }, [activeTab, currentUser?.uid]);

  const progressPercent = Math.min(
    100,
    Math.round((userStats.reputationScore / currentUser.nextMilestone) * 100),
  );
  const badges = useMemo(
    () =>
      badgeTemplates.map((badge) => ({
        ...badge,
        earned:
          (badge.id === 1 && userStats.reported > 0) ||
          (badge.id === 2 && userStats.reported >= 5) ||
          (badge.id === 3 && userStats.resolved >= 10) ||
          (badge.id === 4 && userStats.reputationScore >= 1000),
      })),
    [userStats],
  );

  const galleryCards = useMemo(
    () => complaints.filter((c) => !!resolveGalleryImageUrl(c)),
    [complaints],
  );

  const handleLogout = async () => {
    try {
      await account.deleteSessions();
    } catch (_) {
      try {
        await account.deleteSession("current");
      } catch (_) { }
    }
    navigate("/login");
  };

  const handleShare = async (complaint: any) => {
    if (!reportRef.current) {
      // Fallback if ref is not available for some reason
      const shareData = {
        title: `CivicPulse - ${complaint.category}`,
        text: `Status: ${complaint.status}\nTrack this complaint at CivicPulse!`,
        url: `${window.location.origin}/dashboard/complaints/${complaint.$id}`,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          toast.success("Shared successfully");
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            toast.error("Sharing failed");
          }
        }
      } else {
        try {
          await navigator.clipboard.writeText(shareData.url);
          toast.success("Link copied to clipboard!");
        } catch (err) {
          toast.error("Failed to copy link");
        }
      }
      return;
    }

    setIsGenerating(complaint.$id);
    toast.info("Generating professional report card...");

    try {
      // Ensure the report template has time to update with the new complaint id if needed
      await new Promise((r) => setTimeout(r, 300));

      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        quality: 1,
        pixelRatio: 2, // Higher quality for sharing
      });

      // Check if navigator.share supports files (mobile)
      if (navigator.share && navigator.canShare) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File(
          [blob],
          `CivicPulse-Report-${complaint.$id.slice(-6)}.png`,
          { type: "image/png" },
        );

        const shareData = {
          files: [file],
          title: `CivicPulse - ${complaint.category}`,
          text: `Official Report: ${complaint.category} - Status: ${complaint.status}`,
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          toast.success("Report Card shared!");
        } else {
          throw new Error("Cannot share this file");
        }
      } else {
        // Desktop/Fallback: Download and Copy link
        const link = document.createElement("a");
        link.download = `CivicPulse-Report-${complaint.$id.slice(-6)}.png`;
        link.href = dataUrl;
        link.click();

        const shareUrl = `${window.location.origin}/dashboard/complaints/${complaint.$id}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Report Card downloaded & link copied!");
      }
    } catch (err) {
      console.error("Share error:", err);
      // Final fallback to text share if image generation or sharing fails
      const shareData = {
        title: `CivicPulse - ${complaint.category}`,
        text: `Status: ${complaint.status}\nTrack this complaint at CivicPulse!`,
        url: `${window.location.origin}/dashboard/complaints/${complaint.$id}`,
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copied to clipboard!");
      }
    } finally {
      setIsGenerating(null);
    }
  };

  const handleShareGalleryImage = async (complaint: any) => {
    const complaintId = complaint?.id || complaint?.$id;
    const imageUrl = resolveGalleryImageUrl(complaint);
    if (!complaintId || !imageUrl) return;

    const shareUrl = `${window.location.origin}/dashboard/complaints/${complaintId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `CivicPulse - ${complaint?.category || "Issue"}`,
          text: `Official report card • ${complaint?.category || "Issue"} • ${formatDate(
            complaint?.$createdAt,
          )}`,
          url: imageUrl,
        });
        toast.success("Shared successfully");
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${imageUrl}\n${shareUrl}`);
      toast.success("Image link copied to clipboard!");
    } catch {
      toast.error("Failed to share image link");
    }
  };

  const handleDownloadReport = async (complaint: any) => {
    if (!reportRef.current) return;
    setIsGenerating(complaint.$id);

    try {
      // Small timeout to ensure the report-to-be-rendered is visible if needed
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        quality: 1,
      });

      const link = document.createElement("a");
      link.download = `CivicPulse-Report-${complaint.$id.slice(-6)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Community Sharecard Generated!");
    } catch (err) {
      toast.error("Failed to generate report image");
      console.error(err);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDownloadBadge = async (badge: any) => {
    if (!badgeRef.current || !badge.earned) return;
    setIsGeneratingBadge(badge.id);

    try {
      // Small timeout to ensure the element exists
      await new Promise((r) => setTimeout(r, 400));

      const dataUrl = await toPng(badgeRef.current, {
        cacheBust: true,
        quality: 1,
        style: {
          opacity: "1",
          visibility: "visible",
        },
      });

      const link = document.createElement("a");
      link.download = `CivicPulse-Badge-${badge.name.replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(`${badge.name} Certificate Downloaded!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate certificate");
    } finally {
      setIsGeneratingBadge(null);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim() || newName === currentUser?.name) return;
    setIsUpdating(true);
    try {
      await account.updateName(newName);
      setCurrentUser((prev: any) => ({ ...prev, name: newName }));
      toast.success("Profile name updated successfully!");
    } catch (err) {
      toast.error("Failed to update profile name");
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading && complaints.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-slate-50/50">
        <div className="mb-4 h-12 w-12 rounded-full border-4 border-slate-200 border-t-sky-600 animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
          Syncing Profile...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-blue-100 p-1 shadow-sm"
      >
        <div className="relative px-6 py-8 md:px-8 md:py-10 flex flex-col lg:flex-row gap-8 items-center lg:items-end justify-between">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            <div className="h-24 w-24 flex items-center justify-center rounded-3xl bg-sky-700 text-3xl font-bold text-white shadow-lg shadow-sky-900/20">
              {currentUser.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-100 mx-auto md:mx-0">
                  Citizen Profile
                </span>
                <div className="flex items-center gap-3 justify-center md:justify-start">
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                    {currentUser.name}
                  </h1>
                  <span className="px-3 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-full border border-sky-200">
                    {currentUser.reputationLevel}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600 font-medium justify-center md:justify-start">
                <span className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full ring-1 ring-slate-200 shadow-sm">
                  <Mail className="h-4 w-4 text-sky-600" /> {currentUser.email}
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full ring-1 ring-slate-200 shadow-sm">
                  <MapPin className="h-4 w-4 text-sky-600" /> {currentUser.ward}
                </span>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-auto min-w-[280px]">
            <div className="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-200/60 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={48} className="text-sky-700" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Reputation Score
                  </div>
                  <div className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                </div>
                <div className="text-5xl font-black mb-4 tracking-tighter text-slate-900">
                  {userStats.reputationScore}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Progress to Gold</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      className="h-full bg-sky-700 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200/60 px-8 flex gap-8 bg-white/50 backdrop-blur-sm">
          {["overview", "history", "gallery", "badges", "settings"].map(
            (id) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`relative py-4 text-[11px] font-bold transition-all uppercase tracking-widest ${activeTab === id ? "text-sky-700" : "text-slate-400 hover:text-slate-600"}`}
              >
                {id}
                {activeTab === id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-sky-700 rounded-t-full"
                  />
                )}
              </button>
            ),
          )}
        </div>
      </motion.section>

      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Submissions",
                  value: userStats.reported,
                  color: "text-sky-700",
                  icon: FileText,
                },
                {
                  label: "Success Rate",
                  value: `${userStats.reported ? Math.round((userStats.resolved / userStats.reported) * 100) : 0}%`,
                  color: "text-emerald-700",
                  icon: CheckCircle2,
                },
                {
                  label: "Civic Credit",
                  value: userStats.reputationScore,
                  color: "text-sky-700",
                  icon: TrendingUp,
                },
                {
                  label: "Community Rank",
                  value: "Top 5%",
                  color: "text-sky-700",
                  icon: Award,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-sky-200 transition-colors"
                >
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {item.label}
                    </div>
                    <div className={`text-2xl font-black ${item.color} mt-0.5`}>
                      {item.value}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-sky-50 transition-colors">
                    <item.icon
                      size={20}
                      className="text-slate-400 group-hover:text-sky-600"
                    />
                  </div>
                </div>
              ))}
            </section>

            <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
              <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h2 className="text-base font-bold text-slate-900">
                    Recent Activity
                  </h2>
                  <button
                    onClick={() => navigate("/dashboard/complaints")}
                    className="text-sky-700 text-[10px] font-bold uppercase tracking-wider hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {complaints && complaints.length > 0 ? (
                    complaints.slice(0, 4).map((c) => (
                      <button
                        key={c?.$id}
                        onClick={() =>
                          navigate(`/dashboard/complaints/${c?.$id}`)
                        }
                        className="flex w-full items-center gap-6 px-8 py-5 text-left hover:bg-slate-50 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 group-hover:text-sky-700 transition-colors">
                            {c?.category || "Unknown"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-1">
                            {c?.address || "No address provided"}
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${["Resolved", "Closed"].includes(c?.status) ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}`}
                        >
                          {c?.status || "Unknown"}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-16 text-center text-slate-400 italic text-sm">
                      No activity recorded yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] bg-white p-7 border border-slate-200 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-sky-50/30">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-slate-900">
                      Rankings
                    </h2>
                    <Award className="text-sky-700/20" size={20} />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 ring-1 ring-amber-100">
                        <Star size={18} fill="currentColor" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] font-bold text-slate-900 uppercase">
                          Top 5% in Ward
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Based on recent resolutions
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 ring-1 ring-sky-100">
                        <TrendingUp size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] font-bold text-slate-900 uppercase">
                          Streak: 3 Days
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Keep it up, Citizen!
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("badges")}
                    className="w-full mt-6 py-3 text-[10px] font-bold uppercase tracking-widest text-sky-700 bg-white ring-1 ring-sky-100 rounded-xl hover:bg-sky-50 transition-all"
                  >
                    View All Badges
                  </button>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between p-5 rounded-[22px] bg-white text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all ring-1 ring-slate-200 hover:ring-red-100"
                >
                  <span>Sign out safely</span>
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-base font-bold text-slate-900">
                  Tracked Incidents
                </h2>
                <button
                  onClick={() => navigate("/dashboard/complaints")}
                  className="text-sky-700 text-[10px] font-bold uppercase tracking-wider hover:underline"
                >
                  Full Analytics
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {complaints && complaints.length > 0 ? (
                  complaints
                    .slice(0, showAllHistory ? undefined : 3)
                    .map((c) => (
                      <button
                        key={c.$id}
                        onClick={() =>
                          navigate(`/dashboard/complaints/${c.$id}`)
                        }
                        className="flex w-full items-center gap-6 px-8 py-5 text-left hover:bg-slate-50 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900 group-hover:text-sky-700 transition-colors">
                              {c?.category || "Unknown Category"}
                            </div>
                            <span className="text-[9px] font-mono text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 group-hover:border-sky-100 group-hover:text-sky-400 transition-colors">
                              #{c?.$id?.slice(-6).toUpperCase() || "N/A"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-1">
                            {c?.address || "No Address"}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {formatDate(c?.$createdAt)}
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${["Resolved", "Closed"].includes(c?.status) ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}`}
                        >
                          {c?.status || "Unknown"}
                        </div>
                      </button>
                    ))
                ) : (
                  <div className="p-16 text-center text-slate-400 italic text-sm">
                    No records found.
                  </div>
                )}
              </div>

              {complaints && complaints.length > 3 && (
                <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex justify-center">
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 transition-all shadow-sm"
                  >
                    {showAllHistory
                      ? "Show Less"
                      : `Load More (${complaints.length - 3} More)`}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "gallery" && (
          <motion.div
            key="gallery"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-base font-bold text-slate-900">
                  Shared Report Cards
                </h2>
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                  Showing {galleryCards.length} Reports
                </div>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {galleryCards.length > 0 ? (
                    galleryCards.slice(0, 12).map((c) => {
                      const complaintId = c?.id || c?.$id || "";
                      const galleryImageUrl = resolveGalleryImageUrl(c);
                      if (!galleryImageUrl) return null;
                      return (
                        <div
                          key={complaintId || Math.random()}
                          className="rounded-[24px] overflow-hidden border border-slate-200 bg-white shadow-sm transition-all hover:shadow-xl hover:-translate-y-1"
                        >
                          <button
                            onClick={() =>
                              window.open(galleryImageUrl, "_blank")
                            }
                            className="block w-full aspect-square relative group"
                          >
                            <ImageWithFallback
                              src={galleryImageUrl}
                              alt={c?.category || "Complaint"}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          </button>

                          <div className="p-3 space-y-2">
                            <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">
                              {c?.category || "Incident"}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {formatDate(c?.$createdAt || c?.createdAt)}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => handleShareGalleryImage(c)}
                                className="flex-1 h-8 rounded-xl bg-sky-50 text-sky-700 text-[10px] font-bold uppercase tracking-wider hover:bg-sky-100 transition-colors"
                              >
                                Share
                              </button>
                              <button
                                onClick={() =>
                                  complaintId &&
                                  navigate(
                                    `/dashboard/complaints/${complaintId}`,
                                  )
                                }
                                className="h-8 px-3 rounded-xl bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full p-16 text-center text-slate-400 italic text-sm space-y-3 flex flex-col items-center">
                      <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                        <ImageIcon size={32} />
                      </div>
                      <p>
                        No share cards yet. Open a complaint and click Share
                        Image once.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hidden Report Card Template used for Image Generation */}
            <div className="fixed -left-[2000px] top-0 pointer-events-none">
              <div
                ref={reportRef}
                className="w-[1080px] bg-white p-16 rounded-[48px] shadow-2xl relative overflow-hidden"
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-50 rounded-full -translate-y-1/2 translate-x-1/2 -z-10 opacity-60" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-50 rounded-full translate-y-1/2 -translate-x-1/2 -z-10 opacity-40" />

                <div className="flex justify-between items-start mb-16">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 bg-sky-700 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
                        CP
                      </div>
                      <div className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                        CivicPulse
                      </div>
                    </div>
                    <div className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                      Official Incident Report Card
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-slate-900 uppercase">
                      Status
                    </div>
                    <div
                      className={`text-4xl font-black uppercase tracking-tight mt-1 ${["Resolved", "Closed"].includes(
                        complaints.find((c) => c.$id === isGenerating)
                          ?.status,
                      )
                          ? "text-emerald-600"
                          : "text-orange-500"
                        }`}
                    >
                      {complaints.find((c) => c.$id === isGenerating)?.status ||
                        "VALIDATED"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-12">
                  <div className="col-span-5">
                    <div className="aspect-[4/5] rounded-[40px] overflow-hidden border-8 border-white shadow-2xl">
                      <ImageWithFallback
                        src={
                          complaints.find((c) => c.$id === isGenerating)
                            ?.imageUrl ||
                          (String(
                            complaints.find((c) => c.$id === isGenerating)
                              ?.photos || "",
                          ).match(/https?:\/\/[^\s"']+/) || [])[0]
                        }
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="col-span-7 flex flex-col justify-center gap-8">
                    <div className="space-y-2">
                      <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Category
                      </div>
                      <div className="text-6xl font-black text-slate-900 tracking-tight leading-none">
                        {complaints.find((c) => c.$id === isGenerating)
                          ?.category || "Civic Issue"}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-6 p-6 bg-slate-50/80 rounded-[32px] border border-slate-100">
                        <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-sky-600 shadow-sm">
                          <MapPin size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">
                            Incident Area
                          </div>
                          <div className="text-2xl font-bold text-slate-900 truncate">
                            {complaints.find((c) => c.$id === isGenerating)
                              ?.address || "Delhi - NCT Location"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 p-6 bg-slate-50/80 rounded-[32px] border border-slate-100">
                        <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                          <FileText size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">
                            Tracking ID
                          </div>
                          <div className="text-2xl font-bold font-mono text-slate-900">
                            #
                            {complaints
                              .find((c) => c.$id === isGenerating)
                              ?.$id?.slice(-12)
                              .toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black">
                          {currentUser.name[0]}
                        </div>
                        <div>
                          <div className="text-slate-900 font-black text-lg uppercase tracking-tight">
                            {currentUser.name}
                          </div>
                          <div className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                            Verified Reporter
                          </div>
                        </div>
                      </div>
                      <div className="px-6 py-2 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em]">
                        SCAN TO VALIDATE
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-16 text-center text-slate-300 font-black uppercase tracking-[0.3em] text-[10px]">
                  Built for a Smarter, Transparent, and Better Delhi • PS-CRM
                  Civic Architecture
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "badges" && (
          <motion.div
            key="badges"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-8"
          >
            <div className="max-w-6xl mx-auto">
              {/* Hidden High-Fidelity Badge Template for Generation */}
              <div className="fixed -left-[2000px] top-0 pointer-events-none">
                <div
                  ref={badgeRef}
                  className="w-[1024px] bg-white p-24 rounded-[48px] shadow-2xl relative overflow-hidden"
                  style={{ minHeight: "800px" }}
                >
                  {/* Background Decor */}
                  <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-50 rounded-full -translate-y-1/2 translate-x-1/2 -z-10 opacity-60" />
                  <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-50 rounded-full translate-y-1/2 -translate-x-1/2 -z-10 opacity-40" />

                  <div className="flex flex-col items-center text-center gap-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-14 w-14 bg-sky-700 rounded-2xl flex items-center justify-center text-white text-3xl font-black">
                        CP
                      </div>
                      <div className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
                        CivicPulse
                      </div>
                    </div>

                    <div className="h-40 w-40 bg-white rounded-[48px] shadow-xl border-8 border-sky-50 flex items-center justify-center text-8xl mb-4">
                      {badges.find((b) => b.id === isGeneratingBadge)?.icon ||
                        "🏅"}
                    </div>

                    <div className="space-y-4">
                      <div className="text-slate-400 font-bold uppercase tracking-[0.4em] text-sm">
                        Official Achievement Certificate
                      </div>
                      <h2 className="text-7xl font-black text-slate-900 tracking-tight leading-none px-12">
                        {badges.find((b) => b.id === isGeneratingBadge)?.name ||
                          "Achievement"}
                      </h2>
                    </div>

                    <div className="w-full max-w-2xl h-0.5 bg-slate-100 my-4" />

                    <div className="space-y-8">
                      <div className="text-slate-500 text-2xl font-medium max-w-2xl leading-relaxed">
                        This certifies that{" "}
                        <span className="font-black text-slate-900 uppercase tracking-tight">
                          {currentUser.name}
                        </span>{" "}
                        has demonstrated exceptional civic responsibility and
                        active participation in the **CivicPulse** community.
                      </div>

                      <div className="inline-flex items-center gap-1.5 py-3 px-8 bg-emerald-500 text-white rounded-full text-lg font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20">
                        <CheckCircle2 size={24} /> Verified Contributor
                      </div>
                    </div>

                    <div className="flex items-center gap-12 mt-12 bg-slate-50 border border-slate-100 p-8 rounded-[32px]">
                      <div className="text-left">
                        <div className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">
                          Authenticated For
                        </div>
                        <div className="text-xl font-bold text-slate-900">
                          {currentUser.name}
                        </div>
                      </div>
                      <div className="h-10 w-[1px] bg-slate-200" />
                      <div className="text-left">
                        <div className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">
                          Digital Stamp
                        </div>
                        <div className="text-xl font-bold font-mono text-slate-900 tracking-tighter">
                          CP-ACHV-#
                          {Math.random()
                            .toString(36)
                            .substr(2, 9)
                            .toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 text-slate-300 font-black uppercase tracking-[0.3em] text-xs">
                      Built for a Smarter, Transparent, and Better Delhi •
                      ps-crm architecture
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-3 mb-12">
                <h2 className="text-3xl font-bold text-slate-900">
                  Civic Milestones
                </h2>
                <p className="text-slate-500 text-sm">
                  Earn recognition by contributing to a better Delhi.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-8">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    className={`p-8 rounded-[32px] border-2 transition-all flex flex-col items-center text-center gap-6 ${b.earned ? "bg-white border-sky-100 shadow-xl ring-1 ring-sky-50" : "bg-slate-50/50 border-slate-100 opacity-60 grayscale"}`}
                  >
                    <div
                      className={`h-24 w-24 rounded-[28px] flex items-center justify-center text-5xl shadow-inner ${b.earned ? "bg-sky-50" : "bg-slate-100"}`}
                    >
                      {b.icon}
                    </div>
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-col items-center gap-2">
                        <h3
                          className={`text-xl font-bold ${b.earned ? "text-slate-900" : "text-slate-400"}`}
                        >
                          {b.name}
                        </h3>
                        {b.earned && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full ring-1 ring-emerald-100">
                            <CheckCircle2 size={12} /> Achieved
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed px-2">
                        {b.description}
                      </p>
                    </div>

                    {b.earned ? (
                      <button
                        onClick={() => handleDownloadBadge(b)}
                        disabled={isGeneratingBadge !== null}
                        className="w-full py-3.5 bg-sky-700 hover:bg-sky-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-sky-900/10 active:scale-95 flex items-center justify-center gap-2"
                      >
                        {isGeneratingBadge === b.id ? (
                          <span className="animate-spin text-lg">◌</span>
                        ) : (
                          <Download size={14} />
                        )}
                        Download Certificate
                      </button>
                    ) : (
                      <div className="w-full inline-flex items-center justify-center gap-1.5 py-3.5 bg-slate-100 rounded-2xl text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                        Locked
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "settings" && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
          >
            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-base font-bold text-slate-900">
                  Account Preferences
                </h2>
              </div>
              <div className="p-8 space-y-8">
                <div className="space-y-4 max-w-sm">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Display Name
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="New Name"
                      className="flex-1 h-12 px-5 rounded-2xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-sm disabled:opacity-50"
                      disabled={isUpdating}
                    />
                    <button
                      onClick={handleUpdateName}
                      disabled={
                        isUpdating ||
                        !newName.trim() ||
                        newName === currentUser?.name
                      }
                      className="h-12 px-6 rounded-2xl bg-sky-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-sky-600/20 active:scale-95 flex items-center gap-2"
                    >
                      {isUpdating ? (
                        <span className="animate-spin text-lg">◌</span>
                      ) : (
                        "Update"
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Citizen Profile Data
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Your data is stored securely in accordance with local
                      governance policies.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/dashboard/profile/export")}
                    className="text-[10px] font-bold uppercase tracking-wider text-sky-700 hover:text-sky-900 px-4 py-2 rounded-xl bg-sky-50 transition-colors"
                  >
                    Export Report
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
