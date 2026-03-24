import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

function capture(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function captureSafe(command, args, options = {}) {
  try {
    return capture(command, args, options);
  } catch {
    return "";
  }
}

const tempRoot = mkdtempSync(join(tmpdir(), "grow-pages-"));
const publishDir = join(tempRoot, "publish");
const viteCliPath = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");

try {
  run(process.execPath, [viteCliPath, "build", "--base=/grow-finance-hub/"]);

  cpSync(join(process.cwd(), "dist"), publishDir, { recursive: true });
  cpSync(join(publishDir, "index.html"), join(publishDir, "404.html"));
  writeFileSync(join(publishDir, ".nojekyll"), "");

  const repoUrl = captureSafe("git", ["config", "--get", "remote.origin.url"]);
  if (!repoUrl) {
    throw new Error("Remote 'origin' nao foi encontrado.");
  }

  run("git", ["init"], { cwd: publishDir });

  const gitName =
    captureSafe("git", ["config", "user.name"]) ||
    captureSafe("git", ["config", "--global", "user.name"]);
  const gitEmail =
    captureSafe("git", ["config", "user.email"]) ||
    captureSafe("git", ["config", "--global", "user.email"]);

  if (gitName) {
    run("git", ["config", "user.name", gitName], { cwd: publishDir });
  }
  if (gitEmail) {
    run("git", ["config", "user.email", gitEmail], { cwd: publishDir });
  }

  run("git", ["checkout", "-b", "gh-pages"], { cwd: publishDir });
  run("git", ["add", "."], { cwd: publishDir });
  run("git", ["commit", "-m", "Deploy GitHub Pages"], { cwd: publishDir });
  run("git", ["remote", "add", "origin", repoUrl], { cwd: publishDir });
  run("git", ["push", "-f", "origin", "gh-pages"], { cwd: publishDir });

  process.stdout.write(
    "\nPublicacao no GitHub Pages concluida com sucesso em 'gh-pages'.\n",
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
