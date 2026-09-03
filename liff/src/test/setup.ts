import '@testing-library/jest-dom';
import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';

// Start MSW mock server
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();           // unmount React trees after every test
  vi.clearAllMocks();  // reset call counts + return values
});
afterAll(() => server.close());

// Default window.liff mock — fully reset each test via clearAllMocks
export const mockLiff = {
  init:               vi.fn().mockResolvedValue(undefined),
  isLoggedIn:         vi.fn().mockReturnValue(true),
  login:              vi.fn(),
  getIDToken:         vi.fn().mockReturnValue('mock-id-token'),
  getProfile:         vi.fn().mockResolvedValue({ userId: 'Umock123', displayName: 'Test User', pictureUrl: 'https://example.com/pic.jpg' }),
  getFriendship:      vi.fn().mockResolvedValue({ friendFlag: true }),
  isInClient:         vi.fn().mockReturnValue(true),
  isApiAvailable:     vi.fn().mockReturnValue(true),
  shareTargetPicker:  vi.fn().mockResolvedValue({ status: 'success' }),
  openWindow:         vi.fn(),
};

// Re-apply default implementations before each test (clearAllMocks wipes them)
beforeEach(() => {
  mockLiff.init.mockResolvedValue(undefined);
  mockLiff.isLoggedIn.mockReturnValue(true);
  mockLiff.getIDToken.mockReturnValue('mock-id-token');
  mockLiff.getProfile.mockResolvedValue({ userId: 'Umock123', displayName: 'Test User', pictureUrl: 'https://example.com/pic.jpg' });
  mockLiff.getFriendship.mockResolvedValue({ friendFlag: true });
  mockLiff.isInClient.mockReturnValue(true);
  mockLiff.isApiAvailable.mockReturnValue(true);
  mockLiff.shareTargetPicker.mockResolvedValue({ status: 'success' });
});

Object.defineProperty(window, 'liff', { value: mockLiff, writable: true, configurable: true });
