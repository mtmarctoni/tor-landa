import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

/** Utility: Mask secrets in headers log */
function maskHeaders(headers: Headers): Record<string, string> {
  const headersObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headersObj[key] = /token|key|secret|authorization|cookie/i.test(key) ? '***' : value;
  });
  return headersObj;
}

/** Utility: Signature validation */
function isSignatureValid(rawBody: string, token: string, expected: string): boolean {
  const calculated =
    "sha256=" + createHmac("sha256", token).update(rawBody).digest("hex");
  try {
    return expected.length === calculated.length &&
      timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(calculated, "utf8"));
  } catch {
    return false;
  }
}

/** Utility: format a Notion page or database URL */
function notionUrlForId(id?: string) {
  return id ? `https://www.notion.so/${id.replace(/-/g, '')}` : '';
}

/** Utility: Get env and throw if missing */
function envOrThrow(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

export async function POST(req: NextRequest) {
  console.log("[NOTIFY] Webhook endpoint hit");

  // Read and log
  let rawBody: string;
  try {
    rawBody = await req.text();
    console.log("[NOTIFY] Raw body length:", rawBody.length);
  } catch (e) {
    console.error("[NOTIFY] Error reading raw body:", e);
    return NextResponse.json({ error: "Failed to read body" }, { status: 500 });
  }
  console.log("[NOTIFY] Request headers:", JSON.stringify(maskHeaders(req.headers), null, 2));

  // Notion one-off verification token
  try {
    const maybeVerify = JSON.parse(rawBody);
    if (maybeVerify.verification_token && Object.keys(maybeVerify).length === 1) {
      console.log("[NOTIFY] Notion verification_token:", maybeVerify.verification_token);
      return NextResponse.json({
        message: "Paste this verification_token into .env as NOTION_WEBHOOK_VERIFICATION_TOKEN, then complete setup in Notion UI.",
        verification_token: maybeVerify.verification_token
      });
    }
  } catch { /* ignore */ }

  // Secure signature verification
  const token = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  if (!token) {
    console.error("[NOTIFY] VERIFICATION_TOKEN missing from env!");
    return NextResponse.json({ error: "Webhook verification token not set in env" }, { status: 503 });
  }
  const signature = req.headers.get("x-notion-signature");
  if (!signature) {
    console.warn("[NOTIFY] No x-notion-signature header!");
    return NextResponse.json({ error: "Missing Notion signature header." }, { status: 401 });
  }
  if (!isSignatureValid(rawBody, token, signature)) {
    console.warn("[NOTIFY] Signature verification FAILED");
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }
  console.log("[NOTIFY] Signature verification PASSED");

  // Parse request body
  let bodyObj: any;
  try {
    bodyObj = JSON.parse(rawBody);
  } catch (err) {
    console.error("[NOTIFY] Could not parse event JSON", err);
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  console.log("[NOTIFY] Full event JSON:", JSON.stringify(bodyObj, null, 2));

  // --- Parse Notion event ---
  // Notion: { type: "page.created", entity: {...}, ... }
  const fullType = bodyObj?.type || '';
  const [entity, action] = fullType.split(".");
  const pageId = bodyObj?.entity?.id;
  const parentId = bodyObj?.data?.parent?.id;
  // Flexible title extraction
  let pageTitle: string =
    bodyObj?.data?.properties?.title?.title?.[0]?.plain_text ||
    bodyObj?.data?.properties?.Name?.title?.[0]?.plain_text ||
    bodyObj?.data?.properties?.name?.title?.[0]?.plain_text ||
    "New entry";
  const pageUrl = notionUrlForId(pageId);
  const dbUrl = notionUrlForId(parentId);

  // --- Log the event ---
  let summary = '';
  if (action === 'created' && entity === 'page') {
    summary = `[NOTIFY] Row CREATED: id=${pageId} url=${pageUrl}`;
    console.log(summary, "Title:", pageTitle);
    console.log("[NOTIFY] Properties:", JSON.stringify(bodyObj?.data?.properties, null, 2));
  } else if (action === 'updated' && entity === 'page') {
    summary = `[NOTIFY] Row UPDATED: id=${pageId} url=${pageUrl}`;
    console.log(summary, "Title:", pageTitle);
    if (bodyObj?.changed_properties) {
      console.log('[NOTIFY] Changed properties:', JSON.stringify(bodyObj.changed_properties, null, 2));
    } else {
      console.log('[NOTIFY] All properties:', JSON.stringify(bodyObj?.data?.properties, null, 2));
    }
  } else if ((action === 'deleted' || action === 'archived') && entity === 'page') {
    summary = `[NOTIFY] Row DELETED/ARCHIVED: id=${pageId} url=${pageUrl}`;
    console.log(summary);
  } else {
    summary = `[NOTIFY] Other event: ${entity}.${action}: id="${pageId}" full data=`;
    console.log(summary, JSON.stringify(bodyObj, null, 2));
  }

  // --- Only notify for new row (page.created) ---
  if (!(action === 'created' && entity === 'page')) {
    return NextResponse.json({ ok: true, ignored: true, reason: "Not a page.created event" });
  }

  // --- Telegram notification with page link ---
  let BOT_TOKEN: string, CHAT_ID: string, APP_URL: string;
  try {
    BOT_TOKEN = envOrThrow('TELEGRAM_BOT_TOKEN');
    CHAT_ID = envOrThrow('TELEGRAM_CHAT_ID');
    APP_URL = process.env.NEXT_PUBLIC_APP_URL || "the app";
  } catch (err) {
    console.error("[NOTIFY] Telegram env error:", err);
    return NextResponse.json({ error: "Telegram configuration error" }, { status: 500 });
  }

  const message = `📬 *New Notion entry!*\n*${pageTitle}*\n[🔗 View in Notion](${pageUrl})\n\nSee more in [your dashboard](${APP_URL})`;
  console.log("[NOTIFY] Sending Telegram message:", message);

  try {
    const telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true
      }),
    });
    if (!telegramRes.ok) {
      const text = await telegramRes.text();
      console.error("[NOTIFY] Telegram API error:", text);
      return NextResponse.json({ error: "Failed to send Telegram message", telegramApiError: text }, { status: 500 });
    }
    const resJson = await telegramRes.json();
    console.log("[NOTIFY] Telegram API response:", JSON.stringify(resJson, null, 2));
    console.log("[NOTIFY] Notification chain completed successfully!");
  } catch (err) {
    console.error("[NOTIFY] Telegram fetch error:", err);
    return NextResponse.json({ error: "Failed to send Telegram message" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Explicitly do not allow GET (or any other method)
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
