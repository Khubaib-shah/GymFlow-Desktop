# GymFlow ZKTeco K70 Integration — Implementation Plan

> **Last updated:** July 12, 2026  
> **Status:** In progress — device layer built; attendance bridge and live UI wiring remain.

---

## Goal

Integrate the existing `electron/zkTeco` module into GymFlow Desktop.

The ZKTeco integration already has:

- connection, disconnect, reconnect
- device settings persistence
- create user, get users, delete user
- attendance fetch and polling
- restart
- playground testing scripts

The remaining work is **wiring everything into the Electron application and React UI** — not rebuilding the device layer.

---

## Hard Boundaries (Do Not Violate)

These rules apply to every phase. Any AI or developer working on this integration must follow them:

| Rule | Meaning |
|------|---------|
| **Do not redesign the project architecture** | Keep Electron main/renderer split, handler registration in `main.ts`, Prisma in handlers |
| **Do not move existing files** | Extend in place under `electron/zkTeco/`, `electron/handlers/`, `src/pages/` |
| **Do not introduce new patterns unless absolutely necessary** | Use existing IPC invoke/push, `DeviceManager`, `ZKClient`, preload `api` bridge |
| **GymFlow is the source of truth** | The K70 is fingerprint storage only; membership logic lives in GymFlow |
| **Complete and test each phase before starting the next** | Nothing should break; every shipped phase must be production-ready |

### What Already Exists (Use It)

| Layer | Location | Role |
|-------|----------|------|
| Device protocol | `electron/zkTeco/ZKClient.ts` | Low-level `node-zklib` wrapper |
| Device orchestration | `electron/zkTeco/DeviceManager.ts` | Connect, poll, reconnect, user CRUD, events |
| Settings | `electron/zkTeco/DeviceSettings.ts` | Persists to `gymflow-zkteco-settings.json` |
| IPC handlers | `electron/zkTeco/ipc/device.ipc.ts` | All `device:*` invoke channels |
| Attendance bridge | `electron/zkTeco/DeviceAttendanceBridge.ts` | Device poll → Prisma → renderer events (**written, not registered**) |
| Membership validation | `electron/zkTeco/membership/` | `validateMembershipStateFromMember`, `upsertAttendanceFromBiometric` |
| Member sync | `electron/handlers/members.ts` | Create/update/delete → device |
| Manual attendance | `electron/handlers/attendance.ts` | `attendance:manualEntry` |
| Preload API | `electron/preload.ts` | `api.device.*`, `onAttendanceEvent` |
| Settings UI | `src/pages/Settings.tsx` | Device config + test connection |
| Members UI | `src/pages/Members.tsx` | Enrollment modal, sync polling |
| Attendance UI | `src/pages/Attendance.tsx` | Manual check-in, event subscription |
| Global alerts | `src/App.tsx` | Toast + voice on attendance events |

### What Is NOT Part of This Task

- Rewriting `src/zkteco/` stubs (empty placeholders — remove or ignore)
- Moving playground scripts out of `electron/zkTeco/playground/` (keep for dev testing)
- Changing Prisma schema unless a field is genuinely required
- Replacing polling with push events (K70 does not provide reliable real-time push)

---

## Phase Overview

| Phase | Name | Status |
|-------|------|--------|
| 1 | Device Connection Lifecycle | 🟡 Mostly done |
| 2 | User Synchronization | 🟡 Partial |
| 3 | Attendance Polling | 🟡 Partial |
| 4 | Real-Time UI Updates | 🟡 Partial (UI ready, pipeline broken) |
| 5 | Membership Validation | 🟡 Partial |
| 6 | Manual Check-In | 🟢 Done |
| 7 | Device Monitoring | 🟡 Partial |
| 8 | Synchronization Events | 🟡 Partial |

**Legend:** 🟢 Done · 🟡 Partial · 🔴 Not started

---

# Phase 1 — Device Connection Lifecycle

## Objective

Make the K70 behave like any other hardware connected to GymFlow.

## Requirements

Use the **existing IPC handlers** in `electron/zkTeco/ipc/device.ipc.ts`. The frontend must be able to:

- Save settings (`device:save-settings`)
- Update settings (`device:save-settings`)
- Connect (`device:connect`)
- Disconnect (`device:disconnect`)
- Reconnect (`device:reconnect`)
- Test connection (`device:test-connection`)
- Show device status (`device:get-status`)

The UI must always reflect one of:

- **Connected**
- **Connecting**
- **Disconnected**
- **Error**

