import { Button } from "@/components/ui/button";
import { Phone, Mail } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Navigation() {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="container">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663360032476/PuYjNNzkSZddSRrE.png" 
                alt="Mechanical Enterprise" 
                className="h-14 w-auto"
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className={`text-sm font-medium transition-colors hover:text-[#ff6b35] ${isActive('/') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
              Home
            </Link>
            <Link href="/about" className={`text-sm font-medium transition-colors hover:text-[#ff6b35] ${isActive('/about') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
              About
            </Link>
            <Link href="/services" className={`text-sm font-medium transition-colors hover:text-[#ff6b35] ${isActive('/services') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
              Services
            </Link>
            <Link href="/residential" className={`text-sm font-medium transition-colors hover:text-[#ff6b35] ${isActive('/residential') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
              Residential
            </Link>
            <Link href="/commercial" className={`text-sm font-medium transition-colors hover:text-[#ff6b35] ${isActive('/commercial') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
              Commercial
            </Link>
            <Link href="/rebate-guide" className={`text-sm font-medium transition-colors hover:text-[#ff6b35] ${isActive('/rebate-guide') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
              Rebate Guide
            </Link>
            <Link href="/contact" className={`text-sm font-medium transition-colors hover:text-[#ff6b35] ${isActive('/contact') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
              Contact
            </Link>
          </div>

          {/* Contact Info & CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-[#1e3a5f]">
              <Phone className="h-4 w-4 text-[#ff6b35]" />
              <a href="tel:+18624239396" className="hover:text-[#ff6b35] transition-colors font-medium">
                (862) 423-9396
              </a>
            </div>
            <Link href="/contact">
              <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                Get a Quote
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Link href="/contact">
              <Button size="sm" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                Contact
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4 space-y-2">
          <Link href="/" className={`block py-2 text-sm font-medium ${isActive('/') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
            Home
          </Link>
          <Link href="/about" className={`block py-2 text-sm font-medium ${isActive('/about') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
            About
          </Link>
          <Link href="/services" className={`block py-2 text-sm font-medium ${isActive('/services') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
            Services
          </Link>
          <Link href="/residential" className={`block py-2 text-sm font-medium ${isActive('/residential') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
            Residential
          </Link>
          <Link href="/commercial" className={`block py-2 text-sm font-medium ${isActive('/commercial') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
            Commercial
          </Link>
          <Link href="/rebate-guide" className={`block py-2 text-sm font-medium ${isActive('/rebate-guide') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
            Rebate Guide
          </Link>
          <Link href="/contact" className={`block py-2 text-sm font-medium ${isActive('/contact') ? 'text-[#ff6b35]' : 'text-[#1e3a5f]'}`}>
            Contact
          </Link>
          <div className="pt-2">
            <a href="tel:+18624239396" className="flex items-center gap-2 text-sm text-[#1e3a5f] hover:text-[#ff6b35]">
              <Phone className="h-4 w-4" />
              (862) 423-9396
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
