import { envOrThrow } from "@/utils/envOrThrow";

/**
 * Send a Telegram message using the configured bot and chat.
 * Throws on failure, logs detailed error for diagnostics.
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  const BOT_TOKEN = envOrThrow("TELEGRAM_BOT_TOKEN");
  const CHAT_ID = envOrThrow("TELEGRAM_CHAT_ID");

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: CHAT_ID,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("[TELEGRAM] API error:", errorText);
    throw new Error(`Telegram API error: ${errorText}`);
  }
  // Optionally log Telegram API response for diagnostics
  const json = await res.json();
  console.log("[TELEGRAM] API response:", JSON.stringify(json, null, 2));
}
