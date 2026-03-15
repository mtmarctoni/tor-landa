import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // 1. Validate secret
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.NOTIFY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Try to extract info from Notion payload
  let pageInfo = "";
  try {
    const body = await req.json();
    const pageTitle =
      body?.data?.properties?.title?.title?.[0]?.plain_text ||
      body?.data?.properties?.Name?.title?.[0]?.plain_text ||
      "New entry";
    pageInfo = `\n📄 *${pageTitle}*`;
  } catch {
    // fallback to generic message
  }

  // 3. Build and send the Telegram message
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
