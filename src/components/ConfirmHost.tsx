// S.P.A.R.K. — Kök onay sunucusu (UI denetimi UX-09)
//
// Ekran dışındaki kod (ör. yapay zekâ aktarım onayı) bir karar penceresi
// gösterip sonucu `Promise` ile bekleyebilsin diye kökte tek bir temalı
// `ConfirmModal` tutulur. Eskiden bu onay sistem `Alert` penceresiyle
// soruluyordu: uygulamanın değil telefonun temasını izliyor, hâle desenini
// taşımıyordu.
//
// Kurallar:
//   • Yalnız onay düğmesi `true` döndürür; vazgeç, geri tuşu, karartı ve
//     `dismiss()` (ör. AbortSignal) `false` döndürür.
//   • Aynı anda tek pencere: yeni istek gelirse önceki `false` ile kapanır.
//   • Sunucu takılı değilse `requestConfirmation` `null` döner; çağıran kendi
//     yedeğine (sistem penceresi) düşer, onay asla atlanmaz.
import React, { useEffect, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ConfirmModal, { type ConfirmTone } from './ConfirmModal';

export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmTone;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

interface ActiveRequest extends ConfirmationRequest {
  id: number;
  resolve: (allowed: boolean) => void;
}

type Presenter = (request: ActiveRequest) => void;
type Dismisser = (id: number) => void;

let presenter: Presenter | null = null;
let dismisser: Dismisser | null = null;
let nextId = 1;

export interface ConfirmationHandle {
  result: Promise<boolean>;
  /** Pencereyi `false` sonucuyla kapatır (ör. işlem iptal edildi). */
  dismiss: () => void;
}

export function requestConfirmation(request: ConfirmationRequest): ConfirmationHandle | null {
  if (!presenter || !dismisser) return null;
  const id = nextId++;
  const show = presenter;
  const hide = dismisser;
  let resolveResult: (allowed: boolean) => void = () => undefined;
  const result = new Promise<boolean>(resolve => { resolveResult = resolve; });
  show({ ...request, id, resolve: resolveResult });
  return { result, dismiss: () => hide(id) };
}

export default function ConfirmHost() {
  const [active, setActive] = useState<ActiveRequest | null>(null);
  // Kapanış animasyonu sürerken metin boşalmasın: son içerik korunur.
  const [content, setContent] = useState<ConfirmationRequest | null>(null);
  const activeRef = useRef<ActiveRequest | null>(null);

  useEffect(() => {
    const settle = (allowed: boolean) => {
      const current = activeRef.current;
      if (!current) return;
      activeRef.current = null;
      setActive(null);
      current.resolve(allowed);
    };
    presenter = (request) => {
      settle(false);
      activeRef.current = request;
      setActive(request);
      setContent(request);
    };
    dismisser = (id) => {
      if (activeRef.current?.id === id) settle(false);
    };
    return () => {
      presenter = null;
      dismisser = null;
      settle(false);
    };
  }, []);

  const settleActive = (allowed: boolean) => {
    const current = activeRef.current;
    if (!current) return;
    activeRef.current = null;
    setActive(null);
    current.resolve(allowed);
  };

  return (
    <ConfirmModal
      visible={active !== null}
      title={content?.title ?? ''}
      message={content?.message ?? ''}
      confirmLabel={content?.confirmLabel ?? ''}
      cancelLabel={content?.cancelLabel ?? ''}
      tone={content?.tone}
      icon={content?.icon}
      confirmTestID="confirm-host-confirm"
      cancelTestID="confirm-host-cancel"
      onConfirm={() => settleActive(true)}
      onCancel={() => settleActive(false)}
    />
  );
}
