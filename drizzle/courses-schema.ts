import { mysqlTable, varchar, text, int, decimal, boolean, timestamp, mysqlEnum } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { users } from './schema';

// Courses table
export const courses = mysqlTable('courses', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: mysqlEnum('category', [
    'epa_608',
    'nate',
    'fundamentals',
    'advanced',
    'specialty'
  ]).notNull(),
  difficulty: mysqlEnum('difficulty', ['beginner', 'intermediate', 'advanced']).notNull(),
  duration_hours: int('duration_hours').notNull(),
  instructor_name: varchar('instructor_name', { length: 255 }).notNull(),
  instructor_bio: text('instructor_bio'),
  price_per_course: decimal('price_per_course', { precision: 10, scale: 2 }).notNull(),
  certification_type: varchar('certification_type', { length: 255 }), // e.g., "EPA 608 Type I", "NATE Core"
  learning_objectives: text('learning_objectives'), // JSON array stored as text
  prerequisites: text('prerequisites'), // JSON array
  syllabus: text('syllabus'), // JSON structure with modules
  image_url: varchar('image_url', { length: 500 }),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Subscriptions table
export const subscriptions = mysqlTable('subscriptions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // "Starter", "Professional", "Premium"
  price_monthly: decimal('price_monthly', { precision: 10, scale: 2 }).notNull(),
  max_courses: int('max_courses'), // null = unlimited
  features: text('features'), // JSON array of features
  stripe_price_id: varchar('stripe_price_id', { length: 255 }),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
});

// User enrollments (pay-per-course)
export const enrollments = mysqlTable('enrollments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  user_id: int('user_id').notNull(),
  course_id: varchar('course_id', { length: 36 }).notNull(),
  enrollment_type: mysqlEnum('enrollment_type', ['pay_per_course', 'subscription']).notNull(),
  status: mysqlEnum('status', ['active', 'completed', 'cancelled']).default('active'),
  progress_percentage: int('progress_percentage').default(0),
  completed_at: timestamp('completed_at'),
  certificate_url: varchar('certificate_url', { length: 500 }),
  exam_passed: boolean('exam_passed'),
  exam_score: int('exam_score'),
  exam_date: timestamp('exam_date'),
  payment_id: varchar('payment_id', { length: 255 }), // Stripe payment ID
  price_paid: decimal('price_paid', { precision: 10, scale: 2 }),
  enrolled_at: timestamp('enrolled_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// User subscription table
export const user_subscriptions = mysqlTable('user_subscriptions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  user_id: int('user_id').notNull(),
  subscription_id: varchar('subscription_id', { length: 36 }).notNull(),
  stripe_subscription_id: varchar('stripe_subscription_id', { length: 255 }),
  status: mysqlEnum('status', ['active', 'cancelled', 'paused']).default('active'),
  current_period_start: timestamp('current_period_start'),
  current_period_end: timestamp('current_period_end'),
  auto_renew: boolean('auto_renew').default(true),
  started_at: timestamp('started_at').defaultNow(),
  cancelled_at: timestamp('cancelled_at'),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Course progress tracking
export const course_progress = mysqlTable('course_progress', {
  id: varchar('id', { length: 36 }).primaryKey(),
  enrollment_id: varchar('enrollment_id', { length: 36 }).notNull(),
  module_index: int('module_index').notNull(),
  module_name: varchar('module_name', { length: 255 }).notNull(),
  completed: boolean('completed').default(false),
  completed_at: timestamp('completed_at'),
  time_spent_minutes: int('time_spent_minutes').default(0),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Certificates issued
export const certificates = mysqlTable('certificates', {
  id: varchar('id', { length: 36 }).primaryKey(),
  user_id: int('user_id').notNull(),
  course_id: varchar('course_id', { length: 36 }).notNull(),
  certification_name: varchar('certification_name', { length: 255 }).notNull(),
  issue_date: timestamp('issue_date').defaultNow(),
  expiry_date: timestamp('expiry_date'), // null if no expiry
  certificate_url: varchar('certificate_url', { length: 500 }).notNull(),
  verification_code: varchar('verification_code', { length: 100 }).notNull().unique(),
  created_at: timestamp('created_at').defaultNow(),
});

// Relations
export const coursesRelations = relations(courses, ({ many }) => ({
  enrollments: many(enrollments),
  progress: many(course_progress),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  user: one(users, { fields: [enrollments.user_id], references: [users.id] }),
  course: one(courses, { fields: [enrollments.course_id], references: [courses.id] }),
  progress: many(course_progress),
}));

export const userSubscriptionsRelations = relations(user_subscriptions, ({ one }) => ({
  user: one(users, { fields: [user_subscriptions.user_id], references: [users.id] }),
  subscription: one(subscriptions, { fields: [user_subscriptions.subscription_id], references: [subscriptions.id] }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.user_id], references: [users.id] }),
  course: one(courses, { fields: [certificates.course_id], references: [courses.id] }),
}));
