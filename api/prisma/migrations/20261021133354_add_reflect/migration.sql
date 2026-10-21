-- CreateTable
CREATE TABLE "ReflectEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'precheck',
    "scene" TEXT,
    "story" TEXT,
    "close" TEXT,
    "precheckWhen" TEXT,
    "precheckBefore" TEXT,
    "afterAnswer" TEXT,
    "outcome" TEXT,
    "closedAt" DATETIME,
    "fauxSurfacedAt" DATETIME,
    "interpretationSurfacedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReflectEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReflectMoment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "whenText" TEXT,
    "feeling" TEXT,
    "feelingSource" TEXT,
    "need" TEXT,
    "needSource" TEXT,
    "met" TEXT,
    CONSTRAINT "ReflectMoment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ReflectEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReflectReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "reading" TEXT,
    "camera" TEXT,
    CONSTRAINT "ReflectReading_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ReflectEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReflectState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "fnContentVersion" TEXT NOT NULL,
    "lastCatchAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReflectState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReflectEntry_userId_closedAt_idx" ON "ReflectEntry"("userId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReflectMoment_entryId_position_key" ON "ReflectMoment"("entryId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ReflectReading_entryId_position_key" ON "ReflectReading"("entryId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ReflectState_userId_key" ON "ReflectState"("userId");
