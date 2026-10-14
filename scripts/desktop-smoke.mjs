import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { _electron as electron, expect } from "@playwright/test";

// Run against the packaged Windows app in CI (not just a Vite browser preview).
const executablePath = process.env.PARVIS_EXECUTABLE_PATH;
const app = await electron.launch({
  ...(executablePath
    ? { executablePath: path.resolve(executablePath), args: [] }
    : { args: ["."] }),
  timeout: 90_000,
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    page.getByRole("button", { name: "Beräkna kombinationer" }),
  ).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator(".stat-value").first()).toHaveText("13");
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.equal(await page.evaluate(() => typeof window.process), "undefined");
  await page.getByRole("button", { name: "Ta bort par 4" }).click();
  await page.getByRole("button", { name: "Ta bort par 3" }).click();
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.locator(".stat-value").first()).toHaveText("3");
  await page.locator("#size-filter").selectOption("2");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr td").nth(2)).toHaveText("6");
  await expect(page.locator("tbody tr td").nth(3)).toHaveText("8");
  await page.locator("#name-0").fill("CO2");
  await expect(
    page.getByRole("columnheader", { name: "Summa CO2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Så fungerar det" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Byt till ljust läge" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Bypass the native Save dialog in the test, then check the actual downloaded file.
  const output = path.resolve("test-results", "desktop-export.csv");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await app.evaluate(({ session }, output) => {
    session.defaultSession.once("will-download", (_event, item) =>
      item.setSavePath(output),
    );
  }, output);
  await page.getByRole("button", { name: "Exportera CSV" }).click();
  await expect
    .poll(async () => {
      try {
        return await fs.readFile(output, "utf8");
      } catch {
        return "";
      }
    })
    .toContain("Summa CO2");
  await page.screenshot({
    path: "test-results/desktop-windows.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Desktop smoke test passed: packaged UI, module worker, pairs, filtering, names, help, theme, CSV and sandbox.",
  );
} finally {
  await app.close();
}