Status must update **immediately** whenever connection state changes.

## Auto Reconnection

If the network cable is unplugged, the device loses power, or the device restarts, GymFlow must automatically reconnect without requiring the user to press Connect again.

- Implemented in `DeviceManager.startAutoLifecycle()` — reconnect interval (10s), polling while connected
- Auto-starts on app ready when `settings.enabled && settings.ip` (`main.ts`)
- **Gap:** `applySettings` does not restart lifecycle after save; renderer has no live `device:status` subscription

Retry logic must avoid excessive CPU usage (use configured intervals, not tight loops).

## Device Status Card

Display on the Device / Settings page:

| Field | Source |
|-------|--------|
| Device Name | settings / device info |
| IP | settings |
| Port | settings |
| Firmware | `testConnection` / `getDeviceInfo` |
| Serial Number | device info |
| Connected / Disconnected | `DeviceManager` status |
| Last Connected | `DeviceManager.lastConnectedAt` |
| Last Error | status payload message |

## Current State

| Done | Remaining |
|------|-----------|
| `connect`, `disconnect`, `reconnect`, `test-connection`, `get-status` IPC | Live status push to renderer (`device:status` in preload) |
| Settings persisted to userData | Device Status Card with all fields in UI |
| Auto-start lifecycle on app ready | Connect/Disconnect buttons in Settings (beyond test-only) |
| Reconnect timer in DeviceManager | Restart lifecycle when settings saved while enabled |

---

# Phase 2 — User Synchronization

## Objective

**GymFlow is the source of truth.** The device is only a fingerprint storage device.

## Member Creation

When a new GymFlow member is created and fingerprint registration is enabled:

1. Create the user on the device
2. Store **Device UID** and **Device User ID** (`employeeNo`) in the GymFlow database
3. Immediately refresh UI

**Current:** `members.ts` auto-assigns `employeeNo`, calls `deviceManager.addUser()`, sets `deviceSynced`, runs `waitForEnrollment()` (120s). Enrollment modal in `Members.tsx`.

**Gap:** `ZKClient` exposes `setUser` but `DeviceManager` calls `client.addUser` / `client.updateUser` — wrappers missing. `biometricId` field in schema is unused.

## Member Update

When **Name**, **Card Number**, **Employee ID**, or **Role** changes → update device immediately → refresh UI.

**Current:** `members.ts` update handler syncs name and enabled state to device.

## Member Delete

Deleting a GymFlow member must also delete from device → refresh users → update UI.

**Current:** `members.ts` delete handler calls `deviceManager.deleteUser(employeeNo)`.

## Initial Sync

When opening the device / members page:

1. Load all users from device
2. Compare with database
3. Every member shows **Device Status**:

| Status | Meaning |
|--------|---------|
| ✓ On Device | Member exists in DB and on device |
| ✗ Missing From Device | In DB, not on device |
| Database Only | Created in DB, never synced |
| Unknown | Cannot determine |

**Gap:** No bulk reconcile UI or sync-on-open flow.

## Device User Indicator (Members Table)

Every member row must clearly display:

| Column | Field |
|--------|-------|
| Fingerprint Registered | Yes / No (`deviceSynced`) |
| Device UID | from device user record |
| Device User ID | `employeeNo` |
| Registration Date | enrollment timestamp |
| Last Sync Time | last successful sync |

**Gap:** Members table has no device columns; users cannot see whether fingerprint exists on device.

## Current State

| Done | Remaining |
|------|-----------|
| Create/update/delete wired in `members.ts` | Fix `ZKClient.addUser` / `updateUser` wrappers |
| `employeeNo` auto-assignment | Initial sync / reconcile on page open |
| Enrollment wait + modal UI | Device status columns in Members table |
| `deviceSynced` tracking | Use or remove `biometricId` |
| User packet helpers | "Sync later" option in Settings |

---

# Phase 3 — Attendance

## Objective

Attendance continuously synchronizes from device to GymFlow database.

## Initial Load

1. Load attendance from device (`device:get-attendance`)
2. Store latest processed record ID / fingerprint
3. Display all attendance in UI

## Polling

The K70 does **not** provide reliable push events. Use polling.

Polling must:

- Run continuously **only while connected**
- Avoid duplicate processing
- Not overload CPU (use `pollIntervalMs` from settings)

Every poll:

1. Fetch attendance from device
2. Compare against last processed record
3. Process **only new** records
4. Ignore existing ones

