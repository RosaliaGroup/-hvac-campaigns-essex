import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

export default function Privacy() {
  useSEO({
    title: "Privacy Policy | Mechanical Enterprise",
    description: "Privacy policy for Mechanical Enterprise LLC — how we collect, use, and protect your personal information.",
    ogUrl: "https://mechanicalenterprise.com/privacy",
  });

  return (
    <div className="min-h-screen">
      <Navigation />

      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-[#0a1628] mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: April 6, 2026</p>

          <div className="prose prose-slate max-w-none space-y-6 text-[#333]">
            <p>
              Mechanical Enterprise LLC ("we," "us," or "our") operates the website
              mechanicalenterprise.com. This Privacy Policy explains how we collect, use,
              and protect your personal information when you use our website and services.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Information We Collect</h2>
            <p>We collect information you voluntarily provide through our lead forms, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Property address (when provided for HVAC assessments)</li>
              <li>Service interest or inquiry details</li>
            </ul>
            <p>
              We may also collect standard web analytics data (pages visited, browser type,
              referring URL) to improve our website experience. We do not use third-party
              tracking cookies for advertising purposes on our website.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">How We Use Your Information</h2>
            <p>Your information is used solely for:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Following up on your HVAC assessment or service request</li>
              <li>Providing quotes, scheduling appointments, and delivering services</li>
              <li>Communicating about rebate eligibility and available programs</li>
              <li>Sending service-related updates you've opted into</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">We Do Not Sell Your Data</h2>
            <p>
              We do not sell, rent, or trade your personal information to third parties.
              Your data is never shared with other companies for marketing purposes.
              We may share your information only with trusted service partners directly
              involved in delivering your HVAC services (e.g., utility companies for
              rebate processing).
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Data Security</h2>
            <p>
              We use industry-standard security measures to protect your personal
              information, including encrypted data transmission (HTTPS) and secure
              database storage. However, no method of electronic transmission or
              storage is 100% secure.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Request access to the personal information we hold about you</li>
              <li>Request correction or deletion of your personal information</li>
              <li>Opt out of marketing communications at any time</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your
              data rights, contact us at:
            </p>
            <p>
              <strong>Mechanical Enterprise LLC</strong><br />
              Email:{" "}
              <a href="mailto:sales@mechanicalenterprise.com" className="text-[#e8813a] hover:underline">
                sales@mechanicalenterprise.com
              </a><br />
              Phone:{" "}
              <a href="tel:+18624191763" className="text-[#e8813a] hover:underline">
                (862) 419-1763
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
