/**
 * Resolves which client's storefront to render.
 *
 * Production: the hostname (e.g. `ford.yourdomain.com` or a custom domain).
 * Dev: a `?tenant=ford` query param, falling back to the `localhost` subdomain
 * (`ford.localhost`), then a default.
 */
export function resolveTenantSlug(
  host: string | null,
  queryTenant?: string | string[],
): string {
  const fromQuery = Array.isArray(queryTenant) ? queryTenant[0] : queryTenant;
  if (fromQuery) return fromQuery.toLowerCase();

  if (host) {
    const hostname = host.split(":")[0]; // strip port
    const parts = hostname.split(".");
    // subdomain when there's something before "localhost" or the apex domain
    if (parts.length > 1 && parts[0] !== "www") {
      return parts[0].toLowerCase();
    }
  }

  return "ford";
}
