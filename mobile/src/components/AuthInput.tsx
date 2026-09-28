import React, { useState } from 'react';
import { TextInput, StyleSheet, View, Text, TextInputProps, TouchableOpacity } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  interpolateColor
} from 'react-native-reanimated';
import { Eye, EyeOff } from 'lucide-react-native';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function AuthInput({ label, error, onFocus, onBlur, secureTextEntry, ...props }: AuthInputProps) {
  const isFocused = useSharedValue(0);
  const [focused, setFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

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
        ['#403b38', '#f2611e'] 
      ),
      backgroundColor: interpolateColor(
        isFocused.value,
        [0, 1],
        ['rgba(51, 47, 44, 0.75)', 'rgba(51, 47, 44, 0.95)'] 
      ),
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputWrapper, animatedStyle]}>
        <TextInput
          style={styles.input}
          placeholderTextColor="#767069" 
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity 
            style={styles.eyeIcon} 
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            {isPasswordVisible ? (
              <EyeOff color="#767069" size={20} />
            ) : (
              <Eye color="#767069" size={20} />
            )}
          </TouchableOpacity>
        )}
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
    color: '#c2bdb8',
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    color: '#f4f2f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    flex: 1,
  },
  eyeIcon: {
    padding: 12,
  },
  error: {
    color: '#e55a5a',
    fontSize: 12,
    marginTop: 4,
  },
});
