/**
 * Returns a random, playful, and surrealist Spanish Telegram notification
 * about a new event in the web app—no titles/spoilers, just vibes!
 */

type SurrealistTemplate = (dashboardUrl: string) => string;

const surrealistTemplates: SurrealistTemplate[] = [
  // El oráculo digital despierta
  (dashboardUrl) => 
    `🔮 *¡El oráculo digital ha susurrado!* 🔮\n\nUn nuevo eco ha aparecido en el cosmos virtual.\n\n[Abrir portal cósmico](${dashboardUrl})\n\nEl viento digital mueve los relojes.\n*Importante*: No ignores el conjuro.`,

  // La paradoja del mensaje
  (dashboardUrl) =>
    `🦜 *La paradoja anuncia: ¡Nuevo mensaje encontrado!*\n\nHa surgido algo singular en el tapiz electrónico.\n\n[Descubre el mensaje](${dashboardUrl})\n\n¿Es un espejismo o el destino jugando?\n*Importante*: Nadie sale igual tras descubrirlo.`,

  // ¡Advertencia de lo inusual!
  (dashboardUrl) =>
    `🚨 *¡Advertencia de lo inusual!* 🚨\n\nUna nueva entidad ha emergido en tu universo digital.\n\n[🌒 Abrir portal único](${dashboardUrl})\n\nEl tiempo es un espejismo aquí.\n*Importante*: Este no es un mensaje ordinario.`,

  // El reloj derretido sonríe
  (dashboardUrl) =>
    `⏳ *El reloj derretido sonríe: hay novedades.*\n\nEl surrealismo invade tu aplicación; la realidad es relativa.\n\n[Abre la madriguera de conejo](${dashboardUrl})\n\n¿O es sólo un sueño muy lúcido?\n*Importante*: El universo observa.`,

  // El mensajero invisible canta
  (dashboardUrl) =>
    `🎶 *El mensajero invisible canta:*\n\nAlgo nuevo ha brotado de la tela digital.\n\n[Viajar hacia la novedad](${dashboardUrl})\n\nEnhorabuena por ser parte del absurdo.\n*Importante*: Las palabras importan más allá del sentido.`
];

/**
 * Picks a random surrealist template for Telegram notifications.
 */
export function buildSurrealistTelegramMessage({ dashboardUrl }: { dashboardUrl: string }): string {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  return pick(surrealistTemplates)(dashboardUrl);
}
