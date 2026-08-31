import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Login from "./page";

const signInWithPassword = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const consumePasswordResetSuccess = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/reset-password-notice", () => ({
  consumePasswordResetSuccess: () => consumePasswordResetSuccess(),
}));

beforeEach(() => {
  signInWithPassword.mockReset();
  push.mockReset();
  refresh.mockReset();
  consumePasswordResetSuccess.mockReset();
  consumePasswordResetSuccess.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
});

function fillAndSubmit({
  email = "nightowl@example.com",
  password = "Sup3r$ecret1",
} = {}) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

test("renders email and password fields", () => {
  render(<Login />);
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
});

test("a successful login calls signInWithPassword and redirects to the dashboard", async () => {
  signInWithPassword.mockResolvedValue({
    data: { user: { id: "user-1" }, session: {} },
    error: null,
  });
  render(<Login />);
  fillAndSubmit({ email: "nightowl@example.com", password: "Sup3r$ecret1" });

  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  expect(signInWithPassword).toHaveBeenCalledWith({
    email: "nightowl@example.com",
    password: "Sup3r$ecret1",
  });
  expect(refresh).toHaveBeenCalled();
});

test("a login error shows GoTrue's own message and does not redirect", async () => {
  signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: { name: "AuthApiError", message: "Invalid login credentials" },
  });
  render(<Login />);
  fillAndSubmit();

  expect(
    await screen.findByText("Invalid login credentials"),
  ).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test("links to the registration page", () => {
  render(<Login />);
  expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
    "href",
    "/register",
  );
});

test("links to the reset-password page", () => {
  render(<Login />);
  expect(
    screen.getByRole("link", { name: "Forgot your password?" }),
  ).toHaveAttribute("href", "/reset-password");
});

test("shows a password reset success notice when one was just consumed", async () => {
  consumePasswordResetSuccess.mockReturnValue(true);
  render(<Login />);
  expect(
    await screen.findByText(
      "Your password has been reset. Please log in again.",
    ),
  ).toBeInTheDocument();
});

test("the notice survives React Strict Mode's double effect invocation in dev", async () => {
  // consumePasswordResetSuccess is single-use by design (sessionStorage is
  // cleared on read), so Strict Mode's dev-only double-invoke of effects
  // must not let the second, empty read stomp the first, successful one.
  consumePasswordResetSuccess.mockReturnValueOnce(true).mockReturnValue(false);
  render(
    <StrictMode>
      <Login />
    </StrictMode>,
  );
  expect(
    await screen.findByText(
      "Your password has been reset. Please log in again.",
    ),
  ).toBeInTheDocument();
});

test("does not show the reset success notice on a plain visit", () => {
  render(<Login />);
  expect(
    screen.queryByText("Your password has been reset. Please log in again."),
  ).not.toBeInTheDocument();
});
