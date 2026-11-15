// S.P.A.R.K. — Analiz kart düzenleme: sürükleyerek sıralanan panel
//
// `app/(tabs)/analytics.tsx` içinden taşındı (UI denetimi CQ-02 ilk adımı).
//
// FN-04: Hareket yalnız bırakmada (`release`) temizleniyordu. Üst ScrollView,
// sekme kaydırıcısı ya da sistem jesti hareketi devralırsa (`terminate`) 16 ms'lik
// otomatik kaydırma zamanlayıcısı çalışmaya devam edebiliyor ve kart
// "sürükleniyor" görünümünde kalabiliyordu. Bırakma ve kesilme artık aynı
// temizliği yapar; sürükleme sürerken hareket başka bileşene devredilmez.
//
// A11Y-02/03: tutamacın dokunma alanı en az 44 dp; ekran okuyucuda "ayarlanabilir"
// rolüyle yukarı/aşağı kaydırma kartı bir sıra taşır.
import React, { useEffect, useRef } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { BorderRadius } from '../../theme/spacing';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const AUTO_SCROLL_EDGE = 100;
const AUTO_SCROLL_SPEED = 10;
const HANDLE_TOUCH_WIDTH = 44;

export interface DraggablePanelProps {
  children: React.ReactNode;
  id: string;
  isEditing: boolean;
  shiftOffset: number;
  isDragActive: boolean;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, dy: number) => void;
  onDragEnd: (id: string) => void;
  onLayout?: (id: string, height: number) => void;
  /** Ekran okuyucu: kartı bir sıra yukarı (-1) veya aşağı (+1) taşır. */
  onMoveBy?: (id: string, delta: -1 | 1) => void;
  position?: number;
  total?: number;
  scrollRef?: React.RefObject<ScrollView | null>;
  scrollOffsetRef?: React.RefObject<number>;
  reorderAccessibilityLabel?: string;
}

export default function DraggablePanel({
  children, id, isEditing,
  shiftOffset, isDragActive,
  onDragStart, onDragMove, onDragEnd, onLayout, onMoveBy,
  position, total,
  scrollRef, scrollOffsetRef,
  reorderAccessibilityLabel,
}: DraggablePanelProps) {
  const pan = useRef(new RNAnimated.ValueXY()).current;
  const shiftY = useRef(new RNAnimated.Value(0)).current;
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const propsRef = useRef({ onDragStart, onDragMove, onDragEnd, id, scrollRef, scrollOffsetRef });
  propsRef.current = { onDragStart, onDragMove, onDragEnd, id, scrollRef, scrollOffsetRef };

  useEffect(() => {
    RNAnimated.spring(shiftY, {
      toValue: shiftOffset,
      friction: 8,
      tension: 120,
      useNativeDriver: false,
    }).start();
  }, [shiftOffset, shiftY]);

  const stopAutoScrollRef = useRef(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  });

  useEffect(() => {
    const stop = stopAutoScrollRef.current;
    return () => stop();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Sürükleme sürerken üst ScrollView/sekme kaydırıcısı hareketi almasın.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        propsRef.current.onDragStart(propsRef.current.id);
      },
      onPanResponderMove: (evt, gesture) => {
        pan.setValue({ x: 0, y: gesture.dy });
        propsRef.current.onDragMove(propsRef.current.id, gesture.dy);

        const touchY = evt.nativeEvent.pageY;
        const { scrollRef: sRef, scrollOffsetRef: soRef } = propsRef.current;
        stopAutoScrollRef.current();

        if (touchY < AUTO_SCROLL_EDGE && sRef?.current) {
          autoScrollTimer.current = setInterval(() => {
            const cur = soRef?.current ?? 0;
            sRef.current?.scrollTo({ y: Math.max(0, cur - AUTO_SCROLL_SPEED), animated: false });
          }, 16);
        } else if (touchY > SCREEN_HEIGHT - AUTO_SCROLL_EDGE && sRef?.current) {
          autoScrollTimer.current = setInterval(() => {
            const cur = soRef?.current ?? 0;
            sRef.current?.scrollTo({ y: cur + AUTO_SCROLL_SPEED, animated: false });
          }, 16);
        }
      },
      onPanResponderRelease: () => finishDrag(),
      // FN-04: sistem veya üst bileşen hareketi kestiğinde de aynı temizlik.
      onPanResponderTerminate: () => finishDrag(),
    }),
  ).current;

  function finishDrag() {
    stopAutoScrollRef.current();
    propsRef.current.onDragEnd(propsRef.current.id);
    RNAnimated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 8, useNativeDriver: false }).start();
  }

  return (
    <RNAnimated.View
      onLayout={(e) => onLayout?.(id, e.nativeEvent.layout.height)}
      style={{
        transform: [{ translateY: isDragActive ? pan.y : shiftY }],
        zIndex: isDragActive ? 1000 : 1,
        position: 'relative',
        marginVertical: 4,
        opacity: isDragActive ? 0.88 : 1,
        ...(isDragActive ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 20,
        } : {}),
      }}
    >
      {children}
      {isEditing && (
        <View
          {...panResponder.panHandlers}
          testID={`drag-handle-${id}`}
          style={styles.hitArea}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={reorderAccessibilityLabel}
          accessibilityValue={position != null && total != null ? { min: 1, max: total, now: position } : undefined}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            // Yukarı kaydırma (increment) kartı listede yukarı taşır.
            if (event.nativeEvent.actionName === 'increment') onMoveBy?.(id, -1);
            if (event.nativeEvent.actionName === 'decrement') onMoveBy?.(id, 1);
          }}
        >
          <View
            style={[
              styles.pill,
              {
                backgroundColor: isDragActive ? Colors.primaryGlow : 'transparent',
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: isDragActive ? Colors.primary : Colors.border,
                ...(isDragActive
                  ? Platform.select({
                      ios: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                      },
                      android: { elevation: 3 },
                      default: {},
                    })
                  : {}),
              },
            ]}
          >
            <MaterialCommunityIcons
              name="drag-vertical"
              color={isDragActive ? Colors.primary : Colors.textMuted}
              size={16}
            />
          </View>
        </View>
      )}
    </RNAnimated.View>
  );
}

/** Kart düzenleme modunda sıra tutamacı — kompakt görünüm, geniş dokunma alanı. */
const styles = StyleSheet.create({
  hitArea: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: HANDLE_TOUCH_WIDTH + 8,
    minHeight: HANDLE_TOUCH_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
    minHeight: 28,
  },
});
