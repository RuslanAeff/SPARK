// S.P.A.R.K. — Analiz kartı: Kişisel enflasyon
//
// Kartın tek işi bir soruyu cevaplamak: harcaman değiştiyse bunun ne kadarı
// fiyat, ne kadarı sen? Bu yüzden tek bir yüzde göstermez; ayrışmayı ve
// ayrışmanın hangi ürünlerden geldiğini gösterir.
//
// Okuma sırası bilinçlidir: (1) manşet = kişisel enflasyon, kartın kimliği;
// (2) oran şeridi = iki etkinin ağırlığı, sayı okumadan; (3) satırlar = aynı
// ayrışmanın parası ve yüzdesi; (4) toplam; (5) hangi ürünlerden geldiği;
// (6) sepetin temsil gücü. Renkli noktalar şeridin göstergesidir — dekoratif
// değil; artı/eksi anlamı ise SAYININ renginde taşınır, noktada değil.
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AnimatedCard from '../AnimatedCard';
import { SettingsInfoHintModal, SettingsInfoIconButton } from '../SettingsInfoHint';
import { useLanguage } from '../../i18n/LanguageContext';
import { intlLocaleForLanguage } from '../../i18n/languageOptions';
import { Colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import type { PersonalInflationResult } from '../../utils/personalInflation';
import type { BaseCardProps } from './shared';

interface PersonalInflationCardProps extends BaseCardProps {
  inflationInfo: PersonalInflationResult;
}

/**
 * Sepet, dönemin kalemli harcamasının bu oranından azını kapsıyorsa sayı
 * dönemi temsil etmiyor demektir; kapsam notu uyarı tonuna geçer.
 */
const LOW_COVERAGE_THRESHOLD = 50;

// Yüzde işaretinin yeri dile göre değişir (TR "%12", EN "12%"). Metnin içine
// gömmek yerine Intl'e bırakılır: çeviri dosyalarındaki `%{...}` kalıbı zaten
// interpolasyon deseniyle çakışıyor.
function makePercentFormatter(locale: string) {
  const signed = new Intl.NumberFormat(locale, {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 1,
  });
  const plain = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  const magnitude = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  return {
    signed: (value: number) => signed.format((Math.abs(value) < 0.05 ? 0 : value) / 100),
    plain: (value: number) => plain.format(value / 100),
    magnitude: (value: number) => magnitude.format(Math.abs(value) / 100),
  };
}

function toneFor(value: number): string {
  if (value > 0.05) return Colors.danger;
  if (value < -0.05) return Colors.success;
  return Colors.textSecondary;
}

function PersonalInflationCard({
  styles,
  t,
  currency,
  inflationInfo,
}: PersonalInflationCardProps) {
  const { language } = useLanguage();
  const percent = React.useMemo(
    () => makePercentFormatter(intlLocaleForLanguage(language)),
    [language],
  );
  const [infoVisible, setInfoVisible] = React.useState(false);
  const header = (
    <View style={styles.inflationHeader}>
      <View style={styles.inflationHeaderLeft}>
        <View style={[styles.inflationHeaderIcon, { backgroundColor: Colors.info + '1F' }]}>
          <MaterialCommunityIcons name="basket-outline" size={16} color={Colors.info} />
        </View>
        <Text style={styles.cardHeaderTitle}>{t('inflation_card_title')}</Text>
      </View>
      <SettingsInfoIconButton
        onPress={() => setInfoVisible(true)}
        accessibilityLabel={t('inflation_info_a11y')}
      />
    </View>
  );

  const infoModal = (
    <SettingsInfoHintModal
      visible={infoVisible}
      onClose={() => setInfoVisible(false)}
      title={t('inflation_card_title')}
      paragraphs={[t('inflation_info_basket'), t('inflation_info_coverage')]}
    />
  );

  if (inflationInfo.status !== 'ready') {
    const isBasketIssue = inflationInfo.status === 'insufficient_basket';
    return (
      <>
        <AnimatedCard delay={240} style={styles.section}>
          {header}
          <View style={styles.inflationEmptyWrap} testID="inflation-empty">
            <MaterialCommunityIcons name="basket-off-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.inflationEmptyTitle}>
              {isBasketIssue
                ? t('inflation_empty_basket_title')
                : t('inflation_empty_history_title')}
            </Text>
            <Text style={styles.inflationEmptyHint}>
              {isBasketIssue
                ? t('inflation_empty_basket_hint')
                : t('inflation_empty_history_hint')}
            </Text>
          </View>
        </AnimatedCard>
        {infoModal}
      </>
    );
  }

  const {
    inflationPct,
    listPriceEffectPct,
    listPriceEffectAmount,
    discountEffectPct,
    discountEffectAmount,
    hasDiscountSignal,
    totalChangePct,
    behaviorEffectPct,
    priceEffectAmount,
    behaviorEffectAmount,
    baseValue,
    currentValue,
    basketSize,
    coveragePct,
    contributors,
  } = inflationInfo;

  // Sepette indirim verisi varsa fiyat etkisi ikiye ayrılır: raftaki etiket
  // fiyatı ile kampanya. "Ucuzladı" ile "kampanya yakaladım" aynı şey değil ve
  // ikincisi kalıcı bir kazanç değildir. Veri yoksa kart iki satıra iner.
  const segments = hasDiscountSignal
    ? [
        {
          key: 'list',
          label: t('inflation_list_price_effect'),
          amount: listPriceEffectAmount,
          pct: listPriceEffectPct,
          color: Colors.info,
          testID: 'inflation-list-effect',
        },
        {
          key: 'discount',
          label: t('inflation_discount_effect'),
          amount: discountEffectAmount,
          pct: discountEffectPct,
          color: Colors.warning,
          testID: 'inflation-discount-effect',
        },
        {
          key: 'basket',
          label: t('inflation_behavior_effect'),
          amount: behaviorEffectAmount,
          pct: behaviorEffectPct,
          color: Colors.secondary,
          testID: 'inflation-behavior-effect',
        },
      ]
    : [
        {
          key: 'price',
          label: t('inflation_price_effect'),
          amount: priceEffectAmount,
          pct: inflationPct,
          color: Colors.info,
          testID: 'inflation-price-effect',
        },
        {
          key: 'basket',
          label: t('inflation_behavior_effect'),
          amount: behaviorEffectAmount,
          pct: behaviorEffectPct,
          color: Colors.secondary,
          testID: 'inflation-behavior-effect',
        },
      ];

  // Şerit etkilerin BÜYÜKLÜĞÜNÜ paylaştırır; işaretler zaten sayılarda.
  const weightSum = segments.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const totalAmount = currentValue - baseValue;
  const lowCoverage = coveragePct < LOW_COVERAGE_THRESHOLD;

  return (
    <>
    <AnimatedCard delay={240} style={styles.section}>
      {header}

      <View style={styles.inflationHeroRow}>
        <Text
          testID="inflation-hero"
          style={[styles.inflationHeroValue, { color: toneFor(inflationPct) }]}
        >
          {percent.signed(inflationPct)}
        </Text>
        <Text style={styles.inflationHeroCaption}>{t('inflation_hero_caption')}</Text>
      </View>

      <Text style={styles.inflationSentence}>
        {totalChangePct >= 0
          ? t('inflation_sentence_up', { total: percent.magnitude(totalChangePct) })
          : t('inflation_sentence_down', { total: percent.magnitude(totalChangePct) })}
      </Text>

      <View style={styles.inflationBar} testID="inflation-bar">
        {segments.map(item => (
          <View
            key={item.key}
            style={[
              styles.inflationBarSegment,
              {
                width: `${weightSum > 0 ? (Math.abs(item.amount) / weightSum) * 100 : 100 / segments.length}%`,
                backgroundColor: item.color,
              },
            ]}
          />
        ))}
      </View>

      {segments.map(item => (
        <View key={item.key} style={styles.inflationRow} testID={item.testID}>
          <View style={[styles.inflationRowSwatch, { backgroundColor: item.color }]} />
          <Text style={styles.inflationRowLabel} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={styles.inflationRowAmount}>
            {formatCurrency(item.amount, currency)}
          </Text>
          <Text style={[styles.inflationRowPct, { color: toneFor(item.pct) }]}>
            {percent.signed(item.pct)}
          </Text>
        </View>
      ))}

      <View style={styles.inflationTotalRow} testID="inflation-total">
        <Text style={styles.inflationTotalLabel} numberOfLines={1}>
          {t('inflation_total_change')}
        </Text>
        <Text style={styles.inflationRowAmount}>{formatCurrency(totalAmount, currency)}</Text>
        <Text style={[styles.inflationRowPct, { color: toneFor(totalChangePct) }]}>
          {percent.signed(totalChangePct)}
        </Text>
      </View>

      {contributors.length > 0 && (
        <View style={styles.inflationDriversWrap}>
          <Text style={styles.inflationDriversTitle}>{t('inflation_drivers_title')}</Text>
          {contributors.map(item => (
            <View key={item.key} style={styles.inflationDriverRow}>
              <Text style={styles.inflationDriverName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.inflationDriverPrices}>
                {formatCurrency(item.basePrice, currency)} → {formatCurrency(item.currentPrice, currency)}
              </Text>
              <Text
                style={[styles.inflationDriverPct, { color: toneFor(item.priceChangePct) }]}
              >
                {percent.signed(item.priceChangePct)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inflationCoverage} testID="inflation-coverage">
        <MaterialCommunityIcons
          name={lowCoverage ? 'alert-outline' : 'information-outline'}
          size={13}
          color={lowCoverage ? Colors.warning : Colors.textMuted}
        />
        <Text
          testID="inflation-coverage-text"
          style={[
            styles.inflationCoverageText,
            lowCoverage && styles.inflationCoverageTextLow,
          ]}
        >
          {t('inflation_coverage_note_short', {
            count: basketSize.toString(),
            coverage: percent.plain(coveragePct),
          })}
        </Text>
      </View>
    </AnimatedCard>
    {infoModal}
    </>
  );
}

export default React.memo(PersonalInflationCard);
