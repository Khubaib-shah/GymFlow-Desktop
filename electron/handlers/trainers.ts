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
    // ─── Step 1: Generate next employeeNo ──────────────────────────────
    const lastTrainer = await prisma.trainer.findFirst({
      where: { employeeNo: { not: null } },
      orderBy: { employeeNo: "desc" },
      select: { employeeNo: true },
    });
    const lastTrainerNo = lastTrainer?.employeeNo || TRAINER_ID_OFFSET;
    const nextEmployeeNo = lastTrainerNo + 1;

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
        employeeNo: nextEmployeeNo as number,
        name: trainerName,
        fullName: trainerName,
        firstName: data.firstName,
        lastName: data.lastName,
        privilege: 0,
        password: "",
      };

      await deviceManager.addUser(userPayload);
      deviceSynced = true;

      // Start background wait for fingerprint enrollment
      (async () => {
        try {
          deviceLogger.info("Waiting for fingerprint enrollment on device for trainer", {
            employeeNo: nextEmployeeNo,
          });
          const enrolled = await deviceManager.waitForEnrollment(
            nextEmployeeNo as number,
            300000,
            5000,
          );
          if (enrolled) {
            deviceLogger.info("Fingerprint enrolled for trainer on device", {
              employeeNo: nextEmployeeNo,
            });
            try {
              await prisma.trainer.update({
                where: { id: trainer.id },
                data: { deviceSynced: true },
              });
            } catch { }
          } else {
            deviceLogger.warn("Fingerprint enrollment timed out for trainer", {
              employeeNo: nextEmployeeNo,
            });
          }
        } catch (err: any) {
          deviceLogger.error("Error while waiting for trainer enrollment", {
            employeeNo: nextEmployeeNo,
            error: err?.message,
          });
        }
      })().catch((err: any) => {
        deviceLogger.error("Unhandled error in trainer enrollment watcher", {
          employeeNo: nextEmployeeNo,
          error: err?.message,
        });
      });

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

        // Start background wait for manual enrollment
        (async () => {
          try {
            deviceLogger.info(
              "Waiting for manual fingerprint enrollment for trainer on device",
              { employeeNo: nextEmployeeNo },
            );
            const enrolled = await deviceManager.waitForEnrollment(
              nextEmployeeNo as number,
              120000,
              2000,
            );
            if (enrolled) {
              deviceLogger.info(
                "Manual fingerprint enrolled for trainer on device",
                { employeeNo: nextEmployeeNo },
              );
              try {
                await prisma.trainer.update({
                  where: { id: trainer.id },
                  data: { deviceSynced: true },
                });
              } catch { }
            } else {
              deviceLogger.warn("Manual fingerprint enrollment timed out for trainer", {
                employeeNo: nextEmployeeNo,
              });
            }
          } catch (err: any) {
            deviceLogger.error("Error while waiting for manual trainer enrollment", {
              employeeNo: nextEmployeeNo,
              error: err?.message,
            });
          }
        })().catch((err: any) => {
          deviceLogger.error("Unhandled error in manual trainer enrollment watcher", {
            employeeNo: nextEmployeeNo,
            error: err?.message,
          });
        });
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
      const lastTrainer = await prisma.trainer.findFirst({
        where: { employeeNo: { not: null } },
        orderBy: { employeeNo: "desc" },
        select: { employeeNo: true },
      });
      const nextEmployeeNo = (lastTrainer?.employeeNo || TRAINER_ID_OFFSET) + 1;

      trainer = await prisma.trainer.update({
        where: { id },
        data: { employeeNo: nextEmployeeNo },
      });

      try {
        const trainerName = `${trainer.firstName || ""} ${trainer.lastName || ""}`.trim();
        await deviceManager.addUser({
          uid: nextEmployeeNo,
          id: nextEmployeeNo,
          userId: nextEmployeeNo,
          employeeNo: nextEmployeeNo,
          name: trainerName,
          fullName: trainerName,
          firstName: trainer.firstName,
          lastName: trainer.lastName,
          privilege: 0,
          password: "",
        });
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
