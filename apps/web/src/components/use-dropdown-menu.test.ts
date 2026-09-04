import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useDropdownMenu } from "./use-dropdown-menu";

// The hook renders nothing itself — callers wire its refs onto their own
// trigger/container elements. To exercise Escape/outside-click handling we
// attach the refs to real, detached DOM nodes rather than rendering a
// throwaway component, keeping this test focused on the hook's own
// contract (see auth-nav-link.test.tsx for the real consumer wiring).
let container: HTMLDivElement;
let trigger: HTMLButtonElement;

beforeEach(() => {
  container = document.createElement("div");
  trigger = document.createElement("button");
  container.appendChild(trigger);
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

function setup(options?: { preventClose?: boolean }) {
  const { result, rerender, unmount } = renderHook(
    (props?: { preventClose?: boolean }) =>
      useDropdownMenu<HTMLButtonElement, HTMLDivElement>(props),
    { initialProps: options },
  );
  result.current.triggerRef.current = trigger;
  result.current.containerRef.current = container;
  return { result, rerender, unmount };
}

test("starts closed", () => {
  const { result } = setup();
  expect(result.current.open).toBe(false);
});

test("toggle opens, and toggling again closes", () => {
  const { result } = setup();

  act(() => result.current.toggle());
  expect(result.current.open).toBe(true);

  act(() => result.current.toggle());
  expect(result.current.open).toBe(false);
});

test("close() closes an open menu", () => {
  const { result } = setup();

  act(() => result.current.toggle());
  expect(result.current.open).toBe(true);

  act(() => result.current.close());
  expect(result.current.open).toBe(false);
});

test("Escape closes the menu and returns focus to the trigger", () => {
  const { result } = setup();
  act(() => result.current.toggle());
  expect(result.current.open).toBe(true);

  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(result.current.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

test("a mousedown outside the container closes the menu", () => {
  const { result } = setup();
  act(() => result.current.toggle());

  const outside = document.createElement("div");
  document.body.appendChild(outside);

  act(() => {
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(result.current.open).toBe(false);
  document.body.removeChild(outside);
});

test("a mousedown inside the container does not close the menu", () => {
  const { result } = setup();
  act(() => result.current.toggle());

  act(() => {
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(result.current.open).toBe(true);
});

test("a touchstart outside the container closes the menu", () => {
  const { result } = setup();
  act(() => result.current.toggle());

  const outside = document.createElement("div");
  document.body.appendChild(outside);

  act(() => {
    outside.dispatchEvent(new Event("touchstart", { bubbles: true }));
  });

  expect(result.current.open).toBe(false);
  document.body.removeChild(outside);
});

test("focus moving to an element outside the container closes the menu", () => {
  const { result } = setup();
  act(() => result.current.toggle());
  act(() => trigger.focus());

  const outside = document.createElement("button");
  document.body.appendChild(outside);

  act(() => outside.focus());

  expect(result.current.open).toBe(false);
  document.body.removeChild(outside);
});

test("focus moving to an element inside the container does not close the menu", () => {
  const { result } = setup();
  const item = document.createElement("button");
  container.appendChild(item);
  act(() => result.current.toggle());
  act(() => trigger.focus());

  act(() => item.focus());

  expect(result.current.open).toBe(true);
  container.removeChild(item);
});

test("while preventClose is true, Escape does not close the menu", () => {
  const { result } = setup({ preventClose: true });
  act(() => result.current.toggle());

  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(result.current.open).toBe(true);
});

test("while preventClose is true, an outside mousedown does not close the menu", () => {
  const { result } = setup({ preventClose: true });
  act(() => result.current.toggle());

  const outside = document.createElement("div");
  document.body.appendChild(outside);

  act(() => {
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(result.current.open).toBe(true);
  document.body.removeChild(outside);
});

test("while preventClose is true, focus moving outside the container does not close the menu", () => {
  const { result } = setup({ preventClose: true });
  act(() => result.current.toggle());
  act(() => trigger.focus());

  const outside = document.createElement("button");
  document.body.appendChild(outside);

  act(() => outside.focus());

  expect(result.current.open).toBe(true);
  document.body.removeChild(outside);
});

test("close() still closes the menu even while preventClose is true", () => {
  const { result } = setup({ preventClose: true });
  act(() => result.current.toggle());

  act(() => result.current.close());

  expect(result.current.open).toBe(false);
});

test("turning preventClose off re-enables Escape-to-close", () => {
  const { result, rerender } = setup({ preventClose: true });
  act(() => result.current.toggle());

  rerender({ preventClose: false });

  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(result.current.open).toBe(false);
});

test("removes its document listeners once closed", () => {
  const removeSpy = vi.spyOn(document, "removeEventListener");
  const { result } = setup();

  act(() => result.current.toggle()); // open: attaches keydown/mousedown/touchstart
  act(() => result.current.toggle()); // close: should remove all three

  expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
  expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));

  removeSpy.mockRestore();
});

test("removes its document listeners on unmount while open", () => {
  const removeSpy = vi.spyOn(document, "removeEventListener");
  const { result, unmount } = setup();

  act(() => result.current.toggle());
  removeSpy.mockClear();

  unmount();

  expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
  expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));

  removeSpy.mockRestore();
});
