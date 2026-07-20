import { Buffer } from "buffer";
import type { DeviceUser } from "../types";

export function createUserPacket(user: DeviceUser): Buffer {
  const packet = Buffer.alloc(72);
  // UID (2 bytes) - 0 tells device to auto-assign internal UID
  // For updates, we should pass the actual internal UID if we have it
  const internalUid = typeof user.uid === 'number' && user.uid > 0 && user.uid < 65535 ? user.uid : 0;
  packet.writeUInt16LE(internalUid, 0);

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
  packet.write((user.password ?? "").substring(0, 8), 3, "utf8");

  // -------------------
  // Name (24 bytes)
  // -------------------
  packet.write(user.name.substring(0, 23), 11, "utf8");

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
  const userIdString = String((user as any).user_id ?? user.userId ?? user.uid ?? "");
  packet.write(userIdString.substring(0, 8), 48, "utf8");

  return packet;
}
