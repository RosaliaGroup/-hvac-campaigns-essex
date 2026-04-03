import { useState, useEffect } from "react";
import { X, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [email, setEmail] = useState("");

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      toast.success("Checklist sent! Check your email.");

      // Track Google Ads conversion
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", {
          send_to: "AW-17768263516/popup_checklist_capture",
          value: 1.0,
          currency: "USD",
          transaction_id: Date.now().toString(),
        });
      }

      setIsVisible(false);
      localStorage.setItem("hvac-exit-popup-shown", "true");
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  useEffect(() => {
    // Check if popup was already shown in this session
    const alreadyShown = localStorage.getItem("hvac-exit-popup-shown");
    if (alreadyShown) {
      setHasShown(true);
      return;
    }

    // Track time on page — only enable exit intent after 30 seconds
    let ready = false;
    const readyTimer = setTimeout(() => {
      ready = true;
    }, 30000);

    // Show popup on exit intent after 30s on page
    const handleMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 10 && ready && !hasShown && !isVisible) {
        setIsVisible(true);
        setHasShown(true);

        if (typeof window !== "undefined" && (window as any).gtag) {
          (window as any).gtag("event", "popup_impression", {
            event_category: "Checklist Popup",
            event_label: "exit_intent_checklist",
            value: 1,
          });
        }
      }
    };

    document.documentElement.addEventListener("mouseout", handleMouseOut);

    return () => {
      clearTimeout(readyTimer);
      document.documentElement.removeEventListener("mouseout", handleMouseOut);
    };
  }, [hasShown, isVisible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    createCapture.mutate({
      email,
      captureType: "pseg_checklist_download",
      pageUrl: window.location.href,
      message: "Exit popup checklist download",
    });
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => setIsVisible(false)}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Card className="max-w-md w-full relative animate-in slide-in-from-bottom-4 duration-300">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </Button>

          <CardHeader className="text-center pb-3">
            <div className="w-12 h-12 bg-[#ff6b35]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-[#ff6b35]" />
            </div>
            <CardTitle className="text-xl text-[#1e3a5f]">
              Wait — before you go.
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Get our free <strong>PSE&G Rebate Checklist</strong>. Most
              applications fail for 3 reasons. Takes 30 seconds to get it.
            </p>
          </CardHeader>

          <CardContent>
            {/* Quick preview of what's inside */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <AlertTriangle className="h-3.5 w-3.5 text-[#ff6b35] flex-shrink-0" />
                <span>#1 rejection reason: wrong application timing</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <AlertTriangle className="h-3.5 w-3.5 text-[#ff6b35] flex-shrink-0" />
                <span>#2: missing equipment documentation</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                <span>Our checklist prevents all 3</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                required
                className="h-11"
              />

              <Button
                type="submit"
                className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-3"
                disabled={createCapture.isPending}
              >
                {createCapture.isPending
                  ? "Sending..."
                  : "Get the Free Checklist"}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                No spam. Instant delivery. Unsubscribe anytime.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
