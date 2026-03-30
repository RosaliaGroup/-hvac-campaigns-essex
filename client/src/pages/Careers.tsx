import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Careers() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    experience: "",
    licensed: "",
    coverLetter: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    createCapture.mutate({
      name: form.name,
      email: form.email,
      phone: form.phone,
      captureType: "career_application" as any,
      pageUrl: window.location.href,
      message: `Position: ${form.position}\nExperience: ${form.experience}\nLicensed: ${form.licensed}\nCover Letter: ${form.coverLetter}`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#1e3a5f] text-white py-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9Ii4wNSIvPjwvZz48L3N2Zz4=')] opacity-20"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">Join Our Team</Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Build Your Career With <span className="text-[#ff6b35]">Mechanical Enterprise</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-200 mb-4 leading-relaxed">
              Join a growing WMBE/SBE certified HVAC company committed to employee development, continuing education, and professional growth
            </p>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <ClipboardCheck className="h-16 w-16 text-[#ff6b35] mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-4">
                Apply Now
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Complete the form below to submit your application. We review all applications and will contact qualified candidates within 3-5 business days.
              </p>
            </div>

            <Card className="border-2 border-[#ff6b35]/20">
              <CardContent className="p-6 md:p-8">
                {submitted ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Application Received!</h3>
                    <p className="text-slate-600">
                      Thank you for your interest. We'll review your application and contact qualified candidates within 3-5 business days.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                        <Input
                          id="name"
                          required
                          placeholder="John Smith"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          placeholder="john@example.com"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
                        <Input
                          id="phone"
                          type="tel"
                          required
                          placeholder="(555) 123-4567"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="position">Position Applying For</Label>
                        <Select value={form.position} onValueChange={(val) => setForm({ ...form, position: val })}>
                          <SelectTrigger id="position">
                            <SelectValue placeholder="Select a position" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HVAC Technician">HVAC Technician</SelectItem>
                            <SelectItem value="Project Manager">Project Manager</SelectItem>
                            <SelectItem value="Sales Representative">Sales Representative</SelectItem>
                            <SelectItem value="Administrative">Administrative</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="experience">Years of Experience</Label>
                        <Select value={form.experience} onValueChange={(val) => setForm({ ...form, experience: val })}>
                          <SelectTrigger id="experience">
                            <SelectValue placeholder="Select experience" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0-1">0-1</SelectItem>
                            <SelectItem value="2-5">2-5</SelectItem>
                            <SelectItem value="5-10">5-10</SelectItem>
                            <SelectItem value="10+">10+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Are you licensed/certified?</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={form.licensed === "Yes" ? "default" : "outline"}
                            className={form.licensed === "Yes" ? "bg-[#ff6b35] hover:bg-[#e55a25] flex-1" : "flex-1"}
                            onClick={() => setForm({ ...form, licensed: "Yes" })}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            variant={form.licensed === "No" ? "default" : "outline"}
                            className={form.licensed === "No" ? "bg-[#ff6b35] hover:bg-[#e55a25] flex-1" : "flex-1"}
                            onClick={() => setForm({ ...form, licensed: "No" })}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="coverLetter">Brief Message / Cover Letter</Label>
                      <Textarea
                        id="coverLetter"
                        rows={4}
                        placeholder="Tell us about yourself, your experience, and why you'd like to join our team..."
                        value={form.coverLetter}
                        onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={createCapture.isPending}
                      className="w-full bg-[#ff6b35] hover:bg-[#e55a25] text-white text-lg py-6 font-semibold"
                    >
                      {createCapture.isPending ? "Submitting..." : "Submit Application"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 text-center text-sm text-slate-600">
              <p>Prefer to email your resume? Send it to <a href="mailto:sales@mechanicalenterprise.com" className="text-[#ff6b35] hover:underline font-semibold">sales@mechanicalenterprise.com</a></p>
              <p className="mt-2">Questions? Call us at <a href="tel:862-419-1763" className="text-[#ff6b35] hover:underline font-semibold">(862) 419-1763</a></p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
