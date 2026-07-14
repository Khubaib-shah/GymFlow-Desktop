import { Buffer } from "buffer";
import type { DeviceUser } from "../types";

export function createUserPacket(user: DeviceUser): Buffer {
  const packet = Buffer.alloc(72);
  // -------------------
  // UID (2 bytes)
  // -------------------
  packet.writeUInt16LE(user.uid, 0);

  // -------------------
  // Permission
  // 0 = Normal User
  // 1 = Enroll User
  // 3 = Admin
  // 7 = Super Admin
  // -------------------
  packet.writeUInt8(user.privilege ?? 0, 2);

  // -------------------
  // Password (8 bytes)
  // -------------------
  packet.write((user.password ?? "").substring(0, 8), 3, "ascii");

  // -------------------
  // Name (24 bytes)
  // -------------------
  packet.write(user.name.substring(0, 23), 11, "ascii");

  // -------------------
  // Card Number
  // -------------------
  packet.writeUInt32LE(user.card ?? 0, 35);

  // -------------------
  // Group
  // -------------------
  packet.writeUInt8(user.group ?? 1, 39);

  // -------------------
  // Use Group Timezone
  // -------------------
  packet.writeUInt16LE(0, 40);

  packet.writeUInt16LE(0, 42);
  packet.writeUInt16LE(0, 44);
  packet.writeUInt16LE(0, 46);

  // -------------------
  // User ID (9 bytes)
  // -------------------
  packet.write(String(user.userId).substring(0, 8), 48, "ascii");

  return packet;
}
