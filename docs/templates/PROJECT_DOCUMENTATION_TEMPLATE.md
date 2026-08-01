# Proje Dokümantasyonu ve Akademik Kanıt Şablonu

> Bu şablon teknoloji ve proje türünden bağımsızdır. Köşeli yer tutucuları
> doldurun, uygun olmayan alanları gerekçesiyle `Uygulanamaz` olarak işaretleyin.
> Yaşayan mimari bilgi ile değiştirilemez tarihsel kanıtı ayrı dosyalarda tutun.

## Belge kimliği

| Alan | Değer |
|---|---|
| Proje | `<PROJE_ADI>` |
| Belge sahibi | `<ROL/KİŞİ>` |
| Sürüm | `<SEMVER veya belge sürümü>` |
| Son güncelleme | `<ISO-8601 ve saat dilimi>` |
| Kapsadığı commit/sürüm | `<HASH/TAG>` |
| Belge durumu | `<Taslak / İncelemede / Onaylı / Arşiv>` |
| İnsan onayı | `<kim, tarih, kapsam, referans>` |

## 1. Proje amacı ve sınırlar

- Problem: `<...>`
- Hedef kullanıcı/paydaş: `<...>`
- Hedef son durum: `<...>`
- Kapsam içi: `<...>`
- Kapsam dışı: `<...>`
- Bilinen kısıtlar: `<platform, süre, bütçe, etik, güvenlik, erişilebilirlik>`
- Başarı ölçütleri: `<ölçülebilir metrik veya kabul kriteri>`

## 2. Roller ve insan sorumluluğu

| Rol | Sorumluluk | Karar yetkisi | Kanıt/onay yöntemi |
|---|---|---|---|
| Ürün sahibi | `<...>` | `<...>` | `<...>` |
| Geliştirici | `<...>` | `<...>` | `<...>` |
| İnceleyen | `<...>` | `<...>` | `<...>` |
| AI aracı | `<analiz/kod/test desteği>` | Nihai karar yetkisi yok | AI oturum günlüğü |

## 3. Sistem bağlamı ve mimari

### 3.1 Bağlam

`<Kullanıcılar, dış sistemler, veri sınırları ve temel akış>`

### 3.2 Teknoloji yığını

| Katman | Teknoloji/sürüm | Seçim gerekçesi | Kaynak |
|---|---|---|---|
| `<...>` | `<...>` | `<...>` | `<manifest/lockfile/commit>` |

### 3.3 Bileşenler ve veri akışı

| Bileşen | Sorumluluk | Girdi/çıktı | Güvenlik/veri sınırı |
|---|---|---|---|
| `<...>` | `<...>` | `<...>` | `<...>` |

### 3.4 Domain varlıkları ve değişmezler

| Varlık/kavram | Tanım | Değişmez kural | Uygulama referansı |
|---|---|---|---|
| `<...>` | `<...>` | `<her zaman doğru kalması gereken kural>` | `<...>` |

## 4. Gereksinim izlenebilirliği

| Gereksinim ID | Kaynak/insan onayı | Kabul kriteri | ADR | Kod/commit | Test/CI | Cihaz/insan kabulü | Durum |
|---|---|---|---|---|---|---|---|
| `<REQ-001>` | `<...>` | `<...>` | `<ADR-001>` | `<...>` | `<...>` | `<...>` | `<...>` |

## 5. Mimari karar kaydı (ADR)

Her anlamlı kararı ayrı `ADR-NNN.md` dosyasında tutun:

```markdown
# ADR-<NNN>: <Başlık>

- Tarih: <ISO-8601>
- Durum: <Önerildi / Onaylandı / Değiştirildi / İptal>
- Karar sahibi ve insan onayı: <...>
- Bağlam/problem: <...>
- Değerlendirilen seçenekler: <...>
- Karar: <...>
- Gerekçe ve trade-off: <...>
- Güvenlik/gizlilik etkisi: <...>
- Etkilenen sözleşmeler ve dosyalar: <...>
- Doğrulama planı: <...>
- Kararın yerini alan/aldığı ADR: <...>
- Retrospektif sınırlama: <...>
```

## 6. Geliştirme tarihçesi

Bir tarihçe satırı “neler değişti” yanında “neden” ve “nasıl doğrulandı”yı da
göstermelidir.

