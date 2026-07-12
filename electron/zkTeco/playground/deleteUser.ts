import { ZKClient } from "../ZKClient";

(async () => {
  const client = new ZKClient();

  await client.connect({
    enabled: true,
    deviceType: "zkteco-k70",
    ip: "192.168.1.2",
    port: 4370,
    timeout: 10000,
    pollInterval: 5000,
  });

  const users = await client.getUsers();
  console.log("Users before delete:", users);

  if (!users.length) {
    throw new Error("No users found");
  }

  console.log("Deleting UID:", users[0].uid);

  // <-- THIS is the important line
  await client.deleteUser(users[0].uid);

  const usersAfter = await client.getUsers();

  console.log("Users after delete:", usersAfter);

  await client.disconnect();
})();
