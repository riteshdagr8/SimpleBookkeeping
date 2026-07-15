-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fileNumber" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "businessNumber" TEXT,
    "entityType" TEXT,
    "fiscalYearEnd" DATETIME NOT NULL,
    "incorporationDate" DATETIME,
    "incorporationJurisdiction" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "folderPath" TEXT,
    "qbPasswordEncrypted" TEXT,
    "hstApplicable" BOOLEAN NOT NULL DEFAULT false,
    "hstFrequency" TEXT,
    "payrollApplicable" BOOLEAN NOT NULL DEFAULT false,
    "payrollFrequency" TEXT,
    "remitterType" TEXT,
    "threeMonthEligible" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'Pending',
    "reviewComplete" BOOLEAN NOT NULL DEFAULT false,
    "reviewYears" INTEGER NOT NULL DEFAULT 3,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Client" ("active", "address", "businessNumber", "createdAt", "email", "entityType", "fileNumber", "fiscalYearEnd", "folderPath", "hstApplicable", "hstFrequency", "id", "incorporationDate", "incorporationJurisdiction", "legalName", "notes", "onboardingStatus", "payrollApplicable", "payrollFrequency", "phone", "qbPasswordEncrypted", "remitterType", "reviewComplete", "tenantId", "threeMonthEligible", "updatedAt") SELECT "active", "address", "businessNumber", "createdAt", "email", "entityType", "fileNumber", "fiscalYearEnd", "folderPath", "hstApplicable", "hstFrequency", "id", "incorporationDate", "incorporationJurisdiction", "legalName", "notes", "onboardingStatus", "payrollApplicable", "payrollFrequency", "phone", "qbPasswordEncrypted", "remitterType", "reviewComplete", "tenantId", "threeMonthEligible", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");
CREATE UNIQUE INDEX "Client_tenantId_fileNumber_key" ON "Client"("tenantId", "fileNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
