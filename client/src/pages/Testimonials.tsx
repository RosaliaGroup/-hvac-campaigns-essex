import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import GoogleBusinessShowcase from "@/components/GoogleBusinessShowcase";
import { Button } from "@/components/ui/button";

export default function Testimonials() {
  return <div className="min-h-screen">
    <Navigation />
    <header className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-20">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Customer Reviews & Project Photos</h1>
        <p className="text-xl text-white/90 max-w-3xl">See what customers say about Mechanical Enterprise and explore photos shared on our Google Business Profile.</p>
      </div>
    </header>
    <GoogleBusinessShowcase />
    <section className="py-16 bg-[#1e3a5f] text-white text-center">
      <div className="container mx-auto px-4 space-y-5">
        <h2 className="text-3xl font-bold">Ready for reliable HVAC service?</h2>
        <p>Request an evaluation, repair, maintenance plan, or installation quote.</p>
        <Button size="lg" className="bg-[#ff6b35] hover:bg-[#e85a25]" onClick={() => window.location.href = "/contact"}>Request a Quote</Button>
      </div>
    </section>
    <Footer />
  </div>;
}
