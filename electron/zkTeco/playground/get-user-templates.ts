// @ts-nocheck
import { COMMANDS } from "../constants.ts";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ZKLib = require("zklib-ts");

(async () => {
  // Use the same connection params as your environment
  const zk = new ZKLib("192.168.1.10", 4370, 10000, 4000);

  console.log("Connecting to device...");
  await zk.createSocket();
  console.log("Connected");

  // Disable device during bulk operations
  await zk.executeCmd(COMMANDS.CMD_DISABLEDEVICE);

  try {
    console.log("Fetching users list...");
    const usersResponse = await zk.getUsers();
    let users = usersResponse.data;
    
    console.log(`Successfully fetched ${users.length} users.`);
    
    // ZKTecoTime.net approach: Instead of fetching ALL templates at once (which 
    // crashes on K40 with "Invalid template size 0" due to corrupt blocks), 
    // we query templates specifically per user. 
    
    // We'll demonstrate by fetching templates for the first 5 users
    const sampleUsers = users.slice(0, 5);
    const usersWithTemplates = [];

    for (const user of sampleUsers) {
      const uidString = String(user.user_id ?? user.userId ?? user.uid);
      console.log(`\nFetching templates for User ID: ${uidString} (Name: ${user.name})`);
      
      const userTemplates = [];
      
      // Each user can have up to 10 fingers enrolled (0-9)
      for (let fid = 0; fid < 10; fid++) {
        try {
          // This queries the device for a specific user's specific finger
          const template = await zk.getUserTemplate(uidString, fid);
          if (template && template.template) {
            userTemplates.push({
              fid: template.fid,
              valid: template.valid,
              size: template.size || template.template.length,
              // Convert buffer to hex for preview
              preview: template.template.toString('hex').substring(0, 32) + '...',
              template: template.template
            });
            console.log(`  - Found finger ${fid} (Size: ${template.size || template.template.length} bytes)`);
          }
        } catch (err) {
          // It's expected for this to fail or return an error code if the finger doesn't exist
          // e.g. ERROR_IN_UNHANDLE_CMD or ERROR_DATA_NOT_FOUND
          if (err?.message?.includes('ERROR_IN_UNHANDLE_CMD') || err?.message?.includes('ERROR_DATA_NOT_FOUND')) {
            // Ignore missing fingerprints
          } else {
            console.error(`  - Error checking finger ${fid}:`, err?.message || err);
          }
        }
      }
      
      usersWithTemplates.push({
        ...user,
        enrolledFingersCount: userTemplates.length,
        templates: userTemplates,
      });
    }

    console.log(`\n\n--- RESULTS ---`);
    for (const u of usersWithTemplates) {
      console.log(`User ${u.name} (ID: ${u.user_id}) -> ${u.enrolledFingersCount} fingerprints enrolled.`);
      u.templates.forEach(t => console.log(`    Finger ${t.fid}: ${t.preview}`));
    }

  } catch (err) {
    console.error("Error fetching data:", err);
  } finally {
    await zk.executeCmd(COMMANDS.CMD_ENABLEDEVICE);
    await zk.disconnect();
    console.log("Disconnected.");
  }
})();
