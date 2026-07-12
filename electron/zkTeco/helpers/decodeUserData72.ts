export function decodeUserData72(userData: Buffer) {
  return {
    uid: userData.readUInt16LE(0),

    role: userData.readUInt8(2),

    password: userData.subarray(3, 11).toString("ascii").replace(/\0/g, ""),

    name: userData.subarray(11, 35).toString("ascii").replace(/\0/g, ""),

    cardNo: userData.readUInt32LE(35),

    group: userData.readUInt8(39),

    userTzFlag: userData.readUInt16LE(40),

    tz1: userData.readUInt16LE(42),

    tz2: userData.readUInt16LE(44),

    tz3: userData.readUInt16LE(46),

    userId: userData.subarray(48, 57).toString("ascii").replace(/\0/g, ""),
  };
}
