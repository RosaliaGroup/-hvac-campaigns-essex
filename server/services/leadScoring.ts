/**
 * Lead Scoring Service
 * 
 * Intelligent scoring system that prioritizes leads based on:
 * - Interaction frequency and recency
 * - Engagement quality (call duration, message sentiment, etc.)
 * - Service interest (high-value services score higher)
 * - Timeline urgency
 * - Budget indicators
 */

export interface ScoreBreakdown {
  callScore: number;
  smsScore: number;
  socialScore: number;
  websiteScore: number;
  recencyBonus: number;
  serviceBonus: number;
  budgetBonus: number;
  timelineBonus: number;
  total: number;
}

export interface LeadScoringData {
  // Call data
  totalCalls?: number;
  inboundCalls?: number;
  outboundCalls?: number;
  avgCallDuration?: number; // seconds
  lastCallAt?: Date;
  callQuality?: 'hot' | 'warm' | 'cold';
  
  // SMS data
  totalSms?: number;
  inboundSms?: number;
  outboundSms?: number;
  lastSmsAt?: Date;
  smsResponseRate?: number; // 0-1
  
  // Social media data
  socialInteractions?: number;
  socialSentiment?: 'positive' | 'neutral' | 'negative';
  lastSocialAt?: Date;
  
  // Website data
  websiteVisits?: number;
  formSubmissions?: number;
  lastWebsiteAt?: Date;
  
  // Lead details
  serviceType?: string;
  budget?: string;
  timeline?: string;
  leadAge?: number; // days since first contact
}

/**
 * Calculate comprehensive lead score
 */
