// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment.");
  process.exit(1);
}

fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: CHAT_ID,
    text: "✅ Test message from your Next.js app. The Telegram bot is working correctly!",
  }),
})
  .then((r) => r.json())
  .then((data) => {
    if (data.ok) {
      console.log("✅ Message sent successfully!");
    } else {
      console.error("❌ Telegram error:", data);
    }
  })
  .catch((err) => console.error("❌ Fetch error:", err));
