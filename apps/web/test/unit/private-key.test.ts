import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalisePrivateKey } from "../../src/lib/server/firebase";

const pem = generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const escaped = pem.replace(/\n/g, "\\n"); // as in the service account JSON

describe("service account private key, however it was pasted", () => {
  it.each([
    ["real line breaks", pem],
    ["literal \\n", escaped],
    ["literal \\n inside double quotes", `"${escaped}"`],
    ["inside single quotes", `'${escaped}'`],
    ["with spaces around", `  ${escaped}  `],
    ["Windows line endings", pem.replace(/\n/g, "\r\n")],
    ["without the final line break", pem.trimEnd()],
  ])("%s", (_name, raw) => {
    const k = normalisePrivateKey(raw)!;
    expect(k.startsWith("-----BEGIN PRIVATE KEY-----\n")).toBe(true);
    expect(() => createPrivateKey(k)).not.toThrow();
  });
  it("returns undefined when missing", () => {
    expect(normalisePrivateKey(undefined)).toBeUndefined();
    expect(normalisePrivateKey("")).toBeUndefined();
  });
});
