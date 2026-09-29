import test from "node:test";
import assert from "node:assert/strict";
import { createAdminAuth, hashAdminPassword } from "./admin-auth.js";
import { createApp } from "./app.js";

const password = "synthetic-test-password-only";
const hash = await hashAdminPassword(password);
const configuration = () => ({ username: "admin", hash });
const request = (body = {}, token = "") => ({ body, get: () => token ? `Bearer ${token}` : "" });
function response() {
  return { code: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function allowed(auth, token) {
  const res = response();
  let access = false;
  auth.authorize(request({}, token), res, () => { access = true; });
  return { access, res };
}

test("administrador fechado por omissão, sem consultar dados", async () => {
  const auth = createAdminAuth({ configuration: () => ({}) });
  const res = response();
  await auth.login(request({ username: "admin", password }), res);
  assert.equal(res.code, 503);
  const app = createApp({ connect: () => assert.fail("unauthorized database access") }, { adminAuth: auth });
  const route = app._router.stack.find((layer) => layer.route?.path === "/api/admin/results");
  route.route.stack[0].handle(request(), res, () => assert.fail("unauthorized route"));
  assert.equal(res.code, 503);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("palavras-passe fortes, hash com sal e rejeição de credenciais inválidas", async () => {
  await assert.rejects(hashAdminPassword("short"));
  await assert.rejects(hashAdminPassword("a".repeat(129)));
  assert.notEqual(await hashAdminPassword(password), hash);
  const auth = createAdminAuth({ configuration });
  for (const body of [{ username: "admin", password: "incorrect" }, { username: "other", password }, { password: [] }]) {
    const res = response();
    await auth.login(request(body), res);
    assert.equal(res.code, 401);
    assert.equal(res.body.token, undefined);
  }
  assert.equal(allowed(auth, "a".repeat(64)).access, false);
});

test("sessão expira, logout revoga e configuração alterada invalida acesso", async () => {
  let time = 0;
  let config = configuration();
  const auth = createAdminAuth({ configuration: () => config, now: () => time });
  const login = async () => {
    const res = response();
    await auth.login(request({ username: config.username, password }), res);
    assert.equal(res.code, 200);
    return res.body.token;
  };
  const first = await login();
  assert.equal(allowed(auth, first).access, true);
  auth.logout(request({}, first), response());
  assert.equal(allowed(auth, first).access, false);
  const second = await login();
  time = 3600000;
  assert.equal(allowed(auth, second).access, false);
  const third = await login();
  config = { ...config, username: "new-admin" };
  assert.equal(allowed(auth, third).access, false);
});

test("limita tentativas de login e recupera depois de cinco minutos", async () => {
  let time = 1;
  const auth = createAdminAuth({ configuration, now: () => time });
  for (let index = 0; index < 10; index++) await auth.login(request({ password: [] }), response());
  const limited = response();
  await auth.login(request({ username: "admin", password }), limited);
  assert.equal(limited.code, 429);
  assert.equal(limited.headers["Retry-After"], "300");
  time += 300000;
  const recovered = response();
  await auth.login(request({ username: "admin", password }), recovered);
  assert.equal(recovered.code, 200);
});
