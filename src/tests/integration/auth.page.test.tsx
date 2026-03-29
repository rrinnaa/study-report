import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Auth from "../../pages/Auth";
import { apiService } from "../../services/api";


describe("Auth page scenarios", () => {
  it("shows validation error for invalid register password", async () => {
    render(
      <MemoryRouter>
        <Auth setIsLoggedIn={vi.fn()} />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByText("Регистрация"));
    await userEvent.type(screen.getByPlaceholderText("Имя"), "Иван");
    await userEvent.type(screen.getByPlaceholderText("Фамилия"), "Иванов");
    await userEvent.type(screen.getByPlaceholderText("Почта"), "ivan@example.com");
    await userEvent.type(screen.getByPlaceholderText("Пароль"), "weak");
    await userEvent.click(screen.getByText("Зарегистрироваться"));

    expect(screen.getByText("Пароль должен быть от 6 до 14 символов")).toBeInTheDocument();
  });

  it("shows server error for failed login", async () => {
    vi.spyOn(apiService, "login").mockRejectedValue(new Error("Неверная почта или пароль"));

    render(
      <MemoryRouter>
        <Auth setIsLoggedIn={vi.fn()} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("Почта"), "user@example.com");
    await userEvent.type(screen.getByPlaceholderText("Пароль"), "Wrong12");
    await userEvent.click(screen.getByText("Войти"));

    expect(await screen.findByText("Неверная почта или пароль")).toBeInTheDocument();
  });
});
