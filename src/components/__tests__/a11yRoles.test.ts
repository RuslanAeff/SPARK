// UI denetimi A11Y-01: Erişilebilirlik bilgisi hiç olmayan yedi dosyada her
// dokunulabilir öğe rol taşır; yalnız ikon içeren (görünür metni olmayan) öğe
// ayrıca çevrilmiş bir etiket taşır. TypeScript ayrıştırıcısıyla kaynak taranır.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '../../..');
const FILES = [
  'app/categories.tsx',
  'app/onboarding.tsx',
  'app/goal-settings.tsx',
  'app/edit-items.tsx',
  'src/components/VendorOptionsSheet.tsx',
  'src/components/IncomeSheet.tsx',
  'src/components/DebtSheet.tsx',
];
const TAGS = new Set(['Pressable', 'TouchableOpacity']);

function hasText(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText() === 'Text') {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function offenders(file: string): string[] {
  const full = path.join(ROOT, file);
  const source = ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && TAGS.has(n.tagName.getText())) {
      const names = n.attributes.properties.map(p => (p.name ? p.name.getText() : '...'));
      const spread = names.includes('...');
      const line = source.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      if (!spread && !names.includes('accessibilityRole')) out.push(`${file}:${line} rol yok`);
      const textual = ts.isJsxOpeningElement(n) && hasText(n.parent);
      if (!spread && !textual && !names.includes('accessibilityLabel')) out.push(`${file}:${line} etiket yok`);
    }
    ts.forEachChild(n, visit);
  };
  visit(source);
  return out;
}

it('every pressable in the audited files has a role, icon-only ones a label', () => {
  expect(FILES.flatMap(offenders)).toEqual([]);
});
