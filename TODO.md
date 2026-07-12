# GymFlow — ZKTeco K70 Integration Tasks

> Actionable checklist derived from [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).  
> **Rule:** Complete and test each phase before starting the next. Do not redesign architecture or move files.

**Last updated:** July 12, 2026

---

## Boundaries (Read Before Every Task)

- [x] Documented: do not redesign architecture
- [x] Documented: do not move existing files
- [x] Documented: do not introduce new patterns unless necessary
- [x] Documented: integrate into existing Electron IPC, DeviceManager, ZKClient, React UI

---

## Phase 1 — Device Connection Lifecycle

**Goal:** Device behaves like connected hardware; UI always shows live connection state.

### Backend

- [x] `DeviceManager.connect` / `disconnect` / `reconnect`
- [x] `device:connect`, `device:disconnect`, `device:reconnect` IPC handlers
- [x] `device:save-settings`, `device:get-settings` with `DeviceSettings.ts` persistence
- [x] `device:test-connection`, `device:get-status` IPC handlers
- [x] Auto-start lifecycle on app ready when enabled (`main.ts`)
- [x] Auto-reconnect timer in `DeviceManager.startAutoLifecycle()` (10s interval)
- [x] Attendance polling only while connected
- [ ] Restart lifecycle when settings saved while device enabled
- [ ] Push `device:status` to renderer via `webContents.send` (not `ipcMain.emit`)
- [ ] Expose `device.onStatusChange` listener in `preload.ts`

### Frontend

- [x] Settings page: save IP, port, timeout, poll interval, enabled flag
- [x] Settings page: test connection with temporary status badge
- [ ] Device Status Card: name, IP, port, firmware, serial, connected/disconnected, last connected, last error
- [ ] Live connection indicator (Connected / Connecting / Disconnected / Error) — updates without refresh
- [ ] Connect / Disconnect / Reconnect buttons (not test-only)
- [ ] Subscribe to `device:status` push events in Settings (and optionally global layout)

### Phase 1 Testing

- [ ] Save valid settings → device connects automatically
- [ ] Unplug network cable → status shows disconnected → replug → auto-reconnects
- [ ] Invalid IP → status shows error without crashing app

---

## Phase 2 — User Synchronization

**Goal:** GymFlow is source of truth; every member shows device registration status.

### Backend

- [x] Auto-assign `employeeNo` on member create (`members.ts`)
- [x] Create member → `deviceManager.addUser()` + set `deviceSynced`
- [x] Update member → sync name/enabled to device
- [x] Delete member → `deviceManager.deleteUser(employeeNo)`
- [x] `waitForEnrollment()` with 120s timeout after create
- [x] Auto-disable expired members on device during `members:getAll`
- [ ] **Fix `ZKClient.addUser` / `updateUser`** — wrap existing `setUser` (DeviceManager calls these today)
- [ ] Initial sync: load device users, compare with DB, return per-member device status
- [ ] Store device UID on member record (decide: use `biometricId` or new field)
- [ ] Track last sync timestamp per member

### Frontend

- [x] Enrollment modal with countdown after member create
- [x] Poll `deviceSynced` after create
- [ ] Members table: Fingerprint Registered (Yes/No)
- [ ] Members table: Device UID column
- [ ] Members table: Device User ID (`employeeNo`) column
- [ ] Members table: Registration Date column
- [ ] Members table: Last Sync Time column
- [ ] Members table: Device Status (✓ On Device / ✗ Missing / Database Only / Unknown)
- [ ] "Refresh device users" action on Members or Settings page
- [ ] Bulk reconcile UI: show members missing from device with re-sync action

### Phase 2 Testing

- [ ] Create member with fingerprint enabled → user appears on device → `deviceSynced` true
- [ ] Update member name → device user name updates
- [ ] Delete member → user removed from device
- [ ] Member in DB but not on device → shows "Missing From Device"

---

## Phase 3 — Attendance Polling

**Goal:** Attendance continuously syncs from device to DB; no duplicates.

### Backend

