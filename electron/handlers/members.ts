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
        attendances: {
          orderBy: { checkInTime: "desc" },
          take: 10,
        },
      },
    });
  });

  ipcMain.handle("members:create", async (_: any, data: any) => {
    // ─── Step 1: Generate next employeeNo ──────────────────────────────
    const isActive = data.status === "ACTIVE";
    let nextEmployeeNo: number | null = null;

    if (isActive) {
      const lastMember = await prisma.member.findFirst({
        where: { employeeNo: { not: null } },
        orderBy: { employeeNo: "desc" },
        select: { employeeNo: true },
      });
      nextEmployeeNo = (lastMember?.employeeNo || 0) + 1;
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

      // Start background wait for fingerprint enrollment and log result.
      (async () => {
        try {
          deviceLogger.info("Waiting for fingerprint enrollment on device", {
            employeeNo: nextEmployeeNo,
          });
          const enrolled = await deviceManager.waitForEnrollment(
            nextEmployeeNo as number,
            300000,
            5000,
          );
          if (enrolled) {
            deviceLogger.info("Fingerprint enrolled for user on device", {
              employeeNo: nextEmployeeNo,
            });
            // Optionally update the DB to mark enrollment/provisioning
            try {
              await prisma.member.update({
                where: { id: member.id },
                data: { deviceSynced: true },
              });
            } catch { }
          } else {
            deviceLogger.warn("Fingerprint enrollment timed out", {
              employeeNo: nextEmployeeNo,
            });
          }
        } catch (err: any) {
          deviceLogger.error("Error while waiting for enrollment", {
            employeeNo: nextEmployeeNo,
            error: err?.message,
          });
        }
      })();

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

        // Start background wait for manual enrollment (operator creates user on device and enrolls fingerprint)
        (async () => {
          try {
            deviceLogger.info(
              "Waiting for manual fingerprint enrollment on device",
              { employeeNo: nextEmployeeNo },
            );
            const enrolled = await deviceManager.waitForEnrollment(
              nextEmployeeNo as number,
              120000,
              2000,
            );
            if (enrolled) {
              deviceLogger.info(
                "Manual fingerprint enrolled for user on device",
                { employeeNo: nextEmployeeNo },
              );
              try {
                await prisma.member.update({
                  where: { id: member.id },
                  data: { deviceSynced: true },
                });
              } catch { }
            } else {
              deviceLogger.warn("Manual fingerprint enrollment timed out", {
                employeeNo: nextEmployeeNo,
              });
            }
          } catch (err: any) {
            deviceLogger.error("Error while waiting for manual enrollment", {
              employeeNo: nextEmployeeNo,
              error: err?.message,
            });
          }
        })();
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
    let member = await prisma.member.update({
      where: { id },
      data,
    });

    // If member became ACTIVE and doesn't have an employeeNo, generate one and sync
    if (member.status === "ACTIVE" && !member.employeeNo) {
      const lastMember = await prisma.member.findFirst({
        where: { employeeNo: { not: null } },
        orderBy: { employeeNo: "desc" },
        select: { employeeNo: true },
      });
      const nextEmployeeNo = (lastMember?.employeeNo || 0) + 1;

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
          employeeNo: nextEmployeeNo,
          name: memberName,
          fullName: memberName,
          firstName: member.firstName,
          lastName: member.lastName,
          privilege: 0,
          password: "",
          enabled: true,
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
      const deviceUsers = await deviceManager.getUsers();
      const deviceUsersMap = new Map();

      for (const u of deviceUsers) {
        const uid = Number(u.uid ?? u.userId);
        if (!Number.isNaN(uid)) {
          deviceUsersMap.set(uid, u);
        }
      }

      const members = await prisma.member.findMany({
        select: { id: true, employeeNo: true, deviceSynced: true, firstName: true, lastName: true },
      });

      const updatedStatus = [];

      for (const m of members) {
        const onDevice = m.employeeNo != null ? deviceUsersMap.has(m.employeeNo) : false;

        // Sync name from device to local DB if it differs
        if (onDevice) {
          const dUser = deviceUsersMap.get(m.employeeNo);
          const dName = (dUser.name || "").trim();
          const localName = `${m.firstName || ""} ${m.lastName || ""}`.trim();

          if (dName && dName !== localName) {
            // Split dName into first and last
            const parts = dName.split(" ");
            const newFirst = parts[0];
            const newLast = parts.slice(1).join(" ");

            await prisma.member.update({
              where: { id: m.id },
              data: { firstName: newFirst, lastName: newLast }
            });
          }
        }

        updatedStatus.push({
          id: m.id,
          employeeNo: m.employeeNo,
          deviceSynced: m.deviceSynced,
          onDevice,
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
