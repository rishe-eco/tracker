-- CreateTable
CREATE TABLE "FocusPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "lookbackAnswer" TEXT,
    "lookbackSeenAt" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FocusPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FocusPeriodProject" (
    "focusPeriodId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("focusPeriodId", "projectId"),
    CONSTRAINT "FocusPeriodProject_focusPeriodId_fkey" FOREIGN KEY ("focusPeriodId") REFERENCES "FocusPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FocusPeriodProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FocusPeriod_userId_startDate_idx" ON "FocusPeriod"("userId", "startDate");
