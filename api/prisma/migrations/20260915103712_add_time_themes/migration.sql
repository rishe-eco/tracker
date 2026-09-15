-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeTheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startTimeOfDay" TEXT NOT NULL,
    "endTimeOfDay" TEXT NOT NULL,
    "repeatValue" INTEGER NOT NULL DEFAULT 1,
    "repeatUnit" TEXT,
    "customRepeatDates" TEXT,
    "customRepeatRule" TEXT,
    "endTime" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeTheme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ActionToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ActionToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Action" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ActionToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ProjectToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ProjectToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ProjectToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_IntervalToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_IntervalToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Interval" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_IntervalToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_RoutineToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_RoutineToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_RoutineToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_TagToTimeTheme" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TagToTimeTheme_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TagToTimeTheme_B_fkey" FOREIGN KEY ("B") REFERENCES "TimeTheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "_ActionToTag_AB_unique" ON "_ActionToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ActionToTag_B_index" ON "_ActionToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectToTag_AB_unique" ON "_ProjectToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectToTag_B_index" ON "_ProjectToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_IntervalToTag_AB_unique" ON "_IntervalToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_IntervalToTag_B_index" ON "_IntervalToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_RoutineToTag_AB_unique" ON "_RoutineToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_RoutineToTag_B_index" ON "_RoutineToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TagToTimeTheme_AB_unique" ON "_TagToTimeTheme"("A", "B");

-- CreateIndex
CREATE INDEX "_TagToTimeTheme_B_index" ON "_TagToTimeTheme"("B");
