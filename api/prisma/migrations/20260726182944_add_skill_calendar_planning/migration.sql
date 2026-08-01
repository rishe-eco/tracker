-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SkillProfile" (
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
    "calendarPlanningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "planTimeOfDay" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SkillProfile" ("aiConsentAt", "assessmentCompletedAt", "assessmentSkipped", "assessmentStartedAt", "contentVersion", "createdAt", "id", "locale", "recommendedOrder", "skillKey", "updatedAt", "userId") SELECT "aiConsentAt", "assessmentCompletedAt", "assessmentSkipped", "assessmentStartedAt", "contentVersion", "createdAt", "id", "locale", "recommendedOrder", "skillKey", "updatedAt", "userId" FROM "SkillProfile";
DROP TABLE "SkillProfile";
ALTER TABLE "new_SkillProfile" RENAME TO "SkillProfile";
CREATE UNIQUE INDEX "SkillProfile_userId_skillKey_key" ON "SkillProfile"("userId", "skillKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
