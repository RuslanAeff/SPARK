# AI Destekli Geliştirme Oturumu Şablonu

> Bu şablon farklı AI araçları ve yazılım projeleri için kullanılabilir. Amaç ham
> sohbeti kopyalamak değil; yetki, insan kararı, AI katkısı ve doğrulama zincirini
> yeterli ayrıntıyla kaydetmektir. Secret ve kişisel veri eklemeyin.

## 1. Oturum kimliği

| Alan | Kayıt |
|---|---|
| Oturum ID | `<AI-YYYY-AA-GG-KONU-NNN>` |
| Başlangıç/bitiş | `<ISO-8601, saat dilimi>` |
| Proje/repo | `<...>` |
| Branch/worktree | `<...>` |
| Başlangıç commit'i | `<tam hash>` |
| Başlangıç çalışma ağacı | `<clean/dirty; ilgili dosyaların özeti>` |
| İnsan rolü | `<ürün sahibi/geliştirici/inceleyen>` |
| AI aracı/model/sürüm | `<doğrulanmış bilgi; bilinmiyorsa kaydedilmedi>` |
| Oturum kayıt yeri | `<kontrollü transcript/issue/task referansı>` |

## 2. İnsan talebi ve yetki sınırı

### Hedef

`<İnsanın istediği ölçülebilir sonuç>`

### İnsan tarafından belirlenen kabul kriterleri

- [ ] `<...>`
- [ ] `<...>`

### Açıkça izin verilen işlemler

- [ ] Salt-okunur repo incelemesi
- [ ] Belirlenen dosyalara yazma: `<yollar>`
- [ ] Yerel test/typecheck çalıştırma: `<komutlar>`
- [ ] Bağımlılık kurulumu veya ağ erişimi: `<izin kapsamı / izin yok>`
- [ ] Commit/branch/PR oluşturma: `<izin kapsamı / izin yok>`
- [ ] Dış sisteme mesaj veya veri gönderme: `<izin kapsamı / izin yok>`

### Yasak veya korunacak alanlar

- `<kullanıcı değişiklikleri, secret dosyaları, üretim sistemleri, veri setleri>`

Yetki sonradan genişletildiyse tarih ve insan onayıyla ayrı bir satır ekleyin:

| Zaman | Yeni yetki | İnsan onay referansı |
|---|---|---|
| `<...>` | `<...>` | `<...>` |

## 3. Girdiler ve gizlilik sınıflandırması

| Girdi | Kaynak | Veri sınıfı | AI'ya verildi mi? | Redaksiyon/koruma |
|---|---|---|---|---|
| `<dosya/görsel/log>` | `<insan/repo/sistem>` | `<public/internal/restricted>` | `<evet/hayır/kısmi>` | `<...>` |

Şunları kayda veya prompt'a koymayın: API anahtarları, parolalar, tokenlar,
credential dosyaları, gereksiz kişisel/finansal veri, cihaz UUID'si ve mutlak
kullanıcı yolları.

## 4. Başlangıç kanıtı

```text
git status özeti: <...>
ilgili sürümler: <...>
yeniden üretim adımları: <...>
gözlenen mevcut davranış: <...>
başlangıç ekran/log/test artefaktı: <...>
```

Başlangıç durumu ölçülmediyse “ölçülmedi” yazın; çözüm sonrası hafızadan baseline
üretmeyin.

## 5. Plan ve insan kontrol noktaları

| Adım | AI önerisi | Risk | İnsan kararı | Durum | Beklenen kanıt |
|---|---|---|---|---|---|
| `1` | `<...>` | `<...>` | `<onay/red/değişiklik>` | `<...>` | `<...>` |

Mimari, güvenlik, veri kaybı veya dış sistem etkisi olan kararlarda uygulamadan
önce açık insan kontrol noktası kullanın.

## 6. Karar günlüğü

