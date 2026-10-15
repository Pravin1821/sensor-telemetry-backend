import { Platform } from 'react-native';

export const colors = {
  bg: '#EEEBE4',      // warm paper
  card: '#FBFAF7',
  ink: '#1E2226',     // main text
  muted: '#6B7075',
  line: '#D9D4C7',    // thin borders
  header: '#22282D',  // graphite
  accent: '#E8590C',  // signal orange
  ok: '#2F7D4F',
  alert: '#C62828',
};

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });