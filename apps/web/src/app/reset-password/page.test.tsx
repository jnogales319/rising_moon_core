import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { deferred } from "@/test/deferred";
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

// Name matches both the idle "Send reset link" and the in-flight
// "Sending reset link…" label, so it still finds the button across the
// double-submit tests.
function submitButton() {
  return screen.getByRole("button", { name: /^Send(ing)? reset link/ });
}

function fillEmail(email = "nightowl@example.com") {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
}

function fillAndSubmit(email = "nightowl@example.com") {
  fillEmail(email);
  fireEvent.click(submitButton());
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

test("clicking send multiple times while the request is in flight only calls resetPasswordForEmail once", async () => {
  const call = deferred<{ data: unknown; error: null }>();
  resetPasswordForEmail.mockReturnValue(call.promise);
  render(<ResetPassword />);
  fillEmail();

  fireEvent.click(submitButton());
  fireEvent.click(submitButton());
  fireEvent.click(submitButton());

  expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);

  call.resolve({ data: {}, error: null });
  expect(
    await screen.findByText(
      /check your email for a link to reset your password/i,
    ),
  ).toBeInTheDocument();
});

test("the submit button is disabled while the request is in flight", () => {
  const call = deferred<{ data: unknown; error: null }>();
  resetPasswordForEmail.mockReturnValue(call.promise);
  render(<ResetPassword />);
  fillAndSubmit();

  expect(
    screen.getByRole("button", { name: "Sending reset link…" }),
  ).toBeDisabled();
});

test("shows the in-flight indicator and swaps the label while the request is in flight", () => {
  const call = deferred<{ data: unknown; error: null }>();
  resetPasswordForEmail.mockReturnValue(call.promise);
  const { container } = render(<ResetPassword />);
  fillAndSubmit();

  expect(screen.getByText("Sending reset link…")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Send reset link" }),
  ).not.toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
});

test("after an error the button is re-enabled so the user can retry", async () => {
  resetPasswordForEmail.mockResolvedValue({
    data: null,
    error: { name: "AuthApiError", message: "Something went wrong" },
  });
  render(<ResetPassword />);
  fillAndSubmit();

  await screen.findByText("Something went wrong");
  expect(
    screen.getByRole("button", { name: "Send reset link" }),
  ).not.toBeDisabled();
});

test("links to the login page", () => {
  render(<ResetPassword />);
  expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute(
    "href",
    "/login",
  );
});
