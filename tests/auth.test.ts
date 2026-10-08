import { randomBytes, scryptSync } from "node:crypto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createSession, isSecureRequest, sessionCookie, verifySession } from "../server/auth/session.ts";
import { verifyPassword } from "../server/auth/password.ts";
import { isSameOrigin } from "../server/auth/authorize.ts";
import type { HandlerEvent } from "@netlify/functions";

describe("fundação de autenticação", () => {
  const previousSecret = process.env.SESSION_SECRET;
  beforeEach(() => { process.env.SESSION_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres"; });
  afterEach(() => { process.env.SESSION_SECRET = previousSecret; });

  it("assina e valida uma sessão", () => {
    const token = createSession("admin@perfect.test", "ADMIN");
    assert.deepEqual(verifySession(token)?.sub, "admin@perfect.test");
    assert.deepEqual(verifySession(token)?.role, "ADMIN");
  });

  it("rejeita sessão adulterada", () => {
    const token = createSession("admin@perfect.test", "ADMIN");
    assert.equal(verifySession(`${token.slice(0, -2)}xx`), null);
  });

  it("remove Secure apenas para pedidos locais feitos por HTTP", () => {
    assert.equal(isSecureRequest({ "x-forwarded-proto": "http" }), false);
    assert.equal(isSecureRequest({ origin: "http://localhost:5173" }), false);
    assert.equal(sessionCookie("token", false).includes("; Secure"), false);
    assert.equal(isSecureRequest({ "x-forwarded-proto": "https" }), true);
    assert.equal(sessionCookie("token", true).includes("; Secure"), true);
  });

  it("verifica senha scrypt sem armazenar texto puro", () => {
    const salt = randomBytes(16);
    const hash = scryptSync("senha-forte-123", salt, 64);
    const stored = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
    assert.equal(verifyPassword("senha-forte-123", stored), true);
    assert.equal(verifyPassword("senha-errada", stored), false);
  });

  it("aceita o proxy local do Vite e rejeita origem externa", () => {
    const event = (origin: string, host = "localhost:8888") => ({ headers: { origin, host } }) as unknown as HandlerEvent;
    assert.equal(isSameOrigin(event("http://localhost:5173")), true);
    assert.equal(isSameOrigin(event("https://site-malicioso.example")), false);
  });
});
