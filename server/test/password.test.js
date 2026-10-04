import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordSchema } from "../src/lib/password.js";

test("passwords need at least 4 characters, any content", () => {
  assert.equal(passwordSchema.safeParse("abc").success, false);
  assert.equal(passwordSchema.safeParse("1234").success, true);
  assert.equal(passwordSchema.safeParse("EMP001").success, true);
  assert.equal(passwordSchema.safeParse("รหัสไทย").success, true);
});

test("passwords over bcrypt's 72-byte limit are rejected", () => {
  assert.equal(passwordSchema.safeParse("ก".repeat(24)).success, true);
  assert.equal(passwordSchema.safeParse("ก".repeat(25)).success, false);
});
