CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "original_width" INTEGER NOT NULL,
    "original_height" INTEGER NOT NULL,
    "processed_width" INTEGER,
    "processed_height" INTEGER,
    "original_file_id" TEXT NOT NULL,
    "processed_file_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "images_created_at_idx" ON "images"("created_at");

-- CreateIndex
CREATE INDEX "images_status_idx" ON "images"("status");

-- CreateIndex
CREATE INDEX "images_title_idx" ON "images" USING GIN ("title" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_processed_file_id_fkey" FOREIGN KEY ("processed_file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
