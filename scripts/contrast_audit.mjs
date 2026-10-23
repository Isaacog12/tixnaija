// WCAG Contrast ratio calculator for OKLCH and sRGB tokens

function oklchToRgb(l, c, h) {
  // Convert h from degrees to radians
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab to linear LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  // LMS to linear sRGB
  const rLinear = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const gLinear = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bLinear = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;

  // Gamma correction to sRGB [0, 1]
  function gamma(val) {
    const v = Math.max(0, Math.min(1, val));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * (v ** (1 / 2.4)) - 0.055;
  }

  return [gamma(rLinear), gamma(gLinear), gamma(bLinear)];
}

function relativeLuminance([r, g, b]) {
  function srgbToLin(v) {
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }
  const R = srgbToLin(r);
  const G = srgbToLin(g);
  const B = srgbToLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(rgb1, rgb2) {
  const lum1 = relativeLuminance(rgb1);
  const lum2 = relativeLuminance(rgb2);
  const L1 = Math.max(lum1, lum2);
  const L2 = Math.min(lum1, lum2);
  return (L1 + 0.05) / (L2 + 0.05);
}

// Alpha compositing: foreground over background
function compositeOver(fgRgb, alpha, bgRgb) {
  return [
    fgRgb[0] * alpha + bgRgb[0] * (1 - alpha),
    fgRgb[1] * alpha + bgRgb[1] * (1 - alpha),
    fgRgb[2] * alpha + bgRgb[2] * (1 - alpha),
  ];
}

const tokens = {
  light: {
    background: oklchToRgb(0.98, 0.008, 80),
    foreground: oklchToRgb(0.14, 0.02, 40),
    card: oklchToRgb(1, 0, 0),
    cardForeground: oklchToRgb(0.14, 0.02, 40),
    primary: oklchToRgb(0.66, 0.22, 40),
    primaryForeground: oklchToRgb(0.14, 0.02, 40),
    muted: oklchToRgb(0.93, 0.01, 80),
    mutedForeground: oklchToRgb(0.48, 0.03, 60),
    destructive: oklchToRgb(0.58, 0.24, 25),
    destructiveForeground: oklchToRgb(0.98, 0.008, 80),
  },
  dark: {
    background: oklchToRgb(0.14, 0.02, 40),
    foreground: oklchToRgb(0.97, 0.02, 80),
    card: oklchToRgb(0.18, 0.03, 40),
    cardForeground: oklchToRgb(0.97, 0.02, 80),
    primary: oklchToRgb(0.66, 0.22, 40),
    primaryForeground: oklchToRgb(0.14, 0.02, 40),
    muted: oklchToRgb(0.22, 0.02, 40),
    mutedForeground: oklchToRgb(0.80, 0.03, 70),
    destructive: oklchToRgb(0.60, 0.24, 25),
    destructiveForeground: oklchToRgb(0.98, 0.008, 80),
  }
};

console.log("=== LIGHT MODE TOKEN CONTRASTS ===");
const lightPairs = [
  ["foreground on background", tokens.light.foreground, tokens.light.background],
  ["foreground on card", tokens.light.cardForeground, tokens.light.card],
  ["primary on background", tokens.light.primary, tokens.light.background],
  ["primaryForeground on primary", tokens.light.primaryForeground, tokens.light.primary],
  ["mutedForeground on background", tokens.light.mutedForeground, tokens.light.background],
  ["mutedForeground on card", tokens.light.mutedForeground, tokens.light.card],
  ["destructive on background", tokens.light.destructive, tokens.light.background],
  ["destructiveForeground on destructive", tokens.light.destructiveForeground, tokens.light.destructive],
];
for (const [name, fg, bg] of lightPairs) {
  const r = contrastRatio(fg, bg);
  console.log(`${name}: ${r.toFixed(2)}:1 ${r >= 4.5 ? "PASS (>=4.5)" : r >= 3.0 ? "LARGE ONLY (>=3.0)" : "FAIL (<3.0)"}`);
}

console.log("\n=== DARK MODE TOKEN CONTRASTS ===");
const darkPairs = [
  ["foreground on background", tokens.dark.foreground, tokens.dark.background],
  ["foreground on card", tokens.dark.cardForeground, tokens.dark.card],
  ["primary on background", tokens.dark.primary, tokens.dark.background],
  ["primaryForeground on primary", tokens.dark.primaryForeground, tokens.dark.primary],
  ["mutedForeground on background", tokens.dark.mutedForeground, tokens.dark.background],
  ["mutedForeground on card", tokens.dark.mutedForeground, tokens.dark.card],
  ["destructive on background", tokens.dark.destructive, tokens.dark.background],
  ["destructiveForeground on destructive", tokens.dark.destructiveForeground, tokens.dark.destructive],
];
for (const [name, fg, bg] of darkPairs) {
  const r = contrastRatio(fg, bg);
  console.log(`${name}: ${r.toFixed(2)}:1 ${r >= 4.5 ? "PASS (>=4.5)" : r >= 3.0 ? "LARGE ONLY (>=3.0)" : "FAIL (<3.0)"}`);
}

console.log("\n=== TEXT-WHITE/NN ON DARK BACKGROUND (oklch 0.14 0.02 40 / #050505) ===");
const white = [1, 1, 1];
const darkBg = tokens.dark.background;
const pureBlack = [0.02, 0.02, 0.02]; // #050505
for (const alpha of [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15]) {
  const comp = compositeOver(white, alpha, pureBlack);
  const r = contrastRatio(comp, pureBlack);
  console.log(`text-white/${Math.round(alpha*100)} on #050505: ${r.toFixed(2)}:1 ${r >= 4.5 ? "PASS (>=4.5:1)" : r >= 3.0 ? "LARGE/UI (>=3.0:1)" : "FAIL (<3.0:1)"}`);
}
