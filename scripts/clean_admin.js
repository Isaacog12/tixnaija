import fs from 'fs';

const filePath = 'src/routes/_authenticated/admin.tsx';
let content = fs.readFileSync(filePath, 'utf-8');
content = content.replace(/import\s+\{\s*motion,\s*AnimatePresence\s*\}\s*from\s+['"]framer-motion['"];?\r?\n?/g, '');
content = content.replace(/<\/?AnimatePresence[^>]*>\r?\n?/g, '');
content = content.replace(/<motion\.([a-zA-Z0-9]+)/g, '<$1');
content = content.replace(/<\/motion\.([a-zA-Z0-9]+)>/g, '</$1>');
const propPattern = /\b(variants|initial|animate|exit|transition|whileHover|whileTap|layoutId|layout)\s*=\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\r?\n?/g;
content = content.replace(propPattern, '');
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Cleaned admin.tsx');
