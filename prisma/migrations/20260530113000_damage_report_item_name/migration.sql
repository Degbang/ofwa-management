-- Make damage reports accept free-text item names while preserving existing linked records.
ALTER TABLE "DamageReport"
ADD COLUMN "itemName" TEXT;

UPDATE "DamageReport" AS "report"
SET "itemName" = COALESCE("item"."name", "report"."itemId")
FROM "InventoryItem" AS "item"
WHERE "report"."itemId" = "item"."id";

UPDATE "DamageReport"
SET "itemName" = COALESCE("itemName", 'Unspecified item');

ALTER TABLE "DamageReport"
ALTER COLUMN "itemName" SET NOT NULL,
ALTER COLUMN "itemId" DROP NOT NULL;
