import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Clock, Users, Award, BookOpen, CheckCircle, Star } from 'lucide-react';

interface CourseModule {
  title: string;
  duration: string;
  topics: string[];
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_hours: number;
  instructor_name: string;
  instructor_bio: string;
  rating: number;
  students: number;
  certification_type: string;
  difficulty: string;
  modules: CourseModule[];
  learning_objectives: string[];
  prerequisites?: string[];
  career_outcomes?: string[];
}

const COURSE_DATA: Record<string, CourseData> = {
  '1': {
    id: '1',
    title: 'EPA 608 Type I Certification',
    description: 'Pass your EPA 608 exam on the first try with comprehensive refrigerant handling training.',
    price: 79,
    duration_hours: 12,
    instructor_name: 'John Martinez',
    instructor_bio: 'EPA 608 Universal Certified, NATE Certified, 18+ years HVAC experience, specializing in refrigerant handling and safety protocols.',
    rating: 4.8,
    students: 1250,
    certification_type: 'EPA 608 Type I',
    difficulty: 'Beginner',
    modules: [
      {
        title: 'EPA 608 Fundamentals',
        duration: '2 hours',
        topics: [
          'EPA regulations and compliance requirements',
          'Refrigerant types and properties',
          'Environmental impact of CFCs and HCFCs',
          'Recovery, recycling, and reclamation procedures',
          'Safety protocols and equipment'
        ]
      },
      {
        title: 'Type I Systems (Small Appliances)',
        duration: '3 hours',
        topics: [
          'Small appliance refrigeration systems',
          'Refrigerant handling for Type I',
          'Evacuation and charging procedures',
          'Leak detection methods',
          'Common problems and solutions'
        ]
      },
      {
        title: 'Exam Preparation & Practice',
        duration: '4 hours',
        topics: [
          '100+ practice questions',
          'Real exam scenarios',
          'Time management strategies',
          'Common mistakes to avoid',
          'Final review and confidence building'
        ]
      },
      {
        title: 'Practical Demonstrations',
        duration: '3 hours',
        topics: [
          'Live equipment demonstrations',
          'Recovery equipment operation',
          'Proper evacuation techniques',
          'Hands-on practice with simulators',
          'Troubleshooting exercises'
        ]
      }
    ],
    learning_objectives: [
      'Understand EPA regulations and compliance requirements for Type I systems',
      'Properly handle, recover, and recycle refrigerants',
      'Perform safe evacuation and charging procedures',
      'Identify and fix common refrigerant leaks',
      'Pass the EPA 608 Type I certification exam with confidence'
    ],
    prerequisites: ['High school diploma or equivalent', 'Basic understanding of HVAC systems recommended'],
    career_outcomes: [
      'EPA 608 Type I Certification (required for refrigerant handling)',
      'Increased job opportunities in HVAC industry',
      'Potential salary increase of $2,000-$5,000 annually',
      'Foundation for advanced certifications'
    ]
  },
  '2': {
    id: '2',
    title: 'EPA 608 Universal Certification',
    description: 'Complete EPA 608 certification covering all refrigerant types and system sizes.',
    price: 129,
    duration_hours: 24,
    instructor_name: 'Sarah Johnson',
    instructor_bio: 'EPA 608 Universal Certified, NATE Certified (Core, Installation, Service), 16+ years HVAC experience, trainer for major HVAC manufacturers.',
    rating: 4.9,
    students: 2100,
    certification_type: 'EPA 608 Universal',
    difficulty: 'Intermediate',
    modules: [
      {
        title: 'EPA 608 Core Requirements',
        duration: '3 hours',
        topics: [
          'EPA regulations and compliance',
          'Refrigerant properties and classifications',
          'Environmental regulations (Clean Air Act)',
          'Certification requirements and exam overview'
        ]
      },
      {
        title: 'Type I: Small Appliances',
        duration: '3 hours',
        topics: [
          'Small appliance systems and components',
          'Type I refrigerant handling',
          'Recovery and recycling procedures',
          'Leak detection and repair'
        ]
      },
      {
        title: 'Type II: High-Pressure Appliances',
        duration: '4 hours',
        topics: [
          'High-pressure system components',
          'Refrigerant types for Type II systems',
          'Evacuation procedures for high-pressure systems',
          'Charging and pressure testing',
          'Safety considerations'
        ]
      },
      {
        title: 'Type III: Low-Pressure Systems',
        duration: '4 hours',
        topics: [
          'Low-pressure system design and operation',
          'Centrifugal compressors',
          'Purge units and oil management',
          'Evacuation of low-pressure systems',
          'Charging procedures'
        ]
      },
      {
        title: 'Exam Preparation',
        duration: '5 hours',
        topics: [
          '200+ comprehensive practice questions',
          'All exam topics covered',
          'Timed practice exams',
          'Detailed explanations for each answer',
          'Exam day strategies'
        ]
      },
      {
        title: 'Hands-On Lab & Demonstrations',
        duration: '5 hours',
        topics: [
          'Equipment operation demonstrations',
          'Recovery and recycling equipment',
          'Evacuation and charging procedures',
          'Practical troubleshooting',
          'Safety equipment and procedures'
        ]
      }
    ],
    learning_objectives: [
      'Master EPA 608 regulations for all system types',
      'Understand refrigerant properties and environmental impact',
      'Perform proper recovery, recycling, and reclamation',
      'Handle all three types of refrigerant systems safely',
      'Pass EPA 608 Universal certification exam',
      'Become a certified refrigerant handler'
    ],
    prerequisites: ['High school diploma or equivalent', 'Basic HVAC knowledge recommended'],
    career_outcomes: [
      'EPA 608 Universal Certification (highest level)',
      'Ability to work on all refrigerant systems',
      'Increased earning potential ($5,000-$10,000 annually)',
      'Career advancement opportunities',
      'Foundation for NATE and other certifications'
    ]
  },
  '3': {
    id: '3',
    title: 'NATE Core Exam Prep',
    description: 'Master the fundamentals needed to pass the NATE Core certification exam.',
    price: 99,
    duration_hours: 20,
    instructor_name: 'Michael Chen',
    instructor_bio: 'NATE Certified (Core, Installation, Service), 15+ years HVAC experience, HVAC instructor at technical college, specializing in exam preparation.',
    rating: 4.7,
    students: 890,
    certification_type: 'NATE Core',
    difficulty: 'Intermediate',
    modules: [
      {
        title: 'HVAC System Fundamentals',
        duration: '3 hours',
        topics: [
          'Heating and cooling cycles',
          'Refrigerant properties and behavior',
          'Pressure and temperature relationships',
          'System components and their functions',
          'Thermodynamic principles'
        ]
      },
      {
        title: 'Electrical Fundamentals',
        duration: '3 hours',
        topics: [
          'Basic electrical theory',
          'Circuits and components',
          'Voltage, amperage, and resistance',
          'Wiring and safety',
          'Troubleshooting electrical problems'
        ]
      },
      {
        title: 'Tools and Equipment',
        duration: '2 hours',
        topics: [
          'Refrigerant gauges and manifolds',
          'Vacuum pumps and evacuation',
          'Charging equipment',
          'Leak detection tools',
          'Safety equipment'
        ]
      },
      {
        title: 'Installation and Commissioning',
        duration: '3 hours',
        topics: [
          'System sizing and selection',
          'Proper installation procedures',
          'Evacuation and charging',
          'Performance verification',
          'Startup and commissioning'
        ]
      },
      {
        title: 'Maintenance and Service',
        duration: '3 hours',
        topics: [
          'Preventive maintenance procedures',
          'Troubleshooting methodology',
          'Common problems and solutions',
          'Service documentation',
          'Customer communication'
        ]
      },
      {
        title: 'Exam Preparation & Practice',
        duration: '6 hours',
        topics: [
          '150+ practice questions',
          'Real exam format and timing',
          'Detailed answer explanations',
          'Weak area identification and review',
          'Confidence building exercises'
        ]
      }
    ],
    learning_objectives: [
      'Understand HVAC system operation and thermodynamics',
      'Master electrical fundamentals for HVAC systems',
      'Properly use HVAC tools and equipment',
      'Perform correct installation and commissioning',
      'Execute effective maintenance and service',
      'Pass NATE Core certification exam'
    ],
    prerequisites: ['EPA 608 certification recommended', '2+ years HVAC experience'],
    career_outcomes: [
      'NATE Core Certification',
      'Enhanced credibility with customers and employers',
      'Salary increase of $3,000-$7,000 annually',
      'Foundation for NATE specialty certifications',
      'Career advancement to lead or supervisor roles'
    ]
  },
  '4': {
    id: '4',
    title: 'HVAC Fundamentals for Beginners',
    description: 'Start your HVAC journey with comprehensive basics and safety protocols.',
    price: 49,
    duration_hours: 16,
    instructor_name: 'David Rodriguez',
    instructor_bio: 'EPA 608 Certified, 12+ years HVAC experience, vocational trainer, specializing in entry-level HVAC education and career guidance.',
    rating: 4.6,
    students: 3400,
    certification_type: 'Certificate of Completion',
    difficulty: 'Beginner',
    modules: [
      {
        title: 'HVAC Career Overview',
        duration: '2 hours',
        topics: [
          'HVAC industry overview',
          'Career paths and opportunities',
          'Job roles and responsibilities',
          'Salary and benefits',
          'Education and certification requirements'
        ]
      },
      {
        title: 'Safety Fundamentals',
        duration: '2 hours',
        topics: [
          'Workplace safety principles',
          'Personal protective equipment (PPE)',
          'Hazard identification',
          'Emergency procedures',
          'OSHA regulations'
        ]
      },
      {
        title: 'HVAC System Basics',
        duration: '3 hours',
        topics: [
          'Heating systems (furnace, heat pump, boiler)',
          'Cooling systems (air conditioner, heat pump)',
          'Ventilation and air quality',
          'System components and their functions',
          'How systems work together'
        ]
      },
      {
        title: 'Tools and Equipment Introduction',
        duration: '2 hours',
        topics: [
          'Basic hand tools',
          'Power tools and safety',
          'Diagnostic equipment',
          'Proper tool usage and maintenance',
          'Tool safety practices'
        ]
      },
      {
        title: 'Basic Troubleshooting',
        duration: '3 hours',
        topics: [
          'Troubleshooting methodology',
          'Common problems and solutions',
          'When to call for help',
          'Customer communication',
          'Documentation and reporting'
        ]
      },
      {
        title: 'Next Steps in Your HVAC Career',
        duration: '2 hours',
        topics: [
          'EPA 608 certification path',
          'NATE certification overview',
          'Continuing education',
          'Specialization opportunities',
          'Career advancement planning'
        ]
      }
    ],
    learning_objectives: [
      'Understand HVAC industry and career opportunities',
      'Learn and apply workplace safety principles',
      'Understand basic HVAC system operation',
      'Use basic HVAC tools safely and effectively',
      'Apply troubleshooting methodology',
      'Plan your HVAC career path'
    ],
    prerequisites: ['High school diploma or equivalent', 'Interest in HVAC careers'],
    career_outcomes: [
      'Foundation for HVAC career',
      'Eligibility for apprenticeship programs',
      'Understanding of career requirements',
      'Preparation for EPA 608 certification',
      'Entry-level job readiness'
    ]
  },
  '5': {
    id: '5',
    title: 'Commercial HVAC Systems',
    description: 'Advanced training in commercial-scale HVAC installation and maintenance.',
    price: 249,
    duration_hours: 32,
    instructor_name: 'Lisa Anderson',
    instructor_bio: 'EPA 608 Universal Certified, NATE Certified (Core, Installation, Service), 20+ years commercial HVAC experience, project manager for large-scale installations.',
    rating: 4.9,
    students: 450,
    certification_type: 'Commercial HVAC Specialist',
    difficulty: 'Advanced',
    modules: [
      {
        title: 'Commercial HVAC Overview',
        duration: '2 hours',
        topics: [
          'Commercial vs. residential systems',
          'Commercial building types',
          'System requirements and codes',
          'Design considerations',
          'Energy efficiency standards'
        ]
      },
      {
        title: 'Rooftop Units (RTU)',
        duration: '4 hours',
        topics: [
          'RTU design and components',
          'Installation procedures',
          'Ductwork connections',
          'Commissioning and startup',
          'Maintenance and troubleshooting'
        ]
      },
      {
        title: 'Chilled Water Systems',
        duration: '4 hours',
        topics: [
          'Chiller types and operation',
          'Cooling towers',
          'Piping and water treatment',
          'System controls and optimization',
          'Maintenance procedures'
        ]
      },
      {
        title: 'Variable Air Volume (VAV) Systems',
        duration: '4 hours',
        topics: [
          'VAV box design and operation',
          'Ductwork and distribution',
          'Control systems and sensors',
          'Balancing and commissioning',
          'Troubleshooting VAV problems'
        ]
      },
      {
        title: 'Building Automation and Controls',
        duration: '4 hours',
        topics: [
          'BACnet and other protocols',
          'Control system programming',
          'Sensor types and installation',
          'Energy management systems',
          'Optimization strategies'
        ]
      },
      {
        title: 'Commercial Installation Project',
        duration: '6 hours',
        topics: [
          'Project planning and scheduling',
          'Equipment selection and sizing',
          'Installation procedures',
          'Quality assurance and testing',
          'Documentation and handover'
        ]
      },
      {
        title: 'Advanced Troubleshooting',
        duration: '4 hours',
        topics: [
          'Systematic troubleshooting approach',
          'Complex system diagnostics',
          'Performance optimization',
          'Energy audits',
          'Case studies and real-world problems'
        ]
      },
      {
        title: 'Commercial Codes and Standards',
        duration: '2 hours',
        topics: [
          'ASHRAE standards',
          'Building codes and regulations',
          'Energy codes (IECC)',
          'Compliance and documentation',
          'Inspection and certification'
        ]
      }
    ],
    learning_objectives: [
      'Understand commercial HVAC system design and operation',
      'Master rooftop unit installation and maintenance',
      'Understand chilled water system operation',
      'Implement VAV systems and controls',
      'Work with building automation systems',
      'Plan and execute commercial HVAC projects',
      'Troubleshoot complex commercial systems',
      'Comply with commercial codes and standards'
    ],
    prerequisites: ['EPA 608 certification required', 'NATE Core certification recommended', '5+ years HVAC experience'],
    career_outcomes: [
      'Commercial HVAC Specialist Certification',
      'Ability to work on large-scale projects',
      'Salary increase of $10,000-$20,000 annually',
      'Project management opportunities',
      'Consulting and design opportunities',
      'Career advancement to supervisor/manager roles'
    ]
  },
  '6': {
    id: '6',
    title: 'Heat Pump Installation & Troubleshooting',
    description: 'Master heat pump systems, installation techniques, and advanced diagnostics.',
    price: 149,
    duration_hours: 18,
    instructor_name: 'Emily Thompson',
    instructor_bio: 'EPA 608 Universal Certified, NATE Certified, 14+ years HVAC experience, geothermal specialist, heat pump training expert.',
    rating: 4.8,
    students: 680,
    certification_type: 'Heat Pump Specialist',
    difficulty: 'Advanced',
    modules: [
      {
        title: 'Heat Pump Fundamentals',
        duration: '2 hours',
        topics: [
          'Heat pump operation principles',
          'Heating and cooling cycles',
          'Heat pump types and applications',
          'Market demand and opportunities',
          'Efficiency advantages'
        ]
      },
      {
        title: 'Air-Source Heat Pump Systems',
        duration: '4 hours',
        topics: [
          'Air-source heat pump design',
          'System components and operation',
          'Heating and cooling operation',
          'Defrost cycle and backup heat',
          'Installation procedures',
          'Cold climate performance'
        ]
      },
      {
        title: 'Ground-Source (Geothermal) Systems',
        duration: '4 hours',
        topics: [
          'Geothermal fundamentals',
          'Ground loop types and installation',
          'Closed-loop and open-loop systems',
          'System operation and efficiency',
          'Installation procedures',
          'Maintenance and troubleshooting'
        ]
      },
      {
        title: 'Mini-Split Heat Pump Systems',
        duration: '2.5 hours',
        topics: [
          'Mini-split system design',
          'Ductless configurations',
          'Installation procedures',
          'Commissioning and startup',
          'Common problems and solutions'
        ]
      },
      {
        title: 'Heat Pump Troubleshooting',
        duration: '3 hours',
        topics: [
          'Heating and cooling problems',
          'Defrost cycle issues',
          'Refrigerant problems',
          'Electrical troubleshooting',
          'Performance optimization'
        ]
      },
      {
        title: 'Installation Best Practices',
        duration: '2 hours',
        topics: [
          'Pre-installation planning',
          'Equipment selection and sizing',
          'Proper installation procedures',
          'Startup and commissioning',
          'Customer education'
        ]
      }
    ],
    learning_objectives: [
      'Understand heat pump operation and advantages',
      'Master air-source heat pump installation',
      'Understand geothermal system design and installation',
      'Install and commission mini-split systems',
      'Troubleshoot heat pump problems effectively',
      'Optimize heat pump performance',
      'Become a heat pump specialist'
    ],
    prerequisites: ['EPA 608 certification required', '2+ years HVAC experience', 'NATE Core certification recommended'],
    career_outcomes: [
      'Heat Pump Specialist Certification',
      'Ability to specialize in growing heat pump market',
      'Salary increase of $5,000-$15,000 annually',
      'High-demand specialization',
      'Consulting and design opportunities',
      'Geothermal system expertise'
    ]
  }
};

