-- CreateTable
CREATE TABLE "FrameCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrameCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoopSitting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "breathTaken" BOOLEAN NOT NULL DEFAULT false,
    "wasPrompted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoopSitting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoopEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sittingId" TEXT NOT NULL,
    "passIndex" INTEGER NOT NULL,
    "bodyTexture" TEXT,
    "feelingWord" TEXT,
    "feelingSource" TEXT,
    "need" TEXT,
    "needSource" TEXT,
    "smallAction" TEXT,
    "distinctionCaught" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoopEntry_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "LoopSitting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoopState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "promptFadeLevel" INTEGER NOT NULL DEFAULT 0,
    "frameDone" BOOLEAN NOT NULL DEFAULT false,
    "graduationSurfaced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoopState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FrameCompletion_userId_key" ON "FrameCompletion"("userId");

-- CreateIndex
CREATE INDEX "LoopSitting_userId_createdAt_idx" ON "LoopSitting"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoopEntry_sittingId_idx" ON "LoopEntry"("sittingId");

-- CreateIndex
CREATE UNIQUE INDEX "LoopState_userId_key" ON "LoopState"("userId");
