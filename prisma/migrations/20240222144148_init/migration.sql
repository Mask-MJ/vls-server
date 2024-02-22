/*
  Warnings:

  - You are about to drop the column `createrId` on the `Valve` table. All the data in the column will be lost.
  - You are about to drop the `Dictionary` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Dictionary" DROP CONSTRAINT "Dictionary_templateId_fkey";

-- DropForeignKey
ALTER TABLE "Valve" DROP CONSTRAINT "Valve_createrId_fkey";

-- AlterTable
ALTER TABLE "Valve" DROP COLUMN "createrId";

-- DropTable
DROP TABLE "Dictionary";

-- CreateTable
CREATE TABLE "Dict" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" INTEGER NOT NULL,

    CONSTRAINT "Dict_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Dict" ADD CONSTRAINT "Dict_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
