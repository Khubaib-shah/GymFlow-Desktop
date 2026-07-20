// @ts-nocheck
import { COMMANDS } from "../constants.ts";
import { decodeUserData72 } from "../helpers/decodeUserData72.ts";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ZKLib = require("zklib-ts");

(async () => {
  const zk = new ZKLib("192.168.1.10", 4370, 10000, 4000);

  await zk.createSocket();

  console.log("Connected");

  await zk.executeCmd(COMMANDS.CMD_DISABLEDEVICE);

  try {
    const usersResponse = await zk.getUsers();
    const templatesResponse = await zk.getTemplates();

    const users = usersResponse.data;
    const templates = templatesResponse.data;

    // Merge users with their fingerprint templates
    const usersWithFingerprints = users.map((user: any) => {
      // Find all templates (fingerprints) for this user.
      // Note: We check both uid and userId depending on how the device stores it
      const fingerprints = templates.filter(
        (template: any) => template.uid === user.uid || String(template.uid) === String(user.userId)
      );

      return {
        ...user,
        fingerprints,
      };
    });

    console.log(`Fetched ${users.length} users and ${templates.length} fingerprints.`);
    
    // Display the first 2 users with their fingerprints as an example
    console.dir(usersWithFingerprints.slice(0, 2), { depth: null });

  } catch (err) {
    console.error("Error fetching users or fingerprints:", err);
  }
  await zk.executeCmd(COMMANDS.CMD_ENABLEDEVICE);

  await zk.disconnect();
})();
