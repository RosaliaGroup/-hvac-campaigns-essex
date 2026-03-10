import { useState } from "react";
import InternalNav from "@/components/InternalNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Mail, MessageSquare, CheckCircle, Clock, ArrowRight
} from "lucide-react";
import { getLoginUrl } from "@/const";

interface EmailStep {
  day: number;
  subject: string;
  preheader: string;
  body: string;
  cta: string;
  ctaUrl: string;
}

interface SMSStep {
  day: number;
  message: string;
  timing: string;
}

interface EmailSequence {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: EmailStep[];
}

interface SMSSequence {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: SMSStep[];
}

const emailSequences: EmailSequence[] = [
  {
    id: "popup-residential",
    name: "Residential Popup Lead Sequence",
    description: "Sent to leads captured via homepage and residential page exit popups",
    trigger: "Lead submits popup form on homepage or /residential",
    steps: [
      {
        day: 0,
        subject: "Your Free Rebate Guide is Inside 🏠",
        preheader: "Up to $16,000 back on your heat pump installation",
        body: `Hi {{first_name}},

Thank you for your interest in heat pump incentives for your home!

I'm reaching out from Mechanical Enterprise — Essex County's trusted HVAC specialists with 20+ years of experience and over 4,000 residential installations across New Jersey.

Here's a quick summary of the incentives available to you right now:

💰 PSE&G Home Energy Efficiency Program: Up to $6,000
💰 NJ Clean Energy Program: Up to $3,000  
💰 Federal Tax Credit (25C): Up to $2,000 (30% of cost)
💰 Additional utility incentives: Varies

Total potential incentives: Up to $16,000+

The best part? We handle ALL the paperwork. You don't have to navigate the rebate process alone.

To find out exactly how much you qualify for, we'd love to schedule a FREE in-home assessment. Our team will:
✅ Evaluate your current system
✅ Recommend the right heat pump for your home
✅ Calculate your exact incentive amount
✅ Provide a detailed quote with no obligation

Ready to get started? Reply to this email or call us at (862) 419-1763.

Warm regards,
The Mechanical Enterprise Team
(862) 419-1763 | mechanicalenterprise.com
WMBE/SBE Certified | Licensed & Insured`,
        cta: "Book Your Free Assessment",
        ctaUrl: "https://mechanicalenterprise.com/contact",
      },
      {
        day: 3,
        subject: "Quick question about your HVAC system, {{first_name}}",
        preheader: "Most NJ homeowners don't realize they qualify for this",
        body: `Hi {{first_name}},

I wanted to follow up on your interest in heat pump incentives.

A lot of homeowners I speak with are surprised to learn that their existing HVAC system — even if it's only 8–10 years old — may qualify for a full replacement with incentives covering a significant portion of the cost.

Here's what I'd love to know: How old is your current heating/cooling system?

If it's over 10 years old, you're likely spending 30–40% more on energy bills than necessary. A new heat pump system would pay for itself in energy savings — and the incentives make the upfront cost even more manageable.

We have availability this week for free in-home assessments in your area.

Would any of these times work for you?
• Tuesday or Wednesday afternoon
• Thursday or Friday morning
• Saturday morning

Just reply with what works, or call us directly at (862) 419-1763.

Best,
The Mechanical Enterprise Team`,
        cta: "Schedule This Week",
        ctaUrl: "https://mechanicalenterprise.com/contact",
      },
      {
        day: 7,
        subject: "⚠️ PSE&G incentive funds are limited — here's what you need to know",
        preheader: "NJ homeowners are claiming these incentives fast",
        body: `Hi {{first_name}},

I want to share something important with you.

The PSE&G Home Energy Efficiency Program and NJ Clean Energy incentives are funded programs — meaning once the annual funding is allocated, it's gone until the next cycle.

We've seen homeowners miss out on thousands of dollars in incentives simply because they waited too long.

Right now, the full stack of incentives is available:
✅ PSE&G: Up to $6,000
✅ NJ Clean Energy: Up to $3,000
✅ Federal Tax Credit: 30% (up to $2,000)

But we can't guarantee how long this window stays open.

If you're considering upgrading your HVAC system this year, the best time to act is now — before the busy season and before incentive funds run low.

Our free in-home assessment takes about 45 minutes and gives you a complete picture of your options, costs, and incentive eligibility. No pressure, no obligation.

Call us at (862) 419-1763 or book online.

Best regards,
Mechanical Enterprise Team`,
        cta: "Claim Your Incentives Now",
        ctaUrl: "https://mechanicalenterprise.com/contact",
      },
      {
        day: 14,
        subject: "Last follow-up from Mechanical Enterprise",
        preheader: "We're here when you're ready",
        body: `Hi {{first_name}},

This will be my last follow-up — I don't want to fill your inbox!

If you're still thinking about upgrading your HVAC system and taking advantage of the available incentives, we're here whenever you're ready.

A few things to keep in mind:
• Free in-home assessments, no obligation
• We handle all incentive paperwork
• Financing available at 0% interest
• Licensed, insured, WMBE/SBE certified
• 20+ years serving Essex County and NJ

When the time is right, give us a call at (862) 419-1763 or visit mechanicalenterprise.com.

We'd love to help you save money and improve your home's comfort.

Take care,
Mechanical Enterprise Team
(862) 419-1763`,
        cta: "Visit Our Website",
        ctaUrl: "https://mechanicalenterprise.com",
      },
    ],
  },
  {
    id: "popup-commercial",
    name: "Commercial Popup Lead Sequence",
    description: "Sent to leads captured via commercial page exit popup",
    trigger: "Lead submits popup form on /commercial",
    steps: [
      {
        day: 0,
        subject: "Commercial HVAC Incentives — Your Free Assessment",
        preheader: "Up to 80% of your upgrade could be covered",
        body: `Hello,

Thank you for your interest in commercial HVAC incentives for your property.

Mechanical Enterprise specializes in commercial HVAC solutions across all 15 New Jersey counties. We've served over 2.6 million square feet of commercial space including hotels, restaurants, healthcare facilities, office buildings, and industrial properties.

Here's what's available for commercial properties right now:

🏢 JCP&L Commercial Rebate Program: Significant incentives for high-efficiency systems
🏢 PSE&G Commercial Program: Up to 80% of project costs covered
🏢 Federal Tax Deduction (179D): For commercial buildings
🏢 Utility incentive stacking: Multiple programs can be combined

Our commercial HVAC services include:
✅ VRV/VRF system design and installation
✅ BMS (Building Management System) integration
✅ Multi-zone climate control
✅ System commissioning and balancing
✅ Preventive maintenance programs

We'd like to schedule a complimentary commercial site survey to assess your current systems and identify the best upgrade path and incentive opportunities.

Please reply or call us at (862) 419-1763 to schedule.

Best regards,
Mechanical Enterprise Commercial Team
WMBE/SBE Certified | Licensed & Insured`,
        cta: "Schedule Site Survey",
        ctaUrl: "https://mechanicalenterprise.com/contact",
      },
      {
        day: 4,
        subject: "Commercial HVAC: The ROI numbers for NJ businesses",
        preheader: "How much could you save on energy costs?",
        body: `Hello,

Following up on your interest in commercial HVAC incentives.

I wanted to share some numbers that our commercial clients typically see after upgrading to modern VRV/VRF systems:

📊 Energy cost reduction: 25–35% annually
📊 Incentive coverage: Up to 80% of project cost
📊 Typical payback period: 3–5 years (with incentives)
📊 System lifespan: 20+ years with proper maintenance

For a typical 10,000 sq ft commercial space spending $30,000/year on HVAC energy, that's $7,500–$10,500 in annual savings.

Combined with available incentives covering up to 80% of installation costs, the financial case for upgrading is compelling.

Our team can provide a detailed ROI analysis for your specific property during a free site survey.

Available this week for commercial assessments. Call (862) 419-1763 or reply to schedule.

Best regards,
Mechanical Enterprise Commercial Team`,
        cta: "Get ROI Analysis",
        ctaUrl: "https://mechanicalenterprise.com/contact",
      },
    ],
  },
];

