-- CreateTable
CREATE TABLE "SkillProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "assessmentStartedAt" DATETIME,
    "assessmentCompletedAt" DATETIME,
    "assessmentSkipped" BOOLEAN NOT NULL DEFAULT false,
    "recommendedOrder" TEXT,
    "aiConsentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillModuleProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'not_started',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "partialResponse" TEXT,
    "consecutiveAtCriterion" INTEGER NOT NULL DEFAULT 0,
    "lastCriterionDay" TEXT,
    "masteredAt" DATETIME,
    "reviewIntervalIndex" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillModuleProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "moduleKey" TEXT,
    "itemId" TEXT NOT NULL,
    "formId" TEXT,
    "mode" TEXT NOT NULL,
    "probeId" TEXT,
    "responseText" TEXT,
    "revisionOfAttemptId" TEXT,
    "scores" TEXT NOT NULL,
    "behaviors" TEXT,
    "confidence" INTEGER,
    "latencyMs" INTEGER,
    "contentVersion" TEXT NOT NULL,
    "rubricVersion" TEXT,
    "judgeModelVersion" TEXT,
    "scoredBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillAttempt_probeId_fkey" FOREIGN KEY ("probeId") REFERENCES "SkillProbe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillProbe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "timepoint" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "scheduledFor" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "totals" TEXT,
    "contentVersion" TEXT NOT NULL,
    "rubricVersion" TEXT,
    "judgeModelVersion" TEXT,
    "selfReport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillProbe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillCheckEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT,
    "offsetMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillCheckEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SkillAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SkillProfile_userId_skillKey_key" ON "SkillProfile"("userId", "skillKey");

-- CreateIndex
CREATE INDEX "SkillModuleProgress_userId_nextReviewAt_idx" ON "SkillModuleProgress"("userId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillModuleProgress_userId_skillKey_moduleKey_key" ON "SkillModuleProgress"("userId", "skillKey", "moduleKey");

-- CreateIndex
CREATE INDEX "SkillAttempt_userId_skillKey_moduleKey_idx" ON "SkillAttempt"("userId", "skillKey", "moduleKey");

-- CreateIndex
CREATE INDEX "SkillAttempt_probeId_idx" ON "SkillAttempt"("probeId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProbe_userId_skillKey_timepoint_key" ON "SkillProbe"("userId", "skillKey", "timepoint");

-- CreateIndex
CREATE INDEX "SkillCheckEvent_attemptId_idx" ON "SkillCheckEvent"("attemptId");
