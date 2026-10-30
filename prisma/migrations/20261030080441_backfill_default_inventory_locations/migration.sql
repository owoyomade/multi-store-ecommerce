-- Stores created before inventory existed get their default stock location.
-- New stores get one from createStore().
INSERT INTO "inventory_locations" ("id", "storeId", "name", "isDefault", "createdAt")
SELECT 'loc_' || s."id", s."id", 'Main warehouse', true, NOW()
FROM "stores" s
WHERE NOT EXISTS (
  SELECT 1 FROM "inventory_locations" l WHERE l."storeId" = s."id" AND l."isDefault"
);
