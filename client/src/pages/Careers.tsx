import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function Careers() {
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
              <CardContent className="p-0">
                <iframe 
                  src="https://docs.google.com/forms/d/e/1FAIpQLSd8GwaX3VjNffO3SvCnGTc-1wGwKv3QbhvGrWP__WJPYP_Vuw/viewform?embedded=true" 
                  width="100%" 
                  height="1400" 
                  frameBorder="0" 
                  marginHeight={0} 
                  marginWidth={0}
                  className="rounded-lg"
                >
                  Loading…
                </iframe>
              </CardContent>
            </Card>

            <div className="mt-6 text-center text-sm text-slate-600">
              <p>Prefer to email your resume? Send it to <a href="mailto:sales@mechanicalenterprise.com" className="text-[#ff6b35] hover:underline font-semibold">sales@mechanicalenterprise.com</a></p>
              <p className="mt-2">Questions? Call us at <a href="tel:862-423-9396" className="text-[#ff6b35] hover:underline font-semibold">(862) 423-9396</a></p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
