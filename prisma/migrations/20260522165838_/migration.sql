-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_requesterId_fkey";

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "externalEmail" TEXT,
ADD COLUMN     "externalName" TEXT,
ADD COLUMN     "externalPhone" TEXT,
ALTER COLUMN "requesterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
