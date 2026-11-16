// S.P.A.R.K. — Anahtar (Switch) renkleri (UI denetimi DS-10)
//
// Anahtarlar iki farklı açık iz saydamlığı (`55`/`88`) ve iki farklı kapalı iz
// (`surfaceLight`/`borderLight`) kullanıyordu; `surfaceLight` zemindeki kapalı
// iz neredeyse görünmüyordu. Tüm anahtarlar bu çifti kullanır.
import { Colors } from './colors';

export function switchColors(on: boolean, disabled = false) {
  return {
    trackColor: { false: Colors.borderLight, true: Colors.primary + '88' },
    thumbColor: on && !disabled ? Colors.primary : Colors.textMuted,
    ios_backgroundColor: Colors.borderLight,
  };
}
