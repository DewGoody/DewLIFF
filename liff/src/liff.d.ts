// LIFF SDK loaded via script tag
declare const liff: {
  init(config: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  isInClient(): boolean;
  login(config?: { redirectUri?: string }): void;
  getIDToken(): string | null;
  getProfile(): Promise<{ displayName: string; pictureUrl?: string; userId: string }>;
  getFriendship(): Promise<{ friendFlag: boolean }>;
  getOS(): string;
  getLanguage(): string;
  getDecodedIDToken(): { name?: string } | null;
  closeWindow(): void;
  shareTargetPicker(messages: unknown[]): Promise<void>;
  sendMessages(messages: unknown[]): Promise<void>;
};