export function calculateLeadScore(data: LeadScoringData): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    callScore: 0,
    smsScore: 0,
    socialScore: 0,
    websiteScore: 0,
    recencyBonus: 0,
    serviceBonus: 0,
    budgetBonus: 0,
    timelineBonus: 0,
    total: 0,
  };

  // === CALL SCORING (Max 40 points) ===
  if (data.totalCalls) {
    // Base points for calls
    breakdown.callScore += Math.min(data.totalCalls * 5, 20); // 5 pts per call, max 20
    
    // Inbound calls are more valuable (shows initiative)
    if (data.inboundCalls) {
      breakdown.callScore += Math.min(data.inboundCalls * 3, 10); // 3 pts per inbound, max 10
    }
    
    // Call duration indicates engagement
    if (data.avgCallDuration) {
      if (data.avgCallDuration > 300) breakdown.callScore += 10; // 5+ min call
      else if (data.avgCallDuration > 180) breakdown.callScore += 5; // 3+ min call
      else if (data.avgCallDuration > 60) breakdown.callScore += 2; // 1+ min call
    }
    
    // Call quality from AI assessment
    if (data.callQuality === 'hot') breakdown.callScore += 15;
    else if (data.callQuality === 'warm') breakdown.callScore += 8;
    else if (data.callQuality === 'cold') breakdown.callScore += 3;
  }

  // === SMS SCORING (Max 30 points) ===
  if (data.totalSms) {
    // Base points for SMS engagement
    breakdown.smsScore += Math.min(data.totalSms * 3, 15); // 3 pts per SMS, max 15
    
    // Inbound SMS shows interest
    if (data.inboundSms) {
      breakdown.smsScore += Math.min(data.inboundSms * 2, 10); // 2 pts per inbound, max 10
    }
    
    // Response rate indicates engagement
    if (data.smsResponseRate) {
      if (data.smsResponseRate > 0.8) breakdown.smsScore += 5; // 80%+ response rate
      else if (data.smsResponseRate > 0.5) breakdown.smsScore += 3; // 50%+ response rate
      else if (data.smsResponseRate > 0.3) breakdown.smsScore += 1; // 30%+ response rate
    }
  }

  // === SOCIAL MEDIA SCORING (Max 20 points) ===
  if (data.socialInteractions) {
    // Base points for social engagement
    breakdown.socialScore += Math.min(data.socialInteractions * 2, 10); // 2 pts per interaction, max 10
    
    // Sentiment analysis
    if (data.socialSentiment === 'positive') breakdown.socialScore += 10;
    else if (data.socialSentiment === 'neutral') breakdown.socialScore += 5;
    else if (data.socialSentiment === 'negative') breakdown.socialScore += 2; // Still engaged
  }

  // === WEBSITE SCORING (Max 20 points) ===
  if (data.websiteVisits) {
    breakdown.websiteScore += Math.min(data.websiteVisits * 2, 10); // 2 pts per visit, max 10
  }
  if (data.formSubmissions) {
    breakdown.websiteScore += Math.min(data.formSubmissions * 5, 10); // 5 pts per form, max 10
  }

  // === RECENCY BONUS (Max 20 points) ===
  // Recent interactions are more valuable
  const now = new Date();
  const recentDates = [data.lastCallAt, data.lastSmsAt, data.lastSocialAt, data.lastWebsiteAt]
    .filter(d => d !== undefined) as Date[];
  
  if (recentDates.length > 0) {
    const mostRecent = new Date(Math.max(...recentDates.map(d => d.getTime())));
    const hoursSince = (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60);
    
    if (hoursSince < 24) breakdown.recencyBonus = 20; // Within 24 hours
    else if (hoursSince < 72) breakdown.recencyBonus = 15; // Within 3 days
    else if (hoursSince < 168) breakdown.recencyBonus = 10; // Within 1 week
    else if (hoursSince < 336) breakdown.recencyBonus = 5; // Within 2 weeks
  }

  // === SERVICE TYPE BONUS (Max 15 points) ===
  // High-value services get priority
  if (data.serviceType) {
    const service = data.serviceType.toLowerCase();
    if (service.includes('vrf') || service.includes('vrv')) {
      breakdown.serviceBonus = 15; // VRF/VRV systems are high-value
    } else if (service.includes('commercial') || service.includes('industrial')) {
      breakdown.serviceBonus = 12; // Commercial projects
    } else if (service.includes('installation') || service.includes('new system')) {
      breakdown.serviceBonus = 10; // New installations
    } else if (service.includes('replacement')) {
      breakdown.serviceBonus = 8; // System replacements
    } else if (service.includes('maintenance') || service.includes('repair')) {
      breakdown.serviceBonus = 5; // Maintenance/repair
    }
  }

  // === BUDGET BONUS (Max 10 points) ===
  if (data.budget) {
    const budget = data.budget.toLowerCase();
    if (budget.includes('50k+') || budget.includes('50000+') || budget.includes('no limit')) {
      breakdown.budgetBonus = 10;
    } else if (budget.includes('25k') || budget.includes('25000')) {
      breakdown.budgetBonus = 7;
    } else if (budget.includes('10k') || budget.includes('10000')) {
      breakdown.budgetBonus = 5;
    } else if (budget.includes('5k') || budget.includes('5000')) {
      breakdown.budgetBonus = 3;
    }
  }

  // === TIMELINE BONUS (Max 10 points) ===
  if (data.timeline) {
    const timeline = data.timeline.toLowerCase();
    if (timeline.includes('immediate') || timeline.includes('asap') || timeline.includes('urgent')) {
      breakdown.timelineBonus = 10;
    } else if (timeline.includes('1 week') || timeline.includes('this week')) {
      breakdown.timelineBonus = 8;
    } else if (timeline.includes('2 week') || timeline.includes('this month')) {
      breakdown.timelineBonus = 6;
    } else if (timeline.includes('1 month') || timeline.includes('30 days')) {
      breakdown.timelineBonus = 4;
    } else if (timeline.includes('3 month') || timeline.includes('quarter')) {
      breakdown.timelineBonus = 2;
    }
  }

  // === CALCULATE TOTAL ===
  breakdown.total = 
    breakdown.callScore +
    breakdown.smsScore +
    breakdown.socialScore +
    breakdown.websiteScore +
    breakdown.recencyBonus +
    breakdown.serviceBonus +
    breakdown.budgetBonus +
    breakdown.timelineBonus;

  return breakdown;
}

/**
 * Determine lead priority based on score
 */
export function calculatePriority(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 80) return 'hot';    // 80+ points = Hot lead
  if (score >= 40) return 'warm';   // 40-79 points = Warm lead
  return 'cold';                     // 0-39 points = Cold lead
}

/**
 * Get score color for UI display
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

/**
 * Get priority badge color
 */
export function getPriorityColor(priority: 'hot' | 'warm' | 'cold'): string {
  switch (priority) {
    case 'hot': return '#22c55e';
    case 'warm': return '#f97316';
    case 'cold': return '#3b82f6';
  }
}

/**
 * Calculate score change percentage
 */
export function calculateScoreChange(currentScore: number, previousScore: number): number {
  if (previousScore === 0) return 100;
  return Math.round(((currentScore - previousScore) / previousScore) * 100);
}
