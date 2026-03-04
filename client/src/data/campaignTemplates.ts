export interface CampaignTemplate {
  id: string;
  name: string;
  category: 'emergency' | 'installation' | 'maintenance' | 'rebates' | 'partnerships' | 'commercial';
  platform: 'google-search' | 'facebook' | 'instagram' | 'youtube' | 'google-business';
  adType: string;
  content: {
    headline?: string;
    headline2?: string;
    headline3?: string;
    description?: string;
    description2?: string;
    primaryText?: string;
    body?: string;
    cta?: string;
  };
  targetAudience: string;
  estimatedBudget?: string;
}

export const campaignTemplates: CampaignTemplate[] = [
  // ─── EMERGENCY HVAC REPAIR ────────────────────────────────────────────────
  {
    id: 'emergency-ac-repair-google',
    name: '24/7 Emergency AC Repair',
    category: 'emergency',
    platform: 'google-search',
    adType: 'Search Ad',
    content: {
      headline: '24/7 Emergency AC Repair Newark',
      headline2: 'Same-Day Service | Licensed Techs',
      headline3: 'Call Now (862) 419-1763',
      description: 'AC broken? We\'re available 24/7 for emergency repairs across Essex County. Licensed technicians, transparent pricing, same-day service.',
      description2: 'WMBE certified. Serving 15 New Jersey counties. Call (862) 419-1763 for immediate assistance.',
    },
    targetAudience: 'Homeowners with immediate HVAC failure, 33-mile radius',
    estimatedBudget: '$50-100 per day',
  },
  {
    id: 'emergency-furnace-repair-google',
    name: 'Emergency Furnace Repair',
    category: 'emergency',
    platform: 'google-search',
    adType: 'Search Ad',
    content: {
      headline: 'Emergency Furnace Repair Near You',
      headline2: 'No Heat? We\'re Here 24/7',
      headline3: 'Licensed HVAC Experts',
      description: 'Furnace not working? Get fast, reliable emergency heating repair. Licensed technicians respond quickly across Essex County and surrounding areas.',
      description2: 'Transparent pricing. WMBE certified business. Call (862) 419-1763 now.',
    },
    targetAudience: 'Homeowners with heating emergencies, winter season',
    estimatedBudget: '$50-100 per day',
  },
  {
    id: 'emergency-service-instagram-story',
    name: 'Emergency Service Story',
    category: 'emergency',
    platform: 'instagram',
    adType: 'Story Ad',
    content: {
      headline: 'AC Broken? 🥵',
      body: '24/7 Emergency Service\nCall (862) 419-1763',
      cta: 'Swipe Up',
    },
    targetAudience: 'Local homeowners 25-55',
    estimatedBudget: '$15-30 per day',
  },

  // ─── RESIDENTIAL INSTALLATION & REBATES ──────────────────────────────────
  {
    id: 'heat-pump-installation-google',
    name: 'Heat Pump Installation with Rebates',
    category: 'installation',
    platform: 'google-search',
    adType: 'Search Ad',
    content: {
      headline: 'Heat Pump Installation Newark NJ',
      headline2: 'Up to $16,000 in Rebates Available',
      headline3: '30% Federal Tax Credit | Free Quote',
      description: 'Save big with New Jersey Clean Energy rebates + federal tax credits. Expert heat pump installation. VRF/VRV specialists. Get your free quote today.',
      description2: 'WMBE certified. 20+ years experience. We handle all rebate paperwork.',
    },
    targetAudience: 'Homeowners researching energy-efficient upgrades',
    estimatedBudget: '$75-150 per day',
  },
  {
    id: 'decarbonization-rebates-facebook',
    name: 'Heat Pump Rebates Campaign',
    category: 'rebates',
    platform: 'facebook',
    adType: 'Conversion Ad',
    content: {
      primaryText: '💰 Get up to $16,000 in rebates for upgrading to a heat pump!\n\nNew Jersey homeowners can save big with:\n• Up to $16,000 in NJ Clean Energy rebates\n• 30% federal tax credit (IRA)\n• Zero-interest financing options\n• 30-50% lower energy bills\n\nWe\'re VRF/VRV heat pump specialists and handle ALL rebate paperwork for you.\n\n**Free consultation to calculate your exact savings →**',
      headline: 'Up to $16K in HVAC Rebates',
      description: 'Heat pump installation | We handle paperwork | Free consultation',
      cta: 'Learn More',
    },
    targetAudience: 'Homeowners 45-70, interested in sustainability',
    estimatedBudget: '$40-80 per day',
  },
  {
    id: 'decarbonization-youtube-30s',
    name: 'Decarbonization Program Explainer',
    category: 'rebates',
    platform: 'youtube',
    adType: 'In-Stream Video Ad (30s)',
    content: {
      headline: 'Up to $16,000 in HVAC Rebates',
      description: 'New Jersey homeowners: Did you know you can get up to $16,000 in rebates for upgrading your HVAC system? Heat pumps are energy-efficient, lower your bills by up to 50%, and qualify for massive state and federal incentives. Mechanical Enterprise handles all the paperwork. Get your free rebate consultation today.',
      cta: 'Learn More',
    },
    targetAudience: 'Homeowners 35-65 in service area',
    estimatedBudget: '$40-80 per day',
  },
  {
    id: 'rebate-deadline-google-business',
    name: '2026 Rebate Funds Limited',
    category: 'rebates',
    platform: 'google-business',
    adType: 'Google Business Post',
    content: {
      headline: '2026 HVAC Rebates - Apply Early!',
      body: '⚠️ 2026 Rebate Funds Limited - Apply Early\n\nNew Jersey homeowners can still access:\n💰 Up to $16,000 in state rebates\n💰 30% federal tax credit\n💰 Zero-interest financing\n\nWe handle all paperwork and maximize your savings. Our VRF/VRV specialists have helped hundreds of families upgrade to energy-efficient heat pumps.\n\nDon\'t miss out - rebate funds are allocated first-come, first-served!\n\nCall (862) 419-1763 for your free consultation.',
      cta: 'Get Quote',
    },
    targetAudience: 'Local homeowners in service area',
    estimatedBudget: 'Free (Google Business)',
  },

  // ─── COMMERCIAL HVAC UPGRADES (80% PSE&G Coverage) ───────────────────────
  {
    id: 'commercial-hvac-upgrade-google',
    name: 'Commercial HVAC Upgrade – 80% PSE&G',
    category: 'commercial',
    platform: 'google-search',
    adType: 'Search Ad',
    content: {
      headline: 'Commercial HVAC Upgrade Newark NJ',
      headline2: 'Up to 80% Covered by PSE&G Rebates',
      headline3: 'VRF/VRV Specialists | Free Assessment',
      description: 'Upgrade your commercial HVAC with up to 80% of project costs covered by PSE&G rebates. Reduce operating costs and improve efficiency. Free energy assessment.',
      description2: 'WMBE certified. 2.6M sq ft served. Hotels, offices, restaurants. Call (862) 419-1763.',
    },
    targetAudience: 'Commercial property owners & facility managers in New Jersey',
    estimatedBudget: '$100-200 per day',
  },
  {
    id: 'commercial-hvac-upgrade-facebook',
    name: 'Commercial HVAC – PSE&G Rebate Campaign',
    category: 'commercial',
    platform: 'facebook',
    adType: 'Lead Generation Ad',
    content: {
      primaryText: '🏢 Commercial property owners in New Jersey:\n\nDid you know PSE&G can cover up to 80% of your HVAC upgrade costs?\n\nMechanical Enterprise specializes in commercial VRF/VRV systems for:\n✅ Office buildings\n✅ Hotels & hospitality\n✅ Restaurants & retail\n✅ Healthcare facilities\n✅ Industrial properties\n\nOur team has completed HVAC upgrades for over 2.6 million sq ft of commercial space across New Jersey.\n\n**Free energy assessment + rebate calculation →**',
      headline: 'Up to 80% Covered by PSE&G',
      description: 'Commercial HVAC upgrade | VRF/VRV specialists | Free assessment',
      cta: 'Get Free Assessment',
    },
    targetAudience: 'Commercial property owners, facility managers, business owners in NJ',
    estimatedBudget: '$60-120 per day',
  },
  {
    id: 'commercial-hvac-upgrade-google-business',
    name: 'Commercial HVAC PSE&G Post',
    category: 'commercial',
    platform: 'google-business',
    adType: 'Google Business Post',
    content: {
      headline: 'Commercial HVAC – Up to 80% PSE&G Rebates',
      body: '🏢 Commercial Property Owners: Major Savings Available\n\nPSE&G\'s Commercial & Industrial Direct Install program can cover up to 80% of your HVAC upgrade project costs.\n\nWe specialize in:\n• VRF/VRV commercial systems\n• Energy-efficient retrofits\n• BIM-integrated installations\n• Multi-zone climate control\n\nWe handle all PSE&G rebate paperwork and maximize your incentives.\n\nCall (862) 419-1763 for a free commercial energy assessment.',
      cta: 'Get Assessment',
    },
    targetAudience: 'Commercial property owners in New Jersey',
    estimatedBudget: 'Free (Google Business)',
  },

  // ─── MAINTENANCE SUBSCRIPTION ─────────────────────────────────────────────
  {
    id: 'maintenance-subscription-google',
    name: 'HVAC Maintenance Subscription – Google',
    category: 'maintenance',
    platform: 'google-search',
    adType: 'Search Ad',
    content: {
      headline: 'HVAC Maintenance Plans Newark NJ',
      headline2: 'First Month FREE | Priority Service',
      headline3: 'Licensed Technicians | (862) 419-1763',
      description: 'Stop paying for surprise repairs. Our maintenance subscription gives you fixed monthly pricing, priority emergency service, and 84% fewer breakdowns.',
      description2: 'Residential & commercial plans. WMBE certified. Serving 15 New Jersey counties. Call today.',
    },
    targetAudience: 'Homeowners and property managers researching HVAC maintenance',
    estimatedBudget: '$40-80 per day',
  },
  {
    id: 'maintenance-subscription-facebook',
    name: 'First Month Free Maintenance',
    category: 'maintenance',
    platform: 'facebook',
    adType: 'Lead Generation Ad',
    content: {
      primaryText: '🏠 Tired of unpredictable HVAC repair costs?\n\nOur subscription maintenance plans give you:\n✅ Fixed monthly pricing\n✅ Priority emergency service\n✅ 84% fewer unexpected repairs\n✅ Extended equipment life\n\n**LIMITED TIME: First Month FREE for new subscribers**\n\nPerfect for homeowners and property managers in Essex County and surrounding areas.',
      headline: 'First Month FREE Maintenance',
      description: 'Predictable costs | Priority service | Licensed technicians',
      cta: 'Sign Up',
    },
    targetAudience: 'Property managers, homeowners with 3+ bedrooms',
    estimatedBudget: '$30-60 per day',
  },
  {
    id: 'maintenance-subscription-instagram',
    name: 'Maintenance Subscription – Instagram',
    category: 'maintenance',
    platform: 'instagram',
    adType: 'Feed Ad',
    content: {
      headline: 'Never Worry About HVAC Again 🛠️',
      body: 'Our maintenance subscription keeps your system running perfectly year-round.\n\n✅ Fixed monthly pricing\n✅ Priority emergency service\n✅ Seasonal tune-ups included\n✅ First month FREE\n\nCall (862) 419-1763 to enroll today!',
      cta: 'Sign Up',
    },
    targetAudience: 'Homeowners 30-55 in Essex County and surrounding areas',
    estimatedBudget: '$20-40 per day',
  },
  {
    id: 'summer-ac-tune-up-google-business',
    name: 'Summer AC Tune-Up Special',
    category: 'maintenance',
    platform: 'google-business',
    adType: 'Google Business Post',
    content: {
      headline: 'Prepare Your AC for Summer',
      body: 'Don\'t wait for your AC to break during the first heat wave! ☀️\n\nOur pre-season maintenance includes:\n✓ Full system inspection\n✓ Filter replacement\n✓ Refrigerant check\n✓ Performance optimization\n\n**First-time customers: First month of maintenance subscription FREE!**\n\nCall (862) 419-1763 to schedule your tune-up today!',
      cta: 'Call Now',
    },
    targetAudience: 'Local homeowners in service area',
    estimatedBudget: 'Free (Google Business)',
  },
  {
    id: 'maintenance-subscription-google-business',
    name: 'Maintenance Subscription Post',
    category: 'maintenance',
    platform: 'google-business',
    adType: 'Google Business Post',
    content: {
      headline: 'HVAC Maintenance Subscription – First Month FREE',
      body: '🔧 Protect Your HVAC Investment with Our Subscription Plan\n\nFor a fixed monthly fee, you get:\n✅ Bi-annual tune-ups (spring & fall)\n✅ Priority emergency service\n✅ Filter replacements included\n✅ 15% discount on all repairs\n✅ Extended equipment warranty\n\nResidential plans starting at $49/month.\nCommercial plans available for multi-unit properties.\n\n**First month FREE for new subscribers!**\n\nCall (862) 419-1763 to enroll.',
      cta: 'Learn More',
    },
    targetAudience: 'Homeowners and property managers in service area',
    estimatedBudget: 'Free (Google Business)',
  },

  // ─── REFERRAL PARTNERSHIP PROGRAM ─────────────────────────────────────────
  {
    id: 'referral-partnership-google',
    name: 'Referral Partner Program – Google',
    category: 'partnerships',
    platform: 'google-search',
    adType: 'Search Ad',
    content: {
      headline: 'Earn Referral Income – HVAC Partner',
      headline2: 'Real Estate & Property Managers Welcome',
      headline3: 'No Investment | Flexible | Apply Now',
      description: 'Partner with Mechanical Enterprise and earn referral commissions on every HVAC project. Perfect for real estate agents, property managers, and contractors.',
      description2: 'Serving 15 New Jersey counties. WMBE certified. Flexible schedule. Call (862) 419-1763.',
    },
    targetAudience: 'Real estate agents, property managers, contractors in New Jersey',
    estimatedBudget: '$30-60 per day',
  },
  {
    id: 'partnership-recruitment-facebook',
    name: 'Partner Referral Program',
    category: 'partnerships',
    platform: 'facebook',
    adType: 'Lead Generation Ad',
    content: {
      primaryText: '💼 Earn extra income by referring HVAC clients\n\nAre you a real estate agent, property manager, or business owner with connections in your community?\n\nPartner with Mechanical Enterprise and earn:\n✅ Referral commissions on every project\n✅ Optional direct sales for higher earnings\n✅ No upfront investment required\n✅ Marketing materials and support provided\n\n**Marcus, a property manager in Newark, earned $6,200 last month through referrals alone.**\n\nPerfect for professionals with networks in property management, real estate, construction, retail, or hospitality.',
      headline: 'Earn Referral Income with HVAC',
      description: 'No investment | Flexible schedule | Support provided',
      cta: 'Apply Now',
    },
    targetAudience: 'Real estate agents, property managers, entrepreneurs',
    estimatedBudget: '$25-50 per day',
  },
  {
    id: 'referral-partnership-instagram',
    name: 'Referral Partner Program – Instagram',
    category: 'partnerships',
    platform: 'instagram',
    adType: 'Feed Ad',
    content: {
      headline: 'Earn With Every HVAC Referral 💼',
      body: 'Are you a real estate agent, property manager, or contractor?\n\nPartner with Mechanical Enterprise and earn referral commissions on every project you send our way.\n\n✅ No upfront investment\n✅ Flexible schedule\n✅ Marketing support provided\n✅ Commissions paid promptly\n\nDM us or call (862) 419-1763 to apply!',
      cta: 'Apply Now',
    },
    targetAudience: 'Real estate agents, property managers, contractors 30-55',
    estimatedBudget: '$20-40 per day',
  },
  {
    id: 'referral-partnership-google-business',
    name: 'Referral Partner Program Post',
    category: 'partnerships',
    platform: 'google-business',
    adType: 'Google Business Post',
    content: {
      headline: 'Become a Referral Partner – Earn on Every Project',
      body: '💼 Referral Partner Opportunity\n\nDo you work in real estate, property management, construction, or hospitality?\n\nJoin our referral partner network and earn commissions on every HVAC project you refer.\n\nWhat we offer:\n• Competitive referral commissions\n• Optional direct sales for higher earnings\n• Marketing materials and support\n• No upfront investment required\n• Flexible schedule\n\nWe serve 15 counties across New Jersey and have completed projects for 4,000+ residential and 2.6M sq ft of commercial space.\n\nCall (862) 419-1763 or email sales@mechanicalenterprise.com to apply.',
      cta: 'Apply Now',
    },
    targetAudience: 'Real estate agents, property managers, contractors in New Jersey',
    estimatedBudget: 'Free (Google Business)',
  },
];

