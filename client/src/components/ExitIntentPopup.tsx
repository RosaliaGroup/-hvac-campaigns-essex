import { useState, useEffect } from "react";
import { X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      toast.success("Thanks! We'll send you exclusive HVAC rebate information.");
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

    // Detect exit intent (mouse leaving viewport from top)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasShown && !isVisible) {
        setIsVisible(true);
        setHasShown(true);
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [hasShown, isVisible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email && !phone) {
      toast.error("Please provide either email or phone number");
      return;
    }

    createCapture.mutate({
      email: email || undefined,
      phone: phone || undefined,
      captureType: "exit_popup",
      pageUrl: window.location.href,
    });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
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
          <div className="mx-auto bg-[#ff6b35]/10 rounded-full p-3 w-fit mb-3">
            <Gift className="h-8 w-8 text-[#ff6b35]" />
          </div>
          <CardTitle className="text-2xl text-[#1e3a5f]">
            Wait! Don't Miss Out on Savings
          </CardTitle>
          <CardDescription className="text-base">
            Get exclusive access to HVAC rebate information and special offers worth up to <span className="font-bold text-[#ff6b35]">$16,000</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="popup-email">Email Address</Label>
              <Input
                id="popup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="popup-phone">Phone Number (Optional)</Label>
              <Input
                id="popup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(862) 555-1234"
              />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-green-800 mb-1">You'll receive:</p>
              <ul className="text-green-700 space-y-1 text-xs">
                <li>✓ Complete NJ rebate guide (up to $16K available)</li>
                <li>✓ Seasonal maintenance tips</li>
                <li>✓ Exclusive promotional offers</li>
                <li>✓ Priority scheduling for consultations</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
              disabled={createCapture.isPending}
            >
              {createCapture.isPending ? "Submitting..." : "Send Me Rebate Information"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              We respect your privacy. Unsubscribe anytime.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
