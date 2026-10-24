-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "apn" TEXT,
ADD COLUMN     "apn_password" TEXT,
ADD COLUMN     "apn_user" TEXT,
ADD COLUMN     "sim_carrier" TEXT,
ADD COLUMN     "sim_number" TEXT,
ADD COLUMN     "tracker_model" TEXT;

-- CreateTable
CREATE TABLE "device_imei_changes" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "old_imei" TEXT NOT NULL,
    "new_imei" TEXT NOT NULL,
    "reason" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_imei_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_imei_changes_device_id_idx" ON "device_imei_changes"("device_id");

-- AddForeignKey
ALTER TABLE "device_imei_changes" ADD CONSTRAINT "device_imei_changes_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

