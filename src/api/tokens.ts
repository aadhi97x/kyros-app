/**
 * Token storage.
 *
 * Tokens go in the platform keystore (Keychain on iOS, EncryptedSharedPrefs on
 * Android) rather than AsyncStorage, which is plain text on disk and readable
 * on a rooted device.
 *
 * SecureStore has no web implementation, so the web target falls back to
 * localStorage. That is acceptable only because the web build is a development
 * convenience — a production web client would need httpOnly cookies instead.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'kyros.accessToken';
const REFRESH_KEY = 'kyros.refreshToken';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const isWeb = Platform.OS === 'web';

async function put(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function read(key: string): Promise<string | null> {
  if (isWeb) {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function drop(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/**
 * Cached in memory so that every API call does not hit the keystore, which is
 * a genuinely slow native round trip on Android.
 */
let cached: Tokens | null | undefined;

export async function getTokens(): Promise<Tokens | null> {
  if (cached !== undefined) return cached;

  const [accessToken, refreshToken] = await Promise.all([read(ACCESS_KEY), read(REFRESH_KEY)]);
  cached = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  return cached;
}

export async function setTokens(tokens: Tokens): Promise<void> {
  cached = tokens;
  await Promise.all([put(ACCESS_KEY, tokens.accessToken), put(REFRESH_KEY, tokens.refreshToken)]);
}

export async function clearTokens(): Promise<void> {
  cached = null;
  await Promise.all([drop(ACCESS_KEY), drop(REFRESH_KEY)]);
}

export async function isSignedIn(): Promise<boolean> {
  return (await getTokens()) !== null;
}
