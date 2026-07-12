export function createDeleteUserPacket(uid: number): Buffer {
  const packet = Buffer.alloc(2);

  // user serial number (little-endian)
  packet.writeUInt16LE(uid, 0);

  return packet;
}
