import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PendingButton from "./pending-button";

afterEach(() => {
  cleanup();
});

test("renders the idle label with no spinner when not pending", () => {
  const { container } = render(
    <PendingButton
      type="submit"
      pending={false}
      idleLabel="Log in"
      pendingLabel="Logging in…"
    />,
  );

  const button = screen.getByRole("button", { name: "Log in" });
  expect(button).toBeEnabled();
  expect(screen.queryByText("Logging in…")).not.toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
});

test("swaps to the pending label, shows the decorative spinner, and disables while pending", () => {
  const { container } = render(
    <PendingButton
      type="submit"
      pending
      idleLabel="Log in"
      pendingLabel="Logging in…"
    />,
  );

  expect(screen.getByRole("button", { name: "Logging in…" })).toBeDisabled();
  expect(screen.queryByText("Log in")).not.toBeInTheDocument();

  const spinner = container.querySelector('[aria-hidden="true"]');
  expect(spinner).not.toBeNull();
  expect(spinner?.children).toHaveLength(3);
});

test("forwards type, className, and other button props", () => {
  render(
    <PendingButton
      type="button"
      className="custom-class"
      data-testid="pb"
      pending={false}
      idleLabel="Go"
      pendingLabel="Going…"
    />,
  );

  const button = screen.getByTestId("pb");
  expect(button).toHaveAttribute("type", "button");
  expect(button).toHaveClass("custom-class");
});

test("fires onClick when not pending", () => {
  const onClick = vi.fn();
  render(
    <PendingButton
      type="button"
      onClick={onClick}
      pending={false}
      idleLabel="Go"
      pendingLabel="Going…"
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Go" }));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("does not fire onClick while pending (button is disabled)", () => {
  const onClick = vi.fn();
  render(
    <PendingButton
      type="button"
      onClick={onClick}
      pending
      idleLabel="Go"
      pendingLabel="Going…"
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Going…" }));
  expect(onClick).not.toHaveBeenCalled();
});

test("honours an explicit disabled prop even when not pending", () => {
  render(
    <PendingButton
      type="submit"
      disabled
      pending={false}
      idleLabel="Go"
      pendingLabel="Going…"
    />,
  );

  expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
});
