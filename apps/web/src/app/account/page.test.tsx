import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import AccountPage from "./page";

afterEach(() => {
  cleanup();
});

test("renders the account page heading", () => {
  render(<AccountPage />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Account" }),
  ).toBeInTheDocument();
});

test("links to the change-password page", () => {
  render(<AccountPage />);
  expect(
    screen.getByRole("link", { name: "Change your password" }),
  ).toHaveAttribute("href", "/account/password");
});
