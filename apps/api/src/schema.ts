import { randomUUID } from "node:crypto";
import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());

/** Signet employees who log into the admin/back-office app. */
export const internalUsers = pgTable("internal_users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("ops"), // superadmin | merchandiser | ops
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** A client company with its own branded storefront (Ford, Acme, ...). */
export const tenants = pgTable("tenants", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  domain: text("domain").unique(),
  erpCustomerCode: text("erp_customer_code"),
  primaryColor: text("primary_color").notNull().default("#0f172a"),
  accentColor: text("accent_color").notNull().default("#2563eb"),
  logoUrl: text("logo_url"),
  heroHeadline: text("hero_headline").notNull().default("Company Store"),
  heroSubtext: text("hero_subtext").notNull().default("Official apparel and uniforms"),
  /** Ordered homepage content blocks the page-builder edits, e.g. [{type:"hero",...}]. */
  pageBlocks: jsonb("page_blocks").notNull().default([]),
  punchoutEnabled: boolean("punchout_enabled").notNull().default(false),
  /** Shared secret used to authenticate inbound cXML PunchOutSetupRequests. */
  punchoutSharedSecret: text("punchout_shared_secret"),
  /** Employee-enablement: orders at/above the threshold need an approver's sign-off. */
  requireApproval: boolean("require_approval").notNull().default(false),
  approvalThreshold: doublePrecision("approval_threshold").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** A product family synced from the ERP. */
export const products = pgTable("products", {
  id: id(),
  erpId: text("erp_id").notNull().unique(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  brand: text("brand"),
  imageUrl: text("image_url"),
});

/** A specific size + color of a product (its own ERP SKU). */
export const productVariants = pgTable("product_variants", {
  id: id(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  size: text("size"),
  color: text("color"),
  price: doublePrecision("price").notNull(),
  available: integer("available").notNull().default(0),
});

/** Puts a product in a client's catalog, with customer-specific pricing. */
export const tenantProducts = pgTable(
  "tenant_products",
  {
    id: id(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    priceOverride: doublePrecision("price_override"),
    allotmentEligible: boolean("allotment_eligible").notNull().default(true),
  },
  (t) => ({ uniq: unique().on(t.tenantId, t.productId) }),
);

/** A buyer (an employee at the client company). */
export const users = pgTable(
  "users",
  {
    id: id(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("buyer"), // buyer | approver | admin
    passwordHash: text("password_hash"),
    allotmentBalance: doublePrecision("allotment_balance").notNull().default(0),
  },
  (t) => ({ uniq: unique().on(t.tenantId, t.email) }),
);

export const orders = pgTable("orders", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: text("user_id").references(() => users.id),
  poNumber: text("po_number"),
  status: text("status").notNull().default("pending"), // pending | pending_approval | submitted | rejected | error
  paymentMethod: text("payment_method").notNull().default("po"), // po | allotment
  erpOrderId: text("erp_order_id"),
  punchoutSessionId: text("punchout_session_id"),
  approvedByUserId: text("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderLines = pgTable("order_lines", {
  id: id(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantSku: text("variant_sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: doublePrecision("unit_price").notNull(),
});

/** Ledger of uniform-allotment debits/credits so balances are auditable. */
export const allotmentTransactions = pgTable("allotment_transactions", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: doublePrecision("amount").notNull(), // negative = debit (spend), positive = credit (grant)
  reason: text("reason").notNull(),
  orderId: text("order_id").references(() => orders.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- CRM tabs (mirrors Signet's per-customer workspace tabs) ----

export const contacts = pgTable("contacts", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  label: text("label"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull().default("US"),
  isDefault: boolean("is_default").notNull().default(false),
});

/**
 * Tokenized payment reference only — the platform never stores raw card
 * numbers/CVVs. A real integration would vault cards with a PCI-compliant
 * processor (Stripe, Acumatica's payment profiles, etc.) and store only the
 * returned token + display metadata here.
 */
export const paymentMethods = pgTable("payment_methods", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  last4: text("last4").notNull(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const savedSearches = pgTable("saved_searches", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Username/password reset or account-access requests raised by buyers. */
export const credentialRequests = pgTable("credential_requests", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  type: text("type").notNull(), // username | password
  status: text("status").notNull().default("pending"), // pending | resolved
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const searchLogs = pgTable("search_logs", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productInteractions = pgTable("product_interactions", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  type: text("type").notNull(), // view | add_to_cart | purchase
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pageViews = pgTable("page_views", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Tracks an inbound cXML punchout session end-to-end (setup -> return). */
export const punchoutSessions = pgTable("punchout_sessions", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  buyerCookie: text("buyer_cookie"),
  browserFormPostUrl: text("browser_form_post_url").notNull(),
  status: text("status").notNull().default("open"), // open | returned | expired
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Online invoicing & payment ----

export const invoices = pgTable("invoices", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  invoiceNumber: text("invoice_number").notNull(),
  /** IN = invoice, CM = credit memo, FC = finance charge (mirrors the ERP doc types). */
  invoiceType: text("invoice_type").notNull().default("IN"),
  amount: doublePrecision("amount").notNull(),
  amountPaid: doublePrecision("amount_paid").notNull().default(0),
  status: text("status").notNull().default("open"), // open | partially_paid | paid | past_due | locked | void
  poNumber: text("po_number"),
  terms: text("terms"),
  memo: text("memo"),
  /** Set while a payment is settling so the invoice can't be double-paid. */
  lockedUntil: timestamp("locked_until"),
  dueDate: timestamp("due_date"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

/**
 * One buyer payment, which may settle several invoices at once (Signet lets a
 * buyer tick multiple open invoices and pay them in a single transaction).
 */
export const paymentBatches = pgTable("payment_batches", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  amount: doublePrecision("amount").notNull(),
  surcharge: doublePrecision("surcharge").notNull().default(0),
  method: text("method").notNull(), // card-token | ach | po | allotment
  status: text("status").notNull().default("pending"), // pending | settled | failed
  reference: text("reference"),
  memo: text("memo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  settledAt: timestamp("settled_at"),
});

/** Tokenized payment record only — never raw card data (see paymentMethods). */
export const invoicePayments = pgTable("invoice_payments", {
  id: id(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  batchId: text("batch_id").references(() => paymentBatches.id, { onDelete: "set null" }),
  amount: doublePrecision("amount").notNull(),
  method: text("method").notNull(), // card-token | ach | po | allotment
  status: text("status").notNull().default("settled"), // pending | settled | failed
  reference: text("reference"),
  memo: text("memo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Quote creation & management ----

export const quotes = pgTable("quotes", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  quoteNumber: text("quote_number").notNull(),
  /**
   * Signet's quote lifecycle, plus a retained `converted` state so a placed
   * quote keeps its history instead of disappearing.
   * rep_new | rep_saved | rep_queued | user_queued | user_saved | cancelled | converted
   */
  status: text("status").notNull().default("user_saved"),
  version: integer("version").notNull().default(1),
  total: doublePrecision("total").notNull().default(0),
  assignedWorkerEmail: text("assigned_worker_email"),
  convertedOrderId: text("converted_order_id").references(() => orders.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quoteLines = pgTable("quote_lines", {
  id: id(),
  quoteId: text("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
});

/** The back-and-forth conversation log attached to a quote. */
export const quoteComments = pgTable("quote_comments", {
  id: id(),
  quoteId: text("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  authorType: text("author_type").notNull(), // worker | contact
  authorEmail: text("author_email"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Returns (RMA) & ad-hoc requests ----

/** Admin-configurable RMA pick lists, so reasons/actions aren't hardcoded enums. */
export const returnReasons = pgTable("return_reasons", {
  id: id(),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const returnActions = pgTable("return_actions", {
  id: id(),
  label: text("label").notNull(),
  /** Optional reason ids this action is offered for; empty = offered for all. */
  reasonIds: jsonb("reason_ids").notNull().default([]),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const returnStages = pgTable("return_stages", {
  id: id(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isTerminal: boolean("is_terminal").notNull().default(false),
});

export const returns = pgTable("returns", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  rmaNumber: text("rma_number"),
  reason: text("reason"),
  status: text("status").notNull().default("requested"), // requested | approved | rejected | completed
  /** Free-form workflow stage drawn from returnStages, independent of approve/reject. */
  stage: text("stage"),
  returnToAddress: text("return_to_address"),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const returnLines = pgTable("return_lines", {
  id: id(),
  returnId: text("return_id")
    .notNull()
    .references(() => returns.id, { onDelete: "cascade" }),
  variantSku: text("variant_sku").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  action: text("action"), // refund | replace | repair | credit
  unitPrice: doublePrecision("unit_price").notNull().default(0),
});

/** Catch-all bucket for requests that don't fit orders/returns (samples, artwork, etc.). */
export const adhocRequests = pgTable("adhoc_requests", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  details: text("details"),
  status: text("status").notNull().default("open"), // open | in_progress | waiting_on_customer | resolved | closed
  priority: text("priority").notNull().default("normal"), // low | normal | high | urgent
  assignedToEmail: text("assigned_to_email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---- Shipment tracking ----

export const shipments = pgTable("shipments", {
  id: id(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  status: text("status").notNull().default("pending"), // pending | shipped | delivered
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
});

// ---- Multi-page site builder (custom HTML/CSS per page + reusable templates) ----

export const sitePages = pgTable(
  "site_pages",
  {
    id: id(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    path: text("path").notNull(), // e.g. "/", "/about", "/warranty"
    title: text("title").notNull(),
    html: text("html").notNull().default(""),
    css: text("css").notNull().default(""),
    js: text("js").notNull().default(""),
    isHome: boolean("is_home").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    seoDescription: text("seo_description"),
    /** Which template this page was generated from, for "re-apply / update" flows. */
    templateId: text("template_id").references(() => siteTemplates.id, { onDelete: "set null" }),
    updatedByEmail: text("updated_by_email"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.tenantId, t.path) }),
);

/**
 * The template gallery. Files live on disk (built-ins ship in the repo, uploads
 * land in the API's storage dir); this table holds the browsable metadata.
 */
export const siteTemplates = pgTable("site_templates", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("General"),
  thumbnailUrl: text("thumbnail_url"),
  tags: jsonb("tags").notNull().default([]),
  /** builtin = shipped with Signet, upload = added by an employee. */
  sourceType: text("source_type").notNull().default("upload"),
  entryFile: text("entry_file").notNull().default("index.html"),
  fileCount: integer("file_count").notNull().default(0),
  sizeBytes: integer("size_bytes").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  uploadedByEmail: text("uploaded_by_email"),
  /** Legacy single-snippet templates keep working alongside file-based ones. */
  html: text("html").notNull().default(""),
  css: text("css").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One row per page a template offers, mirrored from its template.json manifest. */
export const siteTemplatePages = pgTable("site_template_pages", {
  id: id(),
  templateId: text("template_id")
    .notNull()
    .references(() => siteTemplates.id, { onDelete: "cascade" }),
  file: text("file").notNull(),
  path: text("path").notNull(),
  title: text("title").notNull(),
  isHome: boolean("is_home").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---- relations (enable db.query.* nested reads) ----

export const tenantsRelations = relations(tenants, ({ many }) => ({
  catalog: many(tenantProducts),
  users: many(users),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  tenants: many(tenantProducts),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const tenantProductsRelations = relations(tenantProducts, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantProducts.tenantId], references: [tenants.id] }),
  product: one(products, { fields: [tenantProducts.productId], references: [products.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [orders.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  lines: many(orderLines),
  invoices: many(invoices),
  shipments: many(shipments),
  returns: many(returns),
}));

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, { fields: [orderLines.orderId], references: [orders.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
  payments: many(invoicePayments),
}));

export const paymentBatchesRelations = relations(paymentBatches, ({ one, many }) => ({
  tenant: one(tenants, { fields: [paymentBatches.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [paymentBatches.userId], references: [users.id] }),
  payments: many(invoicePayments),
}));

export const invoicePaymentsRelations = relations(invoicePayments, ({ one }) => ({
  invoice: one(invoices, { fields: [invoicePayments.invoiceId], references: [invoices.id] }),
  batch: one(paymentBatches, { fields: [invoicePayments.batchId], references: [paymentBatches.id] }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [quotes.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [quotes.userId], references: [users.id] }),
  lines: many(quoteLines),
  comments: many(quoteComments),
}));

export const quoteLinesRelations = relations(quoteLines, ({ one }) => ({
  quote: one(quotes, { fields: [quoteLines.quoteId], references: [quotes.id] }),
}));

export const quoteCommentsRelations = relations(quoteComments, ({ one }) => ({
  quote: one(quotes, { fields: [quoteComments.quoteId], references: [quotes.id] }),
}));

export const returnsRelations = relations(returns, ({ one, many }) => ({
  tenant: one(tenants, { fields: [returns.tenantId], references: [tenants.id] }),
  order: one(orders, { fields: [returns.orderId], references: [orders.id] }),
  user: one(users, { fields: [returns.userId], references: [users.id] }),
  lines: many(returnLines),
}));

export const returnLinesRelations = relations(returnLines, ({ one }) => ({
  return: one(returns, { fields: [returnLines.returnId], references: [returns.id] }),
}));

export const adhocRequestsRelations = relations(adhocRequests, ({ one }) => ({
  tenant: one(tenants, { fields: [adhocRequests.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [adhocRequests.userId], references: [users.id] }),
}));

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  tenant: one(tenants, { fields: [shipments.tenantId], references: [tenants.id] }),
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
}));

export const sitePagesRelations = relations(sitePages, ({ one }) => ({
  tenant: one(tenants, { fields: [sitePages.tenantId], references: [tenants.id] }),
  template: one(siteTemplates, { fields: [sitePages.templateId], references: [siteTemplates.id] }),
}));

export const siteTemplatesRelations = relations(siteTemplates, ({ many }) => ({
  pages: many(siteTemplatePages),
}));

export const siteTemplatePagesRelations = relations(siteTemplatePages, ({ one }) => ({
  template: one(siteTemplates, { fields: [siteTemplatePages.templateId], references: [siteTemplates.id] }),
}));

