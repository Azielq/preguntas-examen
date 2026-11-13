// @vitest-environment node
// ESLint hace cumplir las capas del análisis con IA (PLAN-IA 2.1): src/ no importa server/, api/ ni el SDK.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({ cwd: ROOT });

async function restricted(code, file) {
  const [r] = await eslint.lintText(code, { filePath: join(ROOT, file) });
  return r.messages.filter((m) => m.ruleId === 'no-restricted-imports').length;
}

describe('reglas de capas (ESLint)', () => {
  it('src/ no puede importar server/, api/ ni @anthropic-ai/sdk', async () => {
    expect(await restricted("import { handleAnalyze } from '../../../server/handler';\nexport const x = handleAnalyze;\n", 'src/features/exam/x.ts')).toBe(1);
    expect(await restricted("import { POST } from '../../api/analyze';\nexport const x = POST;\n", 'src/state/x.ts')).toBe(1);
    expect(await restricted("import Anthropic from '@anthropic-ai/sdk';\nexport const x = Anthropic;\n", 'src/ui/x.ts')).toBe(1);
    expect(await restricted("import { validateAnalyzeRequest } from '../../../shared/analysis/contract';\nexport const x = validateAnalyzeRequest;\n", 'src/features/exam/x.ts')).toBe(0);
  });

  it('server/ no importa React ni src/state; shared/ solo tipos de src/bank/types', async () => {
    expect(await restricted("import { useState } from 'react';\nexport const x = useState;\n", 'server/x.ts')).toBe(1);
    expect(await restricted("import { useExam } from '../src/state/examStore.js';\nexport const x = useExam;\n", 'server/x.ts')).toBe(1);
    expect(await restricted("import { grade } from '../src/grading/grade.js';\nexport const x = grade;\n", 'server/x.ts')).toBe(0);
    expect(await restricted("import { grade } from '../../src/grading/grade.js';\nexport const x = grade;\n", 'shared/analysis/x.ts')).toBe(1);
    expect(await restricted("import type { Question } from '../../src/bank/types.js';\nexport type X = Question;\n", 'shared/analysis/x.ts')).toBe(0);
  });
});