export const platformLinks = {
  'google-search': 'https://ads.google.com/aw/campaigns',
  'google-business': 'https://business.google.com/dashboard',
  'facebook': 'https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327',
  'instagram': 'https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327',
  'youtube': 'https://studio.youtube.com',
};

export const platformInstructions = {
  'google-search': {
    title: 'Google Search Ads Setup',
    steps: [
      'Sign in to Google Ads (Account: 332-572-0049)',
      'Click "+ New Campaign"',
      'Select "Search" campaign type',
      'Choose "Website traffic" or "Leads" goal',
      'Set location targeting to 33-mile radius from Newark, New Jersey',
      'Copy the headline and description from template',
      'Add call extensions with (862) 419-1763',
      'Set daily budget and launch campaign',
    ],
  },
  'google-business': {
    title: 'Google Business Profile Post',
    steps: [
      'Sign in to Google Business Profile',
      'Select your business location',
      'Click "Add update" or "Create post"',
      'Choose post type (Offer, Event, or Update)',
      'Copy the content from template',
      'Add relevant photos of your work',
      'Click "Publish"',
    ],
  },
  'facebook': {
    title: 'Facebook Ad Creation',
    steps: [
      'Open Meta Ads Manager (Business ID: 25087499474212997)',
      'Click "Create" to start new campaign',
      'Choose campaign objective (Leads, Traffic, or Engagement)',
      'Set audience targeting to 33-mile radius',
      'Copy primary text, headline, and description from template',
      'Upload relevant images or videos',
      'Set budget and schedule',
      'Review and publish',
    ],
  },
  'instagram': {
    title: 'Instagram Content Posting',
    steps: [
      'Open Meta Business Suite (IG Asset ID: 844109052114327)',
      'Select Instagram account',
      'Click "Create post" or "Create story"',
      'Upload image or video content',
      'Copy caption from template',
      'Add relevant hashtags (#HVAC #Newark #NewJersey)',
      'Schedule or publish immediately',
    ],
  },
  'youtube': {
    title: 'YouTube Video Ad Setup',
    steps: [
      'Sign in to Google Ads',
      'Create new Video campaign',
      'Choose campaign subtype (In-stream, Bumper, etc.)',
      'Upload your video to YouTube first',
      'Set targeting to 33-mile radius from Newark',
      'Copy headline and description from template',
      'Set budget and bidding strategy',
      'Launch campaign',
    ],
  },
};
