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

// Opens the account dropdown by clicking its trigger — the display name
// doubles as the trigger's accessible name.
function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "nightowl" }));
}

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

test("clicking the display name opens the menu with both items", () => {
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  const trigger = screen.getByRole("button", { name: "nightowl" });
  expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();

  fireEvent.click(trigger);

  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("menu")).toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Manage account" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
});

test("falls back to a generic 'Account' label when displayName is null", () => {
  // Reachable when the profile lookup errors/returns no row and there's no
  // email header to fall back to either (see site-header.tsx) — loggedIn
  // can still be true. The trigger and menu need a real accessible name
  // rather than an empty one or a literal "null".
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName={null} />);

  const trigger = screen.getByRole("button", { name: "Account" });
  fireEvent.click(trigger);

  expect(
    screen.getByRole("menu", { name: "Account account menu" }),
  ).toBeInTheDocument();
});

test("'Manage account' links to /account and closes the menu on selection", () => {
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  const manageAccount = screen.getByRole("menuitem", {
    name: "Manage account",
  });
  expect(manageAccount).toHaveAttribute("href", "/account");

  fireEvent.click(manageAccount);

  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

test("a logged-in user sees a log out menu item", () => {
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
});

test("clicking log out signs out, then redirects and refreshes", async () => {
  signOut.mockResolvedValue({ error: null });
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(signOut).toHaveBeenCalled();
  expect(refresh).toHaveBeenCalled();
});

test("a rapid double-click only triggers one sign-out", async () => {
  signOut.mockResolvedValue({ error: null });
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  const item = screen.getByRole("menuitem", { name: "Log out" });
  fireEvent.click(item);
  fireEvent.click(item);

  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledTimes(1);
});

test("shows the in-flight indicator and swaps the label while signing out, without closing the menu", async () => {
  const call = deferred<{ error: null }>();
  signOut.mockReturnValue(call.promise);
  usePathname.mockReturnValue("/");
  const { container } = render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

  expect(screen.getByRole("menuitem", { name: "Logging out…" })).toBeDisabled();
  expect(
    screen.queryByRole("menuitem", { name: "Log out" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("menu")).toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();

  call.resolve({ error: null });
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
});

test("clicking log out moves focus to the trigger before the item disables", async () => {
  // Disabling a focused element force-blurs it to <body>; moving focus to
  // the trigger first keeps it inside the still-open menu instead.
  const call = deferred<{ error: null }>();
  signOut.mockReturnValue(call.promise);
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "nightowl" }),
  );

  call.resolve({ error: null });
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
});

test("Escape does not close the menu while logging out", async () => {
  const call = deferred<{ error: null }>();
  signOut.mockReturnValue(call.promise);
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("menu")).toBeInTheDocument();

  call.resolve({ error: null });
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
});

test("an outside click does not close the menu while logging out", async () => {
  const call = deferred<{ error: null }>();
  signOut.mockReturnValue(call.promise);
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

  fireEvent.mouseDown(document.body);
  expect(screen.getByRole("menu")).toBeInTheDocument();

  call.resolve({ error: null });
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
});

test("the in-flight flag and open menu are cleared after logout, so a later login shows a fresh, closed menu", async () => {
  signOut.mockResolvedValue({ error: null });
  usePathname.mockReturnValue("/");
  // The root layout keeps one instance mounted across navigations, so the
  // same element re-renders as the user logs out and back in.
  const { rerender } = render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));

  rerender(<AuthNavLink loggedIn={false} displayName={null} />);
  rerender(<AuthNavLink loggedIn displayName="nightowl" />);

  // The dropdown must not reopen already-expanded from the logout that
  // just completed.
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();

  openMenu();
  const item = screen.getByRole("menuitem", { name: "Log out" });
  expect(item).toBeEnabled();
  expect(screen.queryByText("Logging out…")).not.toBeInTheDocument();
});

test("no logged-out control flashes between the logout redirect and the refresh", async () => {
  signOut.mockResolvedValue({ error: null });
  usePathname.mockReturnValue("/");
  const { rerender } = render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));

  // push() has landed: pathname is /login, but the server prop has not
  // refreshed yet. The menu must stay in its in-flight state, not fall
  // back to a "Log in" link or an idle "Log out".
  usePathname.mockReturnValue("/login");
  rerender(<AuthNavLink loggedIn displayName="nightowl" />);
  expect(
    screen.getByRole("menuitem", { name: "Logging out…" }),
  ).toBeInTheDocument();

  // refresh() lands: loggedIn flips false against the already-updated
  // pathname, so the control settles straight to nothing.
  rerender(<AuthNavLink loggedIn={false} displayName={null} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Log in" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

test("a signOut error is logged but does not block navigation", async () => {
  const signOutError = new Error("network down");
  signOut.mockResolvedValue({ error: signOutError });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  usePathname.mockReturnValue("/");
  render(<AuthNavLink loggedIn displayName="nightowl" />);

  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  expect(refresh).toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledWith(
    expect.stringContaining("logout"),
    signOutError,
  );

  consoleError.mockRestore();
});
