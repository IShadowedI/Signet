import { Request } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { internalUsers, returnActions, returnReasons, returnStages } from "../../schema";

/** Resolves the signed-in staff member's email for audit/authorship fields. */
export async function staffEmail(req: Request): Promise<string | null> {
  const userId = req.internalUser?.userId;
  if (!userId) return null;
  const user = await db.query.internalUsers.findFirst({ where: eq(internalUsers.id, userId) });
  return user?.email ?? null;
}

/** Short, human-readable document numbers (INV-, Q-, RMA-). */
export function documentNumber(prefix: string): string {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${stamp}-${rand}`;
}

/**
 * Installs the default RMA pick lists the first time they're needed. Reasons,
 * actions and stages are data rather than enums so ops can retire or add their
 * own without a deploy.
 */
export async function ensureReturnConfig(): Promise<void> {
  if ((await db.query.returnReasons.findMany()).length > 0) return;

  const reasons = await db
    .insert(returnReasons)
    .values(
      ["Wrong size", "Damaged in transit", "Defective", "Wrong item shipped", "No longer needed", "Decoration error"].map(
        (label, sortOrder) => ({ label, sortOrder }),
      ),
    )
    .returning();

  await db.insert(returnActions).values([
    { label: "Refund", sortOrder: 0, reasonIds: [] },
    { label: "Replace", sortOrder: 1, reasonIds: reasons.filter((r) => r.label !== "No longer needed").map((r) => r.id) },
    { label: "Repair", sortOrder: 2, reasonIds: reasons.filter((r) => r.label === "Defective").map((r) => r.id) },
    { label: "Store credit", sortOrder: 3, reasonIds: [] },
  ]);

  await db.insert(returnStages).values([
    { label: "Submitted", sortOrder: 0 },
    { label: "Authorised", sortOrder: 1 },
    { label: "In transit", sortOrder: 2 },
    { label: "Received", sortOrder: 3 },
    { label: "Credited", sortOrder: 4, isTerminal: true },
    { label: "Closed", sortOrder: 5, isTerminal: true },
  ]);
}
