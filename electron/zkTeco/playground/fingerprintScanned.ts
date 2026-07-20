// @ts-nocheck
import { ZKClient } from "../ZKClient";

(async () => {
  const client = new ZKClient();

  await client.connect({
    enabled: true,
    deviceType: "zkteco-k40",
    ip: "192.168.1.2",
    port: 4370,
    timeout: 10000,
    pollInterval: 5000,
  });
  // Note: registerRealtimeEvents is not implemented in ZKClient - using getAttendance polling instead
  const attendence = await client.getAttendance();
  console.log(attendence);
  setInterval(async () => {
    const logs = await client.getAttendance();

    console.log(logs.length);

    if (logs.length) {
      console.log(logs[logs.length - 1]);
    }
  }, 2000);
  const socket = (client as any).client.zklibTcp.socket;
  console.log(socket);

  socket.on("data", (buf: Buffer) => {
    console.log("RAW EVENT:", buf.toString("hex"));
  });
  console.log("Waiting for fingerprint...");
})();
