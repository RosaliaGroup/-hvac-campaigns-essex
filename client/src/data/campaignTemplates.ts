export interface CampaignTemplate {
  id: string;
  name: string;
  category: 'emergency' | 'installation' | 'maintenance' | 'rebates' | 'partnerships';
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
  // Emergency HVAC Repair - Google Search
  {
    id: 'emergency-ac-repair-google',
    name: '24/7 Emergency AC Repair',
    category: 'emergency',
    platform: 'google-search',
    adType: 'Search Ad',
    content: {
      headline: '24/7 Emergency AC Repair Newark',
      headline2: 'Same-Day Service | Licensed Techs',
      headline3: 'Call Now (862) 423-9396',
      description: 'AC broken? We\'re available 24/7 for emergency repairs across Essex County. Licensed technicians, transparent pricing, same-day service.',
      description2: 'WMBE certified. Serving 15 NJ counties. Call (862) 423-9396 for immediate assistance.',
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
      description2: 'Transparent pricing. WMBE certified business. Call (862) 423-9396 now.',
    },
    targetAudience: 'Homeowners with heating emergencies, winter season',
    estimatedBudget: '$50-100 per day',
  },

  // Heat Pump Installation - Google Search
  {
    id: 'heat-pump-installation-google',
    name: 'Heat Pump Installation with Rebates',
    category: 'installation',
    platform: 'google-search',
    adType: 'Search Ad',
    content: {
      headline: 'Heat Pump Installation Newark NJ',
      headline2: 'Up to $10,000 in Rebates Available',
      headline3: '30% Federal Tax Credit | Free Quote',
      description: 'Save big with NJ Clean Energy rebates + federal tax credits. Expert heat pump installation. VRF/VRV specialists. Get your free quote today.',
      description2: 'WMBE certified. 20+ years experience. We handle all rebate paperwork.',
    },
    targetAudience: 'Homeowners researching energy-efficient upgrades',
    estimatedBudget: '$75-150 per day',
  },

  // Maintenance Subscription - Facebook
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

  // Decarbonization Program - Facebook
  {
    id: 'decarbonization-rebates-facebook',
    name: 'Heat Pump Rebates Campaign',
    category: 'rebates',
    platform: 'facebook',
    adType: 'Conversion Ad',
    content: {
      primaryText: '💰 Get up to $10,000 in rebates for upgrading to a heat pump!\n\nNew Jersey homeowners can save big with:\n• Up to $10,000 in NJ Clean Energy rebates\n• 30% federal tax credit (IRA)\n• Zero-interest financing options\n• 30-50% lower energy bills\n\nWe\'re VRF/VRV heat pump specialists and handle ALL rebate paperwork for you.\n\n**Free consultation to calculate your exact savings →**',
      headline: 'Up to $10K in HVAC Rebates',
      description: 'Heat pump installation | We handle paperwork | Free consultation',
      cta: 'Learn More',
    },
    targetAudience: 'Homeowners 45-70, interested in sustainability',
    estimatedBudget: '$40-80 per day',
  },

  // Partnership Recruitment - Facebook
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

  // Google Business Post - Seasonal
  {
    id: 'summer-ac-tune-up-google-business',
    name: 'Summer AC Tune-Up Special',
    category: 'maintenance',
    platform: 'google-business',
    adType: 'Google Business Post',
    content: {
      headline: 'Prepare Your AC for Summer',
      body: 'Don\'t wait for your AC to break during the first heat wave! ☀️\n\nOur pre-season maintenance includes:\n✓ Full system inspection\n✓ Filter replacement\n✓ Refrigerant check\n✓ Performance optimization\n\n**First-time customers: First month of maintenance subscription FREE!**\n\nCall (862) 423-9396 to schedule your tune-up today!',
      cta: 'Call Now',
    },
    targetAudience: 'Local homeowners in service area',
    estimatedBudget: 'Free (Google Business)',
  },

  // Instagram Story - Brand Awareness
  {
    id: 'emergency-service-instagram-story',
    name: 'Emergency Service Story',
    category: 'emergency',
    platform: 'instagram',
    adType: 'Story Ad',
    content: {
      headline: 'AC Broken? 🥵',
      body: '24/7 Emergency Service\nCall (862) 423-9396',
      cta: 'Swipe Up',
    },
    targetAudience: 'Local homeowners 25-55',
    estimatedBudget: '$15-30 per day',
  },

  // YouTube Video Ad
  {
    id: 'decarbonization-youtube-30s',
    name: 'Decarbonization Program Explainer',
    category: 'rebates',
    platform: 'youtube',
    adType: 'In-Stream Video Ad (30s)',
    content: {
      headline: 'Up to $10,000 in HVAC Rebates',
      description: 'New Jersey homeowners: Did you know you can get up to $10,000 in rebates for upgrading your HVAC system? Heat pumps are energy-efficient, lower your bills by up to 50%, and qualify for massive state and federal incentives. Mechanical Enterprise handles all the paperwork. Get your free rebate consultation today.',
      cta: 'Learn More',
    },
    targetAudience: 'Homeowners 35-65 in service area',
    estimatedBudget: '$40-80 per day',
  },

  // Google Business Post - Rebate Update
  {
    id: 'rebate-deadline-google-business',
    name: '2026 Rebate Funds Limited',
    category: 'rebates',
    platform: 'google-business',
    adType: 'Google Business Post',
    content: {
      headline: '2026 HVAC Rebates - Apply Early!',
      body: '⚠️ 2026 Rebate Funds Limited - Apply Early\n\nNJ homeowners can still access:\n💰 Up to $10,000 in state rebates\n💰 30% federal tax credit\n💰 Zero-interest financing\n\nWe handle all paperwork and maximize your savings. Our VRF/VRV specialists have helped hundreds of families upgrade to energy-efficient heat pumps.\n\nDon\'t miss out - rebate funds are allocated first-come, first-served!\n\nCall (862) 423-9396 for your free consultation.',
      cta: 'Get Quote',
    },
    targetAudience: 'Local homeowners in service area',
    estimatedBudget: 'Free (Google Business)',
  },
];

export const platformLinks = {
  'google-search': 'https://ads.google.com',
  'google-business': 'https://business.google.com',
  'facebook': 'https://business.facebook.com',
  'instagram': 'https://business.facebook.com/instagram',
  'youtube': 'https://studio.youtube.com',
};

export const platformInstructions = {
  'google-search': {
    title: 'Google Search Ads Setup',
    steps: [
      'Sign in to Google Ads',
      'Click "+ New Campaign"',
      'Select "Search" campaign type',
      'Choose "Website traffic" or "Leads" goal',
      'Set location targeting to 33-mile radius from Newark, NJ',
      'Copy the headline and description from template',
      'Add call extensions with (862) 423-9396',
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
      'Open Meta Ads Manager',
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
      'Open Meta Business Suite',
      'Select Instagram account',
      'Click "Create post" or "Create story"',
      'Upload image or video content',
      'Copy caption from template',
      'Add relevant hashtags (#HVAC #Newark #NJ)',
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