const smsSequences: SMSSequence[] = [
  {
    id: "new-lead-sms",
    name: "New Lead Immediate SMS",
    description: "Sent immediately when a new lead submits any form or popup",
    trigger: "Any new lead capture (popup, contact form, quote request)",
    steps: [
      {
        day: 0,
        message: "Hi {{first_name}}! This is Mechanical Enterprise. Thanks for your interest in HVAC incentives. We'll be in touch shortly to schedule your free assessment. Questions? Call (862) 419-1763. Reply STOP to opt out.",
        timing: "Within 5 minutes of form submission",
      },
      {
        day: 1,
        message: "Hi {{first_name}}, Mechanical Enterprise here. Did you get a chance to review the incentive info we sent? We have openings this week for free in-home assessments. Interested? Reply YES or call (862) 419-1763.",
        timing: "Next day, 10am",
      },
      {
        day: 3,
        message: "{{first_name}}, just a reminder — NJ heat pump incentives up to $16K are available now. Free estimate, no obligation. Call (862) 419-1763 or visit mechanicalenterprise.com. Reply STOP to opt out.",
        timing: "Day 3, 11am",
      },
      {
        day: 7,
        message: "Hi {{first_name}}! Mechanical Enterprise checking in. Still interested in HVAC incentives? We're booking free assessments for this week. Call (862) 419-1763. Reply STOP to unsubscribe.",
        timing: "Day 7, 10am",
      },
    ],
  },
  {
    id: "appointment-reminder",
    name: "Appointment Reminder Sequence",
    description: "Sent to leads who have booked a free assessment",
    trigger: "Lead books a free in-home assessment",
    steps: [
      {
        day: -2,
        message: "Hi {{first_name}}! Reminder: Your free HVAC assessment with Mechanical Enterprise is scheduled for {{appointment_date}} at {{appointment_time}}. Questions? Call (862) 419-1763. Reply CONFIRM to confirm.",
        timing: "2 days before appointment",
      },
      {
        day: -1,
        message: "{{first_name}}, see you tomorrow! Your Mechanical Enterprise assessment is at {{appointment_time}}. Our tech will review your system and calculate your exact incentive amount. Call (862) 419-1763 if you need to reschedule.",
        timing: "Day before appointment, 5pm",
      },
      {
        day: 0,
        message: "Good morning {{first_name}}! Your Mechanical Enterprise assessment is today at {{appointment_time}}. Our technician will arrive in a Mechanical Enterprise vehicle. Call (862) 419-1763 with any questions.",
        timing: "Day of appointment, 8am",
      },
    ],
  },
  {
    id: "post-visit",
    name: "Post-Visit Follow-Up",
    description: "Sent after a free assessment visit is completed",
    trigger: "Technician marks assessment as completed",
    steps: [
      {
        day: 0,
        message: "Hi {{first_name}}, thanks for having us today! We'll send your detailed proposal and incentive breakdown within 24 hours. Questions? Call (862) 419-1763. — Mechanical Enterprise Team",
        timing: "Same day as visit, within 2 hours",
      },
      {
        day: 2,
        message: "{{first_name}}, your HVAC proposal is ready! Check your email for the full breakdown including your incentive eligibility. Ready to move forward? Call (862) 419-1763. We can schedule installation within the week.",
        timing: "2 days after visit",
      },
      {
        day: 5,
        message: "Hi {{first_name}}, Mechanical Enterprise here. Just checking in on your proposal. Any questions about the incentives or installation process? We're happy to walk you through everything. Call (862) 419-1763.",
        timing: "5 days after visit",
      },
    ],
  },
];

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard!`);
}

export default function EmailSMSCampaigns() {
  const { isAuthenticated, loading } = useAuth();
  const [activeEmailSeq, setActiveEmailSeq] = useState(emailSequences[0].id);
  const [activeSMSSeq, setActiveSMSSeq] = useState(smsSequences[0].id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const activeEmail = emailSequences.find(s => s.id === activeEmailSeq)!;
  const activeSMS = smsSequences.find(s => s.id === activeSMSSeq)!;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <InternalNav />
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm flex-shrink-0">
        <div className="container py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" /> Admin Portal
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
                <Mail className="h-6 w-6 text-[#ff6b35]" />
                Email & SMS Campaigns
              </h1>
              <p className="text-sm text-muted-foreground">Automated lead nurture sequences for residential and commercial leads</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      <div className="container py-4">
        <Tabs defaultValue="email">
          <TabsList className="mb-6">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email Sequences
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> SMS Sequences
            </TabsTrigger>
          </TabsList>

          {/* Email Tab */}
          <TabsContent value="email">
            <div className="grid md:grid-cols-4 gap-6">
              {/* Sequence Selector */}
              <div className="space-y-3">
                <h3 className="font-semibold text-[#1e3a5f]">Sequences</h3>
                {emailSequences.map(seq => (
                  <Card
                    key={seq.id}
                    className={`cursor-pointer transition-all p-3 ${activeEmailSeq === seq.id ? "ring-2 ring-[#ff6b35]" : "hover:shadow-md"}`}
                    onClick={() => setActiveEmailSeq(seq.id)}
                  >
                    <p className="font-medium text-sm text-[#1e3a5f]">{seq.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{seq.steps.length} emails</p>
                  </Card>
                ))}
              </div>

              {/* Sequence Detail */}
              <div className="md:col-span-3 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{activeEmail.name}</CardTitle>
                    <CardDescription>
                      <strong>Trigger:</strong> {activeEmail.trigger}
                    </CardDescription>
                  </CardHeader>
                </Card>

                {/* Timeline */}
                <div className="relative">
                  {activeEmail.steps.map((step, i) => (
                    <div key={i} className="flex gap-4 mb-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-[#ff6b35] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {step.day === 0 ? "Now" : `D${step.day}`}
                        </div>
                        {i < activeEmail.steps.length - 1 && (
                          <div className="w-0.5 bg-slate-200 flex-1 my-1"></div>
                        )}
                      </div>
                      <Card className="flex-1 mb-0">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{step.subject}</CardTitle>
                              <CardDescription className="text-xs mt-0.5">Preview: {step.preheader}</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">
                              {step.day === 0 ? "Immediate" : `Day ${step.day}`}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-slate-50 rounded p-3 text-sm whitespace-pre-line text-slate-700 max-h-48 overflow-y-auto">
                            {step.body}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <a
                              href={step.ctaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#ff6b35] font-semibold flex items-center gap-1"
                            >
                              CTA: {step.cta} <ArrowRight className="h-3 w-3" />
                            </a>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => copyToClipboard(`Subject: ${step.subject}\n\n${step.body}`, `Email Day ${step.day}`)}>
                              <Copy className="h-3 w-3 mr-1" /> Copy Email
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* SMS Tab */}
          <TabsContent value="sms">
            <div className="grid md:grid-cols-4 gap-6">
              {/* Sequence Selector */}
              <div className="space-y-3">
                <h3 className="font-semibold text-[#1e3a5f]">Sequences</h3>
                {smsSequences.map(seq => (
                  <Card
                    key={seq.id}
                    className={`cursor-pointer transition-all p-3 ${activeSMSSeq === seq.id ? "ring-2 ring-[#ff6b35]" : "hover:shadow-md"}`}
                    onClick={() => setActiveSMSSeq(seq.id)}
                  >
                    <p className="font-medium text-sm text-[#1e3a5f]">{seq.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{seq.steps.length} messages</p>
                  </Card>
                ))}
              </div>

              {/* SMS Detail */}
              <div className="md:col-span-3 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{activeSMS.name}</CardTitle>
                    <CardDescription>
                      <strong>Trigger:</strong> {activeSMS.trigger}
                    </CardDescription>
                  </CardHeader>
                </Card>

                {activeSMS.steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {step.day < 0 ? `D${step.day}` : step.day === 0 ? "Now" : `D+${step.day}`}
                      </div>
                      {i < activeSMS.steps.length - 1 && (
                        <div className="w-0.5 bg-slate-200 flex-1 my-1 min-h-4"></div>
                      )}
                    </div>
                    <Card className="flex-1">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{step.timing}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">{step.message.length} chars</Badge>
                        </div>
                        {/* SMS Bubble */}
                        <div className="bg-[#1e3a5f] text-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-sm">
                          {step.message}
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs mt-2"
                          onClick={() => copyToClipboard(step.message, `SMS Day ${step.day}`)}>
                          <Copy className="h-3 w-3 mr-1" /> Copy Message
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Integration Guide */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              How to Activate These Sequences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email Automation
                </h3>
                <div className="space-y-2">
                  {[
                    "Sign up for Mailchimp (free up to 500 contacts) or ActiveCampaign",
                    "Create an Automation workflow triggered by 'new subscriber'",
                    "Copy each email template into the workflow steps",
                    "Set delays: Immediately → Day 3 → Day 7 → Day 14",
                    "Connect your website form to Mailchimp via API or Zapier",
                    "Test with your own email before going live",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#ff6b35] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> SMS Automation
                </h3>
                <div className="space-y-2">
                  {[
                    "Your Twilio account is already configured in AI VA Settings",
                    "The AI VA system handles SMS follow-ups automatically",
                    "Go to AI VA Dashboard to monitor SMS conversations",
                    "Customize message templates in AI Script Manager",
                    "Ensure Twilio webhook is pointing to production URL",
                    "Test by submitting a lead form with your own phone number",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#1e3a5f] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
