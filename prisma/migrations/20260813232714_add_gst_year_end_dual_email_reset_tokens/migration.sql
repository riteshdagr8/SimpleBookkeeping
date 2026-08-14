-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fileNumber" TEXT NOT NULL,
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
INSERT INTO "new_Client" ("active", "address", "businessNumber", "contactName", "createdAt", "entityType", "fileNumber", "fiscalYearEnd", "folderPath", "gstYearEnd", "hstApplicable", "hstFrequency", "id", "incorporationDate", "incorporationDocumentsReceived", "incorporationJurisdiction", "legalName", "notes", "onboardingStatus", "payrollApplicable", "payrollFrequency", "phone", "primaryEmail", "qbOnlinePayroll", "qbPasswordEncrypted", "remitterType", "reviewComplete", "reviewYears", "secondaryEmail", "tenantId", "threeMonthEligible", "updatedAt") SELECT "active", "address", "businessNumber", "contactName", "createdAt", "entityType", "fileNumber", "fiscalYearEnd", "folderPath", CASE CAST(strftime('%m', "fiscalYearEnd" / 1000, 'unixepoch') AS INTEGER) WHEN 1 THEN 'January' WHEN 2 THEN 'February' WHEN 3 THEN 'March' WHEN 4 THEN 'April' WHEN 5 THEN 'May' WHEN 6 THEN 'June' WHEN 7 THEN 'July' WHEN 8 THEN 'August' WHEN 9 THEN 'September' WHEN 10 THEN 'October' WHEN 11 THEN 'November' WHEN 12 THEN 'December' ELSE NULL END, "hstApplicable", "hstFrequency", "id", "incorporationDate", "incorporationDocumentsReceived", "incorporationJurisdiction", "legalName", "notes", "onboardingStatus", "payrollApplicable", "payrollFrequency", "phone", COALESCE("email", ''), "qbOnlinePayroll", "qbPasswordEncrypted", "remitterType", "reviewComplete", "reviewYears", NULL, "tenantId", "threeMonthEligible", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");
CREATE UNIQUE INDEX "Client_tenantId_fileNumber_key" ON "Client"("tenantId", "fileNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
