import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ResetPassword from "./page";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail },
  }),
}));

beforeEach(() => {
  resetPasswordForEmail.mockReset();
});

afterEach(() => {
  cleanup();
});

function fillAndSubmit(email = "nightowl@example.com") {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
}

test("renders an email field", () => {
  render(<ResetPassword />);
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Send reset link" }),
  ).toBeInTheDocument();
});

test("a successful request calls resetPasswordForEmail and replaces the form with a confirmation message", async () => {
  resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  render(<ResetPassword />);
  fillAndSubmit("nightowl@example.com");

  expect(
    await screen.findByText(
      /check your email for a link to reset your password/i,
    ),
  ).toBeInTheDocument();
  expect(resetPasswordForEmail).toHaveBeenCalledWith("nightowl@example.com");
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
});

test("a resolved error shows the error message and no confirmation message", async () => {
  resetPasswordForEmail.mockResolvedValue({
    data: null,
    error: { name: "AuthApiError", message: "Something went wrong" },
  });
  render(<ResetPassword />);
  fillAndSubmit();

  expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  expect(
    screen.queryByText(/check your email for a link to reset your password/i),
  ).not.toBeInTheDocument();
});

test("a thrown rejection shows a fallback error message", async () => {
  resetPasswordForEmail.mockRejectedValue(new Error("network down"));
  render(<ResetPassword />);
  fillAndSubmit();

  expect(await screen.findByText("network down")).toBeInTheDocument();
});

test("links to the login page", () => {
  render(<ResetPassword />);
  expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute(
    "href",
    "/login",
  );
});
