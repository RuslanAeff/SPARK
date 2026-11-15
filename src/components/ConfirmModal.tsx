// S.P.A.R.K. — Genel amaçlı onay penceresi
//
// Dışa aktarım, dil değişimi, bütçe onarımı gibi nötr/destekleyici kararlar
// için ortadaki karar penceresi. Görsel dil, yaşam döngüsü ve erişilebilirlik
// `DecisionModal` içindedir (UI denetimi CQ-05); bu dosya yalnız mevcut API'yi
// korur. Silme onayı için `GlassDeleteModal` kullanılır.
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import DecisionModal, { getDecisionColors } from './DecisionModal';

export type ConfirmTone = 'primary' | 'warning';

export interface ConfirmModalProps {
  visible: boolean;
  /** Başlık — kısa ve bold. */
  title: string;
  /** Açıklama — 1-3 satır; uzarsa pencere içinde kayar. */
  message: string;
  /** Onay butonunun metni. */
  confirmLabel: string;
  /** Vazgeç butonunun metni. */
  cancelLabel: string;
  /** Simge rengi / onay butonu rengi. */
  tone?: ConfirmTone;
  /** Başlık üstünde gösterilecek MaterialCommunityIcons adı. */
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onCancel: () => void;
  onConfirm: () => void;
  onDismiss?: () => void;
  /** Mesajın altında, butonların üstünde ek içerik (ör. parola alanları). */
  children?: React.ReactNode;
  /** true iken onay butonu basılamaz ve soluk görünür. */
  confirmDisabled?: boolean;
  confirmTestID?: string;
  cancelTestID?: string;
}

/**
 * Onay düğmesinin dolgu ve yazı rengi (DS-03): birincil ton
 * `primaryAction`/`onPrimary`, uyarı tonu `warning`/`onWarning`.
 */
export function getConfirmButtonColors(tone: ConfirmTone): { background: string; text: string } {
  const { background, text } = getDecisionColors(tone);
  return { background, text };
}

export default function ConfirmModal({ tone = 'primary', icon = 'help-circle-outline', ...props }: ConfirmModalProps) {
  return <DecisionModal {...props} tone={tone} icon={icon} />;
}
