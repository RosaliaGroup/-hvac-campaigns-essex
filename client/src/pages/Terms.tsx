import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

export default function Terms() {
  useSEO({
    title: "Terms of Service | Mechanical Enterprise",
    description: "Terms of service for Mechanical Enterprise LLC — conditions for using our website and HVAC services.",
    ogUrl: "https://mechanicalenterprise.com/terms",
  });

  return (
    <div className="min-h-screen">
      <Navigation />

      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-[#0a1628] mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: April 6, 2026</p>

          <div className="prose prose-slate max-w-none space-y-6 text-[#333]">
            <p>
              These Terms of Service ("Terms") govern your use of the website
              mechanicalenterprise.com and the services provided by Mechanical
              Enterprise LLC ("we," "us," or "our"). By using our website or
              requesting our services, you agree to these Terms.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Services</h2>
            <p>
              Mechanical Enterprise LLC provides HVAC installation, maintenance,
              and repair services in New Jersey. We also assist customers with
              identifying and applying for available utility rebates and tax credits.
              All services are subject to availability and a site assessment.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Free Assessments</h2>
            <p>
              We offer free, no-obligation HVAC assessments. A free assessment does
              not constitute a commitment to purchase services. Quotes provided
              during assessments are estimates and may be adjusted based on final
              site conditions and equipment selection.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Rebates and Incentives</h2>
            <p>
              We help customers identify and apply for available rebates and tax
              credits. Rebate amounts and eligibility are determined by the
              issuing utility or government agency, not by Mechanical Enterprise.
              We do not guarantee rebate approval or specific rebate amounts.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Website Use</h2>
            <p>You agree to use our website only for lawful purposes and not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Submit false or misleading information through our forms</li>
              <li>Interfere with the website's operation or security</li>
              <li>Reproduce, distribute, or modify website content without permission</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Intellectual Property</h2>
            <p>
              All content on this website, including text, images, logos, and design,
              is the property of Mechanical Enterprise LLC and is protected by
              applicable copyright and trademark laws.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Limitation of Liability</h2>
            <p>
              Mechanical Enterprise LLC provides this website and its content on an
              "as is" basis. We make no warranties regarding the accuracy or
              completeness of website content. To the fullest extent permitted by
              law, we shall not be liable for any indirect, incidental, or
              consequential damages arising from use of this website.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of New Jersey.
              Any disputes shall be resolved in the courts of Essex County, New Jersey.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Changes will be posted
              on this page with an updated "Last updated" date. Continued use of
              the website after changes constitutes acceptance of the updated Terms.
            </p>

            <h2 className="text-xl font-semibold text-[#0a1628] mt-8">Contact Us</h2>
            <p>
              If you have questions about these Terms, contact us at:
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
