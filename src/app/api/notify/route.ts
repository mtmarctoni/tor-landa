import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

// This env variable must be set from the verification step in Notion webhook creation
const NOTION_WEBHOOK_VERIFICATION_TOKEN = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;

export async function POST(req: NextRequest) {
  // Buffer the raw request body for signature verification
  const rawBody = await req.text();

  // If this is the verification POST (one-off, not signed), handle it specially
  try {
    const maybeVerify = JSON.parse(rawBody);
    if (maybeVerify.verification_token && Object.keys(maybeVerify).length === 1) {
      // For ease of onboarding: return token in body and log instructions
      console.log("[Notion webhook verification_token received]", maybeVerify.verification_token);
      return NextResponse.json({
        message: "Paste this verification_token into your .env as NOTION_WEBHOOK_VERIFICATION_TOKEN, then complete webhook verification in the Notion UI.",
        verification_token: maybeVerify.verification_token
      });
    }
  } catch {
    // not a verification payload, continue
  }

  // Signature verification (all valid events must be signed and token must be set)
  if (!NOTION_WEBHOOK_VERIFICATION_TOKEN) {
    return NextResponse.json({ error: "Webhook verification token not configured. Complete verification step first." }, { status: 503 });
  }

  const signatureHeader = req.headers.get("x-notion-signature");
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing Notion signature header." }, { status: 401 });
  }
  let calculatedSignature;
  try {
    calculatedSignature =
      "sha256=" +
      createHmac("sha256", NOTION_WEBHOOK_VERIFICATION_TOKEN)
        .update(rawBody)
        .digest("hex");
  } catch (err) {
    return NextResponse.json({ error: "Failed to calculate signature." }, { status: 500 });
  }

  // use timingSafeEqual for constant-time compare
  const valid =
    signatureHeader.length === calculatedSignature.length &&
    timingSafeEqual(Buffer.from(signatureHeader, "utf8"), Buffer.from(calculatedSignature, "utf8"));

  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }

  // Parse event body for UI (safe, since it's valid JSON now)
  let pageInfo = "";
  let body;
  try {
    body = JSON.parse(rawBody);
    const pageTitle =
      body?.data?.properties?.title?.title?.[0]?.plain_text ||
      body?.data?.properties?.Name?.title?.[0]?.plain_text ||
      "New entry";
    pageInfo = `\n📄 *${pageTitle}*`;
  } catch {
    // fallback to generic message
  }

  // Telegram notification logic
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "the app";

  const message = `📬 *New update available!*${pageInfo}\n\nHead over to ${APP_URL} to see what's new.`;

  const telegramRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    }
  );

  if (!telegramRes.ok) {
    const error = await telegramRes.json();
    console.error("Telegram API error:", error);
    return NextResponse.json({ error: "Failed to send Telegram message" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Explicitly do not allow GET (or any other method)
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
