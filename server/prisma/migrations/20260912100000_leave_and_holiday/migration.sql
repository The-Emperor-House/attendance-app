-- AlterTable
ALTER TABLE `DailyAttendance` MODIFY `checkInStatus` ENUM('NORMAL', 'OUT_OF_RANGE', 'OFF_SITE') NULL,
    MODIFY `checkOutStatus` ENUM('NORMAL', 'OUT_OF_RANGE', 'OFF_SITE') NULL;

-- CreateTable
CREATE TABLE `LeaveRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `type` ENUM('SICK', 'VACATION', 'PERSONAL') NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `reason` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `approverNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeaveRequest_employeeId_startDate_idx`(`employeeId`, `startDate`),
    INDEX `LeaveRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Holiday` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Holiday_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

