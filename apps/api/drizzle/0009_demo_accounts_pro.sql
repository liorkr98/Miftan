-- Every seeded demo account is on the paid plan, so the demo shows the whole
-- product. Seed ids all start usr_seed_ (seedId() in src/lib/ids.ts); real
-- accounts get random ids and are untouched. The underscores are escaped:
-- in LIKE a bare _ matches any character.
UPDATE "users" SET "plan" = 'pro' WHERE "id" LIKE 'usr\_seed\_%';
