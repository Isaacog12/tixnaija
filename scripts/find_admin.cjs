const fs = require('fs');

const transcript = fs.readFileSync('C:\\Users\\User-Pc\\.gemini\\antigravity-ide\\brain\\03f72117-ed69-42eb-b29e-1eb43f8e6bb7\\.system_generated\\logs\\transcript.jsonl', 'utf8');
const lines = transcript.split('\n').filter(l => l.trim().length > 0);
for (let i = lines.length - 1; i >= 0; i--) {
  const step = JSON.parse(lines[i]);
  if (step.tool_calls) {
    for (const call of step.tool_calls) {
      if (call.name === 'default_api:replace_file_content' || call.name === 'default_api:multi_replace_file_content') {
        const args = JSON.parse(call.arguments);
        if (args.TargetFile && args.TargetFile.includes('admin.tsx')) {
          console.log('Found an edit to admin.tsx in step', step.step_index);
        }
      }
    }
  }
}
