import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateWorkflow, modelByType } from "@/lib/workflows/service";
import { openInteraction, closeInteraction } from "@/lib/workflows/interactions";
import { getConfigByType } from "@/lib/workflows/configs";
import type { WorkflowType } from "@/lib/workflows/types";

/**
 * Build a PUT handler for a workflow type. Validates the body, scopes the
 * obligation to the tenant, and dispatches the update.
 */
export function buildWorkflowPutHandler(type: WorkflowType) {
  return async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const user = await requireUser();
    const { id: obligationId } = await params;
    const config = getConfigByType(type);
    if (!config) return NextResponse.json({ error: "Unknown workflow" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as unknown;

    // The body shape: { checklist, fields, waitingOnClient, interactionNote }.
    const bodySchema = z.object({
      checklist: z.record(z.boolean()).default({}),
      fields: z.record(z.union([z.string(), z.number(), z.null()])).default({}),
      waitingOnClient: z.boolean().optional(),
      interactionNote: z.string().max(2000).optional(),
    });

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    // Tenant scope check: the obligation must belong to a client in the
    // current tenant.
    const obligation = await prisma.filingObligation.findFirst({
      where: { id: obligationId, client: { tenantId: user.tenantId } },
      select: { id: true, filingType: true },
    });
    if (!obligation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!config.filingTypes.includes(obligation.filingType)) {
      return NextResponse.json({ error: "Wrong workflow for filing type" }, { status: 400 });
    }

    // Validate that any filing date is not in the future.
    const filingDateStr = parsed.data.fields.filingDate;
    if (filingDateStr != null && filingDateStr !== "") {
      const fd = new Date(String(filingDateStr));
      const today = new Date();
      today.setUTCHours(23, 59, 59, 999);
      if (fd.getTime() > today.getTime()) {
        return NextResponse.json(
          { error: "Filing date cannot be in the future" },
          { status: 400 }
        );
      }
    }

    const updated = await updateWorkflow(
      user.tenantId,
      user.id,
      type,
      obligationId,
      {
        checklist: parsed.data.checklist,
        fields: parsed.data.fields,
        waitingOnClient: parsed.data.waitingOnClient,
      }
    );

    // Handle the "Waiting on client" interaction: open or close based on the
    // checkbox. We close any existing Pending interaction first; then if the
    // checkbox is on, open a new one with the current note.
    if (parsed.data.waitingOnClient === false) {
      await closeInteraction(config.interactionType, obligationId);
    } else if (parsed.data.waitingOnClient === true) {
      await openInteraction(
        user.tenantId,
        config.interactionType,
        obligationId,
        parsed.data.interactionNote ?? ""
      );
    }

    return NextResponse.json({ ok: true, status: updated.status });
  };
}

/**
 * Build a POST handler that closes the open interaction (the "Received" button
 * on the editor). Used at /api/<slug>/[id]/interaction/close.
 */
export function buildInteractionCloseHandler(type: WorkflowType) {
  return async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const user = await requireUser();
    const { id: obligationId } = await params;
    const config = getConfigByType(type);
    if (!config) return NextResponse.json({ error: "Unknown workflow" }, { status: 400 });

    const obligation = await prisma.filingObligation.findFirst({
      where: { id: obligationId, client: { tenantId: user.tenantId } },
      select: { id: true },
    });
    if (!obligation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const closed = await closeInteraction(config.interactionType, obligationId);

    // Re-derive status now that waitingOnClient is no longer active.
    // Fetch the current workflow row to get the latest checklist and fields.
    const m = modelByType(type);
    const row = await m.findUnique({ where: { obligationId } }) as { checklist: string; [k: string]: unknown } | null;
    if (row) {
      let checklist: Record<string, boolean> = {};
      try { const p = JSON.parse(row.checklist as string); if (p && typeof p === "object" && !Array.isArray(p)) checklist = p; } catch {}
      const fields: Record<string, string | number | null | undefined> = {};
      for (const f of config.fields) {
        fields[f.key] = (row[f.key] as string | number | null | undefined) ?? null;
      }
      await updateWorkflow(user.tenantId, user.id, type, obligationId, {
        checklist,
        fields,
        waitingOnClient: false,
      });
    }

    return NextResponse.json({ ok: true, closed: !!closed });
  };
}
