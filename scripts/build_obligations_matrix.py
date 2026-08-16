"""Build obligations_matrix.xlsx — how the app generates obligations by client fields.

Source of truth: src/lib/services/obligations.ts (generateObligationsForClient)
and src/lib/compliance-rules.ts (as of 2026-08-14, commit 1e0ccfe).
"""
from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT = "obligations_matrix.xlsx"

FONT = "Arial"
HDR_FILL = PatternFill("solid", fgColor="1F4E79")   # dark blue
HDR_FONT = Font(name=FONT, bold=True, color="FFFFFF", size=11)
BODY_FONT = Font(name=FONT, size=10)
MUTED_FONT = Font(name=FONT, size=10, color="7F7F7F")
BOLD_FONT = Font(name=FONT, bold=True, size=10)
WRAP = Alignment(wrap_text=True, vertical="top")
THIN = Side(style="thin", color="C9C9C9")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
ZERO_FILL = PatternFill("solid", fgColor="FDE9E9")    # light red: produces 0 rows
ALT_FILL = PatternFill("solid", fgColor="EAF1F8")     # light blue for grouping

def style_header(ws, ncols, row=1):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = HDR_FONT
        cell.fill = HDR_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="left")
        cell.border = BORDER

def write_table(ws, headers, rows, widths, start_row=1):
    for j, h in enumerate(headers, 1):
        ws.cell(row=start_row, column=j, value=h)
    style_header(ws, len(headers), start_row)
    for i, r in enumerate(rows, start_row + 1):
        for j, v in enumerate(r, 1):
            cell = ws.cell(row=i, column=j, value=v)
            cell.font = BODY_FONT
            cell.alignment = WRAP
            cell.border = BORDER
    for j, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(j)].width = w
    return start_row + len(rows)

def note(ws, row, text):
    cell = ws.cell(row=row, column=1, value=text)
    cell.font = MUTED_FONT
    cell.alignment = WRAP
    return row + 1

wb = Workbook()

# ---------------- Sheet 1: Overview ----------------
ws = wb.active
ws.title = "Overview"
ws["A1"] = "SimpleBookkeeping — How obligations are generated"
ws["A1"].font = Font(name=FONT, bold=True, size=15, color="1F4E79")
ws["A2"] = "Source: src/lib/services/obligations.ts  +  src/lib/compliance-rules.ts  (2026-08-14)"
ws["A2"].font = MUTED_FONT

r = 4
ws.cell(row=r, column=1, value="Rule that applies to every obligation type:").font = BOLD_FONT
r += 1
for line in [
    "1. The client's historical review must be marked complete (reviewComplete = true), or NO obligations are generated.",
    "2. Every row is gated on its due date (or its period) falling inside the rolling 12-month window:",
    "      windowStart = 1st of the current month;  windowEnd = windowStart + 12 months.",
    "3. Re-generating is idempotent: a row is only inserted if an identical auto-generated row (type + period + due) does not already exist.",
    "4. Jurisdiction changes re-sync: OntarioAnnualReturn rows are deleted when jurisdiction is not Ontario; FederalAnnualReturn when not Federal.",
]:
    ws.cell(row=r, column=1, value=line).font = BODY_FONT
    r += 1

r += 1
hdr = ["Obligation type", "Trigger (client fields)", "Rows", "Period", "Filing due", "Payment due"]
rows = [
    ["T2", "Always (every client, once review is complete)", "0-1", "prior FYE -> FYE", "FYE + 6 months", "FYE + 2 months; +3 if threeMonthEligible"],
    ["HST", "hstApplicable = ON  AND  hstFrequency set", "see HST sheet", "see HST sheet", "see HST sheet", "= filing due"],
    ["OntarioAnnualReturn", "incorporationJurisdiction = Ontario (or empty)", "0-1", "prior FYE -> FYE", "FYE + 6 months", "-"],
    ["FederalAnnualReturn", "incorporationJurisdiction = Federal  AND  incorporationDate set", "0-1", "due - 60 days -> due", "incorporation anniversary + 60 days", "-"],
    ["T4 / T4A / T5", "Always (emitted together as 3 rows)", "0 or 3", "Jan 1 -> Dec 31 of FYE year", "Feb 28 of FYE year + 1", "-"],
    ["PayrollRemittance", "payrollApplicable = ON  AND  remitterType set", "see Payroll sheet", "see Payroll sheet", "see Payroll sheet", "= filing due"],
    ["PayrollProcessing", "payrollApplicable = ON  AND  payrollFrequency set", "see Payroll sheet", "see Payroll sheet", "= period end", "= period end"],
]
r = write_table(ws, hdr, rows, [22, 34, 12, 26, 30, 30], start_row=r)
r += 1
r = note(ws, r, "Period/due columns reference the definitions below. Dates are raw calendar dates — no weekend/holiday adjustment (deferred feature).")

