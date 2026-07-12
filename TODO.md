# GymFlow - ZKTeco Integration Completion Plan

- [ ] Step 1: Inspect current attendance device -> DB flow and identify where to emit `attendance:*` IPC events.
- [ ] Step 2: Implement Electron “device attendance event bridge” listening to `deviceManager` events.
- [ ] Step 3: Implement shared `validateCheckIn()` used by both biometric and manual check-in.
- [ ] Step 4: Emit correct IPC events: `attendance:checkin`, `attendance:checkout`, `attendance:expired`, `attendance:inactive`, `attendance:unknown`.
- [ ] Step 5: Ensure attendance is saved/upserted in Prisma and UI updates live (no full refresh, keep fallback).
- [ ] Step 6: Hook sound + popup handling to attendance IPC events.
- [ ] Step 7: Add device lifecycle IPC events for connected/disconnected + online/offline indicator.
- [ ] Step 8: Type safety improvements in new bridge code (remove unsafe `any` where possible).
- [ ] Step 9: Delete unused playground files only if they are not referenced by build.
- [ ] Step 10: Run `typecheck` + lint, fix any TS/lint errors.
