/**
 * Stripe Products Configuration
 * Define all products and prices for courses and subscriptions
 */

export const STRIPE_PRODUCTS = {
  // Courses (one-time purchases)
  courses: {
    epa608_type_i: {
      name: 'EPA 608 Type I Certification',
      description: 'Comprehensive training for small appliance refrigerant handling',
      price: 7900, // $79.00 in cents
      currency: 'usd',
    },
    epa608_universal: {
      name: 'EPA 608 Universal Certification',
      description: 'Complete EPA 608 certification covering all refrigerant types',
      price: 12900, // $129.00
      currency: 'usd',
    },
    nate_core: {
      name: 'NATE Core Exam Prep',
      description: 'Master the fundamentals for NATE Core certification',
      price: 9900, // $99.00
      currency: 'usd',
    },
    hvac_fundamentals: {
      name: 'HVAC Fundamentals for Beginners',
      description: 'Start your HVAC journey with comprehensive basics',
      price: 4900, // $49.00
      currency: 'usd',
    },
    commercial_hvac: {
      name: 'Commercial HVAC Systems',
      description: 'Advanced training in commercial-scale HVAC systems',
      price: 24900, // $249.00
      currency: 'usd',
    },
    heat_pump_specialist: {
      name: 'Heat Pump Installation & Troubleshooting',
      description: 'Master heat pump systems and advanced diagnostics',
      price: 14900, // $149.00
      currency: 'usd',
    },
  },

  // Subscriptions (recurring)
  subscriptions: {
    starter: {
      name: 'Starter Plan',
      description: 'Access to 5 courses per month',
      price: 2900, // $29.00 per month
      currency: 'usd',
      interval: 'month',
      features: ['Access to 5 courses', 'Email support', 'Certificate of completion', 'Lifetime access'],
    },
    professional: {
      name: 'Professional Plan',
      description: 'Unlimited access to all courses',
      price: 4900, // $49.00 per month
      currency: 'usd',
      interval: 'month',
      features: [
        'Access to all courses',
        'Chat support',
        'Exam preparation materials',
        'Certificate of completion',
        'Lifetime access',
        'Monthly webinars',
      ],
    },
    premium: {
      name: 'Premium Plan',
      description: 'Premium access with mentoring and job placement',
      price: 7900, // $79.00 per month
      currency: 'usd',
      interval: 'month',
      features: [
        'Access to all courses',
        'Priority phone & chat support',
        'Live mentoring sessions',
        'Exam preparation & guarantee',
        'Certificate of completion',
        'Lifetime access',
        'Monthly webinars',
        'Job placement assistance',
      ],
    },
  },
};

/**
 * Helper function to get course price in dollars
 */
export function getCoursePriceInDollars(courseKey: keyof typeof STRIPE_PRODUCTS.courses): number {
  return STRIPE_PRODUCTS.courses[courseKey].price / 100;
}

/**
 * Helper function to get subscription price in dollars
 */
export function getSubscriptionPriceInDollars(
  subscriptionKey: keyof typeof STRIPE_PRODUCTS.subscriptions
): number {
  return STRIPE_PRODUCTS.subscriptions[subscriptionKey].price / 100;
}
