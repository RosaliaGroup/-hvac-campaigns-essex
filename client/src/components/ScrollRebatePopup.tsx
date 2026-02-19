import { useState, useEffect } from "react";
import { X, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ScrollRebatePopupProps {
  pageType: "residential" | "commercial";
}

export default function ScrollRebatePopup({ pageType }: ScrollRebatePopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [email, setEmail] = useState("");

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      toast.success("Thanks! Check your email for rebate and incentive information.");
      
      // Track Google Ads conversion
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          'send_to': 'AW-17768263516/scroll_rebate_capture',
          'value': 1.0,
          'currency': 'USD',
          'transaction_id': Date.now().toString()
        });
      }
      
      setIsVisible(false);
      localStorage.setItem(`hvac-scroll-popup-${pageType}`, "true");
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  useEffect(() => {
    // Check if popup was already shown for this page type
    const alreadyShown = localStorage.getItem(`hvac-scroll-popup-${pageType}`);
    if (alreadyShown) {
      setHasShown(true);
      return;
    }

    // Detect scroll to 50% of page
    const handleScroll = () => {
      if (hasShown || isVisible) return;

      const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      
      if (scrollPercentage >= 50) {
        setIsVisible(true);
        setHasShown(true);
        
        // Track popup impression
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'scroll_popup_impression', {
            'event_category': 'Lead Capture',
            'event_label': pageType,
            'value': 1
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [hasShown, isVisible, pageType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please provide your email address");
      return;
    }

    createCapture.mutate({
      email: email,
      captureType: `scroll_popup_${pageType}`,
      pageUrl: window.location.href,
    });
  };

  if (!isVisible) return null;

  const rebateAmount = pageType === "residential" ? "$16,000" : "80%";
  const rebateDescription = pageType === "residential" 
    ? "Up to $16,000 in rebates for residential heat pump installations"
    : "Up to 80% rebate coverage for commercial HVAC upgrades";

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

          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-[#ff6b35] to-[#ff8c5a] rounded-full flex items-center justify-center">
              <Gift className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-[#1e3a5f]">
              Don't Miss Out on {rebateAmount} in Rebates!
            </CardTitle>
            <CardDescription className="text-base">
              {rebateDescription}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-gradient-to-r from-orange-50 to-blue-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-[#1e3a5f] mb-2">
                  Get Your Free Rebate Guide
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Complete list of available rebates</li>
                  <li>✓ Step-by-step application process</li>
                  <li>✓ Eligibility requirements</li>
                  <li>✓ Estimated savings calculator</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scroll-email">Email Address *</Label>
                <Input
                  id="scroll-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="text-base"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-base py-6"
                disabled={createCapture.isPending}
              >
                {createCapture.isPending ? "Sending..." : (
                  <>
                    Send Me the Rebate Guide <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                We'll email you the complete rebate guide immediately. No spam, unsubscribe anytime.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
