import { NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/auth";
import { clientInputSchema, getClient, updateClient, deleteClient } from "@/lib/services/clients";
import { findInvalidPendingObligations } from "@/lib/services/obligations";
import { prisma } from "@/lib/prisma";
import type { ComplianceConfig } from "@/lib/obligation-matrix";
import { joinPayFrequencies } from "@/lib/payroll-frequency";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user.tenantId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Staff cannot view inactive clients.
  if (!client.active && user.role !== "Admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ client });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // requireUser() redirects on failure by throwing; keep it outside the try so
  // the redirect isn't swallowed and turned into a 500.
  const user = await requireUser();
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = clientInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await getClient(user.tenantId, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!existing.active && user.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Safe entity/jurisdiction update: if the entity type or jurisdiction
    // changed and that invalidates future pending auto-generated obligations,
    // require explicit confirmation before purging them. Historical/completed
    // rows are never touched.
    const entityChanged =
      (parsed.data.entityType ?? null) !== (existing.entityType ?? null);
    const jurisdictionChanged =
      (parsed.data.incorporationJurisdiction ?? null) !== (existing.incorporationJurisdiction ?? null);
    const confirm = (body as { confirm?: boolean } | null)?.confirm === true;

    if ((entityChanged || jurisdictionChanged) && !confirm) {
      const newConfig: ComplianceConfig = {
        entityType: parsed.data.entityType ?? existing.entityType,
        incorporationJurisdiction: parsed.data.incorporationJurisdiction ?? existing.incorporationJurisdiction,
        incorporationDate: parsed.data.incorporationDate ?? existing.incorporationDate,
        hstApplicable: parsed.data.hstApplicable ?? existing.hstApplicable,
        hstFrequency: parsed.data.hstFrequency ?? existing.hstFrequency,
        payrollApplicable: parsed.data.payrollApplicable ?? existing.payrollApplicable,
        payrollFrequency:
          parsed.data.payrollFrequencies !== undefined
            ? joinPayFrequencies(parsed.data.payrollFrequencies)
            : existing.payrollFrequency,
        remitterType: parsed.data.remitterType ?? existing.remitterType,
      };
      const invalid = await findInvalidPendingObligations(id, newConfig);
      if (invalid.length > 0) {
        const byType = new Map<string, number>();
        for (const o of invalid) byType.set(o.filingType, (byType.get(o.filingType) ?? 0) + 1);
        return NextResponse.json({
          needsConfirmation: true,
          affectedCount: invalid.length,
          affectedTypes: [...byType.entries()].map(([type, count]) => ({ type, count })),
        });
      }
    }

    // Reject a review-locked year-count change before anything is deleted, so a
    // failed save can't leave the schedule purged while the client is unchanged.
    if (existing.reviewComplete && parsed.data.reviewYears !== undefined && parsed.data.reviewYears !== existing.reviewYears) {
      return NextResponse.json(
        { error: "Review is complete — unmark 'Review complete' before changing the year count." },
        { status: 400 }
      );
    }

    // Confirmed (or nothing invalidated): purge invalid future-pending rows, then save.
    if (entityChanged || jurisdictionChanged) {
      const newConfig: ComplianceConfig = {
        entityType: parsed.data.entityType ?? existing.entityType,
        incorporationJurisdiction: parsed.data.incorporationJurisdiction ?? existing.incorporationJurisdiction,
        incorporationDate: parsed.data.incorporationDate ?? existing.incorporationDate,
        hstApplicable: parsed.data.hstApplicable ?? existing.hstApplicable,
        hstFrequency: parsed.data.hstFrequency ?? existing.hstFrequency,
        payrollApplicable: parsed.data.payrollApplicable ?? existing.payrollApplicable,
        payrollFrequency:
          parsed.data.payrollFrequencies !== undefined
            ? joinPayFrequencies(parsed.data.payrollFrequencies)
            : existing.payrollFrequency,
        remitterType: parsed.data.remitterType ?? existing.remitterType,
      };
      const invalid = await findInvalidPendingObligations(id, newConfig);
      if (invalid.length > 0) {
        await prisma.filingObligation.deleteMany({ where: { id: { in: invalid.map((o) => o.id) } } });
      }
    }

    const result = await updateClient(user.tenantId, user.id, id, parsed.data);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Review is complete — unmark 'Review complete' before changing the year count." },
        { status: 400 }
      );
    }
    return NextResponse.json({ client: result.client });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    if (msg.includes("already in use")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const ok = await deleteClient(user.tenantId, user.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
