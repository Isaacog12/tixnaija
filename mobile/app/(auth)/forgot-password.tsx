import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, KeyRound, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../../src/supabase/client';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { colors } from '../../src/theme/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRequestReset = async () => {
    setErrorMsg(null);
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (error) throw error;
      setStep('verify');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not send reset code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndUpdate = async () => {
    setErrorMsg(null);
    if (!otpCode.trim()) {
      setErrorMsg('Please enter the verification code sent to your email.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify OTP code
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpCode.trim(),
        type: 'recovery',
      });

      if (verifyError) throw verifyError;

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.confirmationRoot}>
        <View style={styles.confirmationCard}>
          <View style={styles.confirmIconCircle}>
            <CheckCircle2 size={44} color={colors.success} />
          </View>
          <Text style={styles.confirmTitle}>Password Reset</Text>
          <Text style={styles.confirmText}>
            Your password has been reset successfully. You can now sign in with your new credentials.
          </Text>
          <Button
            title="Sign In"
            variant="primary"
            size="lg"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.confirmBtn}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerArea}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {step === 'request'
              ? 'Enter your email to receive recovery instructions'
              : `Enter the code sent to ${email}`}
          </Text>
        </View>

        <View style={styles.formCard}>
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          ) : null}

          {step === 'request' ? (
            <>
              <Input
                label="Registered Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Mail size={20} color={colors.textMuted} />}
              />
              <Button
                title="Send Recovery Code"
                variant="primary"
                size="lg"
                loading={loading}
                onPress={handleRequestReset}
                style={styles.submitBtn}
              />
            </>
          ) : (
            <>
              <Input
                label="6-Digit Verification Code"
                placeholder="Enter OTP"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                leftIcon={<KeyRound size={20} color={colors.textMuted} />}
              />
              <Input
                label="New Password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                leftIcon={<Lock size={20} color={colors.textMuted} />}
              />
              <Input
                label="Confirm New Password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                leftIcon={<Lock size={20} color={colors.textMuted} />}
              />
              <Button
                title="Update Password"
                variant="primary"
                size="lg"
                loading={loading}
                onPress={handleVerifyAndUpdate}
                style={styles.submitBtn}
              />
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleRequestReset}
                disabled={loading}
              >
                <Text style={styles.resendBtnText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Remember your password? </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="button"
          >
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: colors.errorMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 8,
  },
  resendBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  loginLink: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmationRoot: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmationCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  confirmIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  confirmText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmBtn: {
    width: '100%',
  },
});
