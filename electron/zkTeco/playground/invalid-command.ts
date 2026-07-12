const ZKLib = require("node-zklib");

(async () => {
  const zk = new ZKLib("192.168.1.13", 4370, 10000, 4000);

  await zk.createSocket();

  console.log("Connected");

  const response = await zk.executeCmd(9999);

  console.log("Response:", response);

  await zk.disconnect();
})();
