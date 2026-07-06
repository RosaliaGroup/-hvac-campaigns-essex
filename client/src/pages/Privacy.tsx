import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

export default function Privacy() {
  useSEO({
    title: "Privacy Policy | Mechanical Enterprise",
    description: "Privacy policy for Mechanical Enterprise LLC — how we collect, use, and protect your personal information, including SMS/text messaging.",
    ogUrl: "https://mechanicalenterprise.com/privacy",
  });

  return (
    <div className="min-h-screen">
      <Navigation />

      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-[#0a1628] mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: July 7, 2026</p>

          <div className="prose prose-slate max-w-none space-y-6 text-[#333]">
            <p>
              Mechanical Enterprise LLC ("we," "us," or "our") operates the website
              mechanicalenterprise.com and provides HVAC installation, maintenance, and
              repair services in New Jersey. This Privacy Policy explains how we collect,
              use, share, and protect your personal information when you use our website,
              contact us, or receive our services.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Information We Collect</h2>
            <p>
              We collect information you voluntarily provide through our website forms, phone
              calls, and appointment bookings, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Contact details (full name, email address, phone number)</li>
              <li>Service address and property details</li>
              <li>Property and equipment information relevant to your HVAC system</li>
              <li>Service interest, project details, and scheduling preferences</li>
            </ul>
            <p>
              We may also collect standard web analytics data (pages visited, browser type,
              referring URL) through cookies and similar technologies to understand how our
              website is used and to improve the experience. We do not use third-party
              tracking cookies for advertising purposes on our website. Most browsers let you
              refuse or delete cookies through their settings.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">How We Use Your Information</h2>
            <p>Your information is used to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Schedule and confirm appointments and assessments</li>
              <li>Deliver, perform, and follow up on HVAC services</li>
              <li>Prepare quotes and rebate estimates and communicate program eligibility</li>
              <li>Send service-related communications and updates you have requested</li>
              <li>Respond to your inquiries and provide customer support</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">SMS / Text Messaging</h2>
            <p>
              With your consent, we send text messages related to your service requests, such
              as appointment confirmations, reschedules, rebate results, and occasional
              offers.
            </p>
            <p>
              <strong>
                Text messaging originator opt-in data and consent will not be shared with or
                sold to any third parties, with the exception of vendors and service providers
                acting on our behalf solely to deliver those messages.
              </strong>
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>How we collect consent:</strong> you provide consent to receive text
                messages by submitting one of our website forms, or by giving verbal opt-in
                when booking an appointment by phone.
              </li>
              <li>
                <strong>Message frequency</strong> varies based on your interactions with us.
                Message and data rates may apply.
              </li>
              <li>
                <strong>Opting out and help:</strong> reply <strong>STOP</strong> to opt out of
                text messages at any time, reply <strong>HELP</strong> for help, or call us at{" "}
                <a href="tel:+18624239396" className="text-[#e8813a] hover:underline">
                  (862) 423-9396
                </a>.
              </li>
            </ul>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">How We Share Information</h2>
            <p>
              We do not sell, rent, or trade your personal information, and we do not share it
              with other companies for their own marketing. We share information only with
              service providers who help us operate our business and deliver services to you,
              and only to the extent necessary for those purposes. These may include:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Telecommunications carriers and messaging providers (to deliver calls and texts)</li>
              <li>Payment processors (to process payments you authorize)</li>
              <li>Scheduling, booking, and customer-management tools</li>
              <li>Utility companies and program administrators (for rebate processing you request)</li>
            </ul>
            <p>
              We may also disclose information when required by law or to protect our legal
              rights.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Data Retention</h2>
            <p>
              We retain your personal information for as long as needed to provide our
              services, maintain your customer records, comply with our legal obligations,
              resolve disputes, and enforce our agreements. When information is no longer
              needed, we securely delete or anonymize it.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Data Security</h2>
            <p>
              We use industry-standard security measures to protect your personal information,
              including encrypted data transmission (HTTPS) and secure database storage.
              However, no method of electronic transmission or storage is 100% secure.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Request access to the personal information we hold about you</li>
              <li>Request correction or deletion of your personal information</li>
              <li>Opt out of marketing communications, including text messages, at any time</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data
              rights, contact us at:
            </p>
            <p>
              <strong>Mechanical Enterprise LLC</strong><br />
              Email:{" "}
              <a href="mailto:sales@mechanicalenterprise.com" className="text-[#e8813a] hover:underline">
                sales@mechanicalenterprise.com
              </a><br />
              Phone:{" "}
              <a href="tel:+18624239396" className="text-[#e8813a] hover:underline">
                (862) 423-9396
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
