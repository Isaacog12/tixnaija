export const NAIRA = '\u20A6';

export function koboToNaira(kobo: number): number {
  return (kobo || 0) / 100;
}

export function nairaToKobo(naira: number): number {
  return Math.round((naira || 0) * 100);
}

export function formatNaira(kobo: number): string {
  const naira = koboToNaira(kobo);
  return `${NAIRA}${naira.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
