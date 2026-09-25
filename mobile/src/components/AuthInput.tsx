import React, { useState } from 'react';
import { TextInput, StyleSheet, View, Text, TextInputProps } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  interpolateColor
} from 'react-native-reanimated';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function AuthInput({ label, error, onFocus, onBlur, ...props }: AuthInputProps) {
  const isFocused = useSharedValue(0);
  const [focused, setFocused] = useState(false);

  const handleFocus = (e: any) => {
    isFocused.value = withTiming(1, { duration: 200 });
    setFocused(true);
    onFocus && onFocus(e);
  };

  const handleBlur = (e: any) => {
    isFocused.value = withTiming(0, { duration: 200 });
    setFocused(false);
    onBlur && onBlur(e);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(
        isFocused.value,
        [0, 1],
        ['#403b38', '#f2611e'] // var(--border) in dark mode to var(--primary)
      ),
      backgroundColor: interpolateColor(
        isFocused.value,
        [0, 1],
        ['rgba(51, 47, 44, 0.75)', 'rgba(51, 47, 44, 0.95)'] // var(--input) with glass effect
      ),
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputWrapper, animatedStyle]}>
        <TextInput
          style={styles.input}
          placeholderTextColor="#767069" // var(--muted-foreground)
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: '#c2bdb8', // var(--muted-foreground) dark
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    color: '#f4f2f0', // var(--foreground) dark
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: '#e55a5a', // destructive-ish
    fontSize: 12,
    marginTop: 4,
  },
});
