export const colors = {
  background: '#22201e',
  surface: '#2c2a28',
  surfaceElevated: '#383431',
  surfaceGlass: 'rgba(44, 42, 40, 0.85)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderActive: '#f2611e',
  
  primary: '#f2611e',
  primaryForeground: '#ffffff',
  primaryMuted: 'rgba(242, 97, 30, 0.15)',
  
  secondary: '#403b38',
  secondaryForeground: '#f4f2f0',
  
  success: '#2ED573',
  successMuted: 'rgba(46, 213, 115, 0.15)',
  
  warning: '#FFC107',
  warningMuted: 'rgba(255, 193, 7, 0.15)',
  
  error: '#E55A5A',
  errorMuted: 'rgba(229, 90, 90, 0.15)',
  
  text: '#f4f2f0',
  textSecondary: '#c2bdb8',
  textMuted: '#8e8b85',
  placeholder: '#767069',
} as const;

export type ThemeColors = typeof colors;
