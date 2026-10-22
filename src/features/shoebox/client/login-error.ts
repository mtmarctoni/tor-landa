const MESSAGES: Record<number, string> = {
  401: "Esa no es la contraseña. La caja sigue cerrada, pero no se ofende.",
  403: "La cerradura no reconoce esta página. Recárgala e inténtalo otra vez.",
  413: "Esa contraseña no cabe por la cerradura.",
  429: "Demasiados intentos. La cerradura necesita un minuto de descanso.",
  503: "La caja no está disponible ahora mismo. Inténtalo en un momento.",
};
export const LOGIN_FALLBACK =
  "Algo se torció por el camino. Inténtalo otra vez.";

export async function loginFailureMessage(response: Response): Promise<string> {
  if (response.status === 503) {
    // Only the fixed code selects copy; never render server/proxy messages.
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "object" &&
        body.error !== null &&
        "code" in body.error &&
        body.error.code === "SETUP_REQUIRED"
      )
        return "La caja todavía no está configurada. Vuelve un poquito más tarde.";
    } catch {
      // Non-JSON proxy failures keep the ordinary unavailable message.
    }
  }
  return MESSAGES[response.status] ?? LOGIN_FALLBACK;
}
