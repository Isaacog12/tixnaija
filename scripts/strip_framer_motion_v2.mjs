import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes('framer-motion') && !content.includes('<motion.')) return;

  // 1. Remove import
  content = content.replace(/import\s+{([^}]+)}\s+from\s+["']framer-motion["'];?\n?/g, '');
  
  // 2. Remove <AnimatePresence> and </AnimatePresence>
  content = content.replace(/<\/?AnimatePresence[^>]*>\n?/g, '');

  // 3. Replace <motion.div ...> with <div ...>
  content = content.replace(/<motion\.([a-zA-Z0-9]+)/g, '<$1');
  content = content.replace(/<\/motion\.([a-zA-Z0-9]+)>/g, '</$1>');

  // 4. Remove framer-motion props (supports up to 4 levels of nested braces)
  const propPattern = /\b(variants|initial|animate|exit|transition|whileHover|whileTap|layoutId|layout)\s*=\s*\{[^{}]*(\{[^{}]*(\{[^{}]*(\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}[^{}]*)*\}/g;
  content = content.replace(propPattern, '');

  // 5. Also remove valueless props like `layout`
  content = content.replace(/\blayout\b/g, '');

  // Clean up any leftover empty prop spaces inside elements
  content = content.replace(/<([a-zA-Z0-9]+)\s+>/g, '<$1>');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Cleaned ${filePath}`);
}

const files = [
  'src/components/site-nav.tsx',
  'src/routes/_authenticated/tickets.tsx',
  'src/routes/browse.tsx',
  'src/routes/contact.tsx',
  'src/routes/how-it-works.tsx',
  'src/routes/index.tsx'
];

files.forEach(fixFile);
console.log('Done.');
