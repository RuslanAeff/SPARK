// Varsayılan kategori ağacının dört dille ve fiş kategori sözleşmesiyle bağını korur.
// Ağaca yeni bir kategori eklendiğinde çevirisi ya da fiş anahtarı unutulursa burada patlar.
import { DEFAULT_CATEGORIES } from '../schema';
import { RECEIPT_CATEGORY_NAMES } from '../../utils/receiptCategory';
import { translations, type Language } from '../../i18n/translations';
import azJson from '../../i18n/locales/az.json';
import ruJson from '../../i18n/locales/ru.json';

const dicts: Record<Language, Record<string, string>> = {
  tr: translations.tr as Record<string, string>,
  en: translations.en as Record<string, string>,
  az: azJson as Record<string, string>,
  ru: ruJson as Record<string, string>,
};

const allNames = DEFAULT_CATEGORIES.flatMap(parent => [
  parent.name,
  ...parent.children.map(child => child.name),
]);

describe('DEFAULT_CATEGORIES', () => {
  it('her kategori adı için dört dilde de çeviri taşır', () => {
    const missing: string[] = [];
    for (const name of allNames) {
      for (const lang of Object.keys(dicts) as Language[]) {
        const value = dicts[lang][`cat_${name}`];
        if (!value?.trim()) missing.push(`${lang}: cat_${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('fiş kategori sözleşmesindeki her ad ağaçta karşılık bulur', () => {
    const tree = new Set(allNames);
    const orphans = Object.values(RECEIPT_CATEGORY_NAMES).filter(
      name => !tree.has(name),
    );
    expect(orphans).toEqual([]);
  });

  it('kategori adları ağaç genelinde benzersizdir', () => {
    expect(new Set(allNames).size).toBe(allNames.length);
  });

  it("'Diğer' ağacın sonunda kalır", () => {
    expect(DEFAULT_CATEGORIES.at(-1)?.name).toBe('Diğer');
  });
});
