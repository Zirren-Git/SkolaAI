import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

// Test the release asset itself, copied alone to an otherwise empty folder.
// No installed Node.js, Vite server or adjacent application files are used by it.
const { version } = JSON.parse(await fs.readFile("package.json", "utf8"));
const name = `Parvis-${version}-win-x64.exe`;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "parvis-portable-test-"));
await fs.copyFile(path.resolve("build/desktop", name), path.join(temp, name));
const port = 19243;
const child = spawn(
  path.join(temp, name),
  [`--remote-debugging-port=${port}`],
  { cwd: temp, stdio: "ignore" },
);
let launchError;
child.on("error", (error) => {
  launchError = error;
});
let browser;
try {
  await expect
    .poll(
      async () => {
        if (launchError) throw launchError;
        try {
          return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
        } catch {
          return false;
        }
      },
      { timeout: 90_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts()[0].pages()[0];
  await expect(
    page.getByRole("button", { name: "Beräkna kombinationer" }),
  ).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator(".stat-value").first()).toHaveText("13");
  await page.getByRole("button", { name: "Ta bort par 4" }).click();
  await page.getByRole("button", { name: "Ta bort par 3" }).click();
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.locator(".stat-value").first()).toHaveText("3");
  await page.screenshot({
    path: "test-results/portable-windows.png",
    fullPage: true,
  });
  const session = await browser.newBrowserCDPSession();
  await session.send("Browser.close");
  console.log(
    "Portable EXE passed: launched alone from an empty directory and calculated using its bundled worker.",
  );
} finally {
  if (browser) await browser.close().catch(() => {});
  if (child.exitCode === null) child.kill();
  // The portable wrapper can take a moment to remove its extracted payload.
  await fs.rm(temp, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 500,
  });
}
