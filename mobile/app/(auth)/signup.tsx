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
import { User, Mail, Phone, Lock, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../../src/supabase/client';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { colors } from '../../src/theme/colors';

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successEmailSent, setSuccessEmailSent] = useState(false);

  const validate = (): boolean => {
    setErrorMsg(null);
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return false;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setErrorMsg('Please choose a password.');
      return false;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
          },
        },
      });

      if (error) throw error;

      // If user session is established immediately
      if (data.session) {
        router.replace('/(tabs)');
      } else {
        // Confirmation email required
        setSuccessEmailSent(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (successEmailSent) {
    return (
      <View style={styles.confirmationRoot}>
        <View style={styles.confirmationCard}>
          <View style={styles.confirmIconCircle}>
            <CheckCircle2 size={44} color={colors.success} />
          </View>
          <Text style={styles.confirmTitle}>Check your email</Text>
          <Text style={styles.confirmText}>
            We sent a verification link to{' '}
            <Text style={styles.boldText}>{email.trim()}</Text>. Please click the link to activate
            your account and sign in.
          </Text>
          <Button
            title="Return to Sign In"
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
        <View style={styles.headerArea}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Discover and attend live events across Nigeria</Text>
        </View>

        <View style={styles.formCard}>
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          ) : null}

          <Input
            label="Full Name"
            placeholder="e.g. Chioma Adebayo"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            leftIcon={<User size={20} color={colors.textMuted} />}
          />

          <Input
            label="Email Address"
            placeholder="chioma@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Mail size={20} color={colors.textMuted} />}
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="0801 234 5678"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Phone size={20} color={colors.textMuted} />}
          />

          <Input
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon={<Lock size={20} color={colors.textMuted} />}
          />

          <Input
            label="Confirm Password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            leftIcon={<Lock size={20} color={colors.textMuted} />}
          />

          <Button
            title="Create Free Account"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSignUp}
            style={styles.submitBtn}
          />
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
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
  boldText: {
    color: colors.text,
    fontWeight: '700',
  },
  confirmBtn: {
    width: '100%',
  },
});
