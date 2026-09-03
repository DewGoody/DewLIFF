-- View joining campaigns to their currently-published version's config in one row,
-- so the hot read path (getConfig with no explicit version) needs a single
-- round-trip instead of two sequential queries (current_version, then config).
create or replace view current_campaign_configs as
select c.id as campaign_id, c.current_version, cv.config
from campaigns c
join campaign_versions cv
  on cv.campaign_id = c.id and cv.version = c.current_version;
