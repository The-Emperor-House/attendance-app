-- Allow several site visits per employee per day. Existing rows become visit 1.
ALTER TABLE `DailyAttendance` ADD COLUMN `seq` INTEGER NOT NULL DEFAULT 1;

-- Create the new index before dropping the old one: the employeeId foreign key
-- needs an index that starts with employeeId at all times.
CREATE UNIQUE INDEX `DailyAttendance_employeeId_date_seq_key` ON `DailyAttendance`(`employeeId`, `date`, `seq`);
DROP INDEX `DailyAttendance_employeeId_date_key` ON `DailyAttendance`;
