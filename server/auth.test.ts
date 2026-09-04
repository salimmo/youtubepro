import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, parseCookies, verifyPassword } from "./auth";
import { loginRequestSchema, adminCreateUserSchema, changePasswordRequestSchema } from "@shared/auth-contracts";

describe("Passwort-Hashing", () => {
  it("verifiziert das richtige Passwort und lehnt falsche ab", async () => {
    const hash = await hashPassword("geheimes-passwort");
    assert.match(hash, /^scrypt\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    assert.equal(await verifyPassword("geheimes-passwort", hash), true);
    assert.equal(await verifyPassword("geheimes-Passwort", hash), false);
    assert.equal(await verifyPassword("", hash), false);
  });

  it("erzeugt pro Aufruf ein anderes Salt", async () => {
    const first = await hashPassword("gleich");
    const second = await hashPassword("gleich");
    assert.notEqual(first, second);
  });

  it("lehnt beschädigte oder fremde Hash-Formate ab", async () => {
    assert.equal(await verifyPassword("x", "plaintext"), false);
    assert.equal(await verifyPassword("x", "scrypt$16384$abc$def"), false);
    assert.equal(await verifyPassword("x", "bcrypt$10$salt$hash"), false);
  });
});

describe("Cookie-Parsing", () => {
  it("liest mehrere Cookies und dekodiert Werte", () => {
    const cookies = parseCookies("a=1; yp_session=abc%3Ddef; b = 2");
    assert.deepEqual(cookies, { a: "1", yp_session: "abc=def", b: "2" });
  });

  it("gibt bei fehlendem Header ein leeres Objekt zurück", () => {
    assert.deepEqual(parseCookies(undefined), {});
  });
});

describe("Auth-Verträge", () => {
  it("validiert Login-Eingaben", () => {
    assert.equal(loginRequestSchema.safeParse({ username: "salim", password: "x" }).success, true);
    assert.equal(loginRequestSchema.safeParse({ username: "", password: "x" }).success, false);
    assert.equal(loginRequestSchema.safeParse({ username: "salim", password: "x", extra: 1 }).success, false);
  });

  it("erzwingt Benutzernamen- und Passwortregeln beim Anlegen", () => {
    const valid = adminCreateUserSchema.safeParse({ username: "kollege.1", password: "mindestens8", displayName: "Kollege" });
    assert.equal(valid.success, true);
    if (valid.success) assert.equal(valid.data.role, "user");
    assert.equal(adminCreateUserSchema.safeParse({ username: "ab", password: "mindestens8", displayName: "K" }).success, false);
    assert.equal(adminCreateUserSchema.safeParse({ username: "kollege", password: "kurz", displayName: "K" }).success, false);
    assert.equal(adminCreateUserSchema.safeParse({ username: "kol lege", password: "mindestens8", displayName: "K" }).success, false);
  });

  it("verlangt ein neues Passwort mit mindestens 8 Zeichen", () => {
    assert.equal(changePasswordRequestSchema.safeParse({ currentPassword: "alt", newPassword: "neu" }).success, false);
    assert.equal(changePasswordRequestSchema.safeParse({ currentPassword: "alt", newPassword: "neues-passwort" }).success, true);
  });
});
