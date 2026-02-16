import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function Contact() {
  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[400px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white">Contact Us</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Get In Touch
            </h1>
            <p className="text-xl text-white/90">
              Ready to discuss your HVAC needs? Contact us today for a free consultation
            </p>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <Phone className="h-10 w-10 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Phone</CardTitle>
              </CardHeader>
              <CardContent>
                <a href="tel:+18624239396" className="text-[#1e3a5f] hover:text-[#ff6b35] font-medium">
                  (862) 423-9396
                </a>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <Mail className="h-10 w-10 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Email</CardTitle>
              </CardHeader>
              <CardContent>
                <a href="mailto:sales@mechanicalenterprise.com" className="text-[#1e3a5f] hover:text-[#ff6b35] font-medium text-sm">
                  sales@mechanicalenterprise.com
                </a>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <MapPin className="h-10 w-10 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Location</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Newark, NJ
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <Clock className="h-10 w-10 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  24/7 Emergency Service<br />
                  Available
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Service Area */}
          <div className="max-w-4xl mx-auto">
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader>
                <CardTitle className="text-2xl text-[#1e3a5f]">Service Area</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg text-muted-foreground mb-4">
                  We proudly serve 15 counties across New Jersey:
                </p>
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div className="space-y-1">
                    <p>• Bergen County</p>
                    <p>• Burlington County</p>
                    <p>• Camden County</p>
                    <p>• Essex County</p>
                    <p>• Gloucester County</p>
                  </div>
                  <div className="space-y-1">
                    <p>• Hudson County</p>
                    <p>• Hunterdon County</p>
                    <p>• Mercer County</p>
                    <p>• Middlesex County</p>
                    <p>• Monmouth County</p>
                  </div>
                  <div className="space-y-1">
                    <p>• Morris County</p>
                    <p>• Ocean County</p>
                    <p>• Passaic County</p>
                    <p>• Somerset County</p>
                    <p>• Union County</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Request Quote Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-[#1e3a5f] mb-4">Request a Quote</h2>
              <p className="text-xl text-muted-foreground">
                Choose the type of service you need
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-t-4 border-t-[#ff6b35]">
                <CardHeader>
                  <CardTitle className="text-2xl">Residential Services</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Get a quote for your home HVAC needs. Learn about heat pump rebates up to $16,000.
                  </p>
                  <a 
                    href="https://docs.google.com/forms/d/e/1FAIpQLSelUjWmZt7pXF1epkCafLwyB54KsKQ-vnIL1XnqTW5WjnHgwQ/viewform"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                      Residential Quote Form
                    </button>
                  </a>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-[#1e3a5f]">
                <CardHeader>
                  <CardTitle className="text-2xl">Commercial Services</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Get a quote for your business HVAC needs. Learn about commercial incentive programs.
                  </p>
                  <a 
                    href="https://docs.google.com/forms/d/e/1FAIpQLSdc1dHJx1IAeLq6I7cZ2y4z1LS9Hn9w1Xdm8J8LririqJj4CA/viewform"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <button className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                      Commercial Quote Form
                    </button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Service Banner */}
      <section className="py-12 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <Clock className="h-16 w-16 text-[#ff6b35] mx-auto mb-4" />
            <h3 className="text-3xl font-bold mb-4">Need Emergency Service?</h3>
            <p className="text-xl text-white/90 mb-6">
              We're available 24/7 for all your HVAC emergencies
            </p>
            <a href="tel:+18624239396">
              <button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors">
                Call Now: (862) 423-9396
              </button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
