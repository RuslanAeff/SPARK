# Öğrenci değerlendirmesi ve öğretmene cevap taslağı

Hazırlanma: 4 Ekim 2026. Durum: öğrencinin okuyup düzelteceği taslak.
Öğretmene gönderilmedi; nihai kodlama veya bağımsız inceleme değildir.
Belirli görsel sonuçlara ilişkin öğrenci kabulü aşağıda ayrıca kaydedilir.
Ana tez metninin yerine geçmez.

## Öğrencinin doğruladığı çalışma biçimi

### İki görsel örneğe ilişkin sonraki açıklama

4 Ekim 2026'da öğrenci üç ekran görüntüsü sundu. İlk iki görüntü fiş tarama
ekranının yan yana kart görünümü ile ortadaki kartın öne çıktığı görünümünü
gösteriyor. Öğrenci son hâlin hareketli, havada uçuşan katalog gibi olduğunu
bildirdi; durağan görüntüler animasyonun çalışmasını kanıtlamaz. Diğer görüntü
uzun satıcı adının bulunduğu satırda sağ tarafta sıkışma/kırpılma gösteriyor;
sonraki kaydırmalı sayfaya taşma davranışı öğrencinin açıklamasıdır. Düzeltilmiş
satıcı görünümü daha sonra 4 Ekim konuşmasında sunuldu ve incelendi; uzun ad
kısaltılmış, sağ tutar ve ok görünür alanın içinde kalmıştır. Ham fiş/finansal içerikler depoya kopyalanmadı.

