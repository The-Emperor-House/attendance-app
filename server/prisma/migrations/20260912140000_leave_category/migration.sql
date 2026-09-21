-- AlterTable
ALTER TABLE `LeaveQuota` MODIFY `type` VARCHAR(30) NOT NULL;

-- AlterTable
ALTER TABLE `LeaveQuotaDefault` DROP PRIMARY KEY,
    MODIFY `type` VARCHAR(30) NOT NULL,
    ADD PRIMARY KEY (`type`);

-- AlterTable
ALTER TABLE `LeaveRequest` MODIFY `type` VARCHAR(30) NOT NULL;

-- CreateTable
CREATE TABLE `LeaveCategory` (
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

