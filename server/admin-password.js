import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { hashAdminPassword } from "./admin-auth.js";

// Executar num terminal interativo. A palavra-passe nunca é apresentada no ecrã nem passada como argumento de linha de comandos.
if (!process.stdin.isTTY) {
  console.error("Run npm run admin:password in an interactive terminal.");
  process.exitCode = 1;
} else {
  const hiddenOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const input = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });
  try {
    process.stdout.write("Nova palavra-passe (12 a 128 caracteres): ");
    const password = await input.question("");
    process.stdout.write("\nRepetir palavra-passe: ");
    const confirmation = await input.question("");
    if (password !== confirmation) throw new Error("As palavras-passe não coincidem.");
    const hash = await hashAdminPassword(password);
    process.stdout.write(`\n\nConfigura estas variáveis apenas no servidor:\nADMIN_USERNAME=admin\nADMIN_PASSWORD_HASH='${hash}'\n`);
  } catch (error) {
    process.stderr.write(`\n${error.message}\n`);
    process.exitCode = 1;
  } finally { input.close(); }
}
