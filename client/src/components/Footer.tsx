import { Phone, Mail, MapPin } from "lucide-react";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-12">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663360032476/ziPuhHtSxVguNbwi.png" 
              alt="Mechanical Enterprise" 
              className="h-16 w-auto mb-4 bg-white p-2 rounded"
            />
            <p className="text-sm text-white/80">
              Specialized HVAC solutions for residential, commercial, and industrial properties across New Jersey.
            </p>
            <div className="mt-4">
              <p className="text-xs text-white/60">WMBE/SBE Certified</p>
              <p className="text-xs text-white/60">NAICS 238220</p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/">
                  <a className="text-white/80 hover:text-white transition-colors">Home</a>
                </Link>
              </li>
              <li>
                <Link href="/about">
                  <a className="text-white/80 hover:text-white transition-colors">About Us</a>
                </Link>
              </li>
              <li>
                <Link href="/services">
                  <a className="text-white/80 hover:text-white transition-colors">Services</a>
                </Link>
              </li>
              <li>
                <Link href="/contact">
                  <a className="text-white/80 hover:text-white transition-colors">Contact</a>
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold mb-4">Our Services</h4>
            <ul className="space-y-2 text-sm text-white/80">
              <li>Installation & Commissioning</li>
              <li>Repair & Maintenance</li>
              <li>Emergency Services</li>
              <li>VRV/VRF Systems</li>
              <li>System Design</li>
              <li>BIM Technology</li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                <span className="text-white/80">51 ½ Merchant St<br />Newark, NJ 07105</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#ff6b35] flex-shrink-0" />
                <a href="tel:+19737500759" className="text-white/80 hover:text-white transition-colors">
                  (973) 750-0759
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#ff6b35] flex-shrink-0" />
                <a href="mailto:sales@mechanicalenterprise.com" className="text-white/80 hover:text-white transition-colors">
                  sales@mechanicalenterprise.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 mt-8 pt-8 text-center text-sm text-white/60">
          <p>© 2026 Mechanical Enterprise. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