| Tarih | Olay ID | Gözlem/gereksinim | İnsan kararı | Uygulama/commit | Kanıt | Sonuç | Kalan risk |
|---|---|---|---|---|---|---|---|
| `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |

Geçmişten sonradan çıkarılan satırlar `Retrospektif` olarak işaretlenir ve olay
anındaki bilgiyle eşdeğer kabul edilmez.

## 7. Doğrulama stratejisi

### 7.1 Otomatik doğrulama

| Kapsam | Komut | Ortam | Beklenen | Sonuç artefaktı |
|---|---|---|---|---|
| Type/static check | `<...>` | `<...>` | `<...>` | `<CI/log>` |
| Unit | `<...>` | `<...>` | `<...>` | `<CI/log>` |
| Integration | `<...>` | `<...>` | `<...>` | `<CI/log>` |
| Security | `<...>` | `<...>` | `<...>` | `<CI/report>` |

### 7.2 Cihaz/manuel doğrulama

| Senaryo ID | Build/commit | Donanım/OS | Ön koşul | Adımlar | Beklenen | Gözlenen | İnsan inceleyen | Artefakt |
|---|---|---|---|---|---|---|---|---|
| `<DEV-001>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |

### 7.3 Kanıt sınırlamaları

- `<Unit testin kanıtlamadığı UX/donanım davranışları>`
- `<Ağ, cihaz veya üretim ortamı eksikleri>`
- `<Tekrarlanamayan ya da yalnız retrospektif gözlenen olaylar>`

## 8. AI işbirliği beyanı

| Alan | Kayıt |
|---|---|
| Kullanılan araç/model | `<doğrulanmış ad/sürüm veya kaydedilmedi>` |
| Kullanım amaçları | `<analiz/plan/kod/test/dokümantasyon>` |
| İnsan tarafından sağlanan girdiler | `<gereksinim, dosya, veri türü>` |
| İnsan kararları | `<seçimler ve onaylar>` |
| AI tarafından üretilen çıktılar | `<dosya/PR/rapor>` |
| Doğrulama | `<test, review, cihaz kabulü>` |
| Reddedilen/hatalı çıktılar | `<...>` |
| Oturum kayıtları | `<kontrollü referans>` |
| Retrospektif eksikler | `<model kimliği/transcript/kanıt eksikleri>` |

AI çıktısını yazarlık veya doğruluk kanıtıyla eşitlemeyin. Nihai karar ve kabul
sorumluluğunu açıkça insana bağlayın.

## 9. Güvenlik, gizlilik ve etik

- İşlenen veri sınıfları: `<kişisel/finansal/sağlık/telemetri/kaynak kodu>`
- Saklama yerleri ve süreleri: `<...>`
- Secret yönetimi: `<...>`
- Harici servis/veri aktarımı: `<...>`
- Erişim ve paylaşım sınırları: `<...>`
- Redaksiyon yöntemi: `<...>`
- Kullanıcı rızası ve etik onay gereksinimi: `<...>`
- Bilinen riskler ve azaltımlar: `<...>`

Ham log, ekran görüntüsü veya prompt içinde credential ve kişisel veri tutmayın.
Tezde kullanılan artefaktların paylaşım izinlerini ayrıca doğrulayın.

## 10. Kanıt envanteri

| Kanıt ID | Tür | Oluşturma tarihi | Bağlı commit/build | Konum | Bütünlük/hash | Gizlilik sınıfı | Saklama durumu |
|---|---|---|---|---|---|---|---|
| `<EV-001>` | `<test log/video/screenshot/ADR>` | `<...>` | `<...>` | `<...>` | `<...>` | `<public/internal/restricted>` | `<...>` |

## 11. Retrospektif sınırlamalar

- Hangi kayıtlar olay anında değil sonradan oluşturuldu? `<...>`
- Hangi commit öncesi konuşmalar/alternatifler kayıp? `<...>`
- Hangi testlerin tarihli çıktısı yok? `<...>`
- Hangi cihaz iddiaları yeniden üretilemedi? `<...>`
- Yaşayan belgelerde hangi tarihsel içerik sonradan değişmiş olabilir? `<...>`
- Bu eksikler sonuçların yorumunu nasıl sınırlar? `<...>`

## 12. Sürümleme ve bakım

- Yaşayan mimari belge güncellenebilir; tarihsel evidence/ADR kayıtları sessizce
  yeniden yazılmaz. Düzeltme gerekiyorsa yeni bir revizyon notu eklenir.
- Her iddia mümkünse commit/tag/build kimliğine sabitlenir.
- Test sayısı veya performans metriği gibi değişken değerler tarih ve komut olmadan
  kullanılmaz.
- Belge değişikliği de normal kod inceleme/onay sürecinden geçer.
