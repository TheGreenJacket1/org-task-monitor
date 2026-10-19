import '@testing-library/jest-dom'

// Mock ResizeObserver for Recharts in tests
;(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
