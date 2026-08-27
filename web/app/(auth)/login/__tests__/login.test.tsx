import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ householdId: "household-123" }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("signs in, bootstraps the household, and redirects to /inventory", async () => {
    const LoginPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret-password",
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/household/bootstrap", { method: "POST" });
    expect(mockPush).toHaveBeenCalledWith("/inventory");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows submitting label while sign-in is in flight", async () => {
    mockSignInWithPassword.mockImplementation(() => new Promise(() => {}));

    const LoginPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();
  });

  it("does not bootstrap or redirect when sign-in fails", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });

    const LoginPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows bootstrap error message from the API response body", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "RPC failed" }),
    });

    const LoginPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("RPC failed");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows a default bootstrap error when the response body is not parseable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    const LoginPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not set up your household. Please try again."
      );
    });
  });

  it("shows a default bootstrap error when the response body has no error field", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "missing error key" }),
    });

    const LoginPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not set up your household. Please try again."
      );
    });
  });

  it("shows a generic error when sign-in throws", async () => {
    mockSignInWithPassword.mockRejectedValue(new Error("network down"));

    const LoginPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    });
  });
});
