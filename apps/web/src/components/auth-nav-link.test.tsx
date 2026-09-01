import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { deferred } from "@/test/deferred";
import AuthNavLink from "./auth-nav-link";

const usePathname = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: () => signOut() },
  }),
}));

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  signOut.mockReset();
});

afterEach(() => {
  cleanup();
});

test("a logged-in user sees their display name instead of a link", () => {
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  expect(screen.getByText("nightowl")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("a logged-out visitor on any other page sees a link to /login", () => {
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn={false} displayName={null} />);

  expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("a logged-out visitor already on /login sees no link", () => {
  usePathname.mockReturnValue("/login");
  render(<AuthNavLink loggedIn={false} displayName={null} />);

  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("a logged-in user sees a log out button", () => {
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
});

test("clicking log out signs out, then redirects and refreshes", async () => {
  signOut.mockResolvedValue({ error: null });
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  fireEvent.click(screen.getByRole("button", { name: "Log out" }));

  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(signOut).toHaveBeenCalled();
  expect(refresh).toHaveBeenCalled();
});

test("a rapid double-click only triggers one sign-out", async () => {
  signOut.mockResolvedValue({ error: null });
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  const button = screen.getByRole("button", { name: "Log out" });
  fireEvent.click(button);
  fireEvent.click(button);

  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledTimes(1);
});

test("shows the in-flight indicator and swaps the label while signing out", async () => {
  const call = deferred<{ error: null }>();
  signOut.mockReturnValue(call.promise);
  usePathname.mockReturnValue("/");
  const { container } = render(<AuthNavLink loggedIn displayName="nightowl" />);

  fireEvent.click(screen.getByRole("button", { name: "Log out" }));

  expect(screen.getByRole("button", { name: "Logging out…" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Log out" }),
  ).not.toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();

  call.resolve({ error: null });
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
});

test("a signOut error is logged but does not block navigation", async () => {
  const signOutError = new Error("network down");
  signOut.mockResolvedValue({ error: signOutError });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  fireEvent.click(screen.getByRole("button", { name: "Log out" }));

  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(refresh).toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledWith(
    expect.stringContaining("logout"),
    signOutError,
  );

  consoleError.mockRestore();
});
