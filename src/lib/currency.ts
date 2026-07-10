// TixNaija stores money as integer kobo internally; display as Naira.
export const NAIRA = "\u20A6";

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export function formatNaira(kobo: number): string {
  const value = koboToNaira(kobo);
  return `${NAIRA}${value.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
