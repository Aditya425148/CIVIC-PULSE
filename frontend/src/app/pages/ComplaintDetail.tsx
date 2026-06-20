import { useParams, useNavigate, useLocation } from "react-router";
import { useState, useEffect, useRef } from "react";
import { appwriteService } from "../appwriteService";
import { account } from "../appwrite";
import { api } from "../api";
import { motion } from "motion/react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Copy,
  AlertCircle,
  CheckCircle,
  Star,
  MessageSquare,
  ThumbsUp,
  Download,
  Camera,
  Wrench,
  Share2,
} from "lucide-react";

const statusColors: Record<string, string> = {
  Submitted: "bg-slate-100 text-slate-600",
  Assigned: "bg-emerald-100 text-emerald-700",
  "In Progress": "bg-emerald-100 text-emerald-700 font-black animate-pulse",
  Resolved: "bg-emerald-100 text-emerald-700",
  Closed: "bg-slate-100 text-slate-500",
  Escalated: "bg-red-100 text-red-700",
};

const statusSteps = [
  "Submitted",
  "Assigned",
  "In Progress",
  "Resolved",
  "Closed",
];

export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedReassignManager, setSelectedReassignManager] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);

  useEffect(() => {
    if (showReassignModal) {
      api.get<any[]>("/api/complaints/managers")
        .then(setManagers)
        .catch((err) => {
          console.error("Failed to fetch managers for reassignment:", err);
          toast.error("Failed to load managers");
        });
    }
  }, [showReassignModal]);

  useEffect(() => {
    account
      .get()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
    if (id) {
      setLoading(true);
      appwriteService
        .getComplaintById(id)
        .then((data) => {
          setComplaint(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch complaint:", err);
          setLoading(false);
        });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-vh-100 p-8 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mr-3"></div>
        Loading complaint details...
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center text-slate-500">
        Complaint not found
      </div>
    );
  }

  const currentStepIndex = statusSteps.indexOf(complaint.status);
  const isOverdue =
    (complaint.slaRemainingHours || 0) < 0 &&
    !["Resolved", "Closed"].includes(complaint.status);
  const canEscalate = isOverdue || complaint.status === "Escalated";
  const canReopen = ["Resolved", "Closed"].includes(complaint.status);

  const isReporter =
    currentUser &&
    (complaint.reporterId === currentUser.$id ||
      complaint.userId === currentUser.$id);

  const isManager =
    currentUser && sessionStorage.getItem("managerData") !== null;

  const backToListPath = location.pathname.startsWith("/admin/")
    ? "/admin/queue"
    : "/dashboard/complaints";

  const handleCopyId = () => {
    navigator.clipboard.writeText(complaint.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getEvidenceImageUrl = () => {
    if (
      typeof complaint?.imageUrl === "string" &&
      complaint.imageUrl.startsWith("http")
    ) {
      return complaint.imageUrl;
    }
    if (
      typeof complaint?.photoUrl === "string" &&
      complaint.photoUrl.startsWith("http")
    ) {
      return complaint.photoUrl;
    }
    const photos = complaint?.photos;
    if (
      Array.isArray(photos) &&
      typeof photos[0] === "string" &&
      photos[0].startsWith("http")
    ) {
      return photos[0];
    }
    if (typeof photos === "string" && photos.startsWith("http")) {
      return photos;
    }
    return "";
  };

  const evidenceImageUrl = getEvidenceImageUrl();

  const visibleTimeline = (complaint?.timeline || []).filter((event: any) => {
    const note = String(event?.note || "").toLowerCase();
    return !(
      note.includes("share_card_url:") ||
      note.includes("share card saved to gallery") ||
      note.includes("automatic report card generation") ||
      note.includes("auto share card saved")
    );
  });

  const generateShareCardDataUrl = async () => {
    if (!shareCardRef.current) {
      throw new Error("Share card not ready");
    }

    await new Promise((r) => setTimeout(r, 120));

    try {
      return await toPng(shareCardRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        quality: 1,
        pixelRatio: 2,
        style: {
          opacity: "1",
          visibility: "visible",
          position: "static",
        },
      });
    } catch {
      // Retry without evidence image when third-party image CORS taints canvas.
      return await toPng(shareCardRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        quality: 1,
        pixelRatio: 2,
        style: {
          opacity: "1",
          visibility: "visible",
          position: "static",
        },
        filter: (node) =>
          !(
            node instanceof HTMLImageElement &&
            node.getAttribute("data-share-evidence") === "true"
          ),
      });
    }
  };

  const handleDownloadImage = async () => {
    if (!shareCardRef.current) return;
    setIsDownloadingImage(true);
    try {
      const dataUrl = await generateShareCardDataUrl();
      const link = document.createElement("a");
      link.download = `CivicPulse-${complaint.id}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Image downloaded successfully!");
    } catch (err) {
      console.error("Download image error:", err);
      toast.error("Failed to download image. Please try again.");
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      toast.error("Please select a rating (1-5 stars).");
      return;
    }

    setIsSubmittingRating(true);
    try {
      await api.patch(`/api/complaints/${complaint.id}/status`, {
        status: "Closed",
        note: comment || `Closed with ${rating}-star rating`,
        actor: currentUser?.name || "Citizen",
        rating: rating,
        feedback: comment,
      });

      toast.success("Thank you! Your feedback has been submitted.");

      // Refresh complaint data
      const updated = await appwriteService.getComplaintById(complaint.id);
      setComplaint(updated);
      setRating(0);
      setComment("");
    } catch (error: any) {
      console.error("Failed to submit rating:", error);
      toast.error(
        error.message || "Failed to submit rating. Please try again.",
      );
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleCloseComplaint = async () => {
    setIsSubmittingRating(true);
    try {
      await api.patch(`/api/complaints/${complaint.id}/status`, {
        status: "Closed",
        note: "Closed by manager",
        actor: currentUser?.name || "Manager",
      });

      toast.success("Complaint closed successfully.");

      // Refresh complaint data
      const updated = await appwriteService.getComplaintById(complaint.id);
      setComplaint(updated);
    } catch (error: any) {
      console.error("Failed to close complaint:", error);
      toast.error(
        error.message || "Failed to close complaint. Please try again.",
      );
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Hidden Share Card */}
      <div
        className="fixed -left-[2000px] top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div
          ref={shareCardRef}
          className="w-[800px] bg-white p-12 rounded-[3rem] border-[12px] border-orange-100 shadow-2xl relative overflow-hidden"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          {/* Brand Background Decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-32 -mb-32" />

          <div className="relative z-10">
            {/* Brand Header */}
            <div className="flex items-center justify-between mb-12 border-b border-slate-100 pb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-500 rounded-[1.5rem] flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                    CivicPulse
                  </h1>
                  <p className="text-emerald-700 font-bold uppercase tracking-widest text-xs">
                    Official Issue Report
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Report ID
                </span>
                <p className="text-xl font-bold text-slate-900 leading-tight">
                  #{complaint.id}
                </p>
              </div>
            </div>

            {/* Core Stats */}
            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-slate-50">
                  {complaint.category === "Garbage"
                    ? "🗑️"
                    : complaint.category === "Streetlight"
                      ? "💡"
                      : complaint.category === "Pothole"
                        ? "🔧"
                        : complaint.category === "Water"
                          ? "💧"
                          : "📍"}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Issue Type
                  </p>
                  <p className="text-xl font-black text-slate-800">
                    {complaint.category}
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-50">
                  <MapPin className="w-8 h-8 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Status
                  </p>
                  <p className="text-xl font-black text-emerald-700">
                    {complaint.status}
                  </p>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="space-y-8">
              <div className="p-8 bg-white border-2 border-slate-100 rounded-[2.5rem]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  Report Description
                </p>
                <div className="flex gap-6 items-start">
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-slate-900 leading-relaxed italic">
                      "{complaint.description}"
                    </p>
                  </div>
                  {evidenceImageUrl && (
                    <div className="shrink-0">
                      <div className="p-2 bg-slate-50 rounded-[2.5rem] border-4 border-white shadow-xl rotate-2">
                        <img
                          src={evidenceImageUrl}
                          alt="Evidence"
                          data-share-evidence="true"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          className="w-48 h-48 object-cover rounded-[2rem]"
                        />
                      </div>
                      <div className="text-center mt-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          Live Evidence Capture
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-5 p-6 border-l-4 border-orange-500 bg-orange-50/60 rounded-r-[2rem]">
                <MapPin className="w-8 h-8 text-orange-600 mt-1 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Full Location
                  </p>
                  <p className="text-xl font-bold text-slate-800">
                    {complaint.address}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer QR / Link Area */}
            <div className="mt-16 pt-8 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <p className="text-sm font-bold text-slate-500">
                  Validated on{" "}
                  <span className="text-slate-900 font-black">
                    {new Date().toLocaleDateString()}
                  </span>{" "}
                  via CivicPulse Network
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Scanned via Web App
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(backToListPath)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-sm text-slate-400">Complaint Detail</span>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Top Banner */}
        <div
          className={`p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 ${
            complaint.escalated ? "bg-red-50" : "bg-white"
          }`}
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-lg font-[800] text-slate-900">
                {complaint.id}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-[600] ${statusColors[complaint.status]}`}
              >
                {complaint.status}
              </span>
              {complaint.escalated && (
                <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-[700]">
                  🔴 Escalated — Under Review
                </span>
              )}
            </div>
            <div className="text-sm text-slate-500">
              {complaint.category} → {complaint.subcategory}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyId}
              className="flex items-center gap-1.5 text-xs font-[500] text-slate-500 hover:text-slate-900 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copied!" : "Copy ID"}
            </button>
            <button
              onClick={handleDownloadImage}
              disabled={isDownloadingImage}
              className="group flex items-center gap-1.5 text-xs font-black text-sky-700 hover:text-sky-800 px-3 py-2 bg-sky-50 hover:bg-sky-100 rounded-lg transition-all border border-sky-100 shadow-sm"
            >
              {isDownloadingImage ? (
                <div className="w-3.5 h-3.5 border-2 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
              )}
              Download Image
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 grid md:grid-cols-2 gap-6">
          {/* Left */}
          <div className="space-y-4">
            <div>
              <div className="text-xs font-[600] text-slate-400 mb-1 uppercase tracking-wider">
                Description
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {complaint.description}
              </p>
            </div>
            <div>
              <div className="text-xs font-[600] text-slate-400 mb-1 uppercase tracking-wider">
                Location
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400" />
                {complaint.address}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`flex flex-col items-center justify-center p-3 rounded-xl border border-dashed transition-all ${
                  complaint.priorityScore >= 0.75
                    ? "bg-red-50 text-red-600 border-red-200 shadow-sm shadow-red-500/10"
                    : complaint.priorityScore >= 0.4
                      ? "bg-amber-50 text-amber-600 border-amber-200"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Issue Priority
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black leading-none">
                    {(complaint.priorityScore * 10).toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold opacity-60">/ 10</span>
                </div>
                <div className="text-[9px] font-black uppercase mt-1 px-2 py-0.5 rounded-full bg-white/50">
                  {complaint.priorityScore >= 0.75
                    ? "Critical"
                    : complaint.priorityScore >= 0.4
                      ? "Standard"
                      : "Low"}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm flex flex-col items-center justify-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Issue Type
                </div>
                <div className="text-xl mb-0.5">
                  {complaint.category === "Garbage"
                    ? "🗑️"
                    : complaint.category === "Streetlight"
                      ? "💡"
                      : complaint.category === "Pothole"
                        ? "🔧"
                        : complaint.category === "Water"
                          ? "💧"
                          : "📍"}
                </div>
                <div className="text-[10px] font-black text-slate-700 uppercase">
                  {complaint.category}
                </div>
              </div>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 shadow-sm group hover:border-sky-300 transition-all">
              <div className="text-[10px] font-[700] text-sky-400 mb-1 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-sky-600 fill-sky-200" />
                System Status
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-black text-sky-900 leading-none py-1">
                  VALIDATED REPORT
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg border border-sky-200">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase">
                    Trusted
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-sky-700 font-[800] mt-1.5 flex items-center gap-1 bg-sky-100 px-2 py-0.5 rounded-full w-fit">
                <CheckCircle className="w-2.5 h-2.5" />
                READY FOR PROCESSING
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-4">
            {/* Assigned Manager */}
            <div
              className={`rounded-xl p-4 border ${complaint.assignedManagerName ? "bg-sky-50 border-sky-100" : "bg-slate-50 border-slate-100"}`}
            >
              <div className="text-xs font-[600] text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-sky-500" />
                Assigned Manager
              </div>
              {complaint.assignedManagerName ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xs font-[700] shrink-0">
                    {complaint.assignedManagerName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="text-sm font-[700] text-slate-900">
                      {complaint.assignedManagerName}
                    </div>
                    <div className="text-xs text-slate-400">
                      District Manager · {complaint.assignedManagerId}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic">
                  Pending assignment
                </div>
              )}
            </div>

            {/* SLA */}
            <div
              className={`rounded-xl p-4 border transition-all ${
                isOverdue
                  ? "bg-red-50 border-red-100"
                  : complaint.status === "Submitted"
                    ? "bg-amber-50 border-amber-100"
                    : complaint.slaRemainingHours < complaint.slaHours * 0.25
                      ? "bg-amber-50 border-amber-100"
                      : "bg-emerald-50 border-emerald-100"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock
                    className={`w-4 h-4 ${
                      isOverdue
                        ? "text-red-500"
                        : complaint.status === "Submitted"
                          ? "text-amber-500"
                          : "text-emerald-600"
                    }`}
                  />
                  <span className="text-xs font-[700] text-slate-700 uppercase tracking-wider">
                    SLA status
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                {isOverdue ? (
                  <div className="text-xl font-[900] text-red-600">
                    OVERDUE — {Math.abs(complaint.slaRemainingHours)}h
                  </div>
                ) : ["Resolved", "Closed"].includes(complaint.status) ? (
                  <div className="text-xl font-[800] text-emerald-600">
                    ✓ Resolved in time
                  </div>
                ) : complaint.status === "In Progress" ? (
                  <div className="flex flex-col gap-1">
                    <div className="text-2xl font-[900] text-emerald-600 flex items-center gap-2">
                      {complaint.slaRemainingHours}h
                      <span className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">
                        WORKING
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(complaint.slaRemainingHours / complaint.slaHours) * 100}%`,
                        }}
                        className="bg-emerald-500 h-full transition-all duration-1000"
                      />
                    </div>
                  </div>
                ) : complaint.status === "Submitted" ? (
                  <div className="text-xl font-[900] text-amber-600">
                    SLA START PENDING
                  </div>
                ) : (
                  <div className="text-2xl font-[900] text-orange-700">
                    {complaint.slaRemainingHours}h{" "}
                    <span className="text-sm font-bold">remaining</span>
                  </div>
                )}

                <div className="pt-2 border-t border-black/5 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">
                      Standard SLA
                    </span>
                    <span className="text-slate-900 font-bold">
                      {complaint.slaHours} Hours
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                    * Resolution starts after assignment
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment */}
            {complaint.assignedTo && (
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-[600] text-slate-400 mb-2 uppercase tracking-wider">
                  Assigned To
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-emerald-600 flex items-center justify-center text-white text-xs font-[700]">
                    {complaint.assignedTo
                      .split(" ")
                      .slice(-2)
                      .map((n: string) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="text-sm font-[600] text-slate-800">
                      {complaint.assignedTo}
                    </div>
                    <div className="text-xs text-slate-400">
                      Field Officer · {complaint.area}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500 bg-white rounded-lg p-2.5 border border-slate-100">
                  🔒 GPS-stamped proof will be uploaded on resolution
                </div>
              </div>
            )}

            {/* Escalate / Reopen / Close / Reassign Buttons */}
            <div className="space-y-2">
              {complaint.status === "Rejected" && isManager && (
                <button
                  onClick={() => setShowReassignModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-pink-50 hover:bg-pink-100 text-pink-700 text-sm font-[600] rounded-xl border border-pink-100 transition-colors"
                >
                  <Wrench className="w-4 h-4" />
                  Reassign to Manager
                </button>
              )}
              {canEscalate && !complaint.escalated && (
                <button
                  onClick={() => setShowEscalate(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-[600] rounded-xl border border-red-100 transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                  Escalate Complaint
                </button>
              )}
              {canReopen && (
                <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-[600] rounded-xl border border-amber-100 transition-colors">
                  Re-open Complaint (7 days)
                </button>
              )}
              {isManager && complaint.status === "Resolved" && (
                <button
                  onClick={handleCloseComplaint}
                  disabled={isSubmittingRating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 hover:bg-emerald-100 disabled:bg-emerald-50 text-emerald-700 text-sm font-[600] rounded-xl border border-emerald-200 transition-colors disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isSubmittingRating ? "Closing..." : "Close Complaint"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Photo */}
        {evidenceImageUrl && (
          <div className="px-5 pb-5">
            <div className="text-xs font-[600] text-slate-400 mb-2 uppercase tracking-wider">
              Evidence Gallery
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-slate-100 bg-slate-50 aspect-square">
                <img
                  src={evidenceImageUrl}
                  alt="Complaint evidence"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 text-center">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest mb-1">
                    {complaint.category}
                  </span>
                  <span className="text-[10px] text-white/80 font-medium tracking-tighter">
                    #{complaint.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              </div>

              {complaint.status === "Resolved" && (
                <div className="bg-emerald-50 rounded-2xl border-2 border-emerald-100 flex flex-col items-center justify-center gap-2 aspect-square relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl -mr-6 -mt-6" />
                  <Camera className="w-8 h-8 text-emerald-500 mb-1" />
                  <div className="text-center px-2">
                    <div className="text-[10px] text-emerald-700 font-black uppercase tracking-widest leading-none mb-1">
                      Resolution
                    </div>
                    <div className="text-[9px] text-emerald-500 font-bold">
                      GPS Verified
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleDownloadImage}
                  disabled={isDownloadingImage}
                  className="bg-sky-50 rounded-2xl border-2 border-sky-100 flex flex-col items-center justify-center gap-2 aspect-square group hover:bg-sky-100 transition-all border-dashed"
                >
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    {isDownloadingImage ? (
                      <div className="w-4 h-4 border-2 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 text-sky-600" />
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-sky-700 font-black uppercase tracking-widest">
                      Download
                    </div>
                    <div className="text-[9px] text-sky-500 font-bold">
                      PNG File
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-base font-[700] text-slate-900 mb-6">
          Status Timeline
        </h3>

        {/* Step bar */}
        <div className="flex items-center mb-8 overflow-x-auto pb-2">
          {statusSteps.map((s, i) => {
            const done =
              i <
              (complaint.status === "Closed"
                ? statusSteps.length
                : currentStepIndex);
            const active =
              statusSteps[i] === complaint.status ||
              (complaint.status === "Escalated" && s === "Assigned");
            return (
              <div key={s} className="flex items-center min-w-0">
                <div className="flex flex-col items-center min-w-[64px]">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-[700] border-2 ${
                      done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : active
                          ? "bg-orange-500 border-orange-500 text-white ring-4 ring-orange-100"
                          : "bg-white border-slate-200 text-slate-400"
                    }`}
                  >
                    {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  <span
                    className={`text-[10px] mt-1 text-center font-[500] whitespace-nowrap ${
                      active
                        ? "text-orange-700"
                        : done
                          ? "text-emerald-600"
                          : "text-slate-400"
                    }`}
                  >
                    {s}
                  </span>
                </div>
                {i < statusSteps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 min-w-[20px] ${done ? "bg-emerald-400" : "bg-slate-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Event log */}
        <div className="space-y-4">
          {visibleTimeline.map((event: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-4"
            >
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                {i < visibleTimeline.length - 1 && (
                  <div className="w-0.5 flex-1 bg-slate-100 mt-1" />
                )}
              </div>
              <div className="pb-4">
                <div className="text-sm font-[600] text-slate-900">
                  {event.status}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {event.note}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400">
                    {new Date(event.timestamp).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-xs text-emerald-700 font-[500]">
                    by {event.actor}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Rating (only for resolved/closed) */}
      {["Resolved", "Closed"].includes(complaint.status) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-base font-[700] text-slate-900 mb-4">
            Rate the Resolution
          </h3>
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                />
              </button>
            ))}
          </div>
          <textarea
            placeholder="Share your experience (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400 resize-none bg-slate-50"
          />
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleSubmitRating}
              disabled={isSubmittingRating}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-[600] rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              {isSubmittingRating ? "Submitting..." : "Submit Rating"}
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-[500] rounded-xl transition-colors">
              <Share2 className="w-4 h-4" />
              Share Before/After Card
            </button>
          </div>
        </div>
      )}

      {/* Reassign Complaint Modal */}
      {showReassignModal && complaint.status === "Rejected" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-white"
          >
            <h3 className="text-lg font-[700] text-slate-900 mb-2">
              Reassign Rejected Complaint
            </h3>
            <p className="text-xs text-slate-500 mb-4">ID: {complaint.id}</p>
            <div className="text-sm text-slate-700 mb-4 p-3 bg-pink-50 rounded-xl border border-pink-100">
              <strong>Category:</strong> {complaint.category}
              <br />
              <strong>Location:</strong> {complaint.address}
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
                    <div className="text-xs text-slate-400">{mgr.state || "Delhi"}</div>
                  </div>
                </label>
              ))}
              {managers.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-400">
                  No managers found
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!selectedReassignManager) return;

                  setIsReassigning(true);
                  try {
                    const manager = managers.find(
                      (m) => m.id === selectedReassignManager,
                    );
                    if (!manager) {
                      toast.error("Manager not found");
                      return;
                    }

                    // Reassign complaint to new manager
                    await api.patch(`/api/complaints/${complaint.id}/assign`, {
                      managerId: selectedReassignManager,
                      managerName: manager.name,
                    });

                    // Refresh complaint data
                    const updated = await appwriteService.getComplaintById(
                      complaint.id,
                    );
                    setComplaint(updated);

                    toast.success(`Complaint reassigned to ${manager.name}`);
                    setShowReassignModal(false);
                    setSelectedReassignManager("");
                  } catch (error) {
                    console.error("Reassignment error:", error);
                    toast.error("Failed to reassign complaint");
                  } finally {
                    setIsReassigning(false);
                  }
                }}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-[600] rounded-xl transition-colors disabled:opacity-40"
                disabled={!selectedReassignManager || isReassigning}
              >
                {isReassigning ? "Reassigning..." : "Confirm Reassignment"}
              </button>
              <button
                onClick={() => {
                  setShowReassignModal(false);
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

      {/* Escalation Modal */}
      {showEscalate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full"
          >
            <h3 className="text-lg font-[700] text-slate-900 mb-4">
              Escalate Complaint
            </h3>
            <div className="space-y-2 mb-4">
              {[
                "Still not fixed",
                "Wrong resolution",
                "Safety risk",
                "Other reason",
              ].map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <input type="radio" name="reason" className="w-4 h-4" />
                  <span className="text-sm text-slate-700">{r}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEscalate(false)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-[600] rounded-xl transition-colors"
              >
                Submit Escalation
              </button>
              <button
                onClick={() => setShowEscalate(false)}
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
