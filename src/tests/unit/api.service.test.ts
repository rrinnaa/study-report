import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

describe("apiService auth state helpers", () => {
  it("isAuthenticated returns true when token exists", async () => {
    localStorage.setItem("access_token", "token");
    const mod = await import("../../services/api");
    expect(mod.apiService.isAuthenticated()).toBe(true);
  });

  it("getCurrentUser returns parsed user object", async () => {
    localStorage.setItem("user", JSON.stringify({ id: 1, role: "admin" }));
    const mod = await import("../../services/api");
    expect(mod.apiService.getCurrentUser()).toEqual({ id: 1, role: "admin" });
  });

  it("request dispatches logout event when refresh fails", async () => {
    localStorage.setItem("access_token", "expired");
    localStorage.setItem("refresh_token", "refresh");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "bad refresh" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const mod = await import("../../services/api");

    await expect(mod.apiService.request("/profile")).rejects.toThrow("Требуется повторный вход");
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
