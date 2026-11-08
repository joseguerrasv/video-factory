#!/usr/bin/env node
import { contextText } from '../factory.mjs';

// .claude/settings.json runs this once per page. A page with nothing on it prints nothing.
try {
  const text = contextText({ page: Number(process.argv[2] ?? 1) });
  if (text) console.log(text);
} catch (err) {
  console.log(`Video Factory context unavailable (${err.message}). Run: node scripts/factory.mjs doctor`);
}
