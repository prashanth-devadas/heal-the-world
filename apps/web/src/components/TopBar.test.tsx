import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TopBar } from "./TopBar";

vi.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: () => null,
}));

describe("TopBar", () => {
  it('renders "CrisisVault" title text', () => {
    render(<TopBar onBurgerClick={vi.fn()} />);
    expect(screen.getByText(/CrisisVault/)).toBeTruthy();
  });

  it("clicking the burger button calls onBurgerClick", () => {
    const onBurgerClick = vi.fn();
    render(<TopBar onBurgerClick={onBurgerClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Open menu/i }));
    expect(onBurgerClick).toHaveBeenCalledTimes(1);
  });

  it('burger button has aria-label="Open menu"', () => {
    render(<TopBar onBurgerClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Open menu/i });
    expect(btn.getAttribute("aria-label")).toBe("Open menu");
  });
});
