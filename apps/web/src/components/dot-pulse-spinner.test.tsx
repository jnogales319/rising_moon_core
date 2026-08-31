import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import DotPulseSpinner from "./dot-pulse-spinner";

afterEach(() => {
  cleanup();
});

test("renders three dots as a decorative element", () => {
  const { container } = render(<DotPulseSpinner />);
  const wrapper = container.firstElementChild;

  expect(wrapper).toHaveAttribute("aria-hidden", "true");
  expect(wrapper?.children).toHaveLength(3);
});
