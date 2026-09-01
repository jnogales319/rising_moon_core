import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { deferred } from "@/test/deferred";
import Register from "./page";

const DEBOUNCE_MS = 500;

const signUp = vi.fn();
const checkDisplayNameAvailable = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signUp },
    rpc: checkDisplayNameAvailable,
  }),
}));

beforeEach(() => {
  // shouldAdvanceTime keeps the fake clock ticking in real time so
  // Testing Library's setTimeout-based polling (waitFor/findByText) still
  // resolves in tests that never explicitly advance timers; tests that
  // assert on the debounce still drive it deterministically via
  // vi.advanceTimersByTimeAsync.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  signUp.mockReset();
  checkDisplayNameAvailable.mockReset();
  checkDisplayNameAvailable.mockResolvedValue({ data: true, error: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function fillFields({
  displayName = "nightowl",
  email = "nightowl@example.com",
  password = "Sup3r$ecret1",
  confirmPassword = "Sup3r$ecret1",
} = {}) {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: displayName },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirmPassword },
  });
}

// Name matches both the idle "Create account" and the in-flight
// "Creating account…" label, so it still finds the button across the
// double-submit tests.
function submitButton() {
  return screen.getByRole("button", { name: /^Creat(e|ing) account/ });
}

function submit() {
  fireEvent.click(submitButton());
}

test("renders display name, email, password, and confirm password fields", () => {
  render(<Register />);
  expect(screen.getByLabelText("Display name")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Create account" }),
  ).toBeInTheDocument();
});

test("mismatched password and confirm password shows an inline error without calling the backend", async () => {
  render(<Register />);
  fillFields({ password: "Sup3r$ecret1", confirmPassword: "Different1$" });
  submit();

  expect(
    await screen.findByText("Passwords do not match."),
  ).toBeInTheDocument();
  // Timers are never advanced past the debounce in this test, so the live
  // check never fires either.
  expect(checkDisplayNameAvailable).not.toHaveBeenCalled();
  expect(signUp).not.toHaveBeenCalled();
});

test("an unavailable display name shows an inline error without calling signUp", async () => {
  checkDisplayNameAvailable.mockResolvedValue({ data: false, error: null });
  render(<Register />);
  fillFields();
  submit();

  expect(
    await screen.findByText("That display name is taken."),
  ).toBeInTheDocument();
  expect(checkDisplayNameAvailable).toHaveBeenCalledWith(
    "is_display_name_available",
    { name: "nightowl" },
  );
  expect(signUp).not.toHaveBeenCalled();
});

test("an availability-check error during submit shows the error and does not call signUp", async () => {
  checkDisplayNameAvailable.mockResolvedValue({
    data: null,
    error: { message: "Network error" },
  });
  render(<Register />);
  fillFields();
  submit();

  expect(await screen.findByText("Network error")).toBeInTheDocument();
  expect(
    screen.queryByText("That display name is taken."),
  ).not.toBeInTheDocument();
  expect(signUp).not.toHaveBeenCalled();
});

test("an available display name calls signUp with email, password, and display_name", async () => {
  signUp.mockResolvedValue({
    data: { user: { id: "user-1" }, session: null },
    error: null,
  });
  render(<Register />);
  fillFields({
    displayName: "nightowl",
    email: "nightowl@example.com",
    password: "Sup3r$ecret1",
    confirmPassword: "Sup3r$ecret1",
  });
  submit();

  await waitFor(() => expect(signUp).toHaveBeenCalled());
  expect(signUp).toHaveBeenCalledWith({
    email: "nightowl@example.com",
    password: "Sup3r$ecret1",
    options: { data: { display_name: "nightowl" } },
  });
});

test("a successful signUp replaces the form with a confirmation message", async () => {
  signUp.mockResolvedValue({
    data: { user: { id: "user-1" }, session: null },
    error: null,
  });
  render(<Register />);
  fillFields();
  submit();

  expect(
    await screen.findByText(/check your email to confirm your account/i),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
});

test("a signUp error renders the error message and no confirmation message", async () => {
  signUp.mockResolvedValue({
    data: { user: null, session: null },
    error: { name: "AuthApiError", message: "User already registered" },
  });
  render(<Register />);
  fillFields();
  submit();

  expect(
    await screen.findByText("User already registered"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/check your email to confirm your account/i),
  ).not.toBeInTheDocument();
});

test("rapid changes to the display name are debounced into a single check for the final value", async () => {
  render(<Register />);
  const displayNameInput = screen.getByLabelText("Display name");
  fireEvent.change(displayNameInput, { target: { value: "night" } });
  fireEvent.change(displayNameInput, { target: { value: "nighto" } });
  fireEvent.change(displayNameInput, { target: { value: "nightowl" } });

  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

  expect(checkDisplayNameAvailable).toHaveBeenCalledTimes(1);
  expect(checkDisplayNameAvailable).toHaveBeenCalledWith(
    "is_display_name_available",
    { name: "nightowl" },
  );
});

test("shows a live status while the debounced check is in flight, then the taken message, with the button staying enabled", async () => {
  const check = deferred<{ data: boolean; error: null }>();
  checkDisplayNameAvailable.mockReturnValue(check.promise);
  render(<Register />);

  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "nightowl" },
  });
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

  expect(await screen.findByText("Checking availability…")).toBeInTheDocument();

  check.resolve({ data: false, error: null });

  const status = await screen.findByText("That display name is taken.");
  expect(status).toBeInTheDocument();
  const displayNameInput = screen.getByLabelText("Display name");
  expect(displayNameInput).toHaveAttribute("aria-invalid", "true");
  expect(displayNameInput).toHaveAttribute("aria-describedby", status.id);
  expect(
    screen.getByRole("button", { name: "Create account" }),
  ).not.toBeDisabled();
});

