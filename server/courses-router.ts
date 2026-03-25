import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from './_core/trpc';
import { getDb } from './db';
import { courses, enrollments, user_subscriptions, subscriptions, certificates } from '../drizzle/courses-schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const coursesRouter = router({
  // Get all courses with filters
  listCourses: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        difficulty: z.string().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const allCourses = await db.select().from(courses);
      
      // Filter in memory
      return allCourses
        .filter(c => c.is_active)
        .filter(c => !input.category || input.category === 'all' || c.category === input.category)
        .filter(c => !input.difficulty || input.difficulty === 'all' || c.difficulty === input.difficulty)
        .slice(0, input.limit);
    }),

  // Get single course details
  getCourse: publicProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const course = await db
        .select()
        .from(courses)
        .where(and(eq(courses.id, input.courseId), eq(courses.is_active, true)))
        .limit(1);

      return course[0] || null;
    }),

  // Get subscription plans
  getSubscriptionPlans: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(subscriptions).where(eq(subscriptions.is_active, true));
  }),

  // Enroll in a course (pay-per-course)
  enrollCourse: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        paymentId: z.string(), // Stripe payment ID
        pricePaid: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const enrollmentId = uuidv4();

      await db.insert(enrollments).values({
        id: enrollmentId,
        user_id: ctx.user.id,
        course_id: input.courseId,
        enrollment_type: 'pay_per_course',
        status: 'active',
        payment_id: input.paymentId,
        price_paid: input.pricePaid.toString(),
      });

      return { enrollmentId, success: true };
    }),

  // Subscribe to a plan
  subscribeToPlan: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.string(),
        stripeSubscriptionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const userSubId = uuidv4();

      await db.insert(user_subscriptions).values({
        id: userSubId,
        user_id: ctx.user.id,
        subscription_id: input.subscriptionId,
        stripe_subscription_id: input.stripeSubscriptionId,
        status: 'active',
        auto_renew: true,
      });

      return { userSubscriptionId: userSubId, success: true };
    }),

  // Get user's enrollments
  getUserEnrollments: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(enrollments)
      .where(eq(enrollments.user_id, ctx.user.id));
  }),

  // Get user's active subscription
  getUserSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const userSub = await db
      .select()
      .from(user_subscriptions)
      .where(
        and(
          eq(user_subscriptions.user_id, ctx.user.id),
          eq(user_subscriptions.status, 'active')
        )
      )
      .limit(1);

    return userSub[0] || null;
  }),

  // Update course progress
  updateProgress: protectedProcedure
    .input(
      z.object({
        enrollmentId: z.string(),
        progressPercentage: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Verify enrollment belongs to user
      const enrollment = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.id, input.enrollmentId),
            eq(enrollments.user_id, ctx.user.id)
          )
        )
        .limit(1);

      if (!enrollment[0]) {
        throw new Error('Enrollment not found');
      }

      await db
        .update(enrollments)
        .set({
          progress_percentage: input.progressPercentage,
          status: input.progressPercentage === 100 ? 'completed' : 'active',
        })
        .where(eq(enrollments.id, input.enrollmentId));

      return { success: true };
    }),

  // Record exam results
  recordExamResult: protectedProcedure
    .input(
      z.object({
        enrollmentId: z.string(),
        examPassed: z.boolean(),
        examScore: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const enrollment = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.id, input.enrollmentId),
            eq(enrollments.user_id, ctx.user.id)
          )
        )
        .limit(1);

      if (!enrollment[0]) {
        throw new Error('Enrollment not found');
      }

      // Update enrollment with exam results
      await db
        .update(enrollments)
        .set({
          exam_passed: input.examPassed,
          exam_score: input.examScore,
          exam_date: new Date(),
          status: input.examPassed ? 'completed' : 'active',
        })
        .where(eq(enrollments.id, input.enrollmentId));

      // If passed, generate certificate
      if (input.examPassed) {
        const course = await db
          .select()
          .from(courses)
          .where(eq(courses.id, enrollment[0].course_id))
          .limit(1);

        if (course[0]) {
          const certId = uuidv4();
          const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();

          await db.insert(certificates).values({
            id: certId,
            user_id: ctx.user.id,
            course_id: course[0].id,
            certification_name: course[0].certification_type || course[0].title,
            verification_code: verificationCode,
            certificate_url: `/certificates/${certId}.pdf`,
          });

          return {
            success: true,
            certificateId: certId,
            verificationCode,
          };
        }
      }

      return { success: true };
    }),

  // Get user's certificates
  getUserCertificates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(certificates)
      .where(eq(certificates.user_id, ctx.user.id));
  }),

  // Cancel subscription
  cancelSubscription: protectedProcedure
    .input(z.object({ userSubscriptionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const userSub = await db
        .select()
        .from(user_subscriptions)
        .where(
          and(
            eq(user_subscriptions.id, input.userSubscriptionId),
            eq(user_subscriptions.user_id, ctx.user.id)
          )
        )
        .limit(1);

      if (!userSub[0]) {
        throw new Error('Subscription not found');
      }

      await db
        .update(user_subscriptions)
        .set({
          status: 'cancelled',
          cancelled_at: new Date(),
        })
        .where(eq(user_subscriptions.id, input.userSubscriptionId));

      return { success: true };
    }),
});
