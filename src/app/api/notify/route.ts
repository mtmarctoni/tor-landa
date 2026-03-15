import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

// This env variable must be set from the verification step in Notion webhook creation
const NOTION_WEBHOOK_VERIFICATION_TOKEN = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;

export async function POST(req: NextRequest) {
  // --- Logging: endpoint hit ---
  console.log("[NOTIFY] Webhook endpoint hit");

  // Log: All headers (mask secret-looking values)
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (/token|key|secret|authorization|cookie/i.test(key)) {
      headersObj[key] = '***';
    } else {
      headersObj[key] = value;
    }
  });
  console.log("[NOTIFY] Request headers:", JSON.stringify(headersObj, null, 2));

  // Buffer the raw request body for signature verification
  let rawBody = "";
  try {
    rawBody = await req.text();
    console.log(`[NOTIFY] Raw body length: ${rawBody.length}`);
  } catch (e) {
    console.error("[NOTIFY] Error reading raw body:", e);
    return NextResponse.json({ error: "Failed to read body" }, { status: 500 });
  }

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
  } catch (err) {
    // not a verification payload, continue
    // Log it for troubleshooting
    console.log("[NOTIFY] Not a verification payload (proceed to signature)");
  }

  // Signature verification (all valid events must be signed and token must be set)
  if (!NOTION_WEBHOOK_VERIFICATION_TOKEN) {
    console.error("[NOTIFY] VERIFICATION_TOKEN missing from env!");
    return NextResponse.json({ error: "Webhook verification token not configured. Complete verification step first." }, { status: 503 });
  }

  const signatureHeader = req.headers.get("x-notion-signature");
  if (!signatureHeader) {
    console.warn("[NOTIFY] No x-notion-signature header!");
    return NextResponse.json({ error: "Missing Notion signature header." }, { status: 401 });
  }
  // Just log the first 12 chars of the signature to avoid leaking full secrets
  console.log("[NOTIFY] X-Notion-Signature (prefix):", signatureHeader.slice(0, 12) + "...");

  let calculatedSignature;
  try {
    calculatedSignature =
      "sha256=" +
      createHmac("sha256", NOTION_WEBHOOK_VERIFICATION_TOKEN)
        .update(rawBody)
        .digest("hex");
    console.log("[NOTIFY] Calculated signature (prefix):", calculatedSignature.slice(0, 12) + "...");
  } catch (err) {
    console.error("[NOTIFY] Failed to calculate signature.", err);
    return NextResponse.json({ error: "Failed to calculate signature." }, { status: 500 });
  }

  // use timingSafeEqual for constant-time compare
  let valid = false;
  try {
    valid =
      signatureHeader.length === calculatedSignature.length &&
      timingSafeEqual(Buffer.from(signatureHeader, "utf8"), Buffer.from(calculatedSignature, "utf8"));
  } catch (err) {
    console.error("[NOTIFY] Error in timingSafeEqual:", err);
    valid = false;
  }

  if (!valid) {
    console.warn("[NOTIFY] Signature verification FAILED");
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }
  console.log("[NOTIFY] Signature verification PASSED");

  // Parse event body for UI (safe, since it's valid JSON now)
  let pageInfo = "";
  let bodyObj;
  try {
    bodyObj = JSON.parse(rawBody);
    console.log("[NOTIFY] Parsed event body:", JSON.stringify(bodyObj, null, 2));
    const pageTitle =
      bodyObj?.data?.properties?.title?.title?.[0]?.plain_text ||
      bodyObj?.data?.properties?.Name?.title?.[0]?.plain_text ||
      "New entry";
    pageInfo = `\n📄 *${pageTitle}*`;
  } catch (err) {
    console.warn("[NOTIFY] Error parsing event JSON, will use fallback:", err);
  }

  // Telegram notification logic
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "the app";

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("[NOTIFY] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env var missing!");
    return NextResponse.json({ error: "Telegram configuration error" }, { status: 500 });
  }

  const message = `📬 *New update available!*${pageInfo}\n\nHead over to ${APP_URL} to see what's new.`;
  console.log("[NOTIFY] Sending Telegram message:", message);

  let telegramRes;
  try {
    telegramRes = await fetch(
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
  } catch (err) {
    console.error("[NOTIFY] Telegram fetch failed:", err);
    return NextResponse.json({ error: "Failed to send Telegram message (fetch failed)" }, { status: 500 });
  }

  if (!telegramRes.ok) {
    let errorText = "";
    try {
      errorText = await telegramRes.text();
      console.error("[NOTIFY] Telegram API error:", errorText);
    } catch (err) {
      errorText = "Unknown JSON parse fail";
      console.error("[NOTIFY] Telegram API error (weird JSON):", err);
    }
    return NextResponse.json({ error: "Failed to send Telegram message", telegramApiError: errorText }, { status: 500 });
  } else {
    let tgJson = {};
    try {
      tgJson = await telegramRes.json();
      console.log("[NOTIFY] Telegram API response:", JSON.stringify(tgJson, null, 2));
    } catch {
      console.log("[NOTIFY] Telegram API response: (could not parse JSON)");
    }
  }

  console.log("[NOTIFY] Notification chain completed successfully!");
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Explicitly do not allow GET (or any other method)
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
