// @ts-nocheck
import { COMMANDS } from "../constants.ts";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ZKLib = require("zklib-ts");

(async () => {
  // Device Configuration
  const zk = new ZKLib("192.168.1.5", 4370, 10000, 4000);

  // User ID to inspect
  const TARGET_USER_ID = "9999";

  console.log(`Connecting to device to fetch info for User ID: ${TARGET_USER_ID}...`);

  await zk.createSocket();
  console.log("Connected!");

  try {
    // Disable device during read operations
    await zk.executeCmd(COMMANDS.CMD_DISABLEDEVICE);

    // --------------------------------------------------
    // 1. Fetch User Information
    // --------------------------------------------------
    console.log("\n--- 1. Fetching User Info ---");

    const usersResponse = await zk.getUsers();
    const users = usersResponse.data || [];

    const user = users.find(
      (u: any) =>
        String(
          u.user_id ??
          u.userId ??
          u.userIdString ??
          u.uid
        ) === TARGET_USER_ID
    );

    if (!user) {
      console.log(`❌ User with ID ${TARGET_USER_ID} not found.`);
      return;
    }

    console.dir(user, { depth: null });

    const uidString = String(
      user.user_id ??
      user.userId ??
      user.uid
    );

    // --------------------------------------------------
    // 2. Fetch Fingerprints
    // --------------------------------------------------
    console.log(`\n--- 2. Fetching Fingerprints for ${uidString} ---`);

    const userTemplates = [];

    for (let fid = 0; fid < 10; fid++) {
      try {
        const template = await zk.getUserTemplate(uidString, fid);

        if (template?.template) {
          userTemplates.push({
            Finger: fid,
            Valid: template.valid,
            Size: template.size || template.template.length,
          });
        }
      } catch (err: any) {
        console.log(`Finger ${fid}:`, err);

        // Algorithm 10 devices throw this even when a finger exists.
        if (
          err?.err?.message?.includes(
            "maybe finger id not exists?"
          )
        ) {
          userTemplates.push({
            Finger: fid,
            Valid: true,
            Size: "Algorithm 10 Template",
          });
        }
      }
    }

    if (userTemplates.length === 0) {
      console.log("No fingerprints found.");
    } else {
      console.log(`Found ${userTemplates.length} fingerprint(s):`);
      console.table(userTemplates);
    }

    // --------------------------------------------------
    // 3. Fetch Attendance
    // --------------------------------------------------
    console.log(`\n--- 3. Fetching Attendance for ${uidString} ---`);

    const attendanceResponse = await zk.getAttendances();
    const attendances = attendanceResponse.data || [];

    console.dir(attendanceResponse, { depth: null });

    console.log("\nSample Attendance Record:");
    console.dir(attendances[0], { depth: null });

    const userAttendances = attendances.filter(
      (att: any) =>
        String(
          att.user_id ??
          att.userId ??
          att.userSn ??
          att.uid
        ) === TARGET_USER_ID
    );

    if (userAttendances.length === 0) {
      console.log("No attendance records found.");
    } else {
      console.log(
        `Found ${userAttendances.length} attendance record(s).`
      );

      const sortedAttendances = userAttendances.sort(
        (a: any, b: any) =>
          new Date(b.recordTime).getTime() -
          new Date(a.recordTime).getTime()
      );

      console.table(
        sortedAttendances.slice(0, 10).map((att: any) => ({
          Time: new Date(att.recordTime).toLocaleString(),
          State: att.state ?? att.verifyState ?? 0,
          Type: att.verifyType ?? att.verify_type ?? 0,
        }))
      );
    }
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    try {
      await zk.executeCmd(COMMANDS.CMD_ENABLEDEVICE);
    } catch { }

    try {
      await zk.disconnect();
    } catch { }

    console.log("\nDisconnected.");
  }
})();