# ---------------- Sheet 2: HST ----------------
ws = wb.create_sheet("HST")
ws["A1"] = "HST obligations by frequency"
ws["A1"].font = Font(name=FONT, bold=True, size=14, color="1F4E79")
hdr = ["hstFrequency", "Rows", "Anchor", "Period", "Filing due / payment due"]
rows = [
    ["Monthly", 12, "rolling window (NOT gstYearEnd)", "1st -> last day of each month", "last day of the month following the period"],
    ["Quarterly", "up to 8", "gstYearEnd month if set, else calendar quarters", "3-month blocks ending at quarter-end", "last day of the month after the quarter end"],
    ["Annual", "up to 2", "gstYearEnd month if set, else FYE", "prior year-end -> year-end", "year-end + 3 months"],
    ["SelfEmployed", "0-1", "FYE must be Dec 31 (else 0 rows)", "FYE -> next FYE", "filing Jun 15; payment Apr 30 (year after FYE)"],
]
r = write_table(ws, hdr, rows, [16, 10, 34, 34, 42], start_row=3)
# Mark the zero-producing config
ws.cell(row=6, column=2).fill = ZERO_FILL
ws.cell(row=6, column=2).comment = Comment("SelfEmployed with a non-Dec-31 FYE produces 0 rows", "SimpleBookkeeping")
r = ws.max_row + 2
r = note(ws, r, "Monthly HST is anchored to the rolling window (not gstYearEnd) — the H3 fix. gstYearEnd only affects Quarterly/Annual/SelfEmployed anchoring.")

# ---------------- Sheet 3: Payroll ----------------
ws = wb.create_sheet("Payroll")
ws["A1"] = "Payroll obligations"
ws["A1"].font = Font(name=FONT, bold=True, size=14, color="1F4E79")

ws["A3"] = "PayrollRemittance — by remitterType"
ws["A3"].font = BOLD_FONT
hdr = ["remitterType", "Rows", "Period", "Filing due / payment due"]
rows = [
    ["Regular", 12, "monthly, 1st -> last day", "15th of the month after the period"],
    ["Quarterly", 4, "calendar quarters", "15th of the month after the quarter end"],
    ["Accelerated1", 0, "-", "-"],
    ["Accelerated2", 0, "-", "-"],
]
r = write_table(ws, hdr, rows, [16, 8, 30, 34], start_row=4)
ws.cell(row=8, column=2).fill = ZERO_FILL
ws.cell(row=9, column=2).fill = ZERO_FILL
ws.cell(row=8, column=2).comment = Comment("Accelerated remitter rule math not implemented -> 0 rows (known gap)", "SimpleBookkeeping")
ws.cell(row=9, column=2).comment = Comment("Accelerated remitter rule math not implemented -> 0 rows (known gap)", "SimpleBookkeeping")

r = ws.max_row + 3
ws.cell(row=r, column=1, value="PayrollProcessing — by payrollFrequency").font = BOLD_FONT
r += 1
hdr = ["payrollFrequency", "Rows", "Period", "Filing due / payment due"]
rows = [
    ["Weekly", 52, "7-day runs", "= period end"],
    ["Bi-Weekly", 26, "14-day runs", "= period end"],
    ["Semi-Monthly", 24, "1st-15th, 16th-last day", "= period end"],
    ["Monthly", 12, "1st -> last day", "= period end"],
]
write_table(ws, hdr, rows, [16, 8, 30, 22], start_row=r)

for j, w in enumerate([16, 8, 30, 34], 1):
    ws.column_dimensions[get_column_letter(j)].width = w

# ---------------- Sheet 4: Examples ----------------
ws = wb.create_sheet("Examples")
ws["A1"] = "Worked examples (illustrative) — what a generated schedule looks like"
ws["A1"].font = Font(name=FONT, bold=True, size=14, color="1F4E79")

hdr = ["Client config", "Expected obligations (rolling window)"]
examples = [
    ["Review complete; jurisdiction Ontario; FYE Dec 31",
     "T2, OntarioAnnualReturn, T4, T4A, T5 — plus HST/payroll if enabled"],
    ["+ hstApplicable, hstFrequency=Monthly",
     "HST x 12 (rolling months) added to the above"],
    ["+ payrollApplicable, remitterType=Regular, payrollFrequency=Weekly",
     "PayrollRemittance x 12 + PayrollProcessing x 52 added to the above"],
    ["jurisdiction Federal + incorporationDate set",
     "OntarioAnnualReturn dropped; FederalAnnualReturn added"],
    ["hstFrequency=SelfEmployed but FYE not Dec 31",
     "No HST rows at all (warning shown on schedule page)"],
    ["remitterType=Accelerated1 or Accelerated2",
     "No PayrollRemittance rows (rule not implemented)"],
]
r = write_table(ws, hdr, examples, [42, 70], start_row=3)
r += 1
r = note(ws, r, "Totals are approximate: a row is only included when its due date/period lands inside the current rolling 12-month window, so exact counts vary with today's date.")

wb.save(OUT)
print(f"saved {OUT}")
