import { useState, useEffect } from "react";
import { X, Briefcase } from "lucide-react";
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
      toast.success("Thanks! We'll contact you about our commercial HVAC services.");
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
          <div className="mx-auto bg-[#1e3a5f]/10 rounded-full p-3 w-fit mb-3">
            <Briefcase className="h-8 w-8 text-[#1e3a5f]" />
          </div>
          <CardTitle className="text-2xl text-[#1e3a5f]">
            Commercial HVAC Solutions
          </CardTitle>
          <CardDescription className="text-base">
            Get expert consultation for your business HVAC needs. We specialize in VRF/VRV systems, maintenance programs, and energy-efficient upgrades with <span className="font-bold text-[#ff6b35]">up to 80% rebate coverage</span>
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
              <Label htmlFor="popup-email">Business Email *</Label>
              <Input
                id="popup-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@company.com"
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-blue-800 mb-1">Our Commercial Services:</p>
              <ul className="text-blue-700 space-y-1 text-xs">
                <li>✓ VRF/VRV system design & installation</li>
                <li>✓ Preventive maintenance programs</li>
                <li>✓ Energy-efficient retrofits (up to 80% rebates)</li>
                <li>✓ 24/7 emergency service</li>
                <li>✓ BIM technology integration</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90"
              disabled={createCapture.isPending}
            >
              {createCapture.isPending ? "Submitting..." : "Get Commercial HVAC Consultation"}
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
