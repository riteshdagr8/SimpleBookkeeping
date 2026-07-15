-- CreateTable
CREATE TABLE "PayrollProcessing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obligationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "employeeCount" INTEGER,
    "totalRemittance" REAL,
    "employees" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollProcessing_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FilingObligation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GSTHSTProcessing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obligationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "filingDate" DATETIME,
    "amount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GSTHSTProcessing_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FilingObligation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "T2Processing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obligationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "filingDate" DATETIME,
    "taxBalance" REAL,
    "nextFyeDate" DATETIME,
    "nextFilingDeadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "T2Processing_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FilingObligation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OntarioARProcessing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obligationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "filingDate" DATETIME,
    "confirmationNumber" TEXT,
    "fee" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OntarioARProcessing_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FilingObligation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FederalARProcessing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obligationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "filingDate" DATETIME,
    "confirmationNumber" TEXT,
    "companyKeyStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FederalARProcessing_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FilingObligation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InfoReturnProcessing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obligationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "filingDate" DATETIME,
    "craConfirmationNumber" TEXT,
    "recipientCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InfoReturnProcessing_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FilingObligation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "dateInitiated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateClosed" DATETIME,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientInteraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollProcessing_obligationId_key" ON "PayrollProcessing"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "GSTHSTProcessing_obligationId_key" ON "GSTHSTProcessing"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "T2Processing_obligationId_key" ON "T2Processing"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "OntarioARProcessing_obligationId_key" ON "OntarioARProcessing"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "FederalARProcessing_obligationId_key" ON "FederalARProcessing"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "InfoReturnProcessing_obligationId_key" ON "InfoReturnProcessing"("obligationId");

-- CreateIndex
CREATE INDEX "ClientInteraction_tenantId_targetType_targetId_idx" ON "ClientInteraction"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ClientInteraction_targetType_targetId_status_idx" ON "ClientInteraction"("targetType", "targetId", "status");
