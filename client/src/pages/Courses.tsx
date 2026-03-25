import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Award, Clock, Users, Star, Check } from 'lucide-react';
import { useLocation } from 'wouter';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_hours: number;
  price_per_course: number;
  certification_type: string;
  instructor_name: string;
  rating?: number;
  students?: number;
  image_url?: string;
}

interface SubscriptionPlan {
  name: string;
  price: number;
  courses: number;
  features: string[];
  highlighted?: boolean;
}

const COURSES: Course[] = [
  {
    id: '1',
    title: 'EPA 608 Type I Certification',
    description: 'Comprehensive training for small appliance refrigerant handling and certification.',
    category: 'epa_608',
    difficulty: 'beginner',
    duration_hours: 12,
    price_per_course: 79,
    certification_type: 'EPA 608 Type I',
    instructor_name: 'John Martinez',
    rating: 4.8,
    students: 1250,
  },
  {
    id: '2',
    title: 'EPA 608 Universal Certification',
    description: 'Complete EPA 608 certification covering all refrigerant types and system sizes.',
    category: 'epa_608',
    difficulty: 'intermediate',
    duration_hours: 24,
    price_per_course: 129,
    certification_type: 'EPA 608 Universal',
    instructor_name: 'Sarah Johnson',
    rating: 4.9,
    students: 2100,
  },
  {
    id: '3',
    title: 'NATE Core Exam Prep',
    description: 'Master the fundamentals needed to pass the NATE Core certification exam.',
    category: 'nate',
    difficulty: 'intermediate',
    duration_hours: 20,
    price_per_course: 99,
    certification_type: 'NATE Core',
    instructor_name: 'Michael Chen',
    rating: 4.7,
    students: 890,
  },
  {
    id: '4',
    title: 'HVAC Fundamentals for Beginners',
    description: 'Start your HVAC journey with comprehensive basics and safety protocols.',
    category: 'fundamentals',
    difficulty: 'beginner',
    duration_hours: 16,
    price_per_course: 49,
    certification_type: 'Certificate of Completion',
    instructor_name: 'David Rodriguez',
    rating: 4.6,
    students: 3400,
  },
  {
    id: '5',
    title: 'Commercial HVAC Systems',
    description: 'Advanced training in commercial-scale HVAC installation and maintenance.',
    category: 'advanced',
    difficulty: 'advanced',
    duration_hours: 32,
    price_per_course: 249,
    certification_type: 'Commercial HVAC Specialist',
    instructor_name: 'Lisa Anderson',
    rating: 4.9,
    students: 450,
  },
  {
    id: '6',
    title: 'Heat Pump Installation & Troubleshooting',
    description: 'Master heat pump systems, installation techniques, and advanced diagnostics.',
    category: 'specialty',
    difficulty: 'intermediate',
    duration_hours: 18,
    price_per_course: 149,
    certification_type: 'Heat Pump Specialist',
    instructor_name: 'Robert Thompson',
    rating: 4.8,
    students: 680,
  },
];

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    name: 'Starter',
    price: 29,
    courses: 5,
    features: ['Access to 5 courses', 'Email support', 'Certificate of completion', 'Lifetime access'],
  },
  {
    name: 'Professional',
    price: 49,
    courses: 999, // unlimited
    features: [
      'Access to all courses',
      'Chat support',
      'Exam preparation materials',
      'Certificate of completion',
      'Lifetime access',
      'Monthly webinars',
    ],
    highlighted: true,
  },
  {
    name: 'Premium',
    price: 79,
    courses: 999, // unlimited
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
];

