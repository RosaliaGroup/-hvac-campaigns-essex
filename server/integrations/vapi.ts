/**
 * Vapi Voice AI Integration
 * Handles inbound/outbound calls, webhooks, and call logging
 */

import * as db from "../db";

export interface VapiCredentials {
  apiKey: string;
  assistantId?: string;
  phoneNumberId?: string;
}

export interface VapiCallEvent {
  type: "call.started" | "call.ended" | "call.forwarded" | "transcript.updated";
  call: {
    id: string;
    phoneNumber: string;
    direction: "inbound" | "outbound";
    status: string;
    startedAt?: string;
    endedAt?: string;
    duration?: number;
    cost?: number;
  };
  transcript?: string;
  metadata?: Record<string, any>;
}

/**
 * Handle Vapi webhook events
 */
export async function handleVapiWebhook(event: VapiCallEvent) {
  console.log("[Vapi] Received webhook:", event.type);

  switch (event.type) {
    case "call.started":
      await handleCallStarted(event);
      break;
    case "call.ended":
      await handleCallEnded(event);
      break;
    case "transcript.updated":
      await handleTranscriptUpdate(event);
      break;
    default:
      console.log("[Vapi] Unhandled event type:", event.type);
  }
}

async function handleCallStarted(event: VapiCallEvent) {
  const { call } = event;
  
  await db.createCallLog({
    callId: call.id,
    direction: call.direction,
    phoneNumber: call.phoneNumber,
    status: "in_progress",
  });
}

async function handleCallEnded(event: VapiCallEvent) {
  const { call, transcript } = event;
  
  await db.createCallLog({
    callId: call.id,
    direction: call.direction,
    phoneNumber: call.phoneNumber,
    status: "completed",
    duration: call.duration,
    transcript: transcript || "",
  });

  // Extract lead information from transcript if available
  if (transcript) {
    await extractLeadFromTranscript(call.phoneNumber, transcript);
  }
}

async function handleTranscriptUpdate(event: VapiCallEvent) {
  // Update call log with latest transcript
  // This is called during the call for real-time transcription
}

/**
 * Extract lead information from call transcript using AI
 */
async function extractLeadFromTranscript(phoneNumber: string, transcript: string) {
  // TODO: Use LLM to extract:
  // - Customer name
  // - Service type needed
  // - Budget/timeline
  // - Urgency level
  // Then create a lead in the database
  
  console.log("[Vapi] Extracting lead info from transcript:", transcript.substring(0, 100));
}

/**
 * Make an outbound call using Vapi
 */
export async function makeOutboundCall(
  credentials: VapiCredentials,
  phoneNumber: string,
  purpose: string
) {
  const { apiKey, assistantId, phoneNumberId } = credentials;

  if (!apiKey || !assistantId || !phoneNumberId) {
    throw new Error("Missing Vapi credentials");
  }

  const response = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: {
        number: phoneNumber,
      },
      metadata: {
        purpose,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vapi API error: ${error}`);
  }

  const data = await response.json();
  console.log("[Vapi] Outbound call initiated:", data);
  
  return data;
}

/**
 * Get call details from Vapi
 */
export async function getCallDetails(apiKey: string, callId: string) {
  const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch call details");
  }

  return await response.json();
}