**Current:** `DeviceManager.startPolling()` deduplicates via `lastAttendanceFingerprint` Set and emits `attendance` events.

## Duplicate Protection

Never create duplicate attendance. Compare using:

- Record Number, or
- Attendance Timestamp, or
- Unique Attendance Key

**Current:** In-memory dedup in `DeviceManager`; `AttendanceSync.ts` exists but is unused.

## Critical Gap

`DeviceAttendanceBridge` is **written but not registered** in `main.ts`. Polled attendance never reaches Prisma or the renderer.

Bridge must:

1. Register in `main.ts` after handlers
2. Look up members by `employeeNo`
3. Forward events via `getMainWindow()?.webContents.send(...)` — **not** `ipcMain.emit`

---

# Phase 4 — Real-Time UI Updates

## Objective

The UI updates automatically — no manual Refresh.

Whenever these occur, affected pages update immediately:

- Attendance arrives
- Member created / updated / deleted
- Device reconnects / disconnects
- Sync finishes

## Current State

| Done | Remaining |
|------|-----------|
| Preload `onAttendanceEvent` with cleanup | Register bridge so events actually arrive |
| `App.tsx` toast + TTS on events | Fix `data.member.name` → use `firstName` / `lastName` |
| `Attendance.tsx` refetch on event | Incremental row insert instead of full refetch |
| | `device:status` listener in preload + global indicator |
| | Members page live update on sync complete |

---

# Phase 5 — Membership Validation

## Objective

The device cannot disable fingerprint verification based on subscription. **GymFlow performs validation.**

## Flow

```
Member scans finger
        ↓
Attendance appears on device
        ↓
GymFlow receives attendance (poll → bridge)
        ↓
Find member by employeeNo
        ↓
Check subscription status
```

### Active → Allow Entry

- Create attendance record
- Show ✅ Check In Successful
- Play success sound
- Show member card

### Expired → Deny Entry

- Do **not** allow entry (per business rules — may still save audit record)
- Popup: **Subscription Expired**
- Voice: *"Dear {Member Name}, your subscription has expired. Please renew your membership."*
- Emit `attendance:expired`

**Gap:** `EXPIRED` state does not block check-in today; `attendance:expired` is never emitted.

### Suspended → Deny Entry

- Popup: **Membership Suspended**
- Voice: *"Dear {Member Name}, your membership has been suspended. Please contact reception."*
- Emit `attendance:inactive`

**Current:** `BLOCKED` state emits `attendance:inactive` in bridge (when registered).

### Member Not Found → Deny Entry

- Popup: **Unknown Fingerprint**
- Voice: *"Member not found. Please contact reception."*
- Emit `attendance:unknown`

**Current:** Bridge handles unknown device user ID and missing member.

### Validation Alignment

Biometric path must use the **same rules** as manual check-in:

- `ACTIVE` status
- Valid `planId`
- Not expired

**Current:** Manual check-in in `attendance.ts` validates fully; biometric path in bridge does not mirror all rules.

---

# Phase 6 — Manual Check-In

## Objective

Manual Check-In remains available as the backup when device is offline, fingerprint damaged, sensor dirty, or network disconnected.

Manual Check-In must use the **exact same membership validation rules** as fingerprint attendance.

## Current State: 🟢 Done

- `attendance:manualEntry` in `attendance.ts` — toggle check-in/out, 6h session window, stale cleanup
- Full UI modal in `Attendance.tsx` with member search and active-session detection
- Validates status + plan before allowing entry

**Remaining:** Extract shared `validateCheckIn()` used by both biometric bridge and manual handler (Phase 5 alignment).

---

# Phase 7 — Device Monitoring

## Objective

Continuously monitor and display on the Device page:

| Metric | Source |
|--------|--------|
| Connection state | `DeviceManager` |
| Reconnect attempts | `DeviceManager` counters |
| Last Attendance Time | last processed poll record |
| Last Sync Time | last user/attendance sync |
| Errors | `deviceLogger` / last error message |
| Device Restart | event log |
| User Count | `getUsers().length` |
| Attendance Count | `getAttendance().length` |

## Current State

| Done | Remaining |
|------|-----------|
| `device:get-status`, `device:test-connection` | Global online/offline indicator in app layout |
| Test-time status badge in Settings | `device:status` push in preload |
| Reconnect interval in DeviceManager | Device health dashboard / log viewer |
| Structured logging (`deviceLogger`) | Last attendance / sync timestamps in UI |

---

# Phase 8 — Synchronization Events

## Objective

