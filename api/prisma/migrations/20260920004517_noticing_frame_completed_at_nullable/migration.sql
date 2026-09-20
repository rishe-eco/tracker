-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NoticingFrame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "moment" TEXT,
    "unsaidNeed" TEXT,
    "visibleCues" TEXT,
    "wishedInstead" BOOLEAN NOT NULL DEFAULT false,
    "welcomeGuess" TEXT,
    "completedAt" DATETIME,
    CONSTRAINT "NoticingFrame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NoticingFrame" ("completedAt", "id", "moment", "unsaidNeed", "userId", "visibleCues", "welcomeGuess", "wishedInstead") SELECT "completedAt", "id", "moment", "unsaidNeed", "userId", "visibleCues", "welcomeGuess", "wishedInstead" FROM "NoticingFrame";
DROP TABLE "NoticingFrame";
ALTER TABLE "new_NoticingFrame" RENAME TO "NoticingFrame";
CREATE UNIQUE INDEX "NoticingFrame_userId_key" ON "NoticingFrame"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
