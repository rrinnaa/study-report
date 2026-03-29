import { expect, test } from "@playwright/test";

test.describe("Auth/session and route protection", () => {
  test("login and protected navigation flow", async ({ page }) => {
    await page.route("**/api/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          token_type: "bearer",
          user: {
            id: 10,
            first_name: "Ivan",
            last_name: "Petrov",
            email: "ivan@example.com",
            role: "user",
          },
        }),
      });
    });

    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 10,
          first_name: "Ivan",
          last_name: "Petrov",
          email: "ivan@example.com",
          role: "user",
        }),
      });
    });

    await page.route("**/api/external/study-tip", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tip: "test tip", source: "mock", is_fallback: false }),
      });
    });

    await page.goto("/");
    await page.click("text=Вход / Регистрация");
    await expect(page.getByText("Вход и регистрация")).toBeVisible();
    await page.fill('input[placeholder="Почта"]', "ivan@example.com");
    await page.fill('input[placeholder="Пароль"]', "Valid12");
    await page.click("text=Войти");
    await expect(page).toHaveURL(/\/reports\/upload$/);
  });

  test("session restore and forced logout on refresh failure", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "expired-access");
      localStorage.setItem("refresh_token", "expired-refresh");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: 33,
          first_name: "User",
          last_name: "Session",
          email: "s@example.com",
          role: "user",
        }),
      );
    });

    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "token expired" }),
      });
    });

    await page.route("**/api/refresh", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "refresh expired" }),
      });
    });

    await page.route("**/api/external/study-tip", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tip: "tip", source: "mock", is_fallback: false }),
      });
    });

    await page.goto("/reports/upload");
    await expect(page).toHaveURL(/\/auth$/);
  });
});
