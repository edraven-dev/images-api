-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "files_status_idx" ON "files"("status");

-- CreateIndex
CREATE INDEX "files_checksum_idx" ON "files"("checksum");
