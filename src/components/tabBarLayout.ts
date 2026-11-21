// S.P.A.R.K. — Alt sekme çubuğunun geometri hesabı (saf fonksiyon, test edilir)
//
// Ürün sahibi kararı (21 Kasım 2026): seçili sekmenin vurgusu ikonu VE yazıyı
// birlikte içine alan, yumuşak köşeli bir dikdörtgendir (cam dokusu borç/ek
// gelir sekmeleriyle aynı); çubuğun kendisi de aynı dilde köşeli dikdörtgendir
// (eskiden uçları tam yuvarlak "hap" idi). Hesap kuralları:
//   • Seçici 52 dp yüksek; 65 dp çubukta üstte/altta `SELECTOR_INSET` (6,5 dp)
//     boşluk kalır. Uç sekmelerde yan boşluk da aynı 6,5 dp'dir.
//   • Eş merkezli köşeler: çubuk yarıçapı = seçici yarıçapı + boşluk
//     (16 + 6,5 = 22,5 dp). Seçici uç sekmede çubuğa her yönden eşit boşlukla
//     oturur (`selectorBarClearance` = 6,5 dp, testte doğrulanır).
//   • Yan yana hücrelerdeki seçici konumları arasında 2 dp ara kalır.
//   • Yazı seçicinin içinde `LABEL_INSET` pay bırakır. Beş etiket TEK ve ORTAK
//     boyutla yazılır; en uzun etiket sığmazsa hepsi aynı oranda küçülür
//     (en fazla %10). Ölçüm gerçek çizimden yapılır (sistem yazı büyütmesi dahil).
//
// Inter Medium 10 px, harf aralığı 0 ile font dosyasından ölçülen en uzun
// etiketler: EN "Transactions" 62,3 dp · AZ "Əməliyyatlar" 59,9 dp ·
// RU "Настройки" 53,5 dp · TR "Dashboard" 52,2 dp.

/** Bu genişliğin altındaki telefonlar "dar" sayılır (ör. 360 dp). */
export const NARROW_WINDOW_WIDTH = 380;

/**
 * Çubuğun ekran kenarına uzaklığı. Kartlar 20 dp içeride (ScreenPadding);
 * çubuk her iki yanda onlardan 8 dp daha geniş durur ki kartla aynı hizada
 * "yapışık" görünmesin (ürün sahibi geri bildirimi, 21 Kasım 2026).
 */
export function tabBarSideMargin(windowWidth: number): number {
  return windowWidth < NARROW_WINDOW_WIDTH ? 8 : 12;
}

export const SELECTOR_GAP = 2;
export const SELECTOR_HEIGHT = 52;
export const SELECTOR_RADIUS = 16;
/** Seçici ile çubuk kenarı arasındaki eşit boşluk (65 − 52) / 2. */
export const SELECTOR_INSET = 6.5;
/** Hücrelerin çubuk kenarından içeriliği: seçicinin yan boşluğu da 6,5 dp olsun. */
export const BAR_SIDE_PADDING = SELECTOR_INSET - SELECTOR_GAP / 2;
/** Eş merkezli dış köşe: iç yarıçap + boşluk. */
export const BAR_RADIUS = SELECTOR_RADIUS + SELECTOR_INSET;
/** Yazının seçici kenarına olan en küçük payı (her yan). */
export const LABEL_INSET = 3;
export const MIN_LABEL_SCALE = 0.9;

export interface TabBarGeometry {
  cellWidth: number;
  selectorWidth: number;
  labelWidth: number;
  /** Bütün etiketlere uygulanacak ortak ölçek (MIN_LABEL_SCALE…1). */
  labelScale: number;
}

/**
 * @param barWidth Çubuğun dış genişliği.
 * @param count Sekme sayısı.
 * @param naturalLabelWidths Etiketlerin taban boyutta ölçülen doğal genişlikleri;
 *   henüz ölçülmediyse boş dizi (ölçek 1 kabul edilir).
 */
export function computeTabBarGeometry(
  barWidth: number,
  count: number,
  naturalLabelWidths: readonly number[],
): TabBarGeometry {
  const cellWidth = count > 0 ? Math.max(0, (barWidth - BAR_SIDE_PADDING * 2) / count) : 0;
  const selectorWidth = Math.max(0, cellWidth - SELECTOR_GAP);
  const labelWidth = Math.max(0, selectorWidth - LABEL_INSET * 2);
  const widest = naturalLabelWidths.length > 0 ? Math.max(...naturalLabelWidths) : 0;
  const labelScale = widest > labelWidth && widest > 0
    ? Math.max(MIN_LABEL_SCALE, labelWidth / widest)
    : 1;
  return { cellWidth, selectorWidth, labelWidth, labelScale };
}

/** Seçicinin `index` sekmesindeki sol konumu (çubuk içi). */
export function selectorOffset(index: number, geometry: TabBarGeometry): number {
  return BAR_SIDE_PADDING + index * geometry.cellWidth + SELECTOR_GAP / 2;
}

/**
 * Uç sekmedeki seçicinin dış çizgisi ile çubuğun köşeli kenarı arasındaki en
 * dar boşluk (dp). Çubuk `BAR_RADIUS` köşeli bir dikdörtgendir; simetri
 * nedeniyle sol üst ve sol alt köşe yeterlidir.
 */
export function selectorBarClearance(barWidth: number, barHeight: number, geometry: TabBarGeometry): number {
  const radius = Math.min(BAR_RADIUS, barHeight / 2);
  const left = selectorOffset(0, geometry);
  const top = (barHeight - SELECTOR_HEIGHT) / 2;
  // Nokta ile köşeli dikdörtgenin iç kenarı arasındaki uzaklık.
  const inside = (x: number, y: number) => {
    const cx = Math.min(Math.max(x, radius), barWidth - radius);
    const cy = Math.min(Math.max(y, radius), barHeight - radius);
    const corner = radius - Math.hypot(x - cx, y - cy);
    return Math.min(corner, x, y, barWidth - x, barHeight - y);
  };
  let clearance = Infinity;
  for (let degree = 0; degree <= 90; degree += 1) {
    const angle = (degree * Math.PI) / 180;
    const x = left + SELECTOR_RADIUS - SELECTOR_RADIUS * Math.cos(angle);
    clearance = Math.min(
      clearance,
      inside(x, top + SELECTOR_RADIUS - SELECTOR_RADIUS * Math.sin(angle)),
      inside(x, top + SELECTOR_HEIGHT - SELECTOR_RADIUS + SELECTOR_RADIUS * Math.sin(angle)),
    );
  }
  return clearance;
}