- [x] `DeviceManager.startPolling()` with configurable interval
- [x] In-memory dedup via `lastAttendanceFingerprint` Set
- [x] `device:get-attendance` IPC handler
- [x] `upsertAttendanceFromBiometric()` for check-in/out toggle
- [x] `DeviceAttendanceBridge.ts` written (device poll → Prisma → IPC)
- [ ] **Register `DeviceAttendanceBridge` in `main.ts`**
- [ ] Bridge: lookup member by `employeeNo` via `getMemberByDeviceUserId`
- [ ] Bridge: forward events via `getMainWindow()?.webContents.send(...)` — not `ipcMain.emit`
- [ ] Track last processed attendance record ID / timestamp persistently (survive restart)
- [ ] Wire or remove unused `AttendanceSync.ts` dedup service
- [ ] Initial load: fetch device attendance on connect, backfill unprocessed records

### Frontend

- [x] Attendance page displays DB attendance history
- [ ] Show `method: BIOMETRIC` vs `MANUAL` clearly in attendance table
- [ ] Display last device attendance sync time on Attendance or Settings page

### Phase 3 Testing

- [ ] Connect device → poll starts → scan finger → attendance row in DB within one poll cycle
- [ ] Re-poll same records → no duplicate rows in DB
- [ ] Disconnect device → polling stops → no CPU spin

---

## Phase 4 — Real-Time UI Updates

**Goal:** All pages update automatically; no manual Refresh.

### Backend

- [ ] All attendance events pushed: `attendance:checkin`, `checkout`, `expired`, `inactive`, `unknown`
- [ ] Push `device:status` on connect, disconnect, reconnect, error
- [ ] Push `member:device-synced` or equivalent when enrollment completes
- [ ] Push sync-complete event after initial device user reconcile

### Frontend

- [x] Preload `onAttendanceEvent` with cleanup on unmount
- [x] `Attendance.tsx` subscribes to attendance events → refetches
- [x] `App.tsx` global toast + `speechSynthesis` on attendance events
- [ ] Fix `App.tsx`: use `member.firstName` / `member.lastName` (not `member.name`)
- [ ] Incremental attendance row insert (avoid full refetch on every scan)
- [ ] Members page: live update when `deviceSynced` changes (no manual refresh)
- [ ] Global device online/offline badge in app layout
- [ ] Dashboard attendance stats update on new scan

### Phase 4 Testing

- [ ] Scan finger → Attendance page updates within 2s without clicking Refresh
- [ ] Create member → Members page shows enrollment progress live
- [ ] Disconnect device → global indicator turns red immediately

---

## Phase 5 — Membership Validation

**Goal:** Biometric and manual check-in share the same validation rules; expired/suspended/unknown get popup + voice.

### Backend

- [x] `validateMembershipStateFromMember()` — maps status to ACTIVE / EXPIRED / BLOCKED
- [x] Bridge emits `attendance:inactive` for BLOCKED members
- [x] Bridge emits `attendance:unknown` for missing member / device user ID
- [ ] Emit `attendance:expired` when membership expired — **block check-in**
- [ ] Shared `validateCheckIn(member)` used by bridge AND `attendance:manualEntry`
- [ ] Biometric path: validate `ACTIVE` status + valid `planId` (same as manual)
- [ ] Expired scan: save audit record marked rejected (per business rules) OR skip DB write
- [ ] Suspended scan: emit `attendance:inactive` with clear reason

### Frontend

- [x] `App.tsx` handles checkin, checkout, expired, inactive, unknown event types
- [ ] Popup: Subscription Expired with member name
- [ ] Popup: Membership Suspended with member name
- [ ] Popup: Unknown Fingerprint
- [ ] Voice: "Dear {Name}, your subscription has expired..."
- [ ] Voice: "Dear {Name}, your membership has been suspended..."
- [ ] Voice: "Member not found. Please contact reception."
- [ ] Success: check-in sound + member card display
- [ ] Attendance table: mark rejected/expired scans distinctly for audit

### Phase 5 Testing

- [ ] Active member scan → success toast + voice + attendance saved
- [ ] Expired member scan → expired popup + voice, entry denied
- [ ] Suspended member scan → suspended popup + voice, entry denied
- [ ] Unknown fingerprint → unknown popup + voice
- [ ] Manual check-in with expired member → same denial as biometric

---

## Phase 6 — Manual Check-In

**Goal:** Backup check-in when device offline; same validation as biometric.

### Backend

- [x] `attendance:manualEntry` — toggle check-in/out
- [x] 6-hour active session window
- [x] Stale session cleanup
- [x] Validates member status + plan before allowing entry
- [ ] Refactor validation into shared `validateCheckIn()` (see Phase 5)

