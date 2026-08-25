import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import SiteFooter from "./site-footer";

afterEach(() => {
  cleanup();
});

test("shows a copyright notice for the current year", () => {
  render(<SiteFooter />);
  const year = new Date().getFullYear();
  expect(
    screen.getByText(new RegExp(`© ${year} Rising Moon Productions`)),
  ).toBeInTheDocument();
});

test("links to the license page", () => {
  render(<SiteFooter />);
  expect(screen.getByRole("link", { name: "License" })).toHaveAttribute(
    "href",
    "/license",
  );
});
