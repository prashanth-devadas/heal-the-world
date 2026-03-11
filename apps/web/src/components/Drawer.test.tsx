import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Drawer } from "./Drawer";

function renderDrawer(overrides: Partial<React.ComponentProps<typeof Drawer>> = {}) {
  const props = {
    open: false,
    onClose: vi.fn(),
    trackingMode: "ongoing" as const,
    onTrackingModeChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<Drawer {...props} />), props };
}

describe("Drawer", () => {
  it("renders with aria-hidden=true when closed", () => {
    renderDrawer({ open: false });
    const drawer = screen.getByText("Tracking Data").closest("div[aria-hidden]");
    expect(drawer?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders with aria-hidden=false when open", () => {
    renderDrawer({ open: true });
    const drawer = screen.getByText("Tracking Data").closest("div[aria-hidden]");
    expect(drawer?.getAttribute("aria-hidden")).toBe("false");
  });

  it('"Ongoing Issues" button click calls onTrackingModeChange("ongoing") and onClose', () => {
    const { props } = renderDrawer({ open: true });
    fireEvent.click(screen.getByText("Ongoing Issues"));
    expect(props.onTrackingModeChange).toHaveBeenCalledWith("ongoing");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('"Issues Anticipated" button click calls onTrackingModeChange("anticipated") and onClose', () => {
    const { props } = renderDrawer({ open: true });
    fireEvent.click(screen.getByText("Issues Anticipated"));
    expect(props.onTrackingModeChange).toHaveBeenCalledWith("anticipated");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("outside click (mousedown outside drawerRef) calls onClose when open", () => {
    const { props } = renderDrawer({ open: true });
    // Fire mousedown on the document body (outside the drawer)
    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("outside click does NOT call onClose when closed", () => {
    const { props } = renderDrawer({ open: false });
    fireEvent.mouseDown(document.body);
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