Whenever any of these happen, the UI immediately reflects the latest state — no manual refresh:

| Event | Expected UI Response |
|-------|---------------------|
| Create User | Members table updates, device status column |
| Update User | Row reflects new name/sync state |
| Delete User | Row removed or status cleared |
| Attendance | Attendance page adds row, dashboard updates |
| Device Restart | Status card shows reconnecting |
| Reconnect | Status → Connected |
| Connection Lost | Status → Disconnected / Error |
| Settings Changed | Status card reflects new IP/port |
| Attendance Cleared | Counts reset |
| Device Cleared | User count zero, sync status updated |

## Current State

| Done | Remaining |
|------|-----------|
| `deviceSynced` + enrollment polling | IPC channels: `device:sync-complete`, `member:device-synced` |
| Enrollment modal + countdown | Sync failure log in UI |
| Auto-disable expired on device during `members:getAll` | Wire bridge + status push (Phases 3–4) |

---

# Subscription Flow

```
Member Created
      ↓
Save in Database
      ↓
Create User on Device
      ↓
Fingerprint Registered (waitForEnrollment)
      ↓
Member Uses Fingerprint
      ↓
Attendance Received (poll)
      ↓
Lookup Member (employeeNo)
      ↓
Membership Active?
      │
 ┌────┴─────┐
 │          │
Yes         No
 │          │
Attendance   Popup +
Saved        Voice
Success      Expired /
             Suspended /
             Unknown
```

---

# User Lifecycle

```
Create Member
      │
      ▼
Save Database
      │
      ▼
Create Device User (deviceManager.addUser)
      │
      ▼
Refresh Device Users
      │
      ▼
Update UI (deviceSynced, enrollment modal)
      │
      ▼
Member Uses Finger
      │
      ▼
Attendance Received (poll → bridge)
      │
      ▼
Membership Validation
      │
      ▼
Show Result (toast + voice)
      │
      ▼
Attendance History Updated
```

---

# IPC Reference

## Invoke Handlers (renderer → main)

### Device (`device.ipc.ts`)

| Channel | Purpose |
|---------|---------|
| `device:get-settings` | Load persisted settings |
| `device:save-settings` | Save settings |
| `device:get-status` | Current connection status |
| `device:test-connection` | Connect + fetch info/users/attendance |
| `device:get-users` | List device users |
| `device:get-attendance` | Fetch attendance logs |
| `device:add-user` | Create user on device |
| `device:update-user` | Update user on device |
| `device:delete-user` | Delete user from device |
| `device:clear-attendance` | Clear device attendance logs |
| `device:restart` | Restart device |
| `device:connect` | Connect |
| `device:disconnect` | Disconnect |
| `device:reconnect` | Disconnect + connect |
| `device:listen` | Start realtime socket (dev) |
| `device:stopListen` | Stop realtime socket |
| `device:get-config` | Get device config |
| `device:configure` | Configure device |

### Members (device-related)

`members:create`, `members:update`, `members:delete`, `members:getAll`, `members:getById`

### Attendance

`attendance:getRecent`, `attendance:getAll`, `attendance:getActiveSession`, `attendance:manualEntry`

## Push Events (main → renderer)

| Channel | Preload Listener | Emitted Today? |
|---------|------------------|----------------|
| `attendance:checkin` | `onAttendanceEvent('checkin')` | ❌ Bridge not registered |
| `attendance:checkout` | `onAttendanceEvent('checkout')` | ❌ Bridge not registered |
| `attendance:expired` | `onAttendanceEvent('expired')` | ❌ Never emitted |
| `attendance:inactive` | `onAttendanceEvent('inactive')` | ❌ Bridge not registered |
| `attendance:unknown` | `onAttendanceEvent('unknown')` | ❌ Bridge not registered |
| `device:status` | ❌ Not in preload | ❌ Uses `ipcMain.emit` (broken) |

---

# CRUD Operations Checklist

## Device

| Operation | Status |
|-----------|--------|
| Connect | ✅ |
| Disconnect | ✅ |
| Reconnect | ✅ |
| Restart | ✅ |
| Test Connection | ✅ |
| Device Status | 🟡 (no live push) |
| Device Information | 🟡 (partial in test flow) |

## Users

| Operation | Status |
|-----------|--------|
| Create User | 🟡 (`ZKClient` wrappers missing) |
| Read Users | ✅ |
| Update User | 🟡 (`ZKClient` wrappers missing) |
| Delete User | ✅ |
| Refresh User List | 🟡 (no UI trigger) |
| Sync Database ↔ Device | ❌ |
| Device Registration Status | 🟡 (`deviceSynced` only) |
| Device UID Display | ❌ |
| Device User ID Display | ❌ |

