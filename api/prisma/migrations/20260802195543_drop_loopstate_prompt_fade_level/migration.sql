/*
  Warnings:

  - You are about to drop the column `promptFadeLevel` on the `LoopState` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoopState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "graduationSurfaced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoopState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LoopState" ("contentVersion", "createdAt", "graduationSurfaced", "id", "updatedAt", "userId") SELECT "contentVersion", "createdAt", "graduationSurfaced", "id", "updatedAt", "userId" FROM "LoopState";
DROP TABLE "LoopState";
ALTER TABLE "new_LoopState" RENAME TO "LoopState";
CREATE UNIQUE INDEX "LoopState_userId_key" ON "LoopState"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
