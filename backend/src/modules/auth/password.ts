import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));

/* scrypt (built into Node, memory-hard). Stored as scrypt$N$r$p$salt$hash so parameters
   can be raised later without breaking existing hashes. */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };
const maxmem = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem });
  return timingSafeEqual(key, expected);
}

/* Burns the same time as a real check, so "no such user" and "wrong password" look alike */
let dummy: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(password, await dummy);
  return false;
}
