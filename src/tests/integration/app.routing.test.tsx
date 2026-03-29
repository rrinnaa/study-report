import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "../../App";
import { apiService } from "../../services/api";


vi.mock("../../components/Header", () => ({
  default: () => <div data-testid="header">Header</div>,
}));

describe("Route protection and role behavior", () => {
  it("redirects unauthenticated user from private route to auth", async () => {
    vi.spyOn(apiService, "isAuthenticated").mockReturnValue(false);
    vi.spyOn(apiService, "getCurrentUser").mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={["/reports/upload"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Вход и регистрация")).toBeInTheDocument();
  });

  it("blocks non-admin from admin route", () => {
    vi.spyOn(apiService, "isAuthenticated").mockReturnValue(true);
    vi.spyOn(apiService, "getCurrentUser").mockReturnValue({ id: 2, role: "user" } as never);

    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Проверка учебных отчетов по структуре")).toBeInTheDocument();
  });
});