## Attendance

| Operation | Status |
|-----------|--------|
| Load Attendance | ✅ (device fetch) |
| Poll Attendance | ✅ (DeviceManager) |
| Real-time Attendance Updates | ❌ (bridge not wired) |
| Prevent Duplicate Processing | 🟡 (in-memory only) |
| Clear Attendance Logs | ✅ |
| Attendance History | ✅ (DB + UI) |
| Last Attendance Tracking | ❌ |

## Membership Validation

| Rule | Status |
|------|--------|
| Active → Allow entry | 🟡 (biometric path incomplete) |
| Expired → Popup + Voice | ❌ |
| Suspended → Popup + Voice | 🟡 (BLOCKED only) |
| Unknown Member → Popup + Voice | 🟡 (bridge code exists, not wired) |

## UI

| Feature | Status |
|---------|--------|
| Live Device Status | ❌ |
| Live User Updates | 🟡 |
| Live Attendance Updates | ❌ |
| Live Membership Alerts | 🟡 (listeners exist, no events) |
| Device Sync Status | ❌ |
| Registration Indicators | 🟡 (modal only) |
| Loading States | 🟡 |
| Error States | 🟡 |
| Success Notifications | 🟡 |

## Error Handling

| Scenario | Status |
|----------|--------|
| Device Offline | 🟡 (reconnect loop) |
| Connection Timeout | 🟡 |
| Network Lost | 🟡 (auto-reconnect) |
| Invalid Device Settings | 🟡 |
| Failed User Sync | 🟡 (alert on create) |
| Failed Attendance Fetch | 🟡 |
| Duplicate Attendance | 🟡 |
| Unknown Device User | 🟡 (bridge code, not wired) |
| Corrupted Device Response | 🟡 |
| Automatic Recovery After Reconnection | 🟡 |

---

# Prisma — Device Fields on Member

```prisma
model Member {
  employeeNo    Int?     @unique   // Device User ID — ACTIVE
  deviceSynced  Boolean  @default(false)  // ACTIVE
  biometricId   String?  @unique   // UNUSED — decide: wire or remove
}
```

`Attendance.method` supports `"BIOMETRIC"` | `"MANUAL"`.

---

# Priority Order (Recommended Implementation Sequence)

These items unblock the most downstream phases:

1. **Register `DeviceAttendanceBridge` in `main.ts`** — forward via `webContents.send`
2. **Add `ZKClient.addUser` / `updateUser`** — wrappers around `setUser`
3. **Emit `attendance:expired`** — block expired members, voice + popup
4. **Shared `validateCheckIn()`** — biometric + manual use same rules
5. **Expose `device:status` in preload** — global connection indicator
6. **Fix `App.tsx` toast** — `firstName` / `lastName` instead of `name`
7. **Device Status Card + Members device columns** — Phases 1–2 UI
8. **Initial sync / reconcile** — compare DB ↔ device on page open

---

# Testing Each Phase

| Phase | How to Verify |
|-------|---------------|
| 1 | Save settings → auto-connect; unplug cable → auto-reconnect; status card updates live |
| 2 | Create member → appears on device; update name → device updates; delete → removed from device; table shows sync status |
| 3 | Scan finger → attendance appears in DB without duplicate on re-poll |
| 4 | Scan finger → Attendance page updates without Refresh; member create updates Members page |
| 5 | Expired member scan → popup + voice, no check-in; active member → success |
| 6 | Manual check-in with expired member → same denial as biometric |
| 7 | Device page shows user count, last attendance, reconnect attempts |
| 8 | Every action above reflects in UI within 1–2 seconds, no manual refresh |

---

# Related Files

| File | Purpose |
|------|---------|
| `TODO.md` | Actionable task checklist per phase |
| `electron/zkTeco/` | Device integration module |
| `electron/handlers/members.ts` | Member ↔ device sync |
| `electron/handlers/attendance.ts` | Manual attendance |
| `electron/main.ts` | Handler registration, auto-lifecycle |
| `electron/preload.ts` | Renderer API bridge |
| `src/pages/Settings.tsx` | Device configuration UI |
| `src/pages/Members.tsx` | Member management + enrollment |
| `src/pages/Attendance.tsx` | Attendance log + manual check-in |
| `src/App.tsx` | Global attendance alerts |
