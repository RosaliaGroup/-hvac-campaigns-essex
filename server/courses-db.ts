import { getDb } from "./db";
import {
  courses,
  courseLessons,
  courseEnrollments,
  studentProgress,
  quizAttempts,
  certificates,
  subscriptionPlans,
  userSubscriptions,
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Get all active courses
 */
export async function getAllCourses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courses).where(eq(courses.is_active, true));
}

/**
 * Get course by ID with lessons
 */
export async function getCourseWithLessons(courseId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const course = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course.length) return null;

  const lessons = await db
    .select()
    .from(courseLessons)
    .where(eq(courseLessons.course_id, courseId))
    .orderBy(courseLessons.order);

  return { ...course[0], lessons };
}

/**
 * Get student's enrolled courses
 */
export async function getStudentEnrolledCourses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      enrollment: courseEnrollments,
      course: courses,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.course_id, courses.id))
    .where(eq(courseEnrollments.user_id, userId))
    .orderBy(desc(courseEnrollments.created_at));
}

/**
 * Get enrollment details
 */
export async function getEnrollmentDetails(enrollmentId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const enrollment = await db
    .select()
    .from(courseEnrollments)
    .where(eq(courseEnrollments.id, enrollmentId));

  if (!enrollment.length) return null;

  const progress = await db
    .select()
    .from(studentProgress)
    .where(eq(studentProgress.enrollment_id, enrollmentId));

  const quizAttemptRecords = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.enrollment_id, enrollmentId))
    .orderBy(desc(quizAttempts.created_at));

  return {
    enrollment: enrollment[0],
    progress,
    quizAttempts: quizAttemptRecords,
  };
}

/**
 * Create course enrollment
 */
export async function createEnrollment(
  userId: number,
  courseId: number,
  enrollmentType: "one_time" | "subscription",
  paymentIntentId?: string,
  subscriptionId?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(courseEnrollments).values({
    user_id: userId,
    course_id: courseId,
    enrollment_type: enrollmentType,
    stripe_payment_intent_id: paymentIntentId,
    stripe_subscription_id: subscriptionId,
    status: "active",
  });
}

/**
 * Update student progress on a lesson
 */
export async function updateLessonProgress(
  enrollmentId: number,
  lessonId: number,
  videoWatchedSeconds: number,
  videoDurationSeconds: number,
  isCompleted: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db
    .select()
    .from(studentProgress)
    .where(
      and(
        eq(studentProgress.enrollment_id, enrollmentId),
        eq(studentProgress.lesson_id, lessonId)
      )
    );

  if (existing.length) {
    return db
      .update(studentProgress)
      .set({
        video_watched_seconds: videoWatchedSeconds,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date() : null,
        updated_at: new Date(),
      })
      .where(eq(studentProgress.id, existing[0].id));
  } else {
    return db.insert(studentProgress).values({
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      video_watched_seconds: videoWatchedSeconds,
      video_duration_seconds: videoDurationSeconds,
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date() : null,
    });
  }
}

/**
 * Record quiz attempt
 */
export async function recordQuizAttempt(
  enrollmentId: number,
  courseId: number,
  score: number,
  totalQuestions: number,
  correctAnswers: number,
  isFinalExam: boolean,
  timeSpentSeconds: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const passingScore = 70; // 70% passing score
  const passed = score >= passingScore;

  return db.insert(quizAttempts).values({
    enrollment_id: enrollmentId,
    course_id: courseId,
    is_final_exam: isFinalExam,
    score,
    total_questions: totalQuestions,
    correct_answers: correctAnswers,
    passed,
    time_spent_seconds: timeSpentSeconds,
    started_at: new Date(),
    completed_at: new Date(),
  });
}

/**
 * Update enrollment with exam score and completion
 */
export async function updateEnrollmentCompletion(
  enrollmentId: number,
  examScore: number,
  examPassed: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(courseEnrollments)
    .set({
      exam_score: examScore,
      exam_passed: examPassed,
      status: examPassed ? "completed" : "active",
      completed_at: examPassed ? new Date() : null,
      progress_percentage: 100,
    })
    .where(eq(courseEnrollments.id, enrollmentId));
}

/**
 * Issue certificate
 */
export async function issueCertificate(
  enrollmentId: number,
  userId: number,
  courseId: number,
  studentName: string,
  courseTitle: string,
  certificationType: string,
  verificationToken: string,
  pdfUrl: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const result = await db.insert(certificates).values({
    enrollment_id: enrollmentId,
    user_id: userId,
    course_id: courseId,
    certificate_number: certificateNumber,
    student_name: studentName,
    course_title: courseTitle,
    certification_type: certificationType,
    pdf_url: pdfUrl,
    verification_token: verificationToken,
    issue_date: new Date(),
  });

  // Update enrollment with certificate info
  await db
    .update(courseEnrollments)
    .set({
      certificate_issued: true,
      certificate_url: pdfUrl,
      certificate_issued_at: new Date(),
    })
    .where(eq(courseEnrollments.id, enrollmentId));

  return result;
}

/**
 * Get subscription plans
 */
export async function getSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.is_active, true));
}

/**
 * Get user's active subscription
 */
export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const subs = await db
    .select()
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.user_id, userId),
        eq(userSubscriptions.status, "active")
      )
    );

  if (!subs.length) return null;

  const plan = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, subs[0].plan_id));

  return { subscription: subs[0], plan: plan[0] };
}

/**
 * Create subscription
 */
export async function createSubscription(
  userId: number,
  planId: number,
  stripeSubscriptionId: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(userSubscriptions).values({
    user_id: userId,
    plan_id: planId,
    stripe_subscription_id: stripeSubscriptionId,
    status: "active",
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
  });
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(userSubscriptions)
    .set({
      status: "cancelled",
      cancelled_at: new Date(),
    })
    .where(eq(userSubscriptions.id, subscriptionId));
}
