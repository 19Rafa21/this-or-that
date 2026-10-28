import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const digest = (value) => createHash("sha256").update(value).digest("hex");

export async function hashAdminPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new Error("Use a password with 12 to 128 characters");
  }
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, options);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export function createAdminAuth({
  configuration = () => ({ username: process.env.ADMIN_USERNAME, hash: process.env.ADMIN_PASSWORD_HASH }),
  now = Date.now,
} = {}) {
  const sessions = new Map();
  // Limite aplicado à conta, independente de cabeçalhos de proxy falsificáveis. Uma conta de administração por instalação.
  const attempts = [];
  const config = () => {
    const value = configuration();
    return value.username && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value.hash || "") ? value : null;
  };
  const noStore = (res) => res.set("Cache-Control", "no-store");
  const cleanup = () => {
    for (const [key, value] of sessions) if (value.expiresAt <= now()) sessions.delete(key);
    while (attempts.length && attempts[0] <= now() - 300000) attempts.shift();
  };
  const tokenKey = (req) => {
    const header = req.get("Authorization") || "";
    return /^Bearer [a-f0-9]{64}$/.test(header) ? digest(header.slice(7)) : null;
  };
  return {
    async login(req, res) {
      noStore(res);
      const settings = config();
      if (!settings) return res.status(503).json({ error: "admin_not_configured" });
      cleanup();
      if (attempts.length >= 10) {
        res.set("Retry-After", String(Math.max(1, Math.ceil((attempts[0] + 300000 - now()) / 1000))));
        return res.status(429).json({ error: "too_many_attempts" });
      }
      attempts.push(now());
      const { username, password } = req.body || {};
      if (typeof username !== "string" || typeof password !== "string" || password.length > 128) {
        return res.status(401).json({ error: "invalid_credentials" });
      }
      const [, salt, expected] = settings.hash.split("$");
      const actual = await scrypt(password, salt, 64, options);
      if (!timingSafeEqual(actual, Buffer.from(expected, "hex")) || username !== settings.username) {
        return res.status(401).json({ error: "invalid_credentials" });
      }
      // Limita a utilização de memória, incluindo durante inícios de sessão legítimos e repetidos.
      if (sessions.size >= 20) sessions.delete(sessions.keys().next().value);
      const token = randomBytes(32).toString("hex");
      const expiresAt = now() + 3600000;
      sessions.set(digest(token), { expiresAt, configId: digest(settings.username + settings.hash) });
      return res.json({ token, expiresAt, username: settings.username });
    },
    authorize(req, res, next) {
      noStore(res);
      cleanup();
      const settings = config();
      if (!settings) return res.status(503).json({ error: "admin_not_configured" });
      const session = sessions.get(tokenKey(req));
      if (!session || session.configId !== digest(settings.username + settings.hash)) {
        return res.status(401).json({ error: "admin_session_expired" });
      }
      next();
    },
    logout(req, res) {
      noStore(res);
      sessions.delete(tokenKey(req));
      res.json({ ok: true });
    },
  };
}
