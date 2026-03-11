import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TypeFilterOverlay } from "./TypeFilterOverlay";

function renderOverlay(overrides: Partial<React.ComponentProps<typeof TypeFilterOverlay>> = {}) {
  const props = {
    showConflicts: false,
    showNaturalDisasters: false,
    onToggleConflicts: vi.fn(),
    onToggleNaturalDisasters: vi.fn(),
    ...overrides,
  };
  return { ...render(<TypeFilterOverlay {...props} />), props };
}

describe("TypeFilterOverlay", () => {
  it('renders "Conflicts" and "Natural Disasters" labels', () => {
    renderOverlay();
    expect(screen.getByText("Conflicts")).toBeTruthy();
    expect(screen.getByText("Natural Disasters")).toBeTruthy();
  });

  it("clicking Conflicts row calls onToggleConflicts(true) when currently false", () => {
    const { props } = renderOverlay({ showConflicts: false });
    fireEvent.click(screen.getByText("Conflicts"));
    expect(props.onToggleConflicts).toHaveBeenCalledWith(true);
  });

  it("clicking Conflicts row calls onToggleConflicts(false) when currently true", () => {
    const { props } = renderOverlay({ showConflicts: true });
    fireEvent.click(screen.getByText("Conflicts"));
    expect(props.onToggleConflicts).toHaveBeenCalledWith(false);
  });

  it("clicking Natural Disasters row calls onToggleNaturalDisasters(!current)", () => {
    const { props } = renderOverlay({ showNaturalDisasters: false });
    fireEvent.click(screen.getByText("Natural Disasters"));
    expect(props.onToggleNaturalDisasters).toHaveBeenCalledWith(true);
  });

  it("shows checkmark SVG when Conflicts is checked", () => {
    const { container } = renderOverlay({ showConflicts: true });
    // The SVG path for the checkmark is only rendered when checked
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("does not show checkmark SVG when both are unchecked", () => {
    const { container } = renderOverlay({ showConflicts: false, showNaturalDisasters: false });
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(0);
  });

  it("shows two checkmark SVGs when both are checked", () => {
    const { container } = renderOverlay({ showConflicts: true, showNaturalDisasters: true });
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
  });
});
