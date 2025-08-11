-- CreateTable
CREATE TABLE "activity_types" (
    "activityTypeId" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_types_pkey" PRIMARY KEY ("activityTypeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_types_typeName_key" ON "activity_types"("typeName");

-- Insert default activity types
INSERT INTO "activity_types" ("activityTypeId", "typeName", "description", "isDefault", "isActive") VALUES
('cuid1', 'Transportation', 'Travel and transportation activities', true, true),
('cuid2', 'Sightseeing', 'Tourist sightseeing and exploration', true, true),
('cuid3', 'Religious Visit', 'Religious sites and worship activities', true, true),
('cuid4', 'Cultural Experience', 'Cultural activities and experiences', true, true),
('cuid5', 'Meal', 'Dining and meal activities', true, true),
('cuid6', 'Rest', 'Rest and relaxation periods', true, true),
('cuid7', 'Shopping', 'Shopping and market visits', true, true),
('cuid8', 'Educational', 'Educational tours and learning activities', true, true),
('cuid9', 'Entertainment', 'Entertainment and recreational activities', true, true),
('cuid10', 'Free Time', 'Unstructured free time periods', true, true),
('cuid11', 'Check-in/Check-out', 'Hotel and accommodation activities', true, true),
('cuid12', 'Meeting', 'Group meetings and briefings', true, true),
('cuid13', 'Other', 'Other miscellaneous activities', true, true);