Öğrenci her iki örnek için şu cümleyi açıkça doğruladı:
“Son hâlini denedim, istediğim gibi oldu ve bu yüzden tekrar bildirmedim.”
Bu, 4 Ekim'de alınan geriye dönük, kapsamı belirli kullanıcı kabul beyanıdır
(E4'ün kabul türü); bağımsız teknik inceleme, release veya tam E3 kaydı değildir.
Gözlem tarihi, kesin build ve her örneğin çalışma ortamı henüz belirlenmedi.
Dosya adlarındaki tarihler kendiliğinden test tarihi sayılmaz.

Öğrenci memnuniyet durumunda ayrıca onay mesajı yazmayıp devam ettiğini,
bunu gereksiz token kullanımından kaçınmak için yaptığını açıkladı. Bu çalışma
alışkanlığı kaydedilir; diğer tarihsel konuşmalardaki sessizlik otomatik kabul
veya teknik doğruluk olarak kodlanmaz.

Öğrenci düzeltilmiş görüntüyü sunmayı ve animasyonu canlı göstermeyi teklif
etti. Henüz canlı gösterim/başka insan incelemesi yapılmış sayılmaz. Düzeltilmiş satıcı görüntüsü artık mevcut. Animasyon için isteğe bağlı ek
kanıt, kısa kayıt veya tarih/build/ortamı not edilen canlı gösterimdir.
Bu iki örnek yeni adaydır; tam kaynak paketleri ve nihai sayıları henüz kurulmadı.

4 Ekim açıklaması: Öğrenci yukarıdaki olay için kendi katkısının anlatımını
doğruladı; bu, düzeltmenin teknik doğruluğuna onay değildir.

- **Tarama nedeni:** AI ile üretilen projelerin güvenlik ve performans bakımından
  zayıf olabileceğine ilişkin duyduğu eleştiriler üzerine, özellik/tasarım
  geliştirmelerinden sonra önleyici ölü kod, darboğaz ve güvenlik taramaları
  yaptırıyor. Modellerin ilerlemesinden yararlanmak ve sorun bırakmamak istiyor.
  Bu, katılımcının gerekçesi; eleştirmenlerin niyeti veya modellerin gerçekten
  daha iyi olduğu hakkında araştırma sonucu değildir. Belirli bir arıza
  gözlemlediğini bu taramanın başlangıcı olarak bildirmedi.
- **Raporlarla karar verme:** Raporları okumaya çalıştığını, ancak bu çalışma
  biçiminde teknik önerileri kendisi değiştirme/reddetme yoluna gitmediğini
  söylüyor. Bazen raporu başka AI'ya verip yeniden doğrulamasını ve uygulamasını
  istiyor. Bu olayın görünen isteği de yeniden doğrulama ve uygulama talebidir;
  model kimliği/sürümü yalnız öğrencinin adlandırmasından doğrulanmış sayılmaz.
- **Kullanıcı kontrolü:** Genel sıra `npx expo start` → QR kodla Expo Go →
  görünür sorun yoksa ve sonuç istediği gibiyse APK derleme şeklinde. Bu yanıt,
  özel silme gözleminin hangi APK/build'de tekrarlandığını veya tarihini kesin
  olarak belirtmiyor; iki ortamda da test edilmiş gibi yazılmayacak.
- **Yorum sınırı:** İkinci AI'nın incelemesi, ayrı bir AI kontrolüdür; bağımsız
  insan incelemesi veya otomatik doğruluk garantisi değildir. “Öneriyi
  reddetmemeliyim” düşüncesi katılımcının anlattığı çalışma tercihidir, tezin
  koyduğu bir kural değildir. Sonraki müdahaleler olursa bunlar da kaydedilir.

Bu açıklamadan sonra öğrenci görsel geri bildirim örneklerini sağladı. Aynı
örnek yeniden istenmeyecek; aşağıdaki çalışılmış örnek mevcut kaynakları kullanır.

## Birlikte okuyacağımız kısa örnek

**P-002 adayı: API anahtarı kaydedilirken eski kaydın temizlenememesi.**
3 Ekim güvenlik çalışmasının yalnız bu sorunu kapsamda; diğer güvenlik
düzeltmeleri ve Eylül'deki anahtar silme olayı bu örneğe dahil değil.

| Soru | Şu an desteklenen anlatım |
|---|---|
| Sen ne istedin? | Güvenlik raporundaki bulguları yeniden doğrulayıp düzeltmesini AI'dan istedin. |
| Sen ne yaptın? | Teknik kod incelemesini AI'ya bıraktın. Bu olayda kodu kendin incelemediğini açıkladın. |
| AI ne yaptı? | Kaydetme sırasında eski SQLite kaydını temizleyen işlemin hatasını sessizce yutan kodu inceledi; test ekleyip hata bildirimini değiştirdi. |
| Değişiklik ne? | Temizlik başarısızsa kaydetme artık başarı bildirmiyor. Güvenli depoya yazılan yeni değer korunuyor; yeniden deneme mümkün. |
| Neye dayanıyoruz? | Önceki kodla mevcut değişikliği karşılaştırabiliyoruz. Bu konuşmadaki araç çıktıları ve 3 Ekim kaydı ilgili testleri belgeliyor; testlerde gerçek telefon depoları yerine taklitler kullanıldı. |
| Neyi bilmiyoruz? | İlk kusurlu kodun AI tarafından yazıldığı gösterilmedi. Bu özel kaydetme hatasının gerçek telefonda denenmesi veya açık son kullanıcı kabulü doğrulanmadı. |

**Geçici sonuç:** AI destekli bir düzeltme ve belirli otomatik kontroller var.
İlk kusurun AI kaynaklı olduğu veya bütün cihaz koşullarında giderildiği sonucu yok.

**Senin ayrıca bildirdiğin gözlem:** Sil düğmesine dokununca “API anahtarı mevcut”
yazısı kayboluyor ve fiş taramak için anahtar ekleme bildirimi görülüyor. Bu,
silme arayüzüne ilişkin kullanıcı beyanı; P-002'deki kaydetme/legacy temizleme
hatasının testi değil. Gözlem tarihi, build kimliği, cihaz ve kayıt artefaktı
belirlenmediği için tam tanımlı E3 kanıtı veya depolamadan silinme ispatı sayılmadı.
Genel Expo/APK kullanım alışkanlığını bu olaya özel test gibi aktarmıyoruz.

### Gerekçeli sınıflandırma taslağı

- **Kod kusuru:** Temizleme başarısızlığına rağmen kaydetme çağrısı başarılı
  dönüyordu. Dayanak: `writeSecureApiKey` önceki catch bloğu ve hata enjeksiyonu.
- **İlk hatanın AI'ya atfı:** Bilinmiyor. Mevcut düzeltmenin AI tarafından
  yapılması, eski kodun yazarlığını kanıtlamıyor.
- **İnsan katkısı:** Görevi başlatma ve düzeltme talebi; kod incelemesi değil.
  AI bulgusunu kullanıcıya ait teknik teşhis gibi yazmıyoruz.
- **Yeniden çalışma:** Kusurlu başlangıç kodunu düzeltmenin kapsamı ile AI'nın
  önerdiği çözümü sonradan yeniden yapma ayrıdır. İkincisi için bu kısa taslakta
  kesin etiket/deneme sayısı atanmıyor; ilgili konuşma dizisi arşivlenmelidir.
- **Sonuç kanıtı:** Kod değişikliği ve otomatik kontroller; özel cihaz hata
  senaryosu ve kabul açık. AI özetinin kendisini test çıktısı yerine koymuyoruz.

Kaynaklar: [3 Ekim kayıt](../../evidence/SECURITY_REMEDIATION_2026-10-03.md),
`src/services/secureKeyStore.ts`, `app/settings-ai.tsx`,
`src/services/__tests__/secureKeyStore.test.ts`,
`src/components/__tests__/SettingsAiScreen.test.tsx`.
Yerel inceleme tabanı: `28d1e43` + commit edilmemiş çalışma ağacı; mevcut
değişiklikler bu commit'in içinde varmış gibi sunulamaz. Bu tur test çalıştırılmadı.
Konuşma henüz ayrı, hash'li bir özgün kaynak paketine aktarılmadı; bu belge
onun tam transkripti değildir. Resmî kodlama öncesi ilgili özgün mesajlar ve
araç çıktıları kaynak kimlikleriyle korunmalıdır.

Öğrenciden beklenen yalnız kendi katkısının doğru anlatıldığını kontrol etmesidir;
bu inceleme teknik güvenlik onayı değildir.

## Mevcut kaynaklara göre sayı

### Sonradan sağlanan analiz seçicisi örneği

4 Ekim'de öğrenci Türkçe isteğini ve AI yanıtını metin olarak aktardı: analiz
dönem seçimi, seçilen vurgu rengini taşıyan ve sekmeler arasında kayan cam
görünümlü bir yüzeye dönüştürülsün. Bu, şimdilik tasarım gereksinimi ve AI
uygulama yanıtı adayıdır; önceden geçerli bir kuralın ihlali gösterilmediği için
AI hatası olarak kodlanmaz. Aktarılan metin özgün konuşma dışa aktarımı değildir.

Kod kontrolü: `src/components/GlassSelectionIndicator.tsx` tema rengine bağlı
gradyan, ölçülen hedefe `withTiming` hareketi ve `ReduceMotion.System` kullanır.
`app/(tabs)/analytics.tsx` seçili sekme ölçüsünü bu bileşene aktarır ve sekmeleri
`onLayout` ile ölçer. Mevcut kod uygulama kanıtıdır; tarihsel kod sürümü veya
gerçek cihazda animasyon akıcılığı bu okumayla doğrulanmadı.

Aktarılan AI yanıtı 147 grup/1157 test ve temiz diff bildiriyor, fiziksel cihaz
kontrolünün yapılmadığını açıkça söylüyor. Ham tarihsel test çıktısı burada
incelenmedi; bu sayılar doğrulanmış çalıştırma sonucu değil, yanıtın iddiasıdır.
Depodaki 25 Eylül tarihli ilgili izlenebilirlik notları testlerin çalıştırılması
gerektiğini yazıyor; bunlar da çalıştırma kanıtı değildir. Kullanıcının bu özel
tasarımın son hâline ilişkin kabulü henüz sorulmadı. Önceki iki görsel örneğe
verdiği kabul bu olaya aktarılmaz.

İngilizce analiz özeti (doğrudan alıntı çevirisi değil):
“The developer specified a translucent, accent-coloured selection surface
that should slide between analysis-period tabs. The assistant reported
implementing the design and passing automated checks, while explicitly leaving
physical-device validation open. Current source inspection supports the
presence of the implementation, but does not independently verify the reported
historical test run or the perceived quality of the animation.”

Aşağıdaki sayı tablosu önceki ön elemenin anlık durumudur; yeni görsel/tutar
hiyerarşisi/cam seçici örnekleri nihai örnekleme eklenmiş sayılmaz.

Bu tur [SPARK indeksi](EVIDENCE_INDEX.md),
[SynCinema'nın alınmış indeksi](imports/2026-09-21-syncinema-01/EVIDENCE_INDEX.md)
ve [eski pilotun](pilot/SEC02_WORKED_EXAMPLE_DRAFT.md) kaynak kaydı okundu.
Bu bir kaynak yeterliliği ön elemesidir; tüm uzak kod/geçmiş tekrar denetlenmedi.

| Kayıt | Sayı | Ana analize geçmeden eksik olan |
|---|---:|---|
| SPARK eski adaylar | 5 | P-001'in paketi var fakat ilk AI atfı eksik. L02–L04 için olay bazında kaynak paketi gerekli. L05 geniş bir tarihsel iz; henüz yeterince dar bir olay değil. |
| SynCinema adaylar | 5 | Kaynak belge beş başlık içeriyor; “four candidates” ifadesi tutarsız. Özgün konuşma/runtime/CI kaynakları ve yer yer çelişkili anlatımlar kontrol edilmeli. |
| AutoSRT kurulmuş aday | 0 | Ürün README'si mevcut; sınırlı bir geliştirme olayının süreç kaynakları henüz kurulmadı. Bu, projede kullanılabilir olay bulunmadığı anlamına gelmez. |
| Yeni SPARK kaydetme adayı | 1 | Yukarıdaki kısa taslak; özgün konuşma/çıktı paketi tamamlanmalı. Eski silme pilotuyla çift sayılmamalı. |

**Sonuç:** 10 eski aday/iz + 1 yeni aday var. Bunlar 11 hazır tez olayı değildir.
Bir arşivli geçici pilot ve bir yeni kısa inceleme taslağı var; nihai örneklem
henüz seçilmedi. 12 veya 14 olay kotası benimsenmedi. Öğrenci, sayıyı kanıt
yeterliliğine göre belirlemeyi açıkça kabul etti. Şu an kesin bir üç-vaka
örneklem büyüklüğü vaat etmek kaynakların desteklediğinden fazlası olur.

## Öğretmene cevap taslağı

Dear Dr Kacprowicz,

Thank you for your feedback. I would like to address the four points as follows.

First, I will make the analysis inspectable through a worked example before
coding the main dataset. For each classification, I will show the relevant
source, my reasoning, and what remains unknown. Provisional SPARK examples now distinguish code/test evidence, retrospective
user acceptance and uncertain AI authorship. The visual example also records
why a screenshot cannot establish the full behaviour of a swipeable interface.
I would like to submit the example and coding rules for your review and seek
another technically informed reader where possible. Neither review has yet
been completed, and I will not describe AI agreement as independent validation.

Second, I propose using “student developer with prior programming exposure but
no professional software development experience” instead of “novice developer”.
My background includes an Ecology degree, self-directed programming, a
full-stack course at Code Academy in Baku, and current Computer Science MSc
studies at VIZJA University. My workflow mainly involves describing desired
behaviour through conversation, delegating implementation and technical review
to AI, and checking visible results through Expo and APK use. I did not inspect
the code in the security example we are examining. I will distinguish this
workflow from code-level review and will not treat my self-confidence as a
measure of competence. The background and workflow at each project's start
will be described only where I can establish them.

I also request preventive dead-code, performance and security reviews after
feature and design changes. I try to read the reports, but in this workflow I
have generally delegated technical decisions rather than modifying or rejecting
the recommendations myself. Sometimes I ask another AI to verify a report
before implementing it. I will analyse this as a further AI-assisted review,
not as independent human validation. My usual visible-check sequence is Expo
Go first, followed by an APK build when the result appears satisfactory; a
general workflow will not be substituted for evidence of a particular test.

Third, I will reduce the original scope and select episodes according to
available evidence and comparative value. The existing inventories contain
an expanded shortlist of eight SPARK candidates and an imported inventory of
five SynCinema candidates; neither inventory is a verified final dataset. AutoSRT now has two bounded code-change leads, but the missing conversations
prevent reconstruction of their AI interaction sequences.
Overlapping records will be consolidated before counting. I will therefore
not commit to a fixed number merely to fill the original target. SPARK will
remain primary; the secondary cases will contribute only a small number of
well-supported comparisons. I will propose the final number after the source
screening, retaining inclusion and exclusion reasons.

Fourth, I will use explicit coding rules. An error must contradict a requirement
applicable at that time or a verifiable technical fact; AI attribution additionally
requires traceable evidence of the AI output. Ambiguous instructions, later
requirement changes and unknown attribution will be recorded separately.
Minor rework will mean a local correction preserving the central approach;
substantial rework will involve replacing a central mechanism or changing
important interfaces, data structures or lifecycle responsibilities. These
rules will be tried on the worked example and revised before the main analysis.

I will also keep visible user checks separate from technical verification.
For example, seeing the API-key status disappear after pressing Delete does
not prove that every stored copy has been removed. E0–E4 will describe support
for particular claims, rather than act as a single overall quality score.

My next proposed step is to send you the worked example and revised criteria
with a narrower, evidence-based scope. Would this address your concerns?

Best regards,
Ruslan


## Worked visual example — SPK-C01 (draft, 4 October 2026)

Prepared by AI from inspected sources for student and human-reviewer assessment.
This is a trial application of method draft v0.2, not independent coding or a
validated final finding. It supplements the existing technical P-001 pilot;
it does not replace it or create another thesis manuscript.

### Bounded question and source register

Question: could the Analytics vendor card display a long vendor name while
keeping the amount and detail arrow inside its own horizontal page?
Exclude the later Dashboard marquee change, carousel work and unrelated changes
bundled into the same commit. The original start date and exact number of
attempts are unknown. The source log is dated 15 September; retrospective
acceptance was supplied on 4 October. File-name dates do not establish runtime dates.

| Source ID | Source and status | What it supports / does not support |
|---|---|---|
| V01 | Student-supplied earlier vendor-card image and explanation in this conversation; inspected 4 Oct | Visible right-edge crowding/clipping. Moving into an adjacent page is student-reported, not directly observable in the still image. No exact build/device link. |
| V02 | AI log `AI-2026-09-15-VENDOR-OVERFLOW-001`, with traceability `SPK-UX-VENDOR-OVERFLOW-001` | Reports the requirement, an insufficient earlier text adjustment and renewed feedback. An AI-written retrospective summary, not the original exchange; the two records are not independent witnesses. |
| V03 | Commit `25ef86cb0bfa8f9030d5d51bf5e0426cd7aafd30`, scoped diff of VendorsCard, analyticsStyles and VendorsCard tests | Page measurement, clipping, constrained name/amount space and anchored detail arrow. Before/after implementation is inspectable. This combined commit does not preserve every intermediate AI attempt. |
| V04 | Existing regression test and [4 Oct execution](sources/verification-2026-10-04.txt), [hash manifest](sources/verification-2026-10-04.json) | Tests measured widths, arrow anchoring, accessible full name and row press. The four-suite run passed 16 tests in total; not 16 tests of this defect. Native text layout and swipe rendering are not simulated faithfully. |
| V05 | Later vendor-card image supplied and inspected in this conversation on 4 Oct | The displayed long name is shortened and the amount/arrow fit in the shown viewport. Different data and unknown build mean it is not a controlled same-input before/after experiment. |
| V06 | Student's explicit retrospective statement, 4 Oct, applying to this and the carousel example | “Son hâlini denedim, istediğim gibi oldu ve bu yüzden tekrar bildirmedim.” AI translation: “I tried the final version, it was as I wanted, and that is why I did not report it again.” Scoped acceptance, not storage/security verification or proof of every screen width. |

V01/V05/V06 remain conversation-supplied evidence: no original chat export or
image archive has been added to this repository. This document is a source
locator and analysis, not their substitute. Preserve selected originals with
an appropriate privacy-reviewed transfer before external review/publication;
share redacted figures while retaining source provenance. No private paths,
merchant identities or financial amounts are reproduced here.

### Trial classification and rationale

| Field | Provisional decision | Reason and alternative explanation |
|---|---|---|
| Task | Corrective UI maintenance | Reported requirement is to keep an existing row inside its page. Unlike a new glass effect, this addresses a reported layout malfunction. |
| Human contribution | Problem identification, visual feedback and retrospective acceptance | V01/V06 directly support these roles. Rejection of the initial attempt is reported by V02; do not turn it into a preserved direct quotation. No human code review is established. |
| Software issue | Visible layout symptom supported; dynamic overflow reported | V01 shows crowding/clipping; it cannot prove the swipe mechanism or technical cause. V03 addresses a compatible layout risk. Stronger wording would require a matching runtime reproduction. |
| AI authorship of original defect | UNKNOWN | Neither the final fix nor AI-written history identifies the author of the defective baseline. Exclude from a confirmed AI-error numerator. |
| Earlier failed AI correction | REPORTED, not independently reconstructed | V02 describes it, but the original response and intermediate patch were not located. The final diff alone cannot recover that sequence. |
| Unsupported success claim | Candidate only / UNKNOWN for formal coding | V02 says test success was previously presented as visual success. Without the original statement, its wording and scope cannot be checked. |
| Baseline-to-final correction scope | Localized layout correction | Scoped diff retains the pager, data model, component contract and interaction purpose. It adjusts positioning and sizing. This does not classify the whole multi-feature commit. |
| AI-output rework | UNKNOWN | The observed baseline-to-final scope is not the same as revision of a preserved AI proposal. Missing intermediate sources prevent a defensible MINOR/SUBSTANTIAL assignment to AI-output rework. |
| Iteration count | UNKNOWN | The narrative mentions an earlier attempt; no exact count is reconstructed from commits or messages. |
| Outcome | Shown final viewport fits; user reports satisfaction | V05/V06 support this limited result. Font scaling, all page widths, landscape and all gestures remain outside the demonstrated claim. |
| Evidence | E0 narrative; E1 implementation; E2 new automated run; E4 retrospective acceptance | Still images are visual artifacts, but without build/device/scenario identity they do not complete the defined E3 protocol. E4 does not override that gap. |

### What the trial changed in the rules

1. Separate a visible static symptom from a claimed dynamic failure mechanism.
2. Record correction scope separately from AI-output rework; missing AI proposals
   must yield UNKNOWN even where the final fix looks small.
3. Treat a later image as evidence of its displayed state, not historical proof
   of when the fix first worked or a same-input experiment.
4. Attach acceptance to the specific statement and scope; do not backfill silent
   historical sessions. Preserve original language and label translations.

These clarifications are proposed in method draft v0.2. No codebook freeze,
reviewer agreement or inter-rater reliability result is claimed.

### Human-review procedure (ready to use, not yet performed)

Give the reviewer the rules and V01–V06 sources first, withholding the above
classification table until they have made their own notes. Ask them to record:
(1) the bounded issue, (2) what is directly shown versus reported, (3) whether
AI attribution is supported, (4) correction scope versus rework, and (5) the
supported outcome and missing evidence. If original conversation artifacts
cannot be supplied, explicitly restrict their review to the accessible sources.
Record reviewer/date/source versions, their label and cited reason, the initial
label, disagreement, and any resulting rule change. Leave these fields blank
until review occurs. Reviewer technical expertise and relationship to the
student should be described; supervisor feedback is not automatically an
independent second coding exercise.

### Readiness after this trial

The example is ready for student review and provisional discussion with the
supervisor, with its gaps visible. A source-complete independent review packet
still needs the selected conversation/image artifacts. Exact historical device
information may remain UNKNOWN rather than being reconstructed from memory.
Secondary-case eligibility remains open: the imported SynCinema index names
useful comparisons but its runtime/CI claims require underlying sources;
AutoSRT has no bounded episode packet established in this hub yet. Therefore
no final three-project count or completed independent review is promised.


## 4 Ekim — İkincil proje incelemesinin sonucu

[Kaynak kontrolü](REPOSITORY_AUDIT_2026-09-19.md#follow-up-source-check--2026-10-04)
önceki sayımın üzerine geçer: SynCinema için mikrofon izni ve transkripsiyon
isteğinin dağıtımda engellenmesi adayları öncelikli. AutoSRT'de iki sınırlı kod
incelemesi adayı bulundu; bu, iki tamamlanmış AI süreç vakası demek değil.
Öğretmene önerilecek kapsam: SPARK ana vaka; SynCinema seçici karşılaştırma;
AutoSRT, kaynaklarının desteklediği ölçüde teknik değişim örneği. Her projede tam
AI etkileşim dizisi şart koşulacaksa AutoSRT'nin rolünü azaltma veya iki ana vaka
seçeneği tartışılmalı. Henüz onaylanmış kapsam değişikliği yoktur.
