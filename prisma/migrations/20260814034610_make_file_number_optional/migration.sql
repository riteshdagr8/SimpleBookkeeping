-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fileNumber" TEXT,
    "legalName" TEXT NOT NULL,
    "contactName" TEXT,
    "businessNumber" TEXT,
    "entityType" TEXT,
    "fiscalYearEnd" DATETIME NOT NULL,
    "incorporationDate" DATETIME,
    "incorporationJurisdiction" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "primaryEmail" TEXT NOT NULL DEFAULT '',
    "secondaryEmail" TEXT,
    "folderPath" TEXT,
    "qbPasswordEncrypted" TEXT,
    "hstApplicable" BOOLEAN NOT NULL DEFAULT false,
    "hstFrequency" TEXT,
    "gstYearEnd" TEXT,
    "payrollApplicable" BOOLEAN NOT NULL DEFAULT false,
    "payrollFrequency" TEXT,
    "remitterType" TEXT,
    "qbOnlinePayroll" BOOLEAN NOT NULL DEFAULT false,
    "threeMonthEligible" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'Pending',
    "reviewComplete" BOOLEAN NOT NULL DEFAULT false,
    "reviewYears" INTEGER NOT NULL DEFAULT 3,
    "incorporationDocumentsReceived" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Client" ("active", "address", "businessNumber", "contactName", "createdAt", "entityType", "fileNumber", "fiscalYearEnd", "folderPath", "gstYearEnd", "hstApplicable", "hstFrequency", "id", "incorporationDate", "incorporationDocumentsReceived", "incorporationJurisdiction", "legalName", "notes", "onboardingStatus", "payrollApplicable", "payrollFrequency", "phone", "primaryEmail", "qbOnlinePayroll", "qbPasswordEncrypted", "remitterType", "reviewComplete", "reviewYears", "secondaryEmail", "tenantId", "threeMonthEligible", "updatedAt") SELECT "active", "address", "businessNumber", "contactName", "createdAt", "entityType", "fileNumber", "fiscalYearEnd", "folderPath", "gstYearEnd", "hstApplicable", "hstFrequency", "id", "incorporationDate", "incorporationDocumentsReceived", "incorporationJurisdiction", "legalName", "notes", "onboardingStatus", "payrollApplicable", "payrollFrequency", "phone", "primaryEmail", "qbOnlinePayroll", "qbPasswordEncrypted", "remitterType", "reviewComplete", "reviewYears", "secondaryEmail", "tenantId", "threeMonthEligible", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");
CREATE UNIQUE INDEX "Client_tenantId_fileNumber_key" ON "Client"("tenantId", "fileNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
