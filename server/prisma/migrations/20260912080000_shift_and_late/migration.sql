-- AlterTable
ALTER TABLE `DailyAttendance` ADD COLUMN `checkInLate` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Site` ADD COLUMN `lateGraceMinutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `shiftEnd` VARCHAR(5) NULL,
    ADD COLUMN `shiftStart` VARCHAR(5) NULL;

