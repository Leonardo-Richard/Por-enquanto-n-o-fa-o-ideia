/**
 * Descobre onde o Next do monorepo responde (frontend :3000 ou backend :3001)
 * para o worker ADN usar o mesmo anfitrião que `/api/internal/v1/adn/*`.
 */
export async function detectLocalPortalBaseUrl() {
  // 3001 primeiro: quem usa `npm run dev` no backend (comum neste repo) evita ficar preso a :3000 do .env.
  for (const port of [3001, 3000]) {
    const url = `http://127.0.0.1:${port}/api/health`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return `http://127.0.0.1:${port}`;
      }
    } catch {
      /* tenta a seguinte porta */
    }
  }
  return null;
}
