import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Play,
  BookOpen,
  Sun,
  Wrench,
  Building2,
  Zap,
  CheckCircle,
  ArrowRight,
  Star,
  Video,
  Lock,
  Youtube,
  Bell,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type InterestKey =
  | "rebates"
  | "financing"
  | "solar"
  | "maintenance"
  | "commercial"
  | "assessment";

interface VideoTopic {
  id: string;
  interest: InterestKey;
  title: string;
  description: string;
  duration: string;
  youtubeId: string | null; // null = coming soon
  previewVideoUrl?: string; // AI-generated preview video URL
  thumbnail: string;
  badge: string;
  badgeColor: string;
  cta: string;
  ctaHref: string;
  keyPoints: string[];
  isNew?: boolean;
}

// ─── Interest Categories ───────────────────────────────────────────────────────

const INTERESTS: { key: InterestKey; label: string; icon: React.ReactNode; description: string }[] = [
  {
    key: "rebates",
    label: "Rebates & Incentives",
    icon: <BookOpen className="h-5 w-5" />,
    description: "How to maximize your NJ incentives",
  },
  {
    key: "financing",
    label: "OBR Financing",
    icon: <Zap className="h-5 w-5" />,
    description: "$0 down, pay on your utility bill",
  },
  {
    key: "solar",
    label: "Solar + Heat Pump",
    icon: <Sun className="h-5 w-5" />,
    description: "The bundle that pays for itself",
  },
  {
    key: "maintenance",
    label: "Maintenance Plans",
    icon: <Wrench className="h-5 w-5" />,
    description: "Keep your system running perfectly",
  },
  {
    key: "commercial",
    label: "Commercial HVAC",
    icon: <Building2 className="h-5 w-5" />,
    description: "VRV/VRF and large-scale solutions",
  },
  {
    key: "assessment",
    label: "Free Assessment",
    icon: <CheckCircle className="h-5 w-5" />,
    description: "What to expect at your visit",
  },
];

// ─── Video Library ─────────────────────────────────────────────────────────────

