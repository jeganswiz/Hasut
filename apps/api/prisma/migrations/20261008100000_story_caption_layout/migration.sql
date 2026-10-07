-- The member-facing video cap is one and a half minutes. A stored policy that
-- still has the previous 60 second default is raised; any other cap is kept.

UPDATE "remote_configs"
SET "value_json" = jsonb_set(
  "value_json"::jsonb,
  '{maxVideoDurationSeconds}',
  '90'::jsonb
)
WHERE "key" = 'story.policy'
  AND ("value_json"->>'maxVideoDurationSeconds') = '60';
