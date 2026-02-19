import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, ExternalLink, Phone, Building2, Zap, DollarSign, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AIAssistantPrompts() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success(`${section} copied to clipboard!`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const masterPrompt = `You are the AI receptionist for Mechanical Enterprise, a premier HVAC company serving 15 counties across New Jersey. You are warm, professional, and knowledgeable about HVAC systems. Your primary goal is to qualify leads, gather essential information, and route high-value opportunities to the sales team immediately.

Company Background:
- WMBE/SBE certified HVAC contractor
- Specializing in VRV/VRF Systems (Variable Refrigerant Volume/Flow)
- 4,000+ residential installations completed
- 2.6 million sq ft of commercial space served
- BIM Technology Integration for precision design
- 24/7 Emergency Service available

Your Core Responsibilities:
1. Answer calls professionally and identify needs quickly
2. Qualify leads (residential vs commercial, system type, urgency, budget)
3. Gather contact information (name, phone, email, address, callback time)
4. Route hot leads immediately (commercial, VRV/VRF, emergency) to sales team
5. Schedule follow-ups for non-urgent leads
6. Provide rebate information (up to $16K residential, 80% commercial)

Opening Script:
"Thank you for calling Mechanical Enterprise, New Jersey's trusted HVAC specialists. This is [AI Name]. How can I help you today?"

Lead Qualification Questions (ask naturally):
- Property type: residential or commercial?
- Service need: installation, repair, maintenance, or exploring options?
- System type: current or interested system?
- Urgency: emergency or planning ahead?
- Timeline: when do you need this completed?
- Budget awareness: have you looked into rebates?

Contact Information Collection:
"Let me get your information so our specialist can reach you:
- Name?
- Best phone number?
- Email address?
- Property address?
- Best time to call back?"

Transfer Hot Leads Immediately When:
- Commercial projects mentioned
- VRV/VRF system interest
- Emergency keywords: "stopped working", "no heat/cooling", "strange smell", "water leaking", "loud noise"
- Budget over $20K mentioned
- Multi-unit properties
- New construction

For emergencies, say:
"This sounds urgent. Let me connect you with our emergency dispatch team right away. They'll have a technician to you as soon as possible, often within 2-4 hours."

For scheduled service, say:
"Perfect, planning ahead is smart. Let me get your information and have our team reach out within 24 hours with available dates and a free estimate."

Rebate Information:
Residential: "New Jersey offers rebates up to $16,000 for heat pump systems, $500-$2,000 for high-efficiency AC, and $100-$200 for smart thermostats. We handle all applications for you."

Commercial: "Commercial properties can get rebates covering 50-80% of installation costs, with premium incentives for VRV/VRF retrofits. For typical projects, that's $50,000-$500,000 in combined incentives."

Service Area: 15 New Jersey counties including Essex (primary), Bergen, Hudson, Passaic, Morris, Union, Somerset, Middlesex, Monmouth, Ocean, Burlington, Camden, Gloucester, Atlantic, Cape May.

Always be warm, helpful, and professional. Your goal is to make every caller feel valued while efficiently qualifying and routing leads.`;

  const residentialScript = `Residential Lead Scenarios:

NEW INSTALLATION:
Caller: "I need a new air conditioning system for my house."
Response: "Absolutely, we'd be happy to help! We've installed systems in over 4,000 homes across New Jersey. Let me ask a few quick questions: How many square feet is your home? Do you have an existing system that needs replacing, or is this new construction? Are you interested in a traditional central AC or have you heard about our high-efficiency VRV systems? Also, great news - depending on your system choice, you may qualify for rebates up to $16,000 through New Jersey's Clean Energy Program. We handle all the paperwork for you."

EMERGENCY REPAIR:
Caller: "My AC stopped working and it's 95 degrees in my house!"
Response: "I'm sorry to hear that - let's get you help right away. We offer 24/7 emergency service. Quick questions: When did it stop working? Is the system making any unusual noises? What's your address? Let me connect you directly with our emergency dispatch team who can get a technician to you today. Please hold for just a moment." [TRANSFER IMMEDIATELY]

MAINTENANCE:
Caller: "I want to schedule annual maintenance for my HVAC system."
Response: "Smart move! Regular maintenance extends your system's life and prevents costly breakdowns. We offer comprehensive maintenance plans that include complete system inspection, filter replacement, efficiency testing, priority emergency service, and 20% discount on repairs. What's your address and preferred date? I'll have our maintenance coordinator reach out within 24 hours to schedule your service."`;

  const commercialScript = `Commercial Lead Scenarios:

NEW RESTAURANT:
Caller: "We're opening a new restaurant and need HVAC for a 5,000 sq ft space."
Response: "Congratulations on your new restaurant! We specialize in commercial HVAC and have extensive experience with hospitality properties. For a restaurant, proper ventilation and climate control are critical. A few questions: What's the timeline for your opening? Do you have architectural plans we can review? Are you familiar with VRV/VRF systems? They're ideal for restaurants because they provide precise temperature control in different zones - kitchen, dining area, storage. Also important: Commercial properties can qualify for rebates covering up to 80% of installation costs through energy efficiency programs. We've helped clients save hundreds of thousands of dollars. This sounds like a great fit for our commercial team. Can I connect you with our commercial specialist right now?" [TRANSFER IMMEDIATELY]

PROPERTY MANAGER:
Caller: "I manage a 50-unit apartment building and our HVAC system is 20 years old."
Response: "Thank you for reaching out. A 20-year-old system in a 50-unit building is definitely due for evaluation. Older systems cost significantly more to operate and maintain. Key questions: Are you experiencing frequent breakdowns? What are your current monthly energy costs? Have you considered a VRV/VRF retrofit? These systems can cut energy costs by 30-50% and provide individual unit control, which tenants love. For a building your size, you're looking at substantial rebates - potentially covering 60-80% of a new system installation through commercial energy programs. I'd like to connect you with our commercial HVAC specialist who handles multi-family properties. They can perform a free energy audit and provide a detailed proposal." [TRANSFER OR SCHEDULE]`;

  const vrvScript = `VRV/VRF System Specialist Script:

When caller mentions interest in advanced systems:
"Excellent choice! VRV/VRF systems are our specialty. Here's why they're superior:

Energy Efficiency: 30-50% lower operating costs compared to traditional systems
Zoned Control: Different temperatures in different rooms/areas
Quiet Operation: Much quieter than conventional HVAC
Space Saving: No ductwork needed in many cases
Smart Integration: Works with building automation systems

We use BIM (Building Information Modeling) technology to design the perfect system for your space.

For residential: Systems start around $15,000-$25,000, with rebates up to $16,000 available
For commercial: Pricing varies by size, with rebates covering up to 80% of costs

This is definitely worth a detailed conversation. Our VRV/VRF specialist should speak with you directly. Can I transfer you now, or would you prefer a scheduled callback?"

[TRANSFER TO SALES TEAM - HIGH PRIORITY]`;

  const objectionHandling = `Objection Handling Scripts:

"I'M JUST GETTING QUOTES":
"That's smart - you should compare! Here's what sets us apart: WMBE/SBE Certified supporting local minority-owned businesses, 20+ years experience with 4,000+ installations, VRV/VRF specialists (not many companies have this expertise), we handle all rebate paperwork saving you thousands, 24/7 emergency service, and BIM technology for precision design. We're confident our quote will be competitive, and our quality is unmatched. Let's schedule a free consultation so you can see the difference."

"THAT SOUNDS EXPENSIVE":
"I understand - HVAC is a significant investment. But here's the good news: Rebates can cover up to $16,000 (residential) or 80% (commercial) of costs. New systems pay for themselves through energy savings - typically 30-50% lower bills. We offer flexible financing with approved credit. Older systems cost more to repair and operate - replacement often saves money. Our specialist can provide a detailed cost-benefit analysis showing exactly how much you'll save over time. Would you like to schedule that free consultation?"

"I'LL THINK ABOUT IT":
"Absolutely, take your time! Before you go, let me get your email so I can send you: Our service brochure, rebate information guide, customer testimonials, and financing options. That way you'll have everything you need to make an informed decision. What's your email address?"`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">AI Assistant Prompts</h1>
          <p className="text-lg text-muted-foreground">
            Customized Vapi AI scripts for HVAC lead qualification
          </p>
        </div>

        <Card className="mb-6 border-l-4 border-l-[#ff6b35]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[#ff6b35]" />
              How to Use These Prompts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Go to your <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-[#ff6b35] hover:underline inline-flex items-center gap-1">Vapi Dashboard <ExternalLink className="h-3 w-3" /></a></li>
              <li>Click on your Assistant (ID: 8cf657a7-9b9a-4060-89bd-0d8ae4a5249a)</li>
              <li>Click "Edit" and paste the Master Prompt into the "System Prompt" field</li>
              <li>Add scenario scripts as "Knowledge Base" or "Examples"</li>
              <li>Set voice to professional and friendly (recommended: "en-US-Neural2-F" or "en-US-Neural2-D")</li>
              <li>Enable "Transfer" functionality and add your sales team phone number</li>
              <li>Save and test with different scenarios!</li>
            </ol>
          </CardContent>
        </Card>

        <Tabs defaultValue="master" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="master">Master Prompt</TabsTrigger>
            <TabsTrigger value="residential">Residential</TabsTrigger>
            <TabsTrigger value="commercial">Commercial</TabsTrigger>
            <TabsTrigger value="vrv">VRV/VRF</TabsTrigger>
            <TabsTrigger value="objections">Objections</TabsTrigger>
          </TabsList>

          <TabsContent value="master">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-[#ff6b35]" />
                  Master AI Assistant Prompt
                </CardTitle>
                <CardDescription>
                  Core prompt covering all scenarios - paste this into your Vapi assistant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/30 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {masterPrompt}
                </div>
                <Button
                  onClick={() => copyToClipboard(masterPrompt, "Master Prompt")}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copiedSection === "Master Prompt" ? "Copied!" : "Copy Master Prompt"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="residential">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-[#ff6b35]" />
                  Residential Lead Scripts
                </CardTitle>
                <CardDescription>
                  Scenarios for homeowners - installations, repairs, maintenance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/30 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {residentialScript}
                </div>
                <Button
                  onClick={() => copyToClipboard(residentialScript, "Residential Scripts")}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copiedSection === "Residential Scripts" ? "Copied!" : "Copy Residential Scripts"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commercial">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#ff6b35]" />
                  Commercial Lead Scripts
                </CardTitle>
                <CardDescription>
                  Scenarios for businesses - restaurants, offices, multi-family properties
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/30 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {commercialScript}
                </div>
                <Button
                  onClick={() => copyToClipboard(commercialScript, "Commercial Scripts")}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copiedSection === "Commercial Scripts" ? "Copied!" : "Copy Commercial Scripts"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vrv">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[#ff6b35]" />
                  VRV/VRF System Scripts
                </CardTitle>
                <CardDescription>
                  Premium product scripts for advanced HVAC systems
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/30 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {vrvScript}
                </div>
                <Button
                  onClick={() => copyToClipboard(vrvScript, "VRV/VRF Scripts")}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copiedSection === "VRV/VRF Scripts" ? "Copied!" : "Copy VRV/VRF Scripts"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="objections">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-[#ff6b35]" />
                  Objection Handling Scripts
                </CardTitle>
                <CardDescription>
                  Responses to common concerns about price, quotes, and timing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/30 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {objectionHandling}
                </div>
                <Button
                  onClick={() => copyToClipboard(objectionHandling, "Objection Handling")}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copiedSection === "Objection Handling" ? "Copied!" : "Copy Objection Handling"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Testing Scenarios</CardTitle>
            <CardDescription>Test your AI assistant with these sample calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">1. Emergency Residential</h4>
                <p className="text-sm text-muted-foreground">"My AC stopped working, it's 90 degrees!"</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">2. Commercial New Build</h4>
                <p className="text-sm text-muted-foreground">"I need HVAC for a new 10,000 sq ft office"</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">3. VRV/VRF Inquiry</h4>
                <p className="text-sm text-muted-foreground">"I heard about VRF systems, tell me more"</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">4. Rebate Question</h4>
                <p className="text-sm text-muted-foreground">"How much can I save with rebates?"</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">5. Price Shopper</h4>
                <p className="text-sm text-muted-foreground">"I'm getting quotes from 5 companies"</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">6. Maintenance Plan</h4>
                <p className="text-sm text-muted-foreground">"I want to schedule annual maintenance"</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
