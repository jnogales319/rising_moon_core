import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ChangePasswordForm from "./change-password-form";

const signInWithPassword = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword, updateUser, signOut },
  }),
}));

const EMAIL = "player@example.com";
const CURRENT = "Sup3r$ecret1";
const NEXT = "Br4nd$New2";

beforeEach(() => {
  signInWithPassword.mockReset();
  updateUser.mockReset();
  signOut.mockReset();
  // The happy default: the current-password re-check passes and the
  // update succeeds. Individual tests override whichever step they're
  // exercising.
  signInWithPassword.mockResolvedValue({ data: { user: {} }, error: null });
  updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
});

function fillFields({ current = CURRENT, next = NEXT, confirm = NEXT } = {}) {
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText("New password", { exact: true }), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirm },
  });
}

function submit() {
  // The accessible name swaps to "Updating password…" once submitting, and
  // this is re-run across clicks in the double-submit tests. Scoped by name
  // so a future second button on the page fails the query loudly rather
  // than this silently clicking the wrong one.
  fireEvent.click(
    screen.getByRole("button", { name: /^Updat(e|ing) password/ }),
  );
}

test("renders current, new, and confirm password fields plus a submit button", () => {
  render(<ChangePasswordForm email={EMAIL} />);

  expect(screen.getByLabelText("Current password")).toBeInTheDocument();
  expect(
    screen.getByLabelText("New password", { exact: true }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Update password" }),
  ).toBeInTheDocument();
});

test("all three inputs mask their value", () => {
  render(<ChangePasswordForm email={EMAIL} />);

  expect(screen.getByLabelText("Current password")).toHaveAttribute(
    "type",
    "password",
  );
  expect(
    screen.getByLabelText("New password", { exact: true }),
  ).toHaveAttribute("type", "password");
  expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
    "type",
    "password",
  );
});

test("a new/confirm mismatch shows an inline error and calls neither Supabase method", async () => {
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields({ next: NEXT, confirm: "SomethingElse3$" });
  submit();

  expect(
    await screen.findByText("Passwords do not match."),
  ).toBeInTheDocument();
  expect(signInWithPassword).not.toHaveBeenCalled();
  expect(updateUser).not.toHaveBeenCalled();
});

test("an incorrect current password stops before updateUser and shows an error", async () => {
  signInWithPassword.mockResolvedValue({
    data: { user: null },
    error: { name: "AuthApiError", message: "Invalid login credentials" },
  });
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(
    await screen.findByText("Current password is incorrect."),
  ).toBeInTheDocument();
  expect(signInWithPassword).toHaveBeenCalledWith({
    email: EMAIL,
    password: CURRENT,
  });
  expect(updateUser).not.toHaveBeenCalled();
  expect(screen.queryByText("Your password has been updated.")).toBeNull();
});

test("a non-credential re-verification error surfaces verbatim, not as 'incorrect'", async () => {
  signInWithPassword.mockResolvedValue({
    data: { user: null },
    error: {
      name: "AuthApiError",
      code: "over_request_rate_limit",
      message: "Request rate limit reached",
    },
  });
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(
    await screen.findByText("Request rate limit reached"),
  ).toBeInTheDocument();
  expect(screen.queryByText("Current password is incorrect.")).toBeNull();
  expect(updateUser).not.toHaveBeenCalled();
});

test("a successful change re-verifies the current password, updates it, then confirms and clears the form", async () => {
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(
    await screen.findByText("Your password has been updated."),
  ).toBeInTheDocument();
  expect(signInWithPassword).toHaveBeenCalledWith({
    email: EMAIL,
    password: CURRENT,
  });
  expect(updateUser).toHaveBeenCalledWith({ password: NEXT });
  expect(screen.getByLabelText("Current password")).toHaveValue("");
  expect(screen.getByLabelText("New password", { exact: true })).toHaveValue(
    "",
  );
  expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
});

test("a successful change revokes other sessions but keeps this one", async () => {
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  await screen.findByText("Your password has been updated.");
  expect(signOut).toHaveBeenCalledWith({ scope: "others" });
});

test("a failed other-sessions sign-out does not block the success confirmation", async () => {
  signOut.mockRejectedValue(new Error("network down"));
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(
    await screen.findByText("Your password has been updated."),
  ).toBeInTheDocument();
});

test("other sessions are only revoked after the password update succeeds", async () => {
  updateUser.mockResolvedValue({
    data: { user: null },
    error: { name: "AuthApiError", message: "Password is too weak" },
  });
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  await screen.findByText("Password is too weak");
  expect(signOut).not.toHaveBeenCalled();
});

test("the success confirmation is announced to assistive tech", async () => {
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("Your password has been updated.");
});

test("a rejected updateUser surfaces GoTrue's own message and shows no success", async () => {
  updateUser.mockResolvedValue({
    data: { user: null },
    error: {
      name: "AuthApiError",
      message: "New password should be different from the old password.",
    },
  });
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(
    await screen.findByText(
      "New password should be different from the old password.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("Your password has been updated.")).toBeNull();
});

test("a thrown updateUser rejection shows a fallback message", async () => {
  updateUser.mockRejectedValue(new Error("network down"));
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(await screen.findByText("network down")).toBeInTheDocument();
  expect(screen.queryByText("Your password has been updated.")).toBeNull();
});

test("a thrown re-verification rejection shows a fallback message and never reaches updateUser", async () => {
  signInWithPassword.mockRejectedValue(new Error("network down"));
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(await screen.findByText("network down")).toBeInTheDocument();
  expect(updateUser).not.toHaveBeenCalled();
});

test("clicking submit repeatedly while a request is in flight re-verifies only once", async () => {
  let resolveReverify: (value: {
    data: { user: object };
    error: null;
  }) => void = () => {};
  signInWithPassword.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveReverify = resolve;
      }),
  );
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();
  submit();
  submit();

  expect(signInWithPassword).toHaveBeenCalledTimes(1);

  resolveReverify({ data: { user: {} }, error: null });
  await waitFor(() =>
    expect(
      screen.getByText("Your password has been updated."),
    ).toBeInTheDocument(),
  );
});

test("the submit button is disabled while the request is in flight", async () => {
  let resolveReverify: (value: {
    data: { user: object };
    error: null;
  }) => void = () => {};
  signInWithPassword.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveReverify = resolve;
      }),
  );
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(
    screen.getByRole("button", { name: "Updating password…" }),
  ).toBeDisabled();

  resolveReverify({ data: { user: {} }, error: null });
  await waitFor(() =>
    expect(
      screen.getByText("Your password has been updated."),
    ).toBeInTheDocument(),
  );
});

test("shows the in-flight spinner and swaps the button label while the request is in flight", async () => {
  let resolveReverify: (value: {
    data: { user: object };
    error: null;
  }) => void = () => {};
  signInWithPassword.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveReverify = resolve;
      }),
  );
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  expect(screen.getByText("Updating password…")).toBeInTheDocument();
  expect(screen.queryByText("Update password")).not.toBeInTheDocument();

  resolveReverify({ data: { user: {} }, error: null });
  await waitFor(() =>
    expect(
      screen.getByText("Your password has been updated."),
    ).toBeInTheDocument(),
  );
});

test("after an error the button is re-enabled so the user can retry", async () => {
  updateUser.mockResolvedValue({
    data: { user: null },
    error: { name: "AuthApiError", message: "Password is too weak" },
  });
  render(<ChangePasswordForm email={EMAIL} />);
  fillFields();
  submit();

  await screen.findByText("Password is too weak");
  expect(
    screen.getByRole("button", { name: "Update password" }),
  ).not.toBeDisabled();
});
