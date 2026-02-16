import { Star, Play, Quote, CheckCircle, Building2, Home, ThermometerSun } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useState } from "react";

interface Testimonial {
  id: number;
  name: string;
  location: string;
  type: "residential" | "commercial";
  service: string;
  rating: number;
  quote: string;
  beforeImage?: string;
  afterImage?: string;
  videoUrl?: string;
  savings?: string;
  date: string;
}

export default function Testimonials() {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: "Sarah & Michael Thompson",
      location: "Newark, NJ",
      type: "residential",
      service: "Heat Pump Installation",
      rating: 5,
      quote: "We replaced our old oil furnace with a heat pump system and couldn't be happier. The team helped us navigate the rebate process and we received $14,000 back! Our energy bills dropped by 60% and the house stays comfortable year-round. The installation was professional and clean.",
      beforeImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=800&h=600&fit=crop",
      afterImage: "https://images.unsplash.com/photo-1631545804203-e6c0e1c0c6b4?w=800&h=600&fit=crop",
      savings: "$14,000 rebate + 60% lower bills",
      date: "January 2026",
    },
    {
      id: 2,
      name: "David Martinez",
      location: "Property Manager, Essex County",
      type: "commercial",
      service: "Maintenance Subscription",
      rating: 5,
      quote: "Managing 12 residential buildings means HVAC issues can't wait. The maintenance subscription has been a game-changer. Predictable monthly costs, priority service, and fewer emergency calls. My tenants are happier and my budget is under control.",
      savings: "$8,500/month in predictable costs",
      date: "November 2025",
    },
    {
      id: 3,
      name: "Jennifer Lee",
      location: "Montclair, NJ",
      type: "residential",
      service: "VRF System Installation",
      rating: 5,
      quote: "Our 1920s home had uneven heating and cooling for decades. The VRF system gives us zone control in every room. The craftsmanship was exceptional - they preserved our historic details while modernizing the HVAC. Worth every penny.",
      beforeImage: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=600&fit=crop",
      afterImage: "https://images.unsplash.com/photo-1635274022345-a5a1e7d89e87?w=800&h=600&fit=crop",
      date: "October 2025",
    },
    {
      id: 4,
      name: "Robert Chen",
      location: "Restaurant Owner, Jersey City",
      type: "commercial",
      service: "Emergency Repair & Upgrade",
      rating: 5,
      quote: "Our AC died during a summer heat wave with a full dining room. They responded within 2 hours and had us back up and running by dinner service. Then helped us upgrade to a more efficient system with 70% rebate coverage. Saved our business.",
      savings: "70% rebate on new system",
      date: "July 2025",
    },
    {
      id: 5,
      name: "The Patel Family",
      location: "West Orange, NJ",
      type: "residential",
      service: "Complete HVAC Replacement",
      rating: 5,
      quote: "After 25 years, our entire system needed replacement. The team designed a modern solution that cut our energy use in half. They coordinated all the rebates, handled permits, and finished on schedule. Our home has never been more comfortable.",
      beforeImage: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&h=600&fit=crop",
      afterImage: "https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=800&h=600&fit=crop",
      savings: "$12,500 in rebates",
      date: "September 2025",
    },
    {
      id: 6,
      name: "Lisa Rodriguez",
      location: "Boutique Hotel Owner, Newark",
      type: "commercial",
      service: "VRF System for 45-Room Hotel",
      rating: 5,
      quote: "Guest comfort is everything in hospitality. The VRF system lets each room control their own temperature while cutting our energy costs by 40%. The installation team worked overnight to avoid disrupting guests. True professionals.",
      savings: "40% energy cost reduction",
      date: "December 2025",
    },
  ];

  const stats = [
    { label: "5-Star Reviews", value: "98%" },
    { label: "Completed Projects", value: "4,000+" },
    { label: "Average Savings", value: "$11,500" },
    { label: "Customer Retention", value: "94%" },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">
              Customer Success Stories
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Real Results from Real Customers
            </h1>
            <p className="text-xl text-white/90 mb-8">
              See how we've helped homeowners and businesses across Essex County save money and improve comfort with modern HVAC solutions
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-b">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl font-bold text-[#ff6b35] mb-2">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="py-16 bg-secondary/30">
        <div className="container">
          <div className="space-y-12">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-2 gap-0">
                    {/* Content Side */}
                    <div className="p-8 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-[#1e3a5f] mb-1">
                              {testimonial.name}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              {testimonial.type === "residential" ? (
                                <Home className="h-4 w-4" />
                              ) : (
                                <Building2 className="h-4 w-4" />
                              )}
                              {testimonial.location}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-[#ff6b35]/10 text-[#ff6b35] border-[#ff6b35]/30">
                            {testimonial.service}
                          </Badge>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-1 mb-4">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="h-5 w-5 fill-[#ff6b35] text-[#ff6b35]" />
                          ))}
                        </div>

                        {/* Quote */}
                        <div className="relative mb-6">
                          <Quote className="absolute -top-2 -left-2 h-8 w-8 text-[#ff6b35]/20" />
                          <p className="text-lg leading-relaxed pl-6 italic text-slate-700">
                            "{testimonial.quote}"
                          </p>
                        </div>

                        {/* Savings Badge */}
                        {testimonial.savings && (
                          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg border border-green-200 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-semibold">{testimonial.savings}</span>
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground">{testimonial.date}</p>
                      </div>
                    </div>

                    {/* Media Side */}
                    <div className="bg-slate-100 relative">
                      {testimonial.videoUrl ? (
                        <div className="relative h-full min-h-[400px] flex items-center justify-center bg-slate-900">
                          <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f]/80 to-[#2a5a8f]/80 flex items-center justify-center">
                            <Button
                              size="lg"
                              className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 rounded-full h-20 w-20"
                              onClick={() => setSelectedVideo(testimonial.videoUrl!)}
                            >
                              <Play className="h-8 w-8" />
                            </Button>
                          </div>
                          <div className="absolute bottom-4 left-4 right-4 text-white">
                            <Badge className="bg-white/20 text-white backdrop-blur-sm">
                              Video Testimonial
                            </Badge>
                          </div>
                        </div>
                      ) : testimonial.beforeImage && testimonial.afterImage ? (
                        <div className="grid grid-cols-2 h-full min-h-[400px]">
                          <div className="relative">
                            <img
                              src={testimonial.beforeImage}
                              alt="Before"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-4 left-4">
                              <Badge className="bg-slate-900/80 text-white">Before</Badge>
                            </div>
                          </div>
                          <div className="relative">
                            <img
                              src={testimonial.afterImage}
                              alt="After"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-4 left-4">
                              <Badge className="bg-[#ff6b35] text-white">After</Badge>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full min-h-[400px] flex items-center justify-center">
                          <ThermometerSun className="h-24 w-24 text-[#ff6b35]/30" />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Video Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div className="relative w-full max-w-4xl aspect-video">
            <iframe
              src={selectedVideo}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <Button
              variant="outline"
              className="absolute -top-12 right-0 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setSelectedVideo(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Join Our Success Stories?</h2>
            <p className="text-xl text-white/90 mb-8">
              Get a free consultation and quote for your HVAC project. We'll help you access available rebates and design the perfect solution for your needs.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                size="lg"
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold"
                onClick={() => window.location.href = "/contact"}
              >
                Get Your Free Quote
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 backdrop-blur-sm text-white border-white hover:bg-white/20"
                onClick={() => window.location.href = "tel:862-423-9396"}
              >
                Call (862) 423-9396
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
