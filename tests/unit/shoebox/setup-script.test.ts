import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/features/shoebox/server/password";

const script = resolve("scripts/shoebox-setup.mjs");
const scratch = () => mkdtempSync(join(tmpdir(), "shoebox-setup-test-"));
const password = "contraseña sintética $ con espacios";

describe("owner setup helper", () => {
  it("refuses non-TTY input without accepting or printing a password", () => {
    const run = spawnSync(process.execPath, [script], {
      input: password,
      encoding: "utf8",
      cwd: scratch(),
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("terminal interactivo");
    expect(run.stderr + run.stdout).not.toContain(password);
  });

  it("writes a verifier accepted by the server and an independent 32-byte secret", async () => {
    const { setupSecrets } = await import("../../../scripts/shoebox-setup.mjs");
    const file = join(scratch(), "settings.txt");
    const original = "# leave this alone\r\nOTHER_VALUE=original\r\n";
    writeFileSync(file, original);
    const summary = await setupSecrets({
      password,
      confirmation: password,
      file,
    });
    const contents = readFileSync(file, "utf8");
    expect(contents.startsWith(original)).toBe(true);
    const hash = contents
      .match(/^SHOEBOX_PASSWORD_HASH=(.+)$/m)?.[1]
      .replaceAll("\\$", "$");
    if (!hash) throw new Error("missing synthetic verifier");
    expect(await verifyPassword(password, hash)).toBe(true);
    const secret = contents.match(/^SHOEBOX_SESSION_SECRET=([\w-]+)$/m)?.[1];
    if (!secret) throw new Error("missing synthetic secret");
    expect(Buffer.from(secret, "base64url")).toHaveLength(32);
    expect(contents).toContain("scrypt-v1\\$");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(summary)).not.toContain(hash);
    expect(JSON.stringify(summary)).not.toContain(secret);
    expect(contents).not.toContain(password);
  });

  it.each([
    ["", ""],
    ["one", "two"],
    ["é".repeat(513), "é".repeat(513)],
  ])(
    "rejects empty, mismatched or oversized passwords without writing",
    async (password, confirmation) => {
      const { setupSecrets } = await import(
        "../../../scripts/shoebox-setup.mjs"
      );
      const file = join(scratch(), "settings.txt");
      writeFileSync(file, "ORIGINAL=yes\n");
      await expect(
        setupSecrets({ password, confirmation, file }),
      ).rejects.toThrow();
      expect(readFileSync(file, "utf8")).toBe("ORIGINAL=yes\n");
    },
  );

  it("refuses existing keys unless forced, preserving every unrelated line", async () => {
    const { setupSecrets } = await import("../../../scripts/shoebox-setup.mjs");
    const file = join(scratch(), "settings.txt");
    const original =
      "# header\nexport SHOEBOX_PASSWORD_HASH = old\nKEEP=exact\nSHOEBOX_SESSION_SECRET=old\n";
    writeFileSync(file, original);
    await expect(
      setupSecrets({ password, confirmation: password, file }),
    ).rejects.toThrow();
    expect(readFileSync(file, "utf8")).toBe(original);
    await setupSecrets({ password, confirmation: password, file, force: true });
    const contents = readFileSync(file, "utf8");
    expect(contents).toContain("# header\n");
    expect(contents).toContain("KEEP=exact\n");
    expect(contents).not.toContain("=old");
    expect(contents).not.toContain("= old");
  });

  it("writes unescaped Vercel values only into its separate output file", async () => {
    const { setupSecrets } = await import("../../../scripts/shoebox-setup.mjs");
    const file = join(scratch(), "settings.txt");
    writeFileSync(file, "KEEP=yes\n");
    const summary = await setupSecrets({
      password,
      confirmation: password,
      file,
      vercel: true,
    });
    expect(summary.file).toBe(join(resolve(file, ".."), ".env.shoebox.vercel"));
    const contents = readFileSync(summary.file, "utf8");
    expect(contents).toContain("scrypt-v1$");
    expect(contents).not.toContain("\\$");
    expect(readFileSync(file, "utf8")).toBe("KEEP=yes\n");
  });

  it("never echoes hidden input and restores terminal mode on completion", async () => {
    const { readHiddenPassword } = await import(
      "../../../scripts/shoebox-setup.mjs"
    );
    const input = new PassThrough() as PassThrough & {
      isTTY: boolean;
      isRaw: boolean;
      setRawMode: (raw: boolean) => void;
    };
    input.isTTY = true;
    input.isRaw = false;
    const modes: boolean[] = [];
    input.setRawMode = (raw) => {
      input.isRaw = raw;
      modes.push(raw);
    };
    const output = new PassThrough();
    let printed = "";
    output.on("data", (data) => {
      printed += data.toString();
    });
    const result = readHiddenPassword("Contraseña: ", input, output);
    input.write("sintética\u007fX\r");
    await expect(result).resolves.toBe("sintéticX");
    expect(printed).toBe("Contraseña: \n");
    expect(modes).toEqual([true, false]);
    // A fresh terminal starts with readableFlowing=null, not isPaused=true.
    // Leaving it resumed keeps the CLI alive after writing the secrets.
    expect(input.isPaused()).toBe(true);
  });
});
