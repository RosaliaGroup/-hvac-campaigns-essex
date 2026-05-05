import { Lock } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Footer() {
  const { isAuthenticated } = useAuth();
  
  return (
    <footer className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-12">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663360032476/PuYjNNzkSZddSRrE.png" 
              alt="Mechanical Enterprise" 
              className="h-20 w-auto mb-4"
            />
            <p className="text-sm text-white/80">
              Specialized HVAC solutions for residential, commercial, and industrial properties across New Jersey.
            </p>
            <div className="mt-4">
              <p className="text-xs text-white/60">WMBE/SBE Certified</p>
              <p className="text-xs text-white/60">NAICS 238220</p>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/residential" className="text-white/80 hover:text-white transition-colors">Residential HVAC</Link></li>
              <li><Link href="/commercial" className="text-white/80 hover:text-white transition-colors">Commercial HVAC</Link></li>
              <li><Link href="/heat-pump-installation-nj" className="text-white/80 hover:text-white transition-colors">Heat Pump Installation</Link></li>
              <li><Link href="/ductless-mini-split-installation-nj" className="text-white/80 hover:text-white transition-colors">Ductless Mini-Split</Link></li>
              <li><Link href="/vrv-vrf-installation-nj" className="text-white/80 hover:text-white transition-colors">VRV/VRF Systems</Link></li>
              <li><Link href="/direct-install" className="text-white/80 hover:text-white transition-colors">Direct Install Program</Link></li>
            </ul>
          </div>

          {/* Top Service Areas */}
          <div>
            <h4 className="font-semibold mb-4">Top Service Areas</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/hvac-newark-nj" className="text-white/80 hover:text-white transition-colors">Newark, NJ</Link></li>
              <li><Link href="/hvac-jersey-city-nj" className="text-white/80 hover:text-white transition-colors">Jersey City, NJ</Link></li>
              <li><Link href="/hvac-elizabeth-nj" className="text-white/80 hover:text-white transition-colors">Elizabeth, NJ</Link></li>
              <li><Link href="/hvac-hoboken-nj" className="text-white/80 hover:text-white transition-colors">Hoboken, NJ</Link></li>
              <li><Link href="/hvac-clifton-nj" className="text-white/80 hover:text-white transition-colors">Clifton, NJ</Link></li>
              <li><Link href="/hvac-morristown-nj" className="text-white/80 hover:text-white transition-colors">Morristown, NJ</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog/nj-hvac-rebates-2026-complete-guide" className="text-white/80 hover:text-white transition-colors">NJ HVAC Rebates Guide</Link></li>
              <li><Link href="/blog/heat-pump-installation-nj-guide" className="text-white/80 hover:text-white transition-colors">Heat Pump Guide</Link></li>
              <li><Link href="/blog/pseg-heat-pump-rebates-explained" className="text-white/80 hover:text-white transition-colors">PSE&G Rebates Explained</Link></li>
              <li><Link href="/rebate-calculator" className="text-white/80 hover:text-white transition-colors">Rebate Calculator</Link></li>
              <li><Link href="/pseg-rebate-contractor-nj" className="text-white/80 hover:text-white transition-colors">PSE&G Contractor Info</Link></li>
              <li><Link href="/blog" className="text-white/80 hover:text-white transition-colors">All Blog Posts</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 mt-8 pt-8 text-center text-sm text-white/60">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <p>© 2026 Mechanical Enterprise. All rights reserved.</p>
            {isAuthenticated && (
              <Link href="/admin" className="flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors text-xs">
                <Lock className="h-3 w-3" />
                Admin Portal
              </Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
