import { useState, useEffect } from "react";
import { X, Home, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      toast.success("Thanks! We'll send you information about available HVAC incentives and rebates.");
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

    // Show popup after 15 seconds
    const timer = setTimeout(() => {
      if (!hasShown && !isVisible) {
        setIsVisible(true);
        setHasShown(true);
      }
    }, 15000); // 15 seconds

    // Detect exit intent (mouse leaving viewport from top)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasShown && !isVisible) {
        setIsVisible(true);
        setHasShown(true);
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [hasShown, isVisible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email && !formData.phone) {
      toast.error("Please provide either email or phone number");
      return;
    }

    createCapture.mutate({
      firstName: formData.firstName || undefined,
      lastName: formData.lastName || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      captureType: "exit_popup",
      pageUrl: window.location.href,
    });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <Card className="max-w-lg w-full relative animate-in slide-in-from-bottom-4 duration-300">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl text-[#1e3a5f]">
            Don't Miss Out on HVAC Savings!
          </CardTitle>
          <CardDescription className="text-base">
            Get exclusive information about available rebates and incentives for your home or business
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="popup-firstName">First Name *</Label>
                <Input
                  id="popup-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="popup-lastName">Last Name *</Label>
                <Input
                  id="popup-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="popup-email">Email *</Label>
              <Input
                id="popup-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="popup-phone">Phone Number</Label>
              <Input
                id="popup-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(862) 555-1234"
              />
            </div>

            {/* Residential & Commercial Incentives */}
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="h-5 w-5 text-[#ff6b35]" />
                  <p className="font-semibold text-[#ff6b35]">Residential</p>
                </div>
                <ul className="text-orange-700 space-y-1 text-xs">
                  <li>✓ Up to $16,000 in rebates</li>
                  <li>✓ Heat pump installations</li>
                  <li>✓ Energy-efficient upgrades</li>
                  <li>✓ 24/7 emergency service</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-[#1e3a5f]" />
                  <p className="font-semibold text-[#1e3a5f]">Commercial</p>
                </div>
                <ul className="text-blue-700 space-y-1 text-xs">
                  <li>✓ Up to 80% rebate coverage</li>
                  <li>✓ VRF/VRV systems</li>
                  <li>✓ Maintenance programs</li>
                  <li>✓ BMS technology integration</li>
                </ul>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
              disabled={createCapture.isPending}
            >
              {createCapture.isPending ? "Submitting..." : "Get Rebate & Incentive Information"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              We respect your privacy. No spam, unsubscribe anytime.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
