import { COMMANDS } from "../constants.ts";
import { createUserPacket } from "../helpers/createUserPacket.ts";
import ZKLib from "node-zklib";

(async () => {
  const zk = new ZKLib("192.168.1.2", 4370, 10000, 4000);

  await zk.createSocket();

  console.log("Connected");

  await zk.executeCmd(COMMANDS.CMD_USER_WRQ);

  const userPacket = createUserPacket({
    uid: 1,
    userId: "1001",
    name: "Khubaib",
  });

  console.log(userPacket.toString("hex"));

  const response = await zk.executeCmd(COMMANDS.CMD_USER_WRQ, userPacket);

  console.log(response);

  await zk.executeCmd(COMMANDS.CMD_REFRESHDATA);

  await zk.executeCmd(COMMANDS.CMD_ENABLEDEVICE);

  await zk.disconnect();
})();