const VIDEOS: VideoTopic[] = [
  {
    id: "rebates-explainer",
    interest: "rebates",
    title: "How to Get Up to $16,000 Back on a New Heat Pump in NJ",
    description:
      "New Jersey homeowners can stack federal tax credits, utility rebates, and On-Bill Repayment financing to get a brand-new heat pump with little to nothing out of pocket. We walk you through every dollar available.",
    duration: "1:30",
    youtubeId: null, // Replace with real YouTube ID when uploaded — preview video available below
    previewVideoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/nj-rebates-explainer_ee0faf4a.mp4",
    thumbnail:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/hook_generated_f14368ff.webp",
    badge: "Rebates & Incentives",
    badgeColor: "bg-[#1e3a5f] text-white",
    cta: "Calculate Your Rebate",
    ctaHref: "/rebate-calculator",
    keyPoints: [
      "Up to $7,500 from NJ Whole Home Program",
      "30% Federal Tax Credit (up to $2,000)",
      "Additional utility rebates on top",
      "Up to $16,000 total for LMI households",
    ],
    isNew: true,
  },
  {
    id: "obr-financing",
    interest: "financing",
    title: "How OBR Financing Works: $0 Down, Pay on Your Bill",
    description:
      "On-Bill Repayment means you pay nothing upfront. The cost of your new heat pump is spread over your utility bill — often for less than your current energy costs. Here is exactly how it works.",
    duration: "2:00",
    youtubeId: null,
    thumbnail:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/rebates-incentive-breakdown-oAAqu8xDQQMRA3cek2riot.png",
    badge: "OBR Financing",
    badgeColor: "bg-[#ff6b35] text-white",
    cta: "See Your Monthly Payment",
    ctaHref: "/rebate-calculator",
    keyPoints: [
      "$0 upfront — no deposit required",
      "84-month term (120 months for LMI)",
      "Payments added directly to utility bill",
      "Often less than current monthly energy costs",
    ],
  },
  {
    id: "solar-bundle",
    interest: "solar",
    title: "Solar + Heat Pump: The NJ Bundle That Pays for Itself",
    description:
      "Combining a heat pump with solar panels creates a system that generates its own energy. See how NJ homeowners are eliminating their utility bills and getting paid back in under 9 years.",
    duration: "2:30",
    youtubeId: null,
    thumbnail:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/rebates-hero-scene-J3aPJsXepLf9BkC8htkUtM.webp",
    badge: "Solar + HVAC",
    badgeColor: "bg-amber-500 text-white",
    cta: "Book Solar + HVAC Assessment",
    ctaHref: "/rebate-calculator",
    keyPoints: [
      "30% Federal Solar Tax Credit",
      "$1,200–$1,800 average annual savings",
      "6–9 year payback timeline",
      "Heat pump + solar = near-zero utility bills",
    ],
  },
  {
    id: "assessment-walkthrough",
    interest: "assessment",
    title: "What to Expect at Your Free HVAC Assessment",
    description:
      "No pressure, no obligation, no cost. Your free assessment takes about 45 minutes. Here is exactly what our technician will do, what questions to have ready, and how we calculate your personalized proposal.",
    duration: "1:45",
    youtubeId: null,
    thumbnail:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/rebates-hero-scene-2fcBXQM8zkWJZXbcPoYdBm.png",
    badge: "Free Assessment",
    badgeColor: "bg-green-600 text-white",
    cta: "Book Your Free Assessment",
    ctaHref: "/rebate-calculator",
    keyPoints: [
      "45-minute in-home visit",
      "No obligation or pressure",
      "Personalized rebate proposal included",
      "We handle all paperwork",
    ],
  },
  {
    id: "commercial-vrv",
    interest: "commercial",
    title: "VRV/VRF Systems: The Future of Commercial HVAC",
    description:
      "Variable refrigerant flow technology delivers precise multi-zone climate control for commercial properties. Learn how Mechanical Enterprise has installed and maintained over 2.6 million sq ft of commercial space.",
    duration: "3:00",
    youtubeId: null,
    thumbnail:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/rebates-incentive-breakdown-9XBJxUYTVCGjPPM9AbFKzc.webp",
    badge: "Commercial",
    badgeColor: "bg-[#1e3a5f] text-white",
    cta: "Request Commercial Quote",
    ctaHref: "/contact",
    keyPoints: [
      "Multi-zone precision climate control",
      "Up to 40% energy savings vs. traditional systems",
      "BIM technology integration",
      "2.6M sq ft of commercial experience",
    ],
  },
];

// ─── Local storage key for persisting interests ────────────────────────────────
const INTERESTS_KEY = "me_video_interests";

// ─── Component ────────────────────────────────────────────────────────────────

