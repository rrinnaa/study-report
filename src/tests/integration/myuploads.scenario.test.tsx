import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MyUploads from "../../pages/MyUploads";
import { apiService } from "../../services/api";


describe("MyUploads scenarios", () => {
  it("renders loading and then empty state", async () => {
    vi.spyOn(apiService, "getMyUploads").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 6,
    } as never);

    render(
      <MemoryRouter>
        <MyUploads />
      </MemoryRouter>,
    );

    expect(screen.getByText("Загрузка ваших анализов...")).toBeInTheDocument();
    expect(await screen.findByText("У вас пока нет анализов")).toBeInTheDocument();
  });

  it("handles server error and retry", async () => {
    const spy = vi
      .spyOn(apiService, "getMyUploads")
      .mockRejectedValueOnce(new Error("Ошибка сервера"))
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 6,
      } as never);

    render(
      <MemoryRouter>
        <MyUploads />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ошибка сервера")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Попробовать снова"));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });
});