### Frontend

- [x] Manual check-in modal in `Attendance.tsx`
- [x] Member search in modal
- [x] Active session detection before check-in/out
- [ ] Show same success/denial popups and voice as biometric path

### Phase 6 Testing

- [x] Manual check-in/out toggles correctly
- [ ] Expired member manual check-in → denied with same message as biometric

---

## Phase 7 — Device Monitoring

**Goal:** Device page shows live health metrics.

### Backend

- [x] `device:test-connection` returns firmware, user count, attendance count
- [x] `deviceLogger` structured logging
- [x] Reconnect attempt tracking in DeviceManager
- [ ] Expose monitoring payload: last attendance time, last sync time, reconnect count, last error
- [ ] `device:get-status` returns full monitoring snapshot

### Frontend

- [ ] Device monitoring panel on Settings page
- [ ] Show: connection state, reconnect attempts, last attendance, last sync, errors
- [ ] Show: user count, attendance count (live, not test-only)
- [ ] Device restart event reflected in status card
- [ ] Optional: device log viewer (recent errors)

### Phase 7 Testing

- [ ] Connect → monitoring panel shows user count and attendance count
- [ ] Force disconnect → reconnect attempts increment in UI
- [ ] Scan finger → last attendance time updates

---

## Phase 8 — Synchronization Events

**Goal:** Every sync action immediately updates UI — no manual refresh.

### Events to Wire

- [ ] Create User → Members table updates
- [ ] Update User → row reflects changes
- [ ] Delete User → row removed or status cleared
- [ ] Attendance → Attendance page + dashboard update
- [ ] Device Restart → status shows reconnecting
- [ ] Reconnect → status → Connected
- [ ] Connection Lost → status → Disconnected / Error
- [ ] Settings Changed → status card reflects new config
- [ ] Attendance Cleared → counts reset
- [ ] Device Cleared → user count zero

### Backend

- [ ] Define and emit sync event channels as needed (`device:sync-complete`, etc.)
- [ ] Ensure all Phase 1–7 push events are connected end-to-end

### Frontend

- [ ] Each page subscribes only to events it needs (with cleanup on unmount)
- [ ] Loading and error states for all sync operations
- [ ] Success notifications for user create/update/delete on device

### Phase 8 Testing

- [ ] Full end-to-end: create member → enroll → scan → validate → UI updates everywhere
- [ ] No page requires manual Refresh during normal operation

---

## Cross-Cutting / Cleanup

- [ ] Run `typecheck` + lint — fix all TS/lint errors in bridge and device code
- [ ] Remove unsafe `any` in `DeviceAttendanceBridge` where possible
- [ ] Decide fate of `src/zkteco/` empty stubs (remove or implement)
- [ ] Decide fate of `biometricId` Prisma field (wire or remove)
- [ ] Delete playground files only if confirmed unreferenced by build
- [ ] Update README biometric section to reference IMPLEMENTATION_PLAN.md

---

## Critical Path (Do These First)

These unblock Phases 3–5 and 8:

1. [ ] Register `DeviceAttendanceBridge` in `main.ts` with `webContents.send`
2. [ ] Add `ZKClient.addUser` / `updateUser` wrappers around `setUser`
3. [ ] Emit `attendance:expired` and block expired biometric check-in
4. [ ] Shared `validateCheckIn()` for biometric + manual paths
5. [ ] Expose `device:status` in preload + live UI indicator
6. [ ] Fix `App.tsx` member name in toast/voice (`firstName` + `lastName`)

---

## Progress Summary

| Phase | Status | Key Blocker |
|-------|--------|-------------|
| 1 — Connection Lifecycle | 🟡 ~70% | Live status push to renderer |
| 2 — User Sync | 🟡 ~60% | `ZKClient` wrappers + Members table columns |
| 3 — Attendance | 🟡 ~50% | Bridge not registered in `main.ts` |
| 4 — Real-Time UI | 🟡 ~40% | Events never arrive at renderer |
| 5 — Membership Validation | 🟡 ~50% | `attendance:expired` not emitted |
| 6 — Manual Check-In | 🟢 ~90% | Shared validation refactor |
| 7 — Device Monitoring | 🟡 ~30% | Monitoring panel in UI |
| 8 — Sync Events | 🟡 ~20% | Depends on Phases 1–5 |
