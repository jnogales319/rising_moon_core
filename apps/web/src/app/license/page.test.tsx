import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import License from "./page";

afterEach(() => {
  cleanup();
});

test("states the code license", () => {
  render(<License />);
  expect(screen.getByText(/MIT License/)).toBeInTheDocument();
});

test("attributes the Fate SRD content", () => {
  render(<License />);
  expect(
    screen.getByText(
      /Fate SRD.*Creative Commons Attribution 3\.0.*Evil Hat Productions/,
    ),
  ).toBeInTheDocument();
});

test("includes the unofficial fan tool disclaimer", () => {
  render(<License />);
  expect(
    screen.getByText(
      /unofficial fan tool.*[Nn]ot affiliated with or endorsed by Evil Hat/,
    ),
  ).toBeInTheDocument();
});
