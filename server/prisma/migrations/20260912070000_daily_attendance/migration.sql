-- CreateTable
CREATE TABLE `Site` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `radiusM` INTEGER NOT NULL DEFAULT 150,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('EMPLOYEE', 'SUPERVISOR', 'ADMIN') NOT NULL DEFAULT 'EMPLOYEE',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_employeeCode_key`(`employeeCode`),
    UNIQUE INDEX `Employee_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeSite` (
    `employeeId` INTEGER NOT NULL,
    `siteId` INTEGER NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`employeeId`, `siteId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyAttendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `siteId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `checkInAt` DATETIME(3) NULL,
    `checkInLat` DOUBLE NULL,
    `checkInLng` DOUBLE NULL,
    `checkInDistanceM` DOUBLE NULL,
    `checkInPhotoUrl` VARCHAR(191) NULL,
    `checkInStatus` ENUM('NORMAL', 'OUT_OF_RANGE') NULL,
    `checkOutAt` DATETIME(3) NULL,
    `checkOutLat` DOUBLE NULL,
    `checkOutLng` DOUBLE NULL,
    `checkOutDistanceM` DOUBLE NULL,
    `checkOutPhotoUrl` VARCHAR(191) NULL,
    `checkOutStatus` ENUM('NORMAL', 'OUT_OF_RANGE') NULL,
    `note` TEXT NULL,
    `editedByHr` BOOLEAN NOT NULL DEFAULT false,
    `editedById` INTEGER NULL,
    `editedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailyAttendance_siteId_date_idx`(`siteId`, `date`),
    UNIQUE INDEX `DailyAttendance_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmployeeSite` ADD CONSTRAINT `EmployeeSite_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeSite` ADD CONSTRAINT `EmployeeSite_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyAttendance` ADD CONSTRAINT `DailyAttendance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyAttendance` ADD CONSTRAINT `DailyAttendance_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyAttendance` ADD CONSTRAINT `DailyAttendance_editedById_fkey` FOREIGN KEY (`editedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

