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

const TRAINER_ID_OFFSET = 10000;

export function registerTrainersHandlers(ipcMain: any, prisma: any) {
  ipcMain.handle('trainers:getAll', async () => {
    return await prisma.trainer.findMany({
      include: {
        _count: {
          select: { members: true }
        },
        fingerprints: true,
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            status: true,
            plan: { select: { name: true } }
          },
          orderBy: { firstName: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  ipcMain.handle('trainers:create', async (_: any, data: any) => {
    const TRAINER_START_ID = 1;
    const TRAINER_MAX_ID = 499;
    const usedIds = new Set<number>();
    let nextEmployeeNo: number;

    try {

      const allTrainers = await prisma.trainer.findMany({
        where: { employeeNo: { not: null, gte: TRAINER_START_ID, lte: TRAINER_MAX_ID } },
        select: { employeeNo: true },
      });
      for (const t of allTrainers) {
        if (t.employeeNo) usedIds.add(t.employeeNo);
      }

      let candidate = TRAINER_START_ID;
      while (usedIds.has(candidate) && candidate <= TRAINER_MAX_ID) {
        candidate++;
      }
      if (candidate > TRAINER_MAX_ID) throw new Error("No available trainer IDs in range 1-499");
      nextEmployeeNo = candidate;
    } catch (err) {
      throw err;
    }

    // ─── Step 2: Save to SQLite with employeeNo ────────────────────────
    let trainer;
    try {
      trainer = await prisma.trainer.create({
        data: {
          ...data,
          employeeNo: nextEmployeeNo,
          deviceSynced: false,
        },
      });
    } catch (err: any) {
      if (err && err.code === "P2002") {
        throw new Error(
          "A trainer with the provided unique field already exists (CNIC or other)",
        );
      }
      throw err;
    }

    let deviceSynced = false;
    let deviceError: string | undefined;

    const trainerName = `${data.firstName || ""} ${data.lastName || ""}`.trim();

    try {
      // Build a flexible payload covering common ZK library shapes
      const userPayload = {
        uid: nextEmployeeNo as number,
        id: nextEmployeeNo as number,
        userId: nextEmployeeNo as number,
        user_id: String(nextEmployeeNo),
        employeeNo: nextEmployeeNo as number,
        name: trainerName,
        fullName: trainerName,
        firstName: data.firstName,
        lastName: data.lastName,
        privilege: 14, // 14 = Super Admin
        password: "1234",
      };

      await deviceManager.addUser(userPayload);
      deviceSynced = true;

      try {
        await deviceManager.startEnrollment(nextEmployeeNo as number, 0);
      } catch (enrollErr: any) {
        deviceLogger.warn("Failed to auto-start enrollment", {
          employeeNo: nextEmployeeNo,
          error: enrollErr.message,
        });
      }


      // Update sync flag in SQLite
      await prisma.trainer.update({
        where: { id: trainer.id },
        data: { deviceSynced: true },
      });

      deviceLogger.userCreated(nextEmployeeNo as number, trainerName);
    } catch (error: any) {
      const msg = String(error?.message || error);
      if (
        msg.includes("User enrollment is not supported") ||
        msg.includes("User enrollment is not implemented")
      ) {
        deviceError =
          "Remote enrollment not supported by device/library. Please create user with ID " +
          nextEmployeeNo +
          " on the device and enroll fingerprint; the app will detect it automatically.";
        deviceLogger.userCreateFailed(nextEmployeeNo as number, trainerName, msg);


      } else {
        deviceError = msg;
        deviceLogger.userCreateFailed(nextEmployeeNo as number, trainerName, msg);
      }
    }

    return {
      ...trainer,
      deviceSynced,
      deviceError,
    };
  });

  ipcMain.handle('trainers:update', async (_: any, id: string, data: any) => {
    let trainer = await prisma.trainer.update({
      where: { id },
      data,
    });

    // If trainer doesn't have an employeeNo yet, generate one and sync
    if (!trainer.employeeNo) {
      const TRAINER_START_ID = 1;
      const TRAINER_MAX_ID = 499;
      const usedIds = new Set<number>();

      const allTrainers = await prisma.trainer.findMany({
        where: { employeeNo: { not: null, gte: TRAINER_START_ID, lte: TRAINER_MAX_ID } },
        select: { employeeNo: true }
      });
      for (const t of allTrainers) {
        if (t.employeeNo) usedIds.add(t.employeeNo);
      }

      let candidate = TRAINER_START_ID;
      while (usedIds.has(candidate) && candidate <= TRAINER_MAX_ID) {
        candidate++;
      }
      if (candidate > TRAINER_MAX_ID) throw new Error("No available trainer IDs in range 1-9999");
      const nextEmployeeNo = candidate;

      trainer = await prisma.trainer.update({
        where: { id },
        data: { employeeNo: nextEmployeeNo },
      });

      try {
        const trainerName = `${trainer.firstName || ""} ${trainer.lastName || ""}`.trim();
        const userPayload = {
          uid: nextEmployeeNo,
          id: nextEmployeeNo,
          userId: nextEmployeeNo,
          user_id: String(nextEmployeeNo),
          employeeNo: nextEmployeeNo,
          name: trainerName,
          fullName: trainerName,
          firstName: data.firstName || trainer.firstName,
          lastName: data.lastName || trainer.lastName,
          privilege: 14, // Super Admin
          password: "",
        };
        await deviceManager.addUser(userPayload);
        await prisma.trainer.update({
          where: { id: trainer.id },
          data: { deviceSynced: true },
        });
        deviceLogger.info("Assigned ID and synced trainer to device", { employeeNo: nextEmployeeNo });
      } catch (error: any) {
        deviceLogger.error("Failed to create trainer on device", { error: error.message });
      }
    }

    // Sync status/name changes to device
    if (trainer.employeeNo) {
      try {
        const trainerName = `${trainer.firstName || ""} ${trainer.lastName || ""}`.trim();
        await deviceManager.updateUser({
          userId: trainer.employeeNo,
          name: trainerName,
          privilege: 14,
          password: "1234"
        });
        deviceLogger.info("Synced trainer update to device", {
          employeeNo: trainer.employeeNo,
        });
      } catch (error: any) {
        deviceLogger.error("Failed to update trainer on device", {
          employeeNo: trainer.employeeNo,
          error: error.message,
        });
      }
    }

    return trainer;
  });

  ipcMain.handle('trainers:delete', async (_: any, id: string) => {
    const trainer = await prisma.trainer.findUnique({
      where: { id },
      select: { id: true, employeeNo: true, firstName: true, lastName: true },
    });

    if (!trainer) {
      throw new Error("Trainer not found");
    }

    if (trainer.employeeNo) {
      try {
        await deviceManager.deleteUser(trainer.employeeNo);
        deviceLogger.info("Deleted trainer from device", {
          employeeNo: trainer.employeeNo,
          name: `${trainer.firstName} ${trainer.lastName || ""}`.trim(),
        });
      } catch (error: any) {
        deviceLogger.error("Failed to delete trainer from device", {
          employeeNo: trainer.employeeNo,
          error: error.message,
        });
      }
    }

    return await prisma.trainer.delete({
      where: { id },
    });
  });
}
