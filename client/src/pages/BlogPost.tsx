import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, ArrowRight, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { blogPosts, type BlogSection } from "@/data/blogPosts";
import { Redirect } from "wouter";

const BASE = "https://mechanicalenterprise.com";
const PHONE = "(862) 419-1763";
const PHONE_TEL = "tel:+18624191763";

function RenderSection({ section }: { section: BlogSection }) {
  switch (section.type) {
    case "intro":
      return <p className="text-lg text-gray-700 leading-relaxed font-medium border-l-4 border-[#e8813a] pl-5 my-8">{section.content}</p>;
    case "h2":
      return <h2 className="text-2xl md:text-3xl font-bold text-[#0a1628] mt-10 mb-4">{section.content}</h2>;
    case "paragraph":
      return <p className="text-gray-600 leading-[1.8] mb-4" style={{ fontSize: 18 }}>{section.content}</p>;
    case "stat_box":
      return (
        <div className="bg-[#0a1628] rounded-xl p-6 my-8 text-center">
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            {section.content.split(" | ").map((stat, i) => {
              const [label, value] = stat.split(": ");
              return (
                <div key={i} className="flex-1">
                  <div className="text-2xl md:text-3xl font-bold text-[#e8813a]">{value}</div>
                  <div className="text-white/70 text-sm mt-1">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    case "checklist":
      return (
        <div className="bg-gray-50 rounded-xl p-6 my-6 space-y-3">
          {section.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <span className="text-gray-700" style={{ fontSize: 16 }}>{item}</span>
            </div>
          ))}
        </div>
      );
    case "numbered_list":
      return (
        <ol className="space-y-4 my-6 pl-0 list-none">
          {section.items.map((item, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="bg-[#e8813a] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{i + 1}</span>
              <span className="text-gray-700 pt-1" style={{ fontSize: 16 }}>{item}</span>
            </li>
          ))}
        </ol>
      );
    case "cta_box":
      return (
        <div className="border-2 border-[#e8813a] rounded-xl p-6 my-8 text-center bg-white">
          <p className="text-[#0a1628] font-medium mb-4" style={{ fontSize: 17 }}>{section.content}</p>
          <a href={section.buttonUrl}>
            <Button className="bg-[#e8813a] hover:bg-[#d5732f] text-white px-8 py-5 text-base">
              {section.buttonText}
            </Button>
          </a>
        </div>
      );
    default:
      return null;
  }
}

export default function BlogPost({ slug }: { slug: string }) {
  const post = blogPosts.find((p) => p.slug === slug);

  useSEO({
    title: post ? `${post.title} | Mechanical Enterprise` : "Blog | Mechanical Enterprise",
    description: post?.metaDescription ?? "HVAC tips and rebate guides for NJ homeowners.",
    ogUrl: `${BASE}/blog/${slug}`,
  });

  if (!post) return <Redirect to="/blog" />;

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": post.title, "datePublished": post.date,
        "author": { "@type": "Organization", "name": "Mechanical Enterprise LLC" },
        "publisher": { "@type": "Organization", "name": "Mechanical Enterprise LLC", "url": BASE },
        "description": post.metaDescription,
        "mainEntityOfPage": { "@type": "WebPage", "@id": `${BASE}/blog/${post.slug}` },
      }) }} />
      <Navigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] py-16 md:py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#e8813a] text-white hover:bg-[#e8813a]/90 text-sm">{post.category}</Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">{post.title}</h1>
            <div className="flex items-center justify-center gap-4 text-white/60 text-sm">
              <span>{post.date}</span>
              <span>·</span>
              <span>{post.readTime}</span>
              <span>·</span>
              <span>Mechanical Enterprise Team</span>
            </div>
          </div>
        </div>
      </section>

      {/* Article Body + Sidebar */}
      <section className="py-12 bg-white">
        <div className="container">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-10">
            {/* Main Content */}
            <article className="flex-1 max-w-[800px]">
              {post.sections.map((section, i) => (
                <RenderSection key={i} section={section} />
              ))}
            </article>

            {/* Sidebar */}
            <aside className="lg:w-[280px] shrink-0">
              <div className="lg:sticky lg:top-8 space-y-4">
                <div className="bg-[#f7f8fa] rounded-xl border p-6">
                  <h3 className="font-bold text-lg text-[#0a1628] mb-3">Get Your Free Assessment</h3>
                  <p className="text-sm text-gray-600 mb-4">We come to you, assess your system, and show you every rebate you qualify for — no cost, no obligation.</p>
                  <a href={BASE} className="block mb-3">
                    <Button className="w-full bg-[#e8813a] hover:bg-[#d5732f] text-white">
                      📅 Book Free Assessment
                    </Button>
                  </a>
                  <a href={PHONE_TEL} className="block">
                    <Button variant="outline" className="w-full border-[#0a1628] text-[#0a1628]">
                      <Phone className="mr-2 h-4 w-4" /> {PHONE}
                    </Button>
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-[#e8813a]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Claim Your NJ Rebates?</h2>
            <p className="text-lg text-white/90 mb-8">Free assessment — we handle all paperwork</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={BASE}>
                <Button size="lg" className="bg-[#0a1628] hover:bg-[#0a1628]/90 text-white px-8 py-6 text-lg w-full sm:w-auto">
                  📅 Book Free Assessment <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <a href={PHONE_TEL}>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg w-full sm:w-auto">
                  <Phone className="mr-2 h-5 w-5" /> Call {PHONE}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