export default function CourseDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const courseId = params?.id as string;

  const course = COURSE_DATA[courseId];

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Course Not Found</h1>
          <Button onClick={() => setLocation('/courses')}>Back to Courses</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white py-12">
        <div className="container mx-auto px-4">
          <button
            onClick={() => setLocation('/courses')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </button>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex gap-2 mb-4">
                <Badge className="bg-[#ff6b35]">{course.difficulty}</Badge>
                <Badge className="bg-white/20">{course.certification_type}</Badge>
              </div>
              <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
              <p className="text-xl text-white/90">{course.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Course Content */}
          <div className="lg:col-span-2">
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4 mb-12">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Clock className="h-6 w-6 text-[#ff6b35] mx-auto mb-2" />
                  <p className="text-2xl font-bold">{course.duration_hours}</p>
                  <p className="text-sm text-gray-600">Hours</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-6 w-6 text-[#ff6b35] mx-auto mb-2" />
                  <p className="text-2xl font-bold">{course.students.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Students</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Star className="h-6 w-6 text-yellow-400 mx-auto mb-2 fill-yellow-400" />
                  <p className="text-2xl font-bold">{course.rating}</p>
                  <p className="text-sm text-gray-600">Rating</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Award className="h-6 w-6 text-[#ff6b35] mx-auto mb-2" />
                  <p className="text-2xl font-bold">✓</p>
                  <p className="text-sm text-gray-600">Certified</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="mb-12">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
                <TabsTrigger value="instructor">Instructor</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>What You'll Learn</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {course.learning_objectives.map((objective, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{objective}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {course.prerequisites && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Prerequisites</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {course.prerequisites.map((prereq, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#ff6b35] font-bold">•</span>
                            <span>{prereq}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {course.career_outcomes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Career Outcomes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {course.career_outcomes.map((outcome, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#ff6b35] font-bold">✓</span>
                            <span>{outcome}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="curriculum" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Course Curriculum</CardTitle>
                    <CardDescription>{course.modules.length} modules • {course.duration_hours} hours total</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {course.modules.map((module, idx) => (
                      <div key={idx} className="border-l-4 border-[#ff6b35] pl-4 pb-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-lg">{module.title}</h4>
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {module.duration}
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {module.topics.map((topic, topicIdx) => (
                            <li key={topicIdx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-[#ff6b35] mt-1">→</span>
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="instructor" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>About Your Instructor</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-[#1e3a5f] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {course.instructor_name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{course.instructor_name}</h3>
                        <p className="text-gray-700">{course.instructor_bio}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Enrollment Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4 shadow-lg">
              <CardHeader>
                <div className="text-4xl font-bold text-[#ff6b35] mb-2">${course.price}</div>
                <p className="text-sm text-gray-600">One-time payment</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold py-6">
                  Enroll Now
                </Button>
                <p className="text-sm text-center text-gray-600">30-day money-back guarantee</p>

                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-3">This course includes:</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>{course.duration_hours} hours of video content</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Comprehensive workbook & materials</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Practice exams & quizzes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Certificate of completion</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Lifetime access to materials</span>
                    </li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-600 text-center">
                    Secure payment with Stripe. Your data is encrypted and protected.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
