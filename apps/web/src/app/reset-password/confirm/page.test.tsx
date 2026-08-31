import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ResetPasswordConfirm from "./page";

const updateUser = vi.fn();
const signOut = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const markPasswordResetSuccess = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { updateUser, signOut },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/reset-password-notice", () => ({
  markPasswordResetSuccess: () => markPasswordResetSuccess(),
}));

beforeEach(() => {
  updateUser.mockReset();
  signOut.mockReset();
  push.mockReset();
  refresh.mockReset();
  markPasswordResetSuccess.mockReset();
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
});

function fillFields({
  password = "Sup3r$ecret1",
  confirmPassword = "Sup3r$ecret1",
} = {}) {
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirmPassword },
  });
}

function submit() {
  // Matches both labels: the button's accessible name swaps to "Setting
  // new password…" once submitting, and this is re-run across multiple
  // clicks in the double-submit tests below. Still scoped by name so a
  // future second button on the page fails the query instead of this
  // silently clicking the wrong one.
  fireEvent.click(
    screen.getByRole("button", { name: /^Set(ting)? new password/ }),
  );
}

test("renders new password and confirm password fields", () => {
  render(<ResetPasswordConfirm />);
  expect(screen.getByLabelText("New password")).toBeInTheDocument();
  expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Set new password" }),
  ).toBeInTheDocument();
});

test("mismatched password and confirmation shows an inline error without calling updateUser", async () => {
  render(<ResetPasswordConfirm />);
  fillFields({ password: "Sup3r$ecret1", confirmPassword: "Different1$" });
  submit();

  expect(
    await screen.findByText("Passwords do not match."),
  ).toBeInTheDocument();
  expect(updateUser).not.toHaveBeenCalled();
});

test("a successful update calls updateUser, signs out, and redirects to login", async () => {
  updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  render(<ResetPasswordConfirm />);
  fillFields();
  submit();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(updateUser).toHaveBeenCalledWith({ password: "Sup3r$ecret1" });
  expect(signOut).toHaveBeenCalled();
  expect(refresh).toHaveBeenCalled();
  expect(markPasswordResetSuccess).toHaveBeenCalled();
});

test("a signOut rejection does not block the redirect to login", async () => {
  updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  signOut.mockRejectedValue(new Error("network down"));
  render(<ResetPasswordConfirm />);
  fillFields();
  submit();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(refresh).toHaveBeenCalled();
});

test("a resolved error shows GoTrue's own message and does not redirect", async () => {
  updateUser.mockResolvedValue({
    data: { user: null },
    error: { name: "AuthApiError", message: "Auth session missing" },
  });
  render(<ResetPasswordConfirm />);
  fillFields();
  submit();

  expect(await screen.findByText("Auth session missing")).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
  expect(markPasswordResetSuccess).not.toHaveBeenCalled();
});

test("a thrown rejection shows a fallback error message and does not redirect", async () => {
  updateUser.mockRejectedValue(new Error("network down"));
  render(<ResetPasswordConfirm />);
  fillFields();
  submit();

  expect(await screen.findByText("network down")).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

test("clicking submit multiple times while a request is in flight only calls updateUser once", async () => {
  let resolveUpdate: (value: {
    data: { user: object };
    error: null;
  }) => void = () => {};
  updateUser.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
  );
  render(<ResetPasswordConfirm />);
  fillFields();
  submit();
  submit();
  submit();

  expect(updateUser).toHaveBeenCalledTimes(1);

  resolveUpdate({ data: { user: {} }, error: null });
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
});

test("the submit button is disabled while the request is in flight", async () => {
  let resolveUpdate: (value: {
    data: { user: object };
    error: null;
  }) => void = () => {};
  updateUser.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
  );
  render(<ResetPasswordConfirm />);
  fillFields();
  submit();

  expect(
    screen.getByRole("button", { name: "Setting new password…" }),
  ).toBeDisabled();

  resolveUpdate({ data: { user: {} }, error: null });
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
});

test("shows the dot-pulse spinner and swaps the label while the request is in flight", async () => {
  let resolveUpdate: (value: {
    data: { user: object };
    error: null;
  }) => void = () => {};
  updateUser.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
  );
  render(<ResetPasswordConfirm />);
  fillFields();
  submit();

  expect(screen.getByText("Setting new password…")).toBeInTheDocument();
  expect(screen.queryByText("Set new password")).not.toBeInTheDocument();

  resolveUpdate({ data: { user: {} }, error: null });
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
});

test("after an error the button is re-enabled so the user can retry", async () => {
  updateUser.mockResolvedValue({
    data: { user: null },
    error: { name: "AuthApiError", message: "Auth session missing" },
  });
  render(<ResetPasswordConfirm />);
  fillFields();
  submit();

  await screen.findByText("Auth session missing");
  expect(
    screen.getByRole("button", { name: "Set new password" }),
  ).not.toBeDisabled();
});
