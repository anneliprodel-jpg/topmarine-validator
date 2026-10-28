-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "freeboardPdfM" DOUBLE PRECISION,
ADD COLUMN     "freeboardWorkbookM" DOUBLE PRECISION,
ADD COLUMN     "heightPdfM" DOUBLE PRECISION,
ADD COLUMN     "heightWorkbookM" DOUBLE PRECISION,
ADD COLUMN     "loadKg" INTEGER,
ADD COLUMN     "loadKnPerM2" DOUBLE PRECISION,
ADD COLUMN     "weightKg" INTEGER;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "boatLengthM" DOUBLE PRECISION,
ADD COLUMN     "siteCurrentSpeedMs" DOUBLE PRECISION,
ADD COLUMN     "siteWaveHeightM" DOUBLE PRECISION;

