import {
  extractFirstBalancedJsonObject,
  stripTrailingCommasJson,
  relaxInvalidJsonLiterals,
  stripMarkdownCodeFences,
} from '../receiptJsonRepair';

describe('extractFirstBalancedJsonObject', () => {
  it('düz bir nesneyi çıkarır', () => {
    expect(extractFirstBalancedJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('öncesi/sonrası metni olan nesneyi izole eder', () => {
    expect(extractFirstBalancedJsonObject('blah {"a":1} son')).toBe('{"a":1}');
  });

  it('iç içe süslü parantezleri dengeli sayar', () => {
    const s = '{"a":{"b":2},"c":3}';
    expect(extractFirstBalancedJsonObject(s)).toBe(s);
  });

  it('string içindeki süslü parantezleri saymaz', () => {
    const s = '{"name":"a{b}c"}';
    expect(extractFirstBalancedJsonObject(s)).toBe(s);
  });

  it('escape edilmiş tırnağı doğru işler', () => {
    const s = '{"name":"de\\"mo"}';
    expect(extractFirstBalancedJsonObject(s)).toBe(s);
  });

  it('süslü parantez yoksa null döner', () => {
    expect(extractFirstBalancedJsonObject('hiç yok')).toBeNull();
  });

  it('dengelenmemiş açılışta null döner', () => {
    expect(extractFirstBalancedJsonObject('{"a":1')).toBeNull();
  });
});

describe('stripTrailingCommasJson', () => {
  it('nesne sonundaki virgülü kaldırır', () => {
    expect(stripTrailingCommasJson('{"a":1,}')).toBe('{"a":1}');
  });

  it('dizi sonundaki virgülü kaldırır', () => {
    expect(stripTrailingCommasJson('[1,2,]')).toBe('[1,2]');
  });

  it('boşluk içeren sondaki virgülü de kaldırır', () => {
    expect(stripTrailingCommasJson('{"a":1, }')).toBe('{"a":1 }');
  });

  it('string içindeki virgülü korur', () => {
    expect(stripTrailingCommasJson('{"a":"x,y"}')).toBe('{"a":"x,y"}');
  });

  it('geçerli ara virgülleri korur', () => {
    expect(stripTrailingCommasJson('{"a":1,"b":2}')).toBe('{"a":1,"b":2}');
  });
});

describe('relaxInvalidJsonLiterals', () => {
  it('NaN/Infinity/undefined değerlerini null yapar', () => {
    expect(relaxInvalidJsonLiterals('{"a": NaN}')).toBe('{"a": null}');
    expect(relaxInvalidJsonLiterals('{"a": Infinity}')).toBe('{"a": null}');
    expect(relaxInvalidJsonLiterals('{"a": -Infinity}')).toBe('{"a": null}');
    expect(relaxInvalidJsonLiterals('{"a": undefined}')).toBe('{"a": null}');
  });

  it('geçerli sayıya dokunmaz', () => {
    expect(relaxInvalidJsonLiterals('{"a": 12}')).toBe('{"a": 12}');
  });
});

describe('stripMarkdownCodeFences', () => {
  it('```json ... ``` sarmalayıcısını kaldırır', () => {
    expect(stripMarkdownCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('dilsiz ``` ... ``` sarmalayıcısını kaldırır', () => {
    expect(stripMarkdownCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('BOM ve boşlukları temizler', () => {
    expect(stripMarkdownCodeFences('﻿  {"a":1}  ')).toBe('{"a":1}');
  });

  it('sarmalayıcı yoksa içeriği aynen (trim) döner', () => {
    expect(stripMarkdownCodeFences('{"a":1}')).toBe('{"a":1}');
  });
});
