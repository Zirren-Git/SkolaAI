import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Beräkna kombinationer" }),
  ).toBeEnabled();
  await expect(page.locator("tbody tr")).toHaveCount(7);
});
test("renames everywhere, sorts, filters, expands, paginates and exports", async ({
  page,
}) => {
  await page.locator("#name-0").fill("CO2");
  await page.locator("#name-1").fill("Pris");
  await expect(
    page.getByRole("columnheader", { name: "Summa CO2" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "CO2:Pris" }),
  ).toBeVisible();
  await page.locator("#sort").selectOption("x");
  await expect(
    page.locator("tbody tr").first().locator("td").nth(2),
  ).toHaveText("2");
  await page.getByRole("button", { name: "Nästa sida" }).click();
  await expect(page.locator(".table-footer > span")).toContainText("8–13");
  await page.locator("#pair-filter").selectOption("0");
  await page.locator("#size-filter").selectOption("1");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Visa detaljer för kombination 1" })
    .click();
  await expect(page.locator(".detail-content")).toContainText("CO2: 2");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportera CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("parvis-kombinationer.csv");
});
test("supports empty results, disabled limits, invalid input, and reset", async ({
  page,
}) => {
  await page.locator("#limit-0").fill("0");
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.getByText("Inga kombinationer hittades")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exportera CSV" }),
  ).toBeDisabled();
  await page.getByRole("switch", { name: "Aktivera maxgräns för x" }).click();
  await expect(page.locator("#limit-0")).toBeDisabled();
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.locator(".stat-value").first()).toHaveText("15");
  await page
    .getByRole("textbox", { name: "x för par 1", exact: true })
    .fill("");
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.getByRole("alert")).toContainText("Par 1, första värdet");
  await page.getByRole("button", { name: "Återställ exempel" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "x för par 1", exact: true }),
  ).toHaveValue("2");
});
test("handles zero ratios and inclusive decimal limits in browser", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Ta bort par 4" }).click();
  await page.getByRole("button", { name: "Ta bort par 3" }).click();
  await page
    .getByRole("textbox", { name: "x för par 1", exact: true })
    .fill("0");
  await page
    .getByRole("textbox", { name: "y för par 1", exact: true })
    .fill("0");
  await page
    .getByRole("textbox", { name: "x för par 2", exact: true })
    .fill("1");
  await page
    .getByRole("textbox", { name: "y för par 2", exact: true })
    .fill("0");
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(
    page.locator("tbody tr").first().locator("td").nth(4),
  ).toHaveText("∞");
  await expect(page.locator("tbody tr").last().locator("td").nth(4)).toHaveText(
    "—",
  );
  await page
    .getByRole("textbox", { name: "x för par 1", exact: true })
    .fill("0.1");
  await page
    .getByRole("textbox", { name: "y för par 1", exact: true })
    .fill("0.1");
  await page
    .getByRole("textbox", { name: "x för par 2", exact: true })
    .fill("0.2");
  await page
    .getByRole("textbox", { name: "y för par 2", exact: true })
    .fill("0.1");
  await page.locator("#limit-0").fill("0.3");
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.locator(".stat-value").first()).toHaveText("3");
});
test("mobile layout, accessible help, theme persistence and screenshots", async ({
  page,
}) => {
  await page.screenshot({
    path: "test-results/desktop-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Så fungerar det" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Byt till ljust läge" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Beräkna kombinationer" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/desktop-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Hitta rätt kombination." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-light.png",
    fullPage: true,
  });
});

test("adds and removes whole pairs without crossing values", async ({
  page,
}) => {
  for (const n of [4, 3, 2])
    await page.getByRole("button", { name: `Ta bort par ${n}` }).click();
  await expect(
    page.getByRole("button", { name: "Ta bort par 1" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Lägg till par" }).click();
  const x = page.getByRole("textbox", { name: "x för par 2", exact: true });
  await expect(x).toBeFocused();
  await x.fill("4");
  await page
    .getByRole("textbox", { name: "y för par 2", exact: true })
    .fill("5");
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.locator(".stat-value").first()).toHaveText("3");
  await page.locator("#size-filter").selectOption("2");
  const row = page.locator("tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row.locator("td").nth(2)).toHaveText("6");
  await expect(row.locator("td").nth(3)).toHaveText("8");
  await page.locator("#name-0").fill("CO2");
  await expect(
    page.getByRole("textbox", { name: "CO2 för par 2", exact: true }),
  ).toHaveValue("4");
  await page.getByRole("button", { name: "Ta bort par 1" }).click();
  await expect(
    page.getByRole("textbox", { name: "CO2 för par 1", exact: true }),
  ).toHaveValue("4");
  await expect(
    page.getByRole("textbox", { name: "y för par 1", exact: true }),
  ).toHaveValue("5");
  await page.getByRole("button", { name: "Beräkna kombinationer" }).click();
  await expect(page.locator(".stat-value").first()).toHaveText("1");
  await expect(page.locator("#pair-filter option")).toHaveCount(2);
});
