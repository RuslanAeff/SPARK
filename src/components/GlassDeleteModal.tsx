// S.P.A.R.K. — Sade, tema uyumlu silme onayı
//
// Silme kararı `DecisionModal`'ın `danger` tonudur (UI denetimi CQ-05): tehlike
// hâlesi, çöp kutusu çapası, yalnız metinden oluşan "Sil" ve hayalet "İptal".
// Bu dosya mevcut API'yi ve test kimliklerini korur.
import React from 'react';

import DecisionModal from './DecisionModal';
import { useLanguage } from '../i18n/LanguageContext';

interface GlassDeleteModalProps {
  visible: boolean;
  title?: string;
  message: string;
  onCancel: () => void;
  onDelete: () => void;
  onDismiss?: () => void;
}

export default function GlassDeleteModal({
  visible,
  title,
  message,
  onCancel,
  onDelete,
  onDismiss,
}: GlassDeleteModalProps) {
  const { t } = useLanguage();
  return (
    <DecisionModal
      visible={visible}
      tone="danger"
      icon="trash-can-outline"
      title={title ?? t('delete_confirmation_title')}
      message={message}
      cancelLabel={t('cancel')}
      confirmLabel={t('delete')}
      onCancel={onCancel}
      onConfirm={onDelete}
      onDismiss={onDismiss}
      cardTestID="delete-confirm-modal"
      cancelTestID="delete-confirm-cancel"
      confirmTestID="delete-confirm-action"
    />
  );
}
