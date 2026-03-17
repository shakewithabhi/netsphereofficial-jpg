import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver for antd Table/rc-component
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

// Mock window.matchMedia for antd components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock window.getComputedStyle for antd Table (jsdom doesn't implement it for pseudo-elements)
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  if (pseudoElt) {
    return {
      getPropertyValue: () => '',
      width: '0px',
      height: '0px',
      overflow: 'hidden',
    } as unknown as CSSStyleDeclaration;
  }
  return originalGetComputedStyle(elt);
};
