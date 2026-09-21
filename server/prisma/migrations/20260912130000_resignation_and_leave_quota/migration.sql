-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `resignationReason` TEXT NULL,
    ADD COLUMN `resignationType` ENUM('RESIGNED', 'TERMINATED', 'RETIRED', 'OTHER') NULL,
    ADD COLUMN `resignedAt` DATE NULL;

-- CreateTable
CREATE TABLE `LeaveQuotaDefault` (
    `type` ENUM('SICK', 'VACATION', 'PERSONAL') NOT NULL,
    `annualDays` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `type` ENUM('SICK', 'VACATION', 'PERSONAL') NOT NULL,
    `year` INTEGER NOT NULL,
    `days` INTEGER NOT NULL,

    UNIQUE INDEX `LeaveQuota_employeeId_type_year_key`(`employeeId`, `type`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeaveQuota` ADD CONSTRAINT `LeaveQuota_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

