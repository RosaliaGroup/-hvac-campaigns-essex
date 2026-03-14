import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Phone, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Navigation() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location === path;

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/services", label: "Services" },
    { href: "/residential", label: "Residential" },
    { href: "/commercial", label: "Commercial" },
    { href: "/rebate-guide", label: "Rebate Guide" },
    { href: "/video-hub", label: "▶ Video Hub" },
    { href: "/maintenance", label: "Maintenance" },
    { href: "/partnerships", label: "Partnerships" },
    { href: "/careers", label: "Careers" },
    { href: "/testimonials", label: "Testimonials" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="container">
        <div className="flex items-center justify-between py-3">
          {/* Logo */}
          <Link href="/" onClick={() => setMobileOpen(false)}>
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663360032476/PuYjNNzkSZddSRrE.png"
                alt="Mechanical Enterprise"
                className="h-12 w-auto"
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-5 flex-wrap">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-[#ff6b35] ${isActive(link.href) ? "text-[#ff6b35]" : "text-[#1e3a5f]"}`}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && (
              <Link
                href="/command-center"
                className={`text-sm font-bold transition-colors px-3 py-1 rounded-full border-2 border-[#1e3a5f] ${isActive("/command-center") ? "bg-[#1e3a5f] text-white" : "text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white"}`}
              >
                🗂 Dashboard
              </Link>
            )}
          </div>

          {/* Desktop Contact & CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-[#1e3a5f]">
              <Phone className="h-4 w-4 text-[#ff6b35]" />
              <a href="tel:+18624191763" className="hover:text-[#ff6b35] transition-colors font-medium">
                (862) 419-1763
              </a>
            </div>
            <Link href="/contact">
              <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">Get a Quote</Button>
            </Link>
          </div>

          {/* Mobile: phone + hamburger */}
          <div className="md:hidden flex items-center gap-3">
            <a href="tel:+18624191763" className="text-[#1e3a5f]">
              <Phone className="h-5 w-5 text-[#ff6b35]" />
            </a>
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="p-2 rounded-md text-[#1e3a5f] hover:bg-gray-100 transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu — only visible when open */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border pb-4 pt-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-2 py-3 text-base font-medium rounded-md transition-colors ${isActive(link.href) ? "text-[#ff6b35] bg-orange-50" : "text-[#1e3a5f] hover:bg-gray-50"}`}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && (
              <Link
                href="/command-center"
                onClick={() => setMobileOpen(false)}
                className={`block px-2 py-3 text-base font-bold rounded-md transition-colors ${isActive("/command-center") ? "text-[#1e3a5f] bg-blue-50" : "text-[#1e3a5f]/80 hover:bg-gray-50"}`}
              >
                🗂 Dashboard
              </Link>
            )}
            <div className="pt-3 px-2">
              <Link href="/contact" onClick={() => setMobileOpen(false)}>
                <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white text-base py-3">
                  Get a Free Quote
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
