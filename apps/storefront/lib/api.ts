const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface StorefrontVariant {
  sku: string;
  size?: string;
  color?: string;
  price: number;
  available: number;
}

export interface StorefrontProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
  allotmentEligible: boolean;
  fromPrice: number;
  variants: StorefrontVariant[];
}

export interface StorefrontData {
  tenant: {
    slug: string;
    name: string;
    primaryColor: string;
    accentColor: string;
    logoUrl?: string;
    heroHeadline: string;
    heroSubtext: string;
  };
  products: StorefrontProduct[];
}

/** Fetches a tenant's branded storefront payload from the commerce API. */
export async function fetchStorefront(slug: string): Promise<StorefrontData | null> {
  const res = await fetch(`${API_URL}/api/storefront/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export interface PublishedSitePage {
  tenant: Pick<StorefrontData["tenant"], "slug" | "name" | "primaryColor" | "accentColor">;
  page: {
    id: string;
    path: string;
    title: string;
    html: string;
    css: string;
    js: string;
  };
}

/** Loads a published page created in Signet's site builder. */
export async function fetchPublishedSitePage(slug: string, pagePath: string): Promise<PublishedSitePage | null> {
  const params = new URLSearchParams({ path: pagePath });
  const res = await fetch(`${API_URL}/api/storefront/${encodeURIComponent(slug)}/page?${params}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export interface BuyerMe {
  id: string;
  email: string;
  name: string;
  role: string;
  allotmentBalance: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Returns the signed-in buyer for a tenant, or null if not signed in. */
export async function fetchBuyerMe(slug: string): Promise<BuyerMe | null> {
  try {
    return await jsonFetch<BuyerMe>(`/api/auth/storefront/${slug}/me`);
  } catch {
    return null;
  }
}

export function buyerLogin(slug: string, email: string, password: string) {
  return jsonFetch<BuyerMe>(`/api/auth/storefront/${slug}/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function buyerLogout(slug: string) {
  return jsonFetch(`/api/auth/storefront/${slug}/logout`, { method: "POST" });
}

/** Fire-and-forget activity tracking for the admin CRM tabs. Never throws. */
export function track(slug: string, body: Record<string, unknown>) {
  fetch(`${API_URL}/api/storefront/${slug}/track`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export interface OrderLineInput {
  variantSku: string;
  quantity: number;
  unitPrice: number;
}

export function submitOrder(
  slug: string,
  payload: { lines: OrderLineInput[]; poNumber?: string; paymentMethod: "po" | "allotment"; userEmail?: string },
) {
  return jsonFetch<{ id: string; status: string; erpOrderId: string | null }>(`/api/storefront/${slug}/orders`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitPunchoutReturn(
  token: string,
  lines: { sku: string; quantity: number; unitPrice: number; description?: string }[],
) {
  return jsonFetch<{ ok: boolean }>(`/api/punchout/session/${token}/return`, {
    method: "POST",
    body: JSON.stringify({ lines }),
  });
}

export function fetchPunchoutSession(token: string) {
  return jsonFetch<{ status: string; tenantSlug?: string }>(`/api/punchout/session/${token}`);
}