export default function Courses() {
  const [, setLocation] = useLocation();
  const [pricingMode, setPricingMode] = useState<'pay-per-course' | 'subscription'>('pay-per-course');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  const filteredCourses = COURSES.filter((course) => {
    const categoryMatch = selectedCategory === 'all' || course.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === 'all' || course.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-4">Professional HVAC Training & Certifications</h1>
            <p className="text-xl text-white/90 mb-8">
              Get industry-recognized credentials and advance your career with Mechanical Enterprise training programs.
            </p>
            <div className="flex gap-4">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                Browse Courses
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 text-white border-white hover:bg-white/20">
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Mode Toggle */}
      <section className="py-12 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4">
            <span className={pricingMode === 'pay-per-course' ? 'font-bold' : 'text-gray-600'}>Pay Per Course</span>
            <button
              onClick={() => setPricingMode(pricingMode === 'pay-per-course' ? 'subscription' : 'pay-per-course')}
              className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-300"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                  pricingMode === 'subscription' ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={pricingMode === 'subscription' ? 'font-bold' : 'text-gray-600'}>Monthly Subscription</span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {pricingMode === 'pay-per-course' ? (
            <>
              {/* Filters */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-6">Filter Courses</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold mb-3">Category</label>
                    <div className="flex flex-wrap gap-2">
                      {['all', 'epa_608', 'nate', 'fundamentals', 'advanced', 'specialty'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-lg font-medium transition ${
                            selectedCategory === cat
                              ? 'bg-[#ff6b35] text-white'
                              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          }`}
                        >
                          {cat === 'all' ? 'All' : cat.replace(/_/g, ' ').toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-3">Difficulty</label>
                    <div className="flex flex-wrap gap-2">
                      {['all', 'beginner', 'intermediate', 'advanced'].map((diff) => (
                        <button
                          key={diff}
                          onClick={() => setSelectedDifficulty(diff)}
                          className={`px-4 py-2 rounded-lg font-medium transition ${
                            selectedDifficulty === diff
                              ? 'bg-[#1e3a5f] text-white'
                              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          }`}
                        >
                          {diff === 'all' ? 'All Levels' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Courses Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <Card key={course.id} className="hover:shadow-lg transition">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={getDifficultyColor(course.difficulty)}>
                          {course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1)}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-semibold">{course.rating}</span>
                        </div>
                      </div>
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                      <CardDescription>{course.certification_type}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600">{course.description}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>{course.duration_hours} hours</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <span>{course.students?.toLocaleString()} students</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-gray-500" />
                          <span>Instructor: {course.instructor_name}</span>
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl font-bold text-[#ff6b35]">${course.price_per_course}</span>
                          <span className="text-sm text-gray-500">one-time</span>
                        </div>
                        <Button 
                          onClick={() => setLocation(`/courses/${course.id}`)}
                          className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90"
                        >
                          View Course
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Subscription Plans */}
              <h2 className="text-3xl font-bold text-center mb-12">Choose Your Plan</h2>
              <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <Card
                    key={plan.name}
                    className={`relative transition ${
                      plan.highlighted ? 'ring-2 ring-[#ff6b35] shadow-xl' : ''
                    }`}
                  >
                    {plan.highlighted && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-[#ff6b35] text-white">MOST POPULAR</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">${plan.price}</span>
                        <span className="text-gray-600">/month</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <p className="text-sm text-gray-600">
                        {plan.courses === 999 ? 'Unlimited courses' : `Up to ${plan.courses} courses`}
                      </p>
                      <ul className="space-y-3">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={`w-full ${
                          plan.highlighted
                            ? 'bg-[#ff6b35] hover:bg-[#ff6b35]/90'
                            : 'bg-[#1e3a5f] hover:bg-[#1e3a5f]/90'
                        }`}
                      >
                        Start {plan.name} Plan
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">What Our Students Say</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'James Wilson',
                role: 'HVAC Technician',
                text: 'I passed my EPA 608 exam on the first try! The course material was clear and comprehensive.',
              },
              {
                name: 'Maria Garcia',
                role: 'Lead Technician',
                text: 'This training helped me advance to lead technician. Highly recommended for anyone serious about their career.',
              },
              {
                name: 'Robert Chen',
                role: 'Business Owner',
                text: 'I enrolled my entire team. The courses are flexible and the certification recognition is excellent.',
              },
            ].map((testimonial, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Start Your Training?</h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of HVAC professionals who have advanced their careers with Mechanical Enterprise certifications.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
              Browse All Courses
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 text-white border-white hover:bg-white/20">
              Schedule Consultation
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
