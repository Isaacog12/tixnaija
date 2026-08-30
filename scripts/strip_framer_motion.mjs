import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function stripFramerMotion(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes('framer-motion') && !content.includes('<motion.')) return;

  // 1. Remove import
  content = content.replace(/import\s+{([^}]+)}\s+from\s+["']framer-motion["'];?\n?/g, '');
  
  // 2. Remove <AnimatePresence> and </AnimatePresence>
  content = content.replace(/<\/?AnimatePresence[^>]*>\n?/g, '');

  // 3. Replace <motion.div ...> with <div ...>
  //    This regex handles motion.div, motion.span, motion.p, etc.
  content = content.replace(/<motion\.([a-zA-Z0-9]+)/g, '<$1');
  content = content.replace(/<\/motion\.([a-zA-Z0-9]+)>/g, '</$1>');

  // 4. Remove framer-motion specific props
  const propsToRemove = [
    /variants=\{[^}]+\}/g,
    /initial=\{[^}]+\}/g,
    /animate=\{[^}]+\}/g,
    /exit=\{[^}]+\}/g,
    /transition=\{[^}]+\}/g,
    /whileHover=\{[^}]+\}/g,
    /whileTap=\{[^}]+\}/g,
    /layoutId=\{[^}]+\}/g,
    /layout=\{[^}]+\}/g,
    /layout\s/g
  ];

  propsToRemove.forEach(regex => {
    content = content.replace(regex, '');
  });

  // 5. Clean up any leftover empty prop spaces
  content = content.replace(/<([a-zA-Z0-9]+)\s+>/g, '<$1>');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Cleaned ${filePath}`);
}

walkDir('./src', stripFramerMotion);
console.log('Done stripping framer-motion.');
