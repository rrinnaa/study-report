import { expect, test } from "@playwright/test";

test.describe("Business flows", () => {
  test("history filters/sort/pagination UI", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "token");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: 1,
          first_name: "User",
          last_name: "One",
          email: "u1@example.com",
          role: "user",
        }),
      );
    });
    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          first_name: "User",
          last_name: "One",
          email: "u1@example.com",
          role: "user",
        }),
      });
    });
    await page.route("**/api/my-uploads*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            { id: 1, filename: "z-report.pdf", score: 70, created_at: "2026-01-02T10:00:00", has_file: true },
            { id: 2, filename: "a-report.pdf", score: 90, created_at: "2026-01-03T10:00:00", has_file: true },
          ],
          total: 2,
          page: 1,
          limit: 6,
        }),
      });
    });
    await page.goto("/reports/history");
    await expect(page.getByText("Мои загрузки")).toBeVisible();
    await page.fill('input[placeholder="🔍 Поиск..."]', "report");
    await page.selectOption("select", "score");
    await expect(page.getByText("Показано:")).toBeVisible();
  });

  test("external API failure fallback hint on home", async ({ page }) => {
    await page.route("**/api/external/study-tip", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "upstream down" }),
      });
    });
    await page.goto("/");
    await expect(page.getByText("Внешний сервис советов временно недоступен.")).toBeVisible();
  });

  test("upload mode and basic file interaction", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "token");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: 7,
          first_name: "Upload",
          last_name: "User",
          email: "upload@example.com",
          role: "user",
        }),
      );
    });
    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 7,
          first_name: "Upload",
          last_name: "User",
          email: "upload@example.com",
          role: "user",
        }),
      });
    });
    await page.goto("/reports/upload");
    await expect(page.getByText("Загрузка отчетов")).toBeVisible();
    await page.click('input[value="screenshots"]');
    await expect(page.getByText("Разрешены только изображения")).toBeVisible();
  });
});
