import { createUserPacket } from "../helpers/createUserPacket.ts";

const packet = createUserPacket({
  uid: 1,
  name: "Khubaib",
  userId: "1001",
  privilege: 0,
  password: "",
  card: 0,
});

console.log(packet);
console.log(packet.length);
console.log(packet.toString("hex"));
console.log("Group:", packet.readUInt8(39));
console.log("Permission:", packet.readUInt8(2));
console.log("Card:", packet.readUInt32LE(35));
console.log("User ID:", packet.subarray(48, 57).toString());
