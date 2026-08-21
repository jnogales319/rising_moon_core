import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Login from "./page";

const signInWithPassword = vi.fn();
const push = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  signInWithPassword.mockReset();
  push.mockReset();
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
});

test("links to the registration page", () => {
  render(<Login />);
  expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
    "href",
    "/register",
  );
});
