import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi
    .fn()
    .mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
});
Element.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn();
Object.defineProperty(SVGSVGElement.prototype, "createSVGRect", {
  value: () => ({}),
  configurable: true,
});
