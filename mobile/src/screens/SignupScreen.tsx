import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../../supabase/client';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { AuthInput } from '../components/AuthInput';
import Animated, { FadeInDown } from 'react-native-reanimated';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmailSignUp = async () => {
    if (!fullName || !username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username: username }
      }
    });
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    } else {
      Alert.alert('Success', 'Account created! Please sign in if not redirected.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setGoogleLoading(true);
      const redirectUrl = Linking.createURL('auth-callback', { scheme: 'tixnaija' });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No URL returned for OAuth');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success') {
        const { url } = result;
        const { params, errorCode } = QueryParams.getQueryParams(url);

        if (errorCode) {
          throw new Error(params.error_description || errorCode);
        }

        const access_token = params.access_token;
        const refresh_token = params.refresh_token;

        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        } else {
          throw new Error('Authentication tokens missing in callback URL');
        }
      }
    } catch (error: any) {
      Alert.alert('Google Sign-Up Error', error.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.glassCard}>
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join TixNaija to buy and manage tickets</Text>

            <AuthInput 
              label="Full Name" 
              placeholder="Alex Johnson"
              value={fullName}
              onChangeText={setFullName}
            />

            <AuthInput 
              label="Username" 
              placeholder="alexj"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />

            <AuthInput 
              label="Email Address" 
              placeholder="name@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            
            <AuthInput 
              label="Password" 
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <AuthInput 
              label="Confirm Password" 
              placeholder="••••••••"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleEmailSignUp} disabled={loading}>
              {loading ? <ActivityIndicator color="#22201e" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignUp} disabled={googleLoading}>
              {googleLoading ? <ActivityIndicator color="#f4f2f0" /> : <Text style={styles.googleBtnText}>Google</Text>}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  glassCard: {
    backgroundColor: 'rgba(46, 42, 40, 0.75)', 
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#c2bdb8',
    marginBottom: 32,
  },
  primaryBtn: {
    backgroundColor: '#f2611e',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#22201e',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#403b38',
  },
  dividerText: {
    color: '#767069',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  googleBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: '#403b38',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  googleBtnText: {
    color: '#f4f2f0',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#767069',
  },
  footerLink: {
    color: '#f2611e',
    fontWeight: '600',
  }
});
