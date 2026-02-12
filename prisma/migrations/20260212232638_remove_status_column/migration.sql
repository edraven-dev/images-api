/*
  Warnings:

  - You are about to drop the column `status` on the `files` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "files_status_idx";

-- AlterTable
ALTER TABLE "files" DROP COLUMN "status";