test("an availability-check error during the live debounced check clears the status instead of showing taken", async () => {
  checkDisplayNameAvailable.mockResolvedValue({
    data: null,
    error: { message: "Network error" },
  });
  render(<Register />);
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "nightowl" },
  });
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

  expect(
    screen.queryByText("That display name is taken."),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Checking availability…")).not.toBeInTheDocument();
});

test("an availability-check rejection during the live debounced check clears the status instead of hanging on checking", async () => {
  checkDisplayNameAvailable.mockRejectedValue(new Error("network down"));
  render(<Register />);
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "nightowl" },
  });
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

  expect(screen.queryByText("Checking availability…")).not.toBeInTheDocument();
});

test("clicking create account multiple times while submit is in flight only runs the sign-up sequence once", async () => {
  const check = deferred<{ data: boolean; error: null }>();
  checkDisplayNameAvailable.mockReturnValue(check.promise);
  signUp.mockResolvedValue({
    data: { user: { id: "user-1" }, session: null },
    error: null,
  });
  render(<Register />);
  fillFields();

  submit();
  submit();
  submit();

  // The submit's authoritative availability re-check is inside the same
  // in-flight window, so it fires once despite three clicks. (Asserted
  // before any await, so the debounced live check hasn't elapsed yet.)
  expect(checkDisplayNameAvailable).toHaveBeenCalledTimes(1);
  expect(signUp).not.toHaveBeenCalled();

  check.resolve({ data: true, error: null });

  expect(
    await screen.findByText(/check your email to confirm your account/i),
  ).toBeInTheDocument();
  expect(signUp).toHaveBeenCalledTimes(1);
});

test("the create account button is disabled while submit is in flight", async () => {
  const check = deferred<{ data: boolean; error: null }>();
  checkDisplayNameAvailable.mockReturnValue(check.promise);
  signUp.mockResolvedValue({
    data: { user: { id: "user-1" }, session: null },
    error: null,
  });
  render(<Register />);
  fillFields();
  submit();

  expect(
    screen.getByRole("button", { name: "Creating account…" }),
  ).toBeDisabled();

  check.resolve({ data: true, error: null });
  await screen.findByText(/check your email to confirm your account/i);
});

test("shows the in-flight indicator and swaps the label while submit is in flight", async () => {
  const check = deferred<{ data: boolean; error: null }>();
  checkDisplayNameAvailable.mockReturnValue(check.promise);
  signUp.mockResolvedValue({
    data: { user: { id: "user-1" }, session: null },
    error: null,
  });
  const { container } = render(<Register />);
  fillFields();
  submit();

  expect(screen.getByText("Creating account…")).toBeInTheDocument();
  // scoped to the button — "Create account" is also the page heading
  expect(
    screen.queryByRole("button", { name: "Create account" }),
  ).not.toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();

  check.resolve({ data: true, error: null });
  await screen.findByText(/check your email to confirm your account/i);
});

test("after a signUp error the button is re-enabled so the user can retry", async () => {
  signUp.mockResolvedValue({
    data: { user: null, session: null },
    error: { name: "AuthApiError", message: "User already registered" },
  });
  render(<Register />);
  fillFields();
  submit();

  await screen.findByText("User already registered");
  expect(
    screen.getByRole("button", { name: "Create account" }),
  ).not.toBeDisabled();
});

test("after an availability-check error during submit the button is re-enabled", async () => {
  checkDisplayNameAvailable.mockResolvedValue({
    data: null,
    error: { message: "Network error" },
  });
  render(<Register />);
  fillFields();
  submit();

  await screen.findByText("Network error");
  expect(
    screen.getByRole("button", { name: "Create account" }),
  ).not.toBeDisabled();
});

test("a password mismatch does not put the button into the in-flight state", async () => {
  render(<Register />);
  fillFields({ password: "Sup3r$ecret1", confirmPassword: "Different1$" });
  submit();

  await screen.findByText("Passwords do not match.");
  const button = screen.getByRole("button", { name: "Create account" });
  expect(button).not.toBeDisabled();
  expect(screen.queryByText("Creating account…")).not.toBeInTheDocument();
});

test("links to the login page", () => {
  render(<Register />);
  expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("an out-of-order (stale) response does not overwrite the status for the latest value", async () => {
  const first = deferred<{ data: boolean; error: null }>();
  const second = deferred<{ data: boolean; error: null }>();
  checkDisplayNameAvailable
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  render(<Register />);
  const displayNameInput = screen.getByLabelText("Display name");

  fireEvent.change(displayNameInput, { target: { value: "night" } });
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  fireEvent.change(displayNameInput, { target: { value: "nightowl" } });
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

  expect(checkDisplayNameAvailable).toHaveBeenCalledTimes(2);

  // The newer check (for "nightowl") resolves first and says available.
  second.resolve({ data: true, error: null });
  await waitFor(() =>
    expect(
      screen.queryByText("That display name is taken."),
    ).not.toBeInTheDocument(),
  );

  // The stale check (for "night") resolves after, saying taken — must be ignored.
  first.resolve({ data: false, error: null });
  await vi.advanceTimersByTimeAsync(0);
  expect(
    screen.queryByText("That display name is taken."),
  ).not.toBeInTheDocument();
});
