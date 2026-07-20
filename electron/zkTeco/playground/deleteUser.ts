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

  const users = await client.getUsers();

  if (!users.length) {
    throw new Error("No users found");
  }

  // <-- THIS is the important line
  // Ensure uid is defined before calling deleteUser
  if (users[0].uid !== undefined) {
    await client.deleteUser(users[0].uid);
  }

  const usersAfter = await client.getUsers();

  await client.disconnect();
})();
