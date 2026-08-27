import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignUp = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignUp.mockResolvedValue({ error: null });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ householdId: "household-123" }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("registers the user, bootstraps the household, and redirects to /inventory", async () => {
    const SignupPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "secret-password",
      });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/household/bootstrap", {
        method: "POST",
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/inventory");
    });

    expect(mockRefresh).toHaveBeenCalled();
  });

  it("does not bootstrap or redirect when registration fails", async () => {
    mockSignUp.mockResolvedValue({ error: { message: "Email already registered" } });

    const SignupPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), "taken@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Email already registered");
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows submitting label while sign-up is in flight", async () => {
    mockSignUp.mockImplementation(() => new Promise(() => {}));

    const SignupPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(screen.getByRole("button", { name: /signing up/i })).toBeDisabled();
  });

  it("shows bootstrap error message from the API response body", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "RPC failed" }),
    });

    const SignupPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

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

    const SignupPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

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

    const SignupPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not set up your household. Please try again."
      );
    });
  });

  it("shows a generic error when sign-up throws", async () => {
    mockSignUp.mockRejectedValue(new Error("network down"));

    const SignupPage = (await import("../page")).default;
    const user = userEvent.setup();

    render(<SignupPage />);

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret-password");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    });
  });
});
