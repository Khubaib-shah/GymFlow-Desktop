import path from "path";
import { deviceManager } from "../zkTeco";
import { deviceLogger } from "../utils/deviceLogger";

function formatDeviceDate(date: any): string | undefined {
  if (!date) return undefined;
  try {
    return new Date(date).toISOString().split(".")[0];
  } catch {
    return undefined;
  }
}

export function registerMembersHandlers(
  ipcMain: any,
  prisma: any,
  userDataPath: string,
) {
  ipcMain.handle("members:getAll", async () => {
    const now = new Date();

    // Auto-expire: ACTIVE members whose membership has ended
    const expiredMembers = await prisma.member.findMany({
      where: {
        status: "ACTIVE",
        membershipEnd: { lt: now },
      },
      select: { id: true, employeeNo: true, firstName: true, lastName: true },
    });

    if (expiredMembers.length > 0) {
      // Update status in DB
      await prisma.member.updateMany({
        where: {
          status: "ACTIVE",
          membershipEnd: { lt: now },
        },
        data: { status: "EXPIRED" },
      });

      for (const m of expiredMembers) {
        if (m.employeeNo) {
          const name = `${m.firstName} ${m.lastName || ""}`.trim();
          try {
            await deviceManager.updateUser({
              userId: m.employeeNo,
              name,
              enabled: false,
            });
            deviceLogger.info("Auto-disabled expired member on device", {
              employeeNo: m.employeeNo,
              name,
            });
          } catch (err: any) {
            deviceLogger.error(
              "Failed to auto-disable expired member on device",
              {
                employeeNo: m.employeeNo,
                error: err.message,
              },
            );
          }
        }
      }
    }

    // Auto-suspend: EXPIRED members whose membership ended more than 60 days ago
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    await prisma.member.updateMany({
      where: {
        status: "EXPIRED",
        membershipEnd: { lt: sixtyDaysAgo },
      },
      data: { status: "SUSPENDED" },
    });

    return await prisma.member.findMany({
      include: {
        trainer: true,
        plan: true,
        fingerprints: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  ipcMain.handle("members:getById", async (_: any, id: string) => {
    return await prisma.member.findUnique({
      where: { id },
      include: {
        trainer: true,
        plan: true,
        fingerprints: true,
        attendances: {
          orderBy: { checkInTime: "desc" },
          take: 10,
        },
      },
    });
  });

  ipcMain.handle("members:create", async (_: any, data: any) => {
    delete data.fingerprints;
    // ─── Step 1: Generate next employeeNo ──────────────────────────────
    const isActive = data.status === "ACTIVE";
    let nextEmployeeNo: number | null = null;

    if (isActive) {
      const MEMBER_ID_OFFSET = 500;
      const usedIds = new Set<number>();

      const allMembers = await prisma.member.findMany({
        where: { employeeNo: { not: null, gte: MEMBER_ID_OFFSET } },
        select: { employeeNo: true },
      });
      for (const m of allMembers) {
        if (m.employeeNo) usedIds.add(m.employeeNo);
      }

      let candidate = MEMBER_ID_OFFSET;
      while (usedIds.has(candidate)) {
        candidate++;
      }
      nextEmployeeNo = candidate;
    }

    // ─── Step 2: Save to SQLite with employeeNo ────────────────────────
    let member;
    try {
      member = await prisma.member.create({
        data: {
          ...data,
          employeeNo: nextEmployeeNo,
          deviceSynced: false,
        },
      });
    } catch (err: any) {
      // Prisma unique constraint violation for CNIC (or other unique fields)
      if (err && err.code === "P2002") {
        throw new Error(
          "A member with the provided unique field already exists (CNIC or other)",
        );
      }
      throw err;
    }

    let deviceSynced = false;
    let deviceError: string | undefined;

    if (!isActive) {
      return {
        ...member,
        deviceSynced: false,
        deviceError: undefined,
      };
    }

    const memberName = `${data.firstName || ""} ${data.lastName || ""}`.trim();

    try {
      // Build a flexible payload covering common ZK library shapes
      const userPayload = {
        uid: nextEmployeeNo as number,
        id: nextEmployeeNo as number,
        userId: nextEmployeeNo as number,
        user_id: String(nextEmployeeNo),
        employeeNo: nextEmployeeNo as number,
        name: memberName,
        fullName: memberName,
        firstName: data.firstName,
        lastName: data.lastName,
        privilege: 0,
        password: "",
        enabled: true,
        startDate: formatDeviceDate(data.membershipStart),
        endDate: formatDeviceDate(data.membershipEnd),
      };

      await deviceManager.addUser(userPayload);
      deviceSynced = true;


      // Update sync flag in SQLite
      await prisma.member.update({
        where: { id: member.id },
        data: { deviceSynced: true },
      });

      deviceLogger.userCreated(nextEmployeeNo as number, memberName);
    } catch (error: any) {
      // If the underlying ZK library doesn't support remote enrollment, guide operator to enroll locally.
      const msg = String(error?.message || error);
      if (
        msg.includes("User enrollment is not supported") ||
        msg.includes("User enrollment is not implemented")
      ) {
        deviceError =
          "Remote enrollment not supported by device/library. Please create user with ID " +
          nextEmployeeNo +
          " on the device and enroll fingerprint; the app will detect it automatically.";
        deviceLogger.userCreateFailed(nextEmployeeNo as number, memberName, msg);

      } else {
        deviceError = msg;
        deviceLogger.userCreateFailed(nextEmployeeNo as number, memberName, msg);
      }
    }

    // ─── Step 4: Return result ─────────────────────────────────────────
    return {
      ...member,
      deviceSynced,
      deviceError,
    };
  });

  ipcMain.handle("members:update", async (_: any, id: string, data: any) => {
    delete data.fingerprints;
    let member = await prisma.member.update({
      where: { id },
      data,
    });

    // If member became ACTIVE and doesn't have an employeeNo, generate one and sync
    if (member.status === "ACTIVE" && !member.employeeNo) {
      const MEMBER_ID_OFFSET = 500;
      const usedIds = new Set<number>();

      const allMembers = await prisma.member.findMany({
        where: { employeeNo: { not: null, gte: MEMBER_ID_OFFSET } },
        select: { employeeNo: true },
      });
      for (const m of allMembers) {
        if (m.employeeNo) usedIds.add(m.employeeNo);
      }

      let candidate = MEMBER_ID_OFFSET;
      while (usedIds.has(candidate)) {
        candidate++;
      }
      const nextEmployeeNo = candidate;

      member = await prisma.member.update({
        where: { id },
        data: { employeeNo: nextEmployeeNo },
      });

      try {
        const memberName = `${member.firstName || ""} ${member.lastName || ""}`.trim();
        await deviceManager.addUser({
          uid: nextEmployeeNo,
          id: nextEmployeeNo,
          userId: nextEmployeeNo,
          user_id: String(nextEmployeeNo),
          employeeNo: nextEmployeeNo,
          name: memberName,
          fullName: memberName,
          firstName: member.firstName,
          lastName: member.lastName,
          privilege: 0,
          password: "",
          startDate: formatDeviceDate(member.membershipStart),
          endDate: formatDeviceDate(member.membershipEnd),
        });
        await prisma.member.update({
          where: { id: member.id },
          data: { deviceSynced: true },
        });
        deviceLogger.info("Assigned ID and synced upgraded member to device", { employeeNo: nextEmployeeNo });
      } catch (error: any) {
        deviceLogger.error("Failed to create upgraded member on device", { error: error.message });
      }
    } else if (member.status === "ACTIVE" && member.employeeNo) {
      try {
        const memberName = `${member.firstName || ""} ${member.lastName || ""}`.trim();
        await deviceManager.addUser({
          uid: member.employeeNo,
          id: member.employeeNo,
          userId: member.employeeNo,
          user_id: String(member.employeeNo),
          employeeNo: member.employeeNo,
          name: memberName,
          fullName: memberName,
          firstName: member.firstName,
          lastName: member.lastName,
          privilege: 0,
          password: "",
        });
        deviceLogger.info("Synced updated member to device", { employeeNo: member.employeeNo });
      } catch (error: any) {
        deviceLogger.error("Failed to sync updated member to device", { error: error.message });
      }
    }

    // Sync status change to Hikvision device
    if (member.employeeNo) {
      try {
        const memberName =
          `${member.firstName || ""} ${member.lastName || ""}`.trim();
        const isExpired =
          member.membershipEnd && new Date(member.membershipEnd) < new Date();
        const shouldEnable = member.status === "ACTIVE" && !isExpired;

        await deviceManager.updateUser({
          userId: member.employeeNo,
          name: memberName,
          enabled: shouldEnable,
          endDate: formatDeviceDate(member.membershipEnd),
        });

        deviceLogger.info("Synced member update to device", {
          employeeNo: member.employeeNo,
          enabled: shouldEnable,
        });
      } catch (error: any) {
        deviceLogger.error("Failed to update user on device", {
          employeeNo: member.employeeNo,
          error: error.message,
        });
      }
    }

    return member;
  });

  ipcMain.handle("members:delete", async (_: any, id: string) => {
    // Fetch member first to get employeeNo for device cleanup
    const member = await prisma.member.findUnique({
      where: { id },
      select: { id: true, employeeNo: true, firstName: true, lastName: true },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    if (member.employeeNo) {
      try {
        await deviceManager.deleteUser(member.employeeNo);
        deviceLogger.info("Deleted member from device", {
          employeeNo: member.employeeNo,
          name: `${member.firstName} ${member.lastName || ""}`.trim(),
        });
      } catch (error: any) {
        // Log but don't block DB deletion — device might be offline
        deviceLogger.error("Failed to delete user from device", {
          employeeNo: member.employeeNo,
          error: error.message,
        });
      }
    }

    // Delete from SQLite
    return await prisma.member.delete({
      where: { id },
    });
  });

  ipcMain.handle("members:getPhotoPath", async (_: any, filename: string) => {
    return path.join(userDataPath, "media", filename);
  });

  ipcMain.handle("members:getDeviceSyncStatus", async () => {
    try {
      const { users: deviceUsers, templates } = await deviceManager.getUsersAndTemplates();
      const deviceUsersMap = new Map();
      const fingerprintCounts = new Map();

      for (const u of deviceUsers) {
        const uid = Number(u.user_id ?? u.uid ?? u.userId);
        if (!Number.isNaN(uid)) {
          deviceUsersMap.set(uid, u);
        }
      }

      if (Array.isArray(templates)) {
        for (const t of templates) {
          const uid = Number(t.uid ?? t.userId ?? t.user_id);
          if (!Number.isNaN(uid)) {
            fingerprintCounts.set(uid, (fingerprintCounts.get(uid) || 0) + 1);
          }
        }
      }

      const members = await prisma.member.findMany({
        select: { id: true, employeeNo: true, deviceSynced: true, firstName: true, lastName: true },
      });

      const updatedStatus = [];

      for (const m of members) {
        const onDevice = m.employeeNo != null ? deviceUsersMap.has(m.employeeNo) : false;
        const fingerprintCount = m.employeeNo != null ? (fingerprintCounts.get(m.employeeNo) || 0) : 0;

        updatedStatus.push({
          id: m.id,
          employeeNo: m.employeeNo,
          deviceSynced: m.deviceSynced,
          onDevice,
          fingerprintCount,
        });
      }

      return {
        success: true,
        data: updatedStatus,
      };
    } catch (error) {
      return { success: false, data: [] };
    }
  });
}
