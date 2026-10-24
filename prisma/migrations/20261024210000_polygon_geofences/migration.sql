-- CreateEnum
CREATE TYPE "GeofenceShape" AS ENUM ('circle', 'polygon');

-- AlterTable
ALTER TABLE "geofences" ADD COLUMN     "polygon" JSONB,
ADD COLUMN     "shape" "GeofenceShape" NOT NULL DEFAULT 'circle';

