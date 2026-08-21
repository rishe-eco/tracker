-- AlterTable
ALTER TABLE "SkillAttempt" ADD COLUMN "rung" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SkillModuleProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'not_started',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "partialResponse" TEXT,
    "consecutiveAtCriterion" INTEGER NOT NULL DEFAULT 0,
    "lastCriterionDay" TEXT,
    "rung" TEXT NOT NULL DEFAULT 'assisted',
    "masteredAt" DATETIME,
    "reviewIntervalIndex" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillModuleProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SkillModuleProgress" ("consecutiveAtCriterion", "createdAt", "currentStep", "id", "lastCriterionDay", "masteredAt", "moduleKey", "nextReviewAt", "partialResponse", "reviewIntervalIndex", "skillKey", "state", "updatedAt", "userId") SELECT "consecutiveAtCriterion", "createdAt", "currentStep", "id", "lastCriterionDay", "masteredAt", "moduleKey", "nextReviewAt", "partialResponse", "reviewIntervalIndex", "skillKey", "state", "updatedAt", "userId" FROM "SkillModuleProgress";
DROP TABLE "SkillModuleProgress";
ALTER TABLE "new_SkillModuleProgress" RENAME TO "SkillModuleProgress";
CREATE INDEX "SkillModuleProgress_userId_nextReviewAt_idx" ON "SkillModuleProgress"("userId", "nextReviewAt");
CREATE UNIQUE INDEX "SkillModuleProgress_userId_skillKey_moduleKey_key" ON "SkillModuleProgress"("userId", "skillKey", "moduleKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
