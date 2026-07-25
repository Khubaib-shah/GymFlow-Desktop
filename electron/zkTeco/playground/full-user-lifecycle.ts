// @ts-nocheck
import { COMMANDS } from "../constants.ts";
import { createUserPacket } from "../helpers/createUserPacket.ts";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ZKLib = require("zklib-ts");

(async () => {
  // Use the IP address of your test device
  const zk = new ZKLib("192.168.1.10", 4370, 10000, 4000);

  console.log("Connecting to device...");
  await zk.createSocket();
  console.log("Connected!");

  // It is recommended to disable the device while modifying data
  await zk.executeCmd(COMMANDS.CMD_DISABLEDEVICE);

  try {
    const testUserId = "9999";
    const testUid = 9999;
    
    // ==========================================
    // 1. Create User
    // ==========================================
    console.log(`\n--- 1. Creating User ${testUserId} ---`);
    const createPacket = createUserPacket({
      uid: testUid,
      userId: testUserId,
      name: "PlaygroundUser",
      role: 0,
      password: ""
    });
    
    await zk.executeCmd(COMMANDS.CMD_USER_WRQ, createPacket);
    await zk.executeCmd(COMMANDS.CMD_REFRESHDATA);
    console.log("✅ User created successfully.");

    // ==========================================
    // 2. Update User
    // ==========================================
    console.log(`\n--- 2. Updating User ${testUserId} ---`);
    const updatePacket = createUserPacket({
      uid: testUid,
      userId: testUserId,
      name: "PlaygroundUpdated",
      role: 14, // Role 14 usually signifies Admin on some ZKTeco devices
      password: ""
    });
    
    await zk.executeCmd(COMMANDS.CMD_USER_WRQ, updatePacket);
    await zk.executeCmd(COMMANDS.CMD_REFRESHDATA);
    console.log("✅ User updated successfully.");

    // ==========================================
    // 3. Check Fingerprints
    // ==========================================
    console.log(`\n--- 3. Checking Fingerprints for ${testUserId} ---`);
    const userTemplates = [];
    
    for (let fid = 0; fid < 10; fid++) {
      try {
        const template = await zk.getUserTemplate(testUserId, fid);
        if (template && template.template) {
          userTemplates.push(fid);
        }
      } catch (err) {
        // Safely ignore missing fingers
      }
    }
    console.log(`✅ User ${testUserId} has ${userTemplates.length} fingerprints enrolled. Enrolled fingers:`, userTemplates);

    // Re-enable device so users can scan while we listen for realtime logs
    await zk.executeCmd(COMMANDS.CMD_ENABLEDEVICE);

    // ==========================================
    // 4. Real Time Attendance
    // ==========================================
    console.log(`\n--- 4. Listening for Real Time Attendance ---`);
    console.log("👋 Please scan a fingerprint on the device...");
    
    await zk.getRealTimeLogs((log: any) => {
      // For K40 / zklib-ts standard real-time event parsing:
      if (log && log.event === 1 && log.payload) { // EF_ATTLOG
        const buffer = log.payload;
        const user_id = buffer.subarray(0, 24).toString("ascii").split("\0").shift();
        
        const record_time = new Date(
            buffer.readUIntLE(26, 1) + 2000,
            buffer.readUIntLE(27, 1) - 1, 
            buffer.readUIntLE(28, 1),
            buffer.readUIntLE(29, 1),
            buffer.readUIntLE(30, 1),
            buffer.readUIntLE(31, 1)
        );
        
        console.log(`\n🛎️  REAL-TIME ATTENDANCE: User ${user_id} scanned at ${record_time.toLocaleString()}`);
      } else {
         console.log("\n📦 Realtime Event Received (Other):", log);
      }
    });

    // Keep process alive to listen
    process.stdin.resume();

  } catch (err) {
    console.error("❌ Error during lifecycle test:", err);
    await zk.executeCmd(COMMANDS.CMD_ENABLEDEVICE);
    await zk.disconnect();
  }
})();
