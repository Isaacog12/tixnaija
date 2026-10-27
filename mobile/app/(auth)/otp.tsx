import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, KeyRound, ShieldCheck, RefreshCw } from 'lucide-react-native';

import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';

const RESEND_INTERVAL = 60;

export default function OtpVerificationScreen() {
  const router = useRouter();
  const { email: paramEmail, type: paramType } = useLocalSearchParams<{
    email?: string;
    type?: string;
  }>();

  const [email, setEmail] = useState(paramEmail || '');
  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_INTERVAL);
  const [errorMsg, setErrorMsg] = useState('');

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const handleVerify = async () => {
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Email address is required.');
      return;
    }
    if (!token.trim()) {
      setErrorMsg('Please enter the verification code sent to your email.');
      return;
    }

    setIsVerifying(true);
    try {
      const otpType = paramType === 'recovery' ? 'recovery' : 'email';
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: otpType as any,
      });

      if (error) throw error;

      if (paramType === 'recovery') {
        Alert.alert('Code Verified', 'You can now set a new password for your account.');
        router.replace('/(tabs)/more');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email to receive a code.');
      return;
    }

    setIsResending(true);
    try {
      if (paramType === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase()
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
        });
        if (error) throw error;
      }

      setCountdown(RESEND_INTERVAL);
      Alert.alert('Code Sent', 'A new verification code has been dispatched to your email inbox.');
    } catch (err: any) {
      Alert.alert('Resend Failed', err.message || 'Could not send verification code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <KeyRound size={32} color={colors.primary} />
          </View>

          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to{' '}
            <Text style={styles.emailHighlight}>{email || 'your email'}</Text>.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {!paramEmail && (
            <Input
              label="Email Address"
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          )}

          <Input
            label="Verification Code"
            placeholder="e.g. 12345678"
            keyboardType="number-pad"
            autoCapitalize="none"
            value={token}
            onChangeText={setToken}
            style={styles.tokenInput}
          />

          <Button
            title="Verify & Continue"
            variant="primary"
            loading={isVerifying}
            onPress={handleVerify}
            style={{ marginTop: 8 }}
          />

          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={styles.resendTimerText}>
                Resend code in {countdown}s
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={isResending}
                style={styles.resendBtn}
              >
                {isResending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <RefreshCw size={13} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.resendBtnText}>Resend Verification Code</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emailHighlight: {
    color: colors.text,
    fontWeight: '700',
  },
  tokenInput: {
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: `${colors.error}18`,
    borderColor: colors.error,
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
  },
  resendRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendTimerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