export default function VideoHub() {
  const { user, isAuthenticated } = useAuth();

  const [videoTopic, setVideoTopic] = useState<"rebates" | "financing" | "solar" | "assessment">("rebates");
  const [generatedVideoId, setGeneratedVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<"idle" | "pending" | "processing" | "completed" | "failed">("idle");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  const generateVideo = trpc.heygen.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedVideoId(data.heygenVideoId);
      setVideoStatus("pending");
    },
    onError: () => setVideoStatus("failed"),
  });

  const { data: statusData, refetch: refetchStatus } = trpc.heygen.checkStatus.useQuery(
    { heygenVideoId: generatedVideoId! },
    {
      enabled: !!generatedVideoId && (videoStatus === "pending" || videoStatus === "processing"),
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return s === "completed" || s === "failed" ? false : 5000;
      },
    }
  );

  useEffect(() => {
    if (!statusData) return;
    setVideoStatus(statusData.status as typeof videoStatus);
    if (statusData.status === "completed" && statusData.videoUrl) {
      setGeneratedVideoUrl(statusData.videoUrl);
    }
  }, [statusData]);

  const [selectedInterests, setSelectedInterests] = useState<InterestKey[]>(() => {
    try {
      const stored = localStorage.getItem(INTERESTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeFilter, setActiveFilter] = useState<InterestKey | "all">("all");
  const [showInterestPicker, setShowInterestPicker] = useState(false);

  // Persist interests to localStorage
  useEffect(() => {
    localStorage.setItem(INTERESTS_KEY, JSON.stringify(selectedInterests));
  }, [selectedInterests]);

  // Auto-open interest picker for new visitors with no interests saved
  useEffect(() => {
    if (selectedInterests.length === 0) {
      setShowInterestPicker(true);
    }
  }, []);

  const toggleInterest = (key: InterestKey) => {
    setSelectedInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Filter videos: if interests selected, show those first; then rest
  const filteredVideos =
    activeFilter === "all"
      ? [
          ...VIDEOS.filter((v) => selectedInterests.includes(v.interest)),
          ...VIDEOS.filter((v) => !selectedInterests.includes(v.interest)),
        ]
      : VIDEOS.filter((v) => v.interest === activeFilter);

  const recommendedVideos = VIDEOS.filter((v) => selectedInterests.includes(v.interest));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-16">
        <div className="container">
          <div className="max-w-3xl">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">
              <Video className="h-3 w-3 mr-1" /> Learning Hub
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Your Personalized HVAC Learning Hub
            </h1>
            <p className="text-xl text-white/90 mb-6">
              Watch short, expert videos on the topics that matter most to you — rebates,
              financing, solar, and more. Each video ends with a clear next step to help you
              save money on your home's comfort system.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setShowInterestPicker(true)}
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white"
              >
                Choose My Topics
              </Button>
              <Button
                variant="outline"
                className="bg-white/10 border-white text-white hover:bg-white/20"
                onClick={() => setActiveFilter("all")}
              >
                Browse All Videos
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interest Picker ───────────────────────────────────────────────── */}
      {showInterestPicker && (
        <section className="bg-white border-b border-gray-200 py-8">
          <div className="container">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-bold text-[#1e3a5f] mb-2">
                What are you most interested in?
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Select all that apply — we will show your most relevant videos first.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                {INTERESTS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.key);
                  return (
                    <button
                      key={interest.key}
                      onClick={() => toggleInterest(interest.key)}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-[#ff6b35] bg-[#ff6b35]/5"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <span
                        className={`mt-0.5 ${isSelected ? "text-[#ff6b35]" : "text-gray-400"}`}
                      >
                        {interest.icon}
                      </span>
                      <div>
                        <div
                          className={`font-semibold text-sm ${
                            isSelected ? "text-[#ff6b35]" : "text-[#1e3a5f]"
                          }`}
                        >
                          {interest.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {interest.description}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-[#ff6b35] ml-auto flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowInterestPicker(false)}
                  className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white"
                  disabled={selectedInterests.length === 0}
                >
                  Show My Videos ({selectedInterests.length} selected)
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedInterests([]);
                    setShowInterestPicker(false);
                  }}
                >
                  Skip — show all
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Recommended for You ───────────────────────────────────────────── */}
      {recommendedVideos.length > 0 && !showInterestPicker && (
        <section className="py-10 bg-white border-b">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
                  <Star className="h-5 w-5 text-[#ff6b35]" /> Recommended for You
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Based on your selected interests
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInterestPicker(true)}
                className="text-[#ff6b35]"
              >
                Edit Interests
              </Button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedVideos.map((video) => (
                <VideoCard key={video.id} video={video} highlighted />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <section className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container">
          <div className="flex gap-2 overflow-x-auto py-3 no-scrollbar">
            <button
              onClick={() => setActiveFilter("all")}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === "all"
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Videos
            </button>
            {INTERESTS.map((interest) => (
              <button
                key={interest.key}
                onClick={() => setActiveFilter(interest.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeFilter === interest.key
                    ? "bg-[#ff6b35] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {interest.icon}
                {interest.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Video Grid ───────────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="container">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HeyGen Personalized Video Generator ─────────────────────────── */}
      <section className="py-16 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <Badge className="mb-4 bg-[#ff6b35] text-white">
              <Video className="h-3 w-3 mr-1" /> Powered by HeyGen AI
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get a Personalized Video for Your Home
            </h2>
            <p className="text-lg text-white/90 mb-8">
              Receive a 60-second AI-generated video — addressed to you by name — walking
              through your rebate options, financing, or assessment process.
            </p>

            {!isAuthenticated ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6">
                <p className="text-white/90 mb-4">
                  Sign in to generate your personalized video.
                </p>
                <Link href="/rebate-calculator">
                  <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
                    Start Your Rebate Calculator <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            ) : videoStatus === "completed" && generatedVideoUrl ? (
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl mb-6">
                <video
                  src={generatedVideoUrl}
                  controls
                  autoPlay
                  className="w-full aspect-video"
                />
                <div className="p-4 text-[#1e3a5f]">
                  <p className="font-semibold mb-3">Your personalized video is ready!</p>
                  <div className="flex gap-3 justify-center flex-wrap">
                    <a href={generatedVideoUrl} download target="_blank" rel="noreferrer">
                      <Button variant="outline" className="border-[#1e3a5f] text-[#1e3a5f]">
                        Download Video
                      </Button>
                    </a>
                    <Button
                      onClick={() => { setVideoStatus("idle"); setGeneratedVideoId(null); setGeneratedVideoUrl(null); }}
                      className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white"
                    >
                      Generate Another
                    </Button>
                  </div>
                </div>
              </div>
            ) : videoStatus === "pending" || videoStatus === "processing" ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                  <p className="text-white font-semibold">Generating your personalized video…</p>
                  <p className="text-white/70 text-sm">This takes about 2–3 minutes. You can leave this page and come back.</p>
                </div>
              </div>
            ) : videoStatus === "failed" ? (
              <div className="bg-red-500/20 rounded-2xl p-6 mb-6">
                <p className="text-white mb-3">Video generation failed. Please try again.</p>
                <Button
                  onClick={() => setVideoStatus("idle")}
                  className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white"
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 text-left">
                <p className="text-white/80 text-sm italic mb-4">
                  "Hi {user?.name?.split(" ")[0] ?? "there"} — based on your home in Essex County, you qualify for up to
                  $16,000 in rebates and incentives. Here is exactly how to claim every dollar..."
                </p>
                <div className="mb-4">
                  <p className="text-white/90 text-sm font-semibold mb-2">Choose your video topic:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["rebates", "financing", "solar", "assessment"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setVideoTopic(t)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          videoTopic === t
                            ? "bg-[#ff6b35] text-white"
                            : "bg-white/10 text-white/80 hover:bg-white/20"
                        }`}
                      >
                        {t === "rebates" && "💰 NJ Rebates"}
                        {t === "financing" && "💳 OBR Financing"}
                        {t === "solar" && "☀️ Solar + HVAC"}
                        {t === "assessment" && "🏠 Free Assessment"}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold"
                  disabled={generateVideo.isPending}
                  onClick={() =>
                    generateVideo.mutate({
                      topic: videoTopic,
                      clientName: user?.name ?? "Valued Customer",
                    })
                  }
                >
                  {generateVideo.isPending ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2" /> Submitting…</>
                  ) : (
                    <>Generate My Personalized Video <ArrowRight className="ml-2 h-5 w-5" /></>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Kling B-Roll Gallery ──────────────────────────────────────── */}
      <section className="py-14 bg-[#0f1e35] text-white">
        <div className="container">
          <div className="text-center mb-8">
            <Badge className="mb-3 bg-[#ff6b35] text-white">🎬 Cinematic B-Roll</Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Behind the Story</h2>
            <p className="text-white/70 max-w-xl mx-auto text-sm">
              Cinematic scenes showing real NJ homeowners discovering rebates, our technicians at work, and families enjoying year-round comfort.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/kling-broll-scene1_4a877670.mp4", label: "Discovering Your Rebate" },
              { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/kling-broll-scene2_ed5de037.mp4", label: "Expert Installation" },
              { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/kling-broll-scene3_6db4c2c8.mp4", label: "Year-Round Comfort" },
            ].map((scene) => (
              <div key={scene.url} className="rounded-xl overflow-hidden bg-white/5">
                <video
                  src={scene.url}
                  className="w-full aspect-video object-cover"
                  controls
                  muted
                  loop
                  playsInline
                />
                <p className="text-center text-white/80 text-sm py-2 font-medium">{scene.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Nano Banana Slide Gallery ─────────────────────────────────────── */}
      <section className="py-14 bg-[#0f1e35] border-t border-white/10 text-white">
        <div className="container">
          <div className="text-center mb-8">
            <Badge className="mb-3 bg-[#ff6b35] text-white">📊 Explainer Slides</Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">NJ Rebates — Visual Breakdown</h2>
            <p className="text-white/70 max-w-xl mx-auto text-sm">
              Scroll through the full rebate explainer — every slide tells part of the story.
            </p>
          </div>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4" style={{ width: "max-content" }}>
              {[
                { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/hook_generated_f14368ff.webp", label: "Up to $16,000 Back" },
                { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/opportunity_generated_eb21207e.webp", label: "Three Stacked Incentives" },
                { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/window_units_generated_7930e870.webp", label: "Window Units? This Changes Everything" },
                { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/zero_out_of_pocket_generated_c473db49.webp", label: "$0 Out of Pocket" },
                { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/what_you_get_generated_367e5c8c.webp", label: "We Handle Everything" },
                { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/cta_generated_4b0e3981.webp", label: "Book Free Assessment" },
                { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663360032476/4ocuaVfrPR2qxUA9U855oL/closing_generated_95f47e80.webp", label: "Mechanical Enterprise" },
              ].map((slide) => (
                <div key={slide.url} className="flex-shrink-0 w-72 rounded-xl overflow-hidden bg-white/5">
                  <img src={slide.url} alt={slide.label} className="w-full aspect-video object-cover" />
                  <p className="text-center text-white/80 text-xs py-2 font-medium px-2">{slide.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mt-6">
            <a
              href="https://www.youtube.com/@MechanicalEnterprise-AH"
              target="_blank"
              rel="noreferrer"
            >
              <Button className="bg-red-600 hover:bg-red-700 text-white">
                <Youtube className="h-4 w-4 mr-2" /> Subscribe on YouTube for the Full Video
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ─── Video Card Component ──────────────────────────────────────────────────────

function VideoCard({ video, highlighted = false }: { video: VideoTopic; highlighted?: boolean }) {
  const [playing, setPlaying] = useState(false);

  return (
    <Card
      className={`overflow-hidden flex flex-col h-full transition-shadow hover:shadow-lg ${
        highlighted ? "ring-2 ring-[#ff6b35]" : ""
      }`}
    >
      {/* Thumbnail / Player */}
      <div className="relative aspect-video bg-gray-900 overflow-hidden">
        {playing && video.youtubeId ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : playing && video.previewVideoUrl ? (
          <video
            className="w-full h-full object-cover"
            src={video.previewVideoUrl}
            autoPlay
            controls
            title={video.title}
          />
        ) : (
          <>
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              {video.youtubeId ? (
                <button
                  onClick={() => setPlaying(true)}
                  className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-transform hover:scale-110 shadow-xl"
                  aria-label="Play video"
                >
                  <Play className="h-7 w-7 text-[#1e3a5f] ml-1" fill="currentColor" />
                </button>
              ) : video.previewVideoUrl ? (
                <button
                  onClick={() => setPlaying(true)}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-16 h-16 rounded-full bg-[#ff6b35]/90 hover:bg-[#ff6b35] flex items-center justify-center transition-transform hover:scale-110 shadow-xl">
                    <Play className="h-7 w-7 text-white ml-1" fill="currentColor" />
                  </div>
                  <span className="text-white text-xs font-medium bg-[#ff6b35]/80 px-3 py-1 rounded-full">
                    Watch Preview
                  </span>
                </button>
              ) : (
                <a
                  href="https://www.youtube.com/@MechanicalEnterprise-AH"
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-16 h-16 rounded-full bg-red-600/90 hover:bg-red-600 flex items-center justify-center transition-transform hover:scale-110 shadow-xl">
                    <Youtube className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-white text-xs font-medium bg-black/60 px-3 py-1 rounded-full flex items-center gap-1">
                    <Bell className="h-3 w-3" /> Subscribe to Watch
                  </span>
                </a>
              )}
            </div>
            {/* Duration badge */}
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
              {video.duration}
            </div>
            {/* New badge */}
            {video.isNew && (
              <div className="absolute top-2 left-2">
                <Badge className="bg-[#ff6b35] text-white text-xs">New</Badge>
              </div>
            )}
          </>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <Badge className={`text-xs ${video.badgeColor}`}>{video.badge}</Badge>
        </div>
        <CardTitle className="text-base leading-snug text-[#1e3a5f]">{video.title}</CardTitle>
        <CardDescription className="text-sm line-clamp-2">{video.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0">
        {/* Key Points */}
        <ul className="space-y-1.5 mb-4">
          {video.keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              {point}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link href={video.ctaHref}>
          <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white text-sm">
            {video.cta} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