| Karar ID | Bağlam | AI seçenekleri/önerisi | İnsan tarafından seçilen karar | Gerekçe | ADR/kanıt |
|---|---|---|---|---|---|
| `<DEC-001>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |

AI önerisiyle insan kararını aynı hücrede belirsiz bırakmayın. İnsan seçim
yapmadıysa durum `AI önerisi — onay bekliyor` olmalıdır.

## 7. Uygulama kaydı

| Değişiklik | AI katkı türü | İnsan katkısı | Dosyalar | Risk/yan etki | Durum |
|---|---|---|---|---|---|
| `<...>` | `<kod/test/doküman>` | `<gereksinim/review/düzeltme>` | `<...>` | `<...>` | `<...>` |

### Kullanılmayan veya hatalı AI çıktıları

| Çıktı | Neden reddedildi/değiştirildi | Etki kaldı mı? | Takip |
|---|---|---|---|
| `<...>` | `<...>` | `<...>` | `<...>` |

Bu bölüm önemlidir: yalnız başarılı AI çıktılarının kaydı, katkıyı olduğundan daha
güvenilir gösterir.

## 8. Otomatik doğrulama

| Komut | Commit/çalışma ağacı | Ortam | Tarih | Exit code | Sonuç | Log/CI | Kanıtlamadığı şey |
|---|---|---|---|---|---|---|---|
| `<...>` | `<...>` | `<OS/runtime>` | `<...>` | `<...>` | `<...>` | `<...>` | `<ör. gerçek cihaz UX>` |

Test daha sonra farklı bir committe çalıştırıldıysa bunu açıkça belirtin.

## 9. Cihaz/entegrasyon doğrulaması

| Senaryo | Build+commit | Cihaz/OS | Mod/ağ/veri durumu | Beklenen | Gözlenen | Artefakt | İnsan inceleyen |
|---|---|---|---|---|---|---|---|
| `<...>` | `<...>` | `<anonimleştirilmiş>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |

Görsel kalite, gesture, animasyon, permission, cold-start ve donanım bağımlı
davranışlar yalnız unit testle “doğrulandı” olarak işaretlenmemelidir.

## 10. Sonuç ve insan kabulü

| Alan | Kayıt |
|---|---|
| Tamamlanan kapsam | `<...>` |
| Tamamlanmayan kapsam | `<...>` |
| Kalan risk/teknik borç | `<...>` |
| Son diff özeti | `<dosya ve satır özeti>` |
| Commit/PR/build | `<...>` |
| İnsan incelemesi | `<kim/rol, tarih, neyi inceledi>` |
| Nihai kabul | `<kabul / kısmi kabul / reddedildi / bekliyor>` |
| Kabul kanıtı | `<issue, review, transcript veya imzalı kayıt>` |

## 11. Gizlilik kontrol listesi

- [ ] Secret/credential/log tokenı kayda alınmadı.
- [ ] Ekran görüntüsü ve videolar gerekli yerlerde redakte edildi.
- [ ] Kişisel kullanıcı yolu, UUID ve cihaz seri numarası çıkarıldı.
- [ ] AI'ya gönderilen veri türleri belirtildi.
- [ ] Harici servis saklama/paylaşım belirsizlikleri not edildi.
- [ ] Tezde veya herkese açık depoda kullanılacak artefaktların paylaşım izni kontrol edildi.

## 12. Retrospektif sınırlama beyanı

- Bu kayıt olay sırasında mı, sonradan mı oluşturuldu? `<...>`
- Eksik model/araç sürümü var mı? `<...>`
- Tam transcript veya insan onay referansı korunmuş mu? `<...>`
- Başlangıç baseline'ı olay sırasında ölçülmüş mü? `<...>`
- Test/cihaz artefaktı ilgili commit'e bağlı mı? `<...>`
- Sonradan değişmiş yaşayan belgelere dayanılıyor mu? `<...>`
- Bu eksikler yorum ve akademik iddiayı nasıl sınırlar? `<...>`

## 13. Kısa akademik katkı özeti

```text
İnsan katkısı: <gereksinim, karar, inceleme ve kabul>
AI katkısı: <analiz, kod, test veya dokümantasyon>
Doğrulama: <otomatik ve manuel kanıt>
Atıf sınırı: <AI önerisinin insan kararı veya bağımsız kanıt olmadığı alanlar>
Retrospektif sınırlama: <eksik kayıtlar>
```
