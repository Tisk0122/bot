# Discord Gateway rate limit fix

## Main cause

`GET /admin/api/preferences` previously called `guild.members.fetch()` on every dashboard load. This requests a full guild member chunk through Gateway Opcode 8. The same endpoint therefore generated repeated requests and could throw `GatewayRateLimitError`, which was exposed as HTTP 500.

## Changes

- `/admin/api/preferences` now builds its list from `guild.members.cache` plus IDs already present in `dm_preferences.json`. It does not request guild members from Discord.
- The preferences endpoint includes `cachedMemberCount`, `guildMemberCount`, and `cacheOnly` so the dashboard can show cache coverage. A member absent from cache but with a saved preference is shown by ID rather than triggering a lookup.
- `/admin/api/study-roles` uses member/user caches only.
- Study VC role enforcement uses the member and role caches already maintained by Gateway events. It no longer force-fetches a member for every join.
- Study VC startup restoration checks only members currently in the target voice channel.
- AFK startup tracks users currently in cached voice channels and the timer checks cached member state. It no longer fetches all guild members or re-fetches a member on each timer.
- `/recruit` sends notifications only to saved opt-in IDs and uses user REST lookups instead of requesting a full guild member chunk.
- `/study-role list` no longer requests the entire guild member list.
- Fixed a dashboard overview variable shadowing issue that attempted to assign to locally destructured `const` values.

## Intentional remaining member fetches

- `/recruit-notify-init` still requests the guild member list because its explicit purpose is to send an initial settings DM to every current server member. Run it only when needed, not repeatedly.
- Approval/denial button handlers may fetch a specific target member to verify membership when that user is not already cached.

## Cache coverage note

The notification-settings page prioritizes avoiding Gateway chunk requests. Consequently, a server member who is not cached and has never saved a notification preference cannot be shown as an `unset` row until that member enters the cache. The dashboard displays cache coverage to make this limitation visible.

## Verification

All project JavaScript files pass `node --check`. The inline browser script embedded in `web/dashboardHtml.js` also parses successfully. Live Discord Gateway/API behavior must still be verified after deployment.
