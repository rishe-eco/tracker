-- CreateTable
CREATE TABLE "NoticingFrame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "moment" TEXT,
    "unsaidNeed" TEXT,
    "visibleCues" TEXT,
    "wishedInstead" BOOLEAN NOT NULL DEFAULT false,
    "welcomeGuess" TEXT,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoticingFrame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoticingSitting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wasPrompted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoticingSitting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoticingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sittingId" TEXT NOT NULL,
    "passIndex" INTEGER NOT NULL,
    "place" TEXT,
    "person" TEXT,
    "observation" TEXT,
    "need" TEXT,
    "smallThing" TEXT,
    "capacityTags" TEXT,
    "motiveNote" TEXT,
    "caughtTypes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoticingEntry_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "NoticingSitting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoticingState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "lastCatchAt" TEXT,
    "graduationSurfaced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NoticingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NoticingFrame_userId_key" ON "NoticingFrame"("userId");

-- CreateIndex
CREATE INDEX "NoticingSitting_userId_createdAt_idx" ON "NoticingSitting"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NoticingEntry_sittingId_idx" ON "NoticingEntry"("sittingId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticingState_userId_key" ON "NoticingState"("userId");
