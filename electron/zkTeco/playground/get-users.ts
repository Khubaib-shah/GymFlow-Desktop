import { COMMANDS } from "../constants";
import { decodeUserData72 } from "../helpers/decodeUserData72";

const ZKLib = require("node-zklib");

(async () => {
  const zk = new ZKLib("192.168.1.2", 4370, 10000, 4000);

  await zk.createSocket();

  console.log("Connected");

  await zk.executeCmd(COMMANDS.CMD_DISABLEDEVICE);

  const payload = Buffer.from([
    0x01, 0x09, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  const response = await zk.executeCmd(COMMANDS.CMD_DATA_WRRQ, payload);

  const users = [];

  let offset = 4;

  const data = response.subarray(8);

  while (offset + 72 <= data?.length) {
    users.push(decodeUserData72(data?.subarray(offset, offset + 72)));

    offset += 72;
  }
  console.log(users);

  if (data.length >= 76) {
    const userPacket = data.subarray(4, 76);
    const user = decodeUserData72(userPacket);
    console.log(user);
  }
  await zk.executeCmd(COMMANDS.CMD_ENABLEDEVICE);

  await zk.disconnect();
})();
