import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AuthNavLink from "./auth-nav-link";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

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
