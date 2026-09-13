-- CreateTable
CREATE TABLE "CreditRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'ORDER_PAID',
    "creditType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "creditValue" REAL NOT NULL DEFAULT 5.0,
    "minSpend" REAL NOT NULL DEFAULT 0.0,
    "maxCredit" REAL,
    "customerTag" TEXT,
    "expiryDays" INTEGER NOT NULL DEFAULT 90,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "orderId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "action" TEXT NOT NULL DEFAULT 'CREDIT',
    "source" TEXT NOT NULL DEFAULT 'CASHBACK',
    "ruleId" TEXT,
    "shopifyTransactionId" TEXT,
    "note" TEXT,
    "expiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'EVENT',
    "targetSegment" TEXT,
    "dropAmount" REAL DEFAULT 0.0,
    "expiryDays" INTEGER DEFAULT 30,
    "recipientCount" INTEGER DEFAULT 0,
    "totalDisbursed" REAL DEFAULT 0.0,
    "bonusMultiplier" REAL NOT NULL DEFAULT 1.0,
    "bonusFixedAmount" REAL NOT NULL DEFAULT 0.0,
    "minSpend" REAL NOT NULL DEFAULT 0.0,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "referrerEmail" TEXT,
    "referralCode" TEXT NOT NULL,
    "advocateRewardAmount" REAL NOT NULL DEFAULT 10.0,
    "friendRewardAmount" REAL NOT NULL DEFAULT 10.0,
    "claimsCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CreditSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultExpiryDays" INTEGER NOT NULL DEFAULT 90,
    "autoNotifyCustomer" BOOLEAN NOT NULL DEFAULT true,
    "cashbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cashbackRate" REAL NOT NULL DEFAULT 5.0,
    "returnCreditBonusPercent" REAL NOT NULL DEFAULT 10.0,
    "referralsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "welcomeBonusEnabled" BOOLEAN NOT NULL DEFAULT true,
    "welcomeBonusAmount" REAL NOT NULL DEFAULT 10.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VipTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSpend" REAL NOT NULL DEFAULT 0.0,
    "cashbackRate" REAL NOT NULL DEFAULT 5.0,
    "perks" TEXT,
    "badgeColor" TEXT NOT NULL DEFAULT '#6b7280',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PixelEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'standard',
    "shopifyEventId" TEXT,
    "clientId" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT,
    "orderId" TEXT,
    "checkoutToken" TEXT,
    "currency" TEXT,
    "value" REAL,
    "subtotal" REAL,
    "lineItemsCount" INTEGER NOT NULL DEFAULT 0,
    "discountCodes" TEXT,
    "hasStoreCredit" BOOLEAN NOT NULL DEFAULT false,
    "storeCreditAmount" REAL,
    "raw" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CreditRule_shop_isActive_idx" ON "CreditRule"("shop", "isActive");

-- CreateIndex
CREATE INDEX "CreditRule_shop_trigger_idx" ON "CreditRule"("shop", "trigger");

-- CreateIndex
CREATE INDEX "CreditLedger_shop_createdAt_idx" ON "CreditLedger"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedger_shop_action_idx" ON "CreditLedger"("shop", "action");

-- CreateIndex
CREATE INDEX "CreditLedger_shop_customerId_idx" ON "CreditLedger"("shop", "customerId");

-- CreateIndex
CREATE INDEX "CreditLedger_shop_source_idx" ON "CreditLedger"("shop", "source");

-- CreateIndex
CREATE INDEX "CreditLedger_shop_orderId_idx" ON "CreditLedger"("shop", "orderId");

-- CreateIndex
CREATE INDEX "Campaign_shop_isActive_idx" ON "Campaign"("shop", "isActive");

-- CreateIndex
CREATE INDEX "Campaign_shop_status_idx" ON "Campaign"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referralCode_key" ON "Referral"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_shop_referrerCustomerId_idx" ON "Referral"("shop", "referrerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditSettings_shop_key" ON "CreditSettings"("shop");

-- CreateIndex
CREATE INDEX "VipTier_shop_orderIndex_idx" ON "VipTier"("shop", "orderIndex");

-- CreateIndex
CREATE INDEX "PixelEvent_shop_eventName_idx" ON "PixelEvent"("shop", "eventName");

-- CreateIndex
CREATE INDEX "PixelEvent_shop_createdAt_idx" ON "PixelEvent"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "PixelEvent_shop_checkoutToken_idx" ON "PixelEvent"("shop", "checkoutToken");

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");
