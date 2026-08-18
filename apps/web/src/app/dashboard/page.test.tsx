import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Dashboard from "./page";

test("renders the dashboard page heading", () => {
  render(<Dashboard />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeInTheDocument();
});
