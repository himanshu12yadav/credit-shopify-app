-- AlterTable
ALTER TABLE "CreditSettings" ADD COLUMN "externalApiKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CreditSettings_externalApiKey_key" ON "CreditSettings"("externalApiKey");
