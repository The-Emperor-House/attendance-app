import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 4;

// The one rule for any password that gets set (by an admin or by the employee).
// bcrypt silently ignores everything past 72 bytes (24 Thai characters), so cap it there.
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`)
  .refine((v) => Buffer.byteLength(v, "utf8") <= 72, "รหัสผ่านยาวเกินไป");
