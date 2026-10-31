import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
export const dummyPasswordHash = `${"0".repeat(32)}:${"0".repeat(128)}`;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await deriveKey(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const actual = (await deriveKey(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
