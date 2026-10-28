-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "SourceReference" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "sourceDate" TEXT,
    "evidenceStatus" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "SourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widthM" DOUBLE PRECISION,
    "lengthM" DOUBLE PRECISION,
    "floatsPerModule" INTEGER,
    "floatVolumeL" INTEGER,
    "sourceId" TEXT NOT NULL,
    "sourceLocation" TEXT NOT NULL,
    "evidenceStatus" TEXT NOT NULL,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConflict" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceA" TEXT NOT NULL,
    "sourceB" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SourceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRule" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidenceStatus" TEXT NOT NULL,
    "isAssumption" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ValidationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "projectName" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL DEFAULT '',
    "requestedDeliveryDate" TIMESTAMP(3),
    "referenceText" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',
    "modulesConnected" TEXT,
    "connectionDescription" TEXT NOT NULL DEFAULT '',
    "connectionComponents" TEXT NOT NULL DEFAULT '',
    "connectionQuantitiesUnknown" BOOLEAN NOT NULL DEFAULT false,
    "anchoringType" TEXT,
    "anchoringDetails" TEXT NOT NULL DEFAULT '',
    "shoreConnection" TEXT,
    "gangwayDetails" TEXT NOT NULL DEFAULT '',
    "shoreSupportDetails" TEXT NOT NULL DEFAULT '',
    "shoreDetailsUnknown" BOOLEAN NOT NULL DEFAULT false,
    "siteNotes" TEXT NOT NULL DEFAULT '',
    "winterUse" BOOLEAN,
    "relevantProperties" TEXT[],
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionLine" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "variant" TEXT,
    "code" TEXT,
    "customName" TEXT,
    "quantity" INTEGER,
    "statedWidthM" DOUBLE PRECISION,
    "statedLengthM" DOUBLE PRECISION,
    "statedFloatsPerModule" INTEGER,

    CONSTRAINT "SubmissionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleVersion" TEXT NOT NULL,
    "submissionType" TEXT NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "report" JSONB NOT NULL,

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceReference_key_key" ON "SourceReference"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_internalId_key" ON "ProductVariant"("internalId");

-- CreateIndex
CREATE INDEX "ProductVariant_code_idx" ON "ProductVariant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_code_variant_key" ON "ProductVariant"("code", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "SourceConflict_key_key" ON "SourceConflict"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRule_ruleId_key" ON "ValidationRule"("ruleId");

-- CreateIndex
CREATE INDEX "Submission_updatedAt_idx" ON "Submission"("updatedAt");

-- CreateIndex
CREATE INDEX "SubmissionLine_submissionId_idx" ON "SubmissionLine"("submissionId");

-- CreateIndex
CREATE INDEX "ValidationRun_submissionId_createdAt_idx" ON "ValidationRun"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRule" ADD CONSTRAINT "ValidationRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionLine" ADD CONSTRAINT "SubmissionLine_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

