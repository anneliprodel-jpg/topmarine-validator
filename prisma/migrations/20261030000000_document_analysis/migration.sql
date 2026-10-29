-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "conflicts" JSONB,
ADD COLUMN     "corrections" JSONB,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "extraction" JSONB,
ADD COLUMN     "extractionError" TEXT,
ADD COLUMN     "extractionFinishedAt" TIMESTAMP(3),
ADD COLUMN     "extractionModel" TEXT,
ADD COLUMN     "extractionProvider" TEXT,
ADD COLUMN     "extractionStage" TEXT,
ADD COLUMN     "extractionStartedAt" TIMESTAMP(3),
ADD COLUMN     "extractionStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "extractionVersion" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "SubmissionLine" ADD COLUMN     "statedFloatsTotal" INTEGER;

-- AlterTable
ALTER TABLE "ValidationRun" ADD COLUMN     "conflicts" JSONB,
ADD COLUMN     "documents" JSONB,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "extractor" JSONB;

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "kind" TEXT,
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "ocrUsed" BOOLEAN NOT NULL DEFAULT false,
    "units" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceDocument_submissionId_idx" ON "SourceDocument"("submissionId");

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

