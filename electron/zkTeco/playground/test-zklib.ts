// @ts-nocheck
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ZKLib = require("zklib-ts");

(async () => {
  const zk = new ZKLib("192.168.1.10", 4370, 10000, 4000);
  try {
    await zk.createSocket();
    const usersResponse = await zk.getUsers();
    console.log("Users:", usersResponse.data.length);
    const templatesResponse = await zk.getTemplates();
    console.log("Templates:", templatesResponse.data.length);
    if (templatesResponse.data.length > 0) {
      console.log("Sample Template:", templatesResponse.data[0]);
    }
  } catch(e) {
    console.error(e);
  } finally {
    await zk.disconnect();
  }
})();
