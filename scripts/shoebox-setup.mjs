#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  ftruncateSync,
  openSync,
  readFileSync,
  writeSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { pathToFileURL } from "node:url";
import {
  KEY_BYTES,
  MIN_SALT_BYTES,
  SCRYPT_OPTIONS,
} from "../src/features/shoebox/password-parameters.mjs";

const KEYS = ["SHOEBOX_PASSWORD_HASH", "SHOEBOX_SESSION_SECRET"];
const EXISTING_KEY =
  /^(?:export\s+)?(SHOEBOX_PASSWORD_HASH|SHOEBOX_SESSION_SECRET)\s*=/;

/**
 * Never accepts a password on argv, stdin pipes or environment variables.
 * @param {string} prompt
 * @param {import("node:stream").Readable & {isTTY?: boolean, isRaw?: boolean, setRawMode?: (raw: boolean) => unknown}} input
 * @param {Pick<NodeJS.WriteStream, "write">} output
 */
export function readHiddenPassword(
  prompt,
  input = process.stdin,
  output = process.stdout,
) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(
      new Error(
        "Usa un terminal interactivo; no se acepta entrada redirigida.",
      ),
    );
  }
  return new Promise((resolvePassword, reject) => {
    let value = "";
    const wasRaw = Boolean(input.isRaw);
    const wasFlowing = input.readableFlowing === true;
    const finish = (error) => {
      input.removeListener("keypress", onKey);
      input.removeListener("end", onEnd);
      input.setRawMode(wasRaw);
      if (!wasFlowing) input.pause();
      output.write("\n");
      if (error) reject(error);
      else resolvePassword(value);
      value = "";
    };
    const onEnd = () => finish(new Error("Entrada cancelada."));
    const onKey = (text, key = {}) => {
      if (
        (key.ctrl && (key.name === "c" || key.name === "d")) ||
        key.name === "escape"
      ) {
        finish(new Error("Entrada cancelada."));
      } else if (key.name === "return" || key.name === "enter") {
        finish();
      } else if (key.name === "backspace") {
        value = Array.from(value).slice(0, -1).join("");
      } else if (
        text &&
        !key.ctrl &&
        !key.meta &&
        Array.from(text).every((character) => {
          const code = character.charCodeAt(0);
          return code >= 32 && code !== 127;
        })
      ) {
        value += text;
        if (Buffer.byteLength(value, "utf8") > 1024) {
          finish(new Error("La contraseña supera los 1.024 bytes."));
        }
      }
    };
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.on("keypress", onKey);
    input.once("end", onEnd);
    output.write(prompt);
    input.resume();
  });
}

/** Called only with owner input or synthetic tests; never logs secret values. */
export async function setupSecrets({
  password,
  confirmation,
  file = ".env.local",
  force = false,
  vercel = false,
}) {
  if (
    !password ||
    password !== confirmation ||
    Buffer.byteLength(password, "utf8") > 1024
  ) {
    throw new Error(
      "Las contraseñas deben coincidir y tener entre 1 y 1.024 bytes.",
    );
  }
  const target = vercel
    ? resolve(dirname(resolve(file)), ".env.shoebox.vercel")
    : resolve(file);
  // No following symlinks, no truncation before validation, owner-only mode.
  let fd;
  try {
    fd = openSync(target, constants.O_RDWR | constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code !== "ENOENT")
      throw new Error("No se pudo abrir el archivo de destino.");
  }
  try {
    if (fd !== undefined && !fstatSync(fd).isFile())
      throw new Error("El destino debe ser un archivo normal.");
    const original = fd === undefined ? "" : readFileSync(fd, "utf8");
    const lines =
      original.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter(Boolean) ?? [];
    if (!force && lines.some((line) => EXISTING_KEY.test(line.trimStart()))) {
      throw new Error(
        "Ya existen claves de la caja. Usa --force solo si quieres rotarlas.",
      );
    }
    const salt = randomBytes(MIN_SALT_BYTES);
    const key = scryptSync(password, salt, KEY_BYTES, SCRYPT_OPTIONS);
    const values = [
      `scrypt-v1$${salt.toString("base64url")}$${key.toString("base64url")}`,
      randomBytes(32).toString("base64url"),
    ];
    const encoded = values.map((value) =>
      vercel ? value : value.replaceAll("$", "\\$"),
    );
    const found = new Set();
    const replaced = lines
      .map((line) => {
        const match = EXISTING_KEY.exec(line.trimStart());
        if (!match) return line;
        const name = match[1];
        found.add(name);
        const ending = line.match(/(\r\n|\n|\r)$/)?.[0] ?? "";
        return `${name}=${encoded[KEYS.indexOf(name)]}${ending}`;
      })
      .join("");
    let contents = replaced;
    for (const [index, name] of KEYS.entries()) {
      if (found.has(name)) continue;
      if (contents && !/[\r\n]$/.test(contents)) contents += "\n";
      contents += `${name}=${encoded[index]}\n`;
    }
    if (fd === undefined)
      fd = openSync(
        target,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600,
      );
    fchmodSync(fd, 0o600);
    // Reading the descriptor advanced its cursor; overwrite from byte zero.
    const bytes = Buffer.from(contents, "utf8");
    let written = 0;
    while (written < bytes.length) {
      written += writeSync(fd, bytes, written, bytes.length - written, written);
    }
    ftruncateSync(fd, bytes.length);
    return { file: target, keys: [...KEYS], vercel };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

async function main() {
  let file = ".env.local";
  let force = false;
  let vercel = false;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--force") force = true;
    else if (args[index] === "--vercel") vercel = true;
    else if (
      args[index] === "--file" &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    )
      file = args[++index];
    else throw new Error("Opciones: --file <ruta>, --force, --vercel.");
  }
  const password = await readHiddenPassword("Contraseña: ");
  const confirmation = await readHiddenPassword("Repite la contraseña: ");
  const result = await setupSecrets({
    password,
    confirmation,
    file,
    force,
    vercel,
  });
  console.log(`Claves escritas: ${result.keys.join(", ")} en ${result.file}`);
  if (vercel)
    console.log(
      "Pega los valores sin barras inversas en Vercel y elimina después este archivo.",
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    // Only our own fixed messages; never print raw filesystem errors or input.
    console.error(
      error instanceof Error && error.message.startsWith("Usa un terminal")
        ? error.message
        : "No se completó la preparación. Comprueba las opciones, la confirmación y las claves existentes.",
    );
    process.exitCode = 1;
  });
}
