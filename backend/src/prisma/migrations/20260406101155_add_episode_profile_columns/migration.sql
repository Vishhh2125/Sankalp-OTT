-- AlterTable
ALTER TABLE "episodes" ADD COLUMN     "completed_profiles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_profiles" INTEGER NOT NULL DEFAULT 4;
