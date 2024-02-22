-- CreateTable
CREATE TABLE "Template" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "remark" TEXT NOT NULL DEFAULT '',
    "createrId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dictionary" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" INTEGER,

    CONSTRAINT "Dictionary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_key" ON "Template"("name");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_createrId_fkey" FOREIGN KEY ("createrId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dictionary" ADD CONSTRAINT "Dictionary_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
