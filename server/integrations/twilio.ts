/**
 * Twilio SMS Integration
 * Handles two-way SMS conversations, automated follow-ups, and lead qualification
 */

import * as db from "../db";

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export interface TwilioSmsWebhook {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
}

/**
 * Handle incoming SMS from Twilio webhook
 */
export async function handleIncomingSms(webhook: TwilioSmsWebhook) {
  console.log("[Twilio] Incoming SMS from:", webhook.From);

  // Store SMS in database
  await db.createSmsConversation({
    conversationId: webhook.MessageSid,
    phoneNumber: webhook.From,
    direction: "inbound",
    message: webhook.Body,
    status: "received",
  });

  // Generate AI response
  const response = await generateSmsResponse(webhook.Body, webhook.From);

  return response;
}

/**
 * Generate AI response to SMS using LLM
 */
async function generateSmsResponse(message: string, phoneNumber: string): Promise<string> {
  // TODO: Use LLM to generate contextual response
  // Consider:
  // - Previous conversation history
  // - Lead qualification questions
  // - Service type inquiry
  // - Appointment scheduling
  
  // For now, return a simple response
  return "Thanks for contacting Mechanical Enterprise! We'll respond shortly. For immediate assistance, call (862) 423-9396.";
}

/**
 * Send SMS using Twilio API
 */
export async function sendSms(
  credentials: TwilioCredentials,
  to: string,
  message: string
) {
  const { accountSid, authToken, phoneNumber } = credentials;

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error("Missing Twilio credentials");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: phoneNumber,
        Body: message,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio API error: ${error}`);
  }

  const data = await response.json();
  
  // Log outbound SMS
  await db.createSmsConversation({
    conversationId: data.sid,
    phoneNumber: to,
    direction: "outbound",
    message,
    status: "sent",
  });

  console.log("[Twilio] SMS sent to:", to);
  return data;
}

/**
 * Send automated follow-up SMS sequence
 */
export async function sendFollowUpSequence(
  credentials: TwilioCredentials,
  phoneNumber: string,
  leadName: string,
  day: 1 | 3 | 7
) {
  const messages = {
    1: `Hi ${leadName}! Thanks for your interest in our HVAC services. We're excited to help you save up to $16K with NJ rebates. Have any questions?`,
    3: `Hi ${leadName}, just checking in! We've helped 4000+ homeowners upgrade their HVAC systems. Ready to discuss your project? Reply YES to schedule a call.`,
    7: `${leadName}, this is your last chance! Our $16K rebate offer ends soon. Reply NOW to claim your free quote before spots fill up.`,
  };

  await sendSms(credentials, phoneNumber, messages[day]);
}

/**
 * Send appointment reminder SMS
 */
export async function sendAppointmentReminder(
  credentials: TwilioCredentials,
  phoneNumber: string,
  appointmentTime: string
) {
  const message = `Reminder: Your HVAC consultation is scheduled for ${appointmentTime}. Reply CONFIRM to confirm or RESCHEDULE to change. - Mechanical Enterprise`;
  
  await sendSms(credentials, phoneNumber, message);
}
