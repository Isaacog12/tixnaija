import * as Linking from 'expo-linking';
import { supabase } from '../supabase/client';

/**
 * Extracts authentication tokens or PKCE auth code from a deep link callback URL.
 * Handles both URL hash fragments (#access_token=...) and query parameters (?code=...).
 */
export async function handleAuthCallbackUrl(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = Linking.parse(url);

    // 1. Check for PKCE exchange code in query params
    const code = parsed.queryParams?.code as string | undefined;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return { success: true };
    }

    // 2. Check for hash fragment parameters (#access_token=...&refresh_token=...)
    let accessToken: string | undefined = parsed.queryParams?.access_token as string | undefined;
    let refreshToken: string | undefined = parsed.queryParams?.refresh_token as string | undefined;

    if (!accessToken && url.includes('#')) {
      const hash = url.split('#')[1];
      const params = new URLSearchParams(hash);
      accessToken = params.get('access_token') || undefined;
      refreshToken = params.get('refresh_token') || undefined;
      const errorDescription = params.get('error_description');
      if (errorDescription) {
        throw new Error(decodeURIComponent(errorDescription));
      }
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return { success: true };
    }

    // Check for error in query params
    const errorMsg = parsed.queryParams?.error_description || parsed.queryParams?.error;
    if (errorMsg) {
      throw new Error(String(errorMsg));
    }

    return { success: false, error: 'No authentication tokens found in redirect URL.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to authenticate from redirect.' };
  }
}
