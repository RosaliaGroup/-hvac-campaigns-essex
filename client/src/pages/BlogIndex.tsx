import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { blogPosts } from "@/data/blogPosts";

const BASE = "https://mechanicalenterprise.com";

export default function BlogIndex() {
  useSEO({
    title: "HVAC Blog | Rebate Guides & Tips for NJ Homeowners | Mechanical Enterprise",
    description: "HVAC tips, rebate guides, and energy savings advice for NJ homeowners. Learn about heat pump rebates, installation, and more from Mechanical Enterprise.",
    ogUrl: `${BASE}/blog`,
  });

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] py-16">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">HVAC Tips & Rebate Guides for NJ Homeowners</h1>
            <p className="text-lg text-white/70">Expert advice from the Mechanical Enterprise team</p>
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {blogPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <Card className="h-full cursor-pointer group hover:shadow-lg transition-shadow border-t-4 border-t-transparent hover:border-t-[#e8813a]">
                  <CardContent className="pt-6">
                    <Badge className="mb-3 bg-[#e8813a]/10 text-[#e8813a] hover:bg-[#e8813a]/20 text-xs">{post.category}</Badge>
                    <h2 className="font-bold text-xl text-[#0a1628] mb-3 group-hover:text-[#e8813a] transition-colors leading-tight">{post.title}</h2>
                    <p className="text-sm text-gray-500 mb-3">{post.date} · {post.readTime}</p>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{post.excerpt}</p>
                    <span className="text-[#e8813a] font-medium text-sm inline-flex items-center gap-1">
                      Read more <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {blogPosts.length === 0 && (
            <p className="text-center text-gray-500 text-lg">More articles coming soon.</p>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-[#e8813a]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Get Your Free Assessment Today</h2>
            <p className="text-lg text-white/90 mb-8">No cost. No obligation. We come to you.</p>
            <a href={BASE}>
              <Button size="lg" className="bg-[#0a1628] hover:bg-[#0a1628]/90 text-white px-8 py-6 text-lg">
                📅 Book Free Assessment <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
