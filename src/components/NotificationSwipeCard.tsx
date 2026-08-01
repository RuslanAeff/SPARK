import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { BorderRadius, Spacing } from '../theme/spacing';
import { FontFamily } from '../theme/typography';

interface NotificationSwipeCardProps {
  children: React.ReactNode;
  enabled: boolean;
  deleteLabel: string;
  onDelete: () => Promise<void>;
  onWillOpen?: (methods: SwipeableMethods) => void;
  onDidClose?: (methods: SwipeableMethods) => void;
  testID?: string;
}

/**
 * Tek yönlü, güvenli swipe yüzeyi: kart sola kayar, sağda açık bir Sil aksiyonu
 * belirir. Swipe tek başına veri silmez; yanlış dokunuşa karşı aksiyona ikinci
 * onay dokunuşu gerekir. Çoklu seçimde `enabled=false` ile jest tamamen kapanır.
 */
export default function NotificationSwipeCard({
  children,
  enabled,
  deleteLabel,
  onDelete,
  onWillOpen,
  onDidClose,
  testID,
}: NotificationSwipeCardProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(scheme === 'dark'), [scheme]);
  const swipeableRef = useRef<SwipeableMethods>(null);
  const registeredMethodsRef = useRef<SwipeableMethods | null>(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (!enabled) swipeableRef.current?.close();
  }, [enabled]);

  useEffect(
    () => () => {
      const methods = registeredMethodsRef.current;
      if (methods) onDidClose?.(methods);
      registeredMethodsRef.current = null;
    },
    [onDidClose],
  );

  const performDelete = useCallback(async () => {
    if (!enabled || deletingRef.current) return;
    deletingRef.current = true;
    try {
      await onDelete();
    } catch {
      swipeableRef.current?.close();
    } finally {
      deletingRef.current = false;
    }
  }, [enabled, onDelete]);

  const renderRightAction = useCallback(
    () => (
      <Pressable
        style={({ pressed }) => [
          styles.deleteAction,
          pressed && styles.deleteActionPressed,
        ]}
        disabled={!enabled}
        pointerEvents={enabled ? 'auto' : 'none'}
        onPress={() => void performDelete()}
        accessibilityRole="button"
        accessibilityLabel={deleteLabel}
        accessibilityState={{ disabled: !enabled }}
        accessibilityElementsHidden={!enabled}
        importantForAccessibility={enabled ? 'yes' : 'no-hide-descendants'}
        testID={testID ? `${testID}-delete-action` : undefined}
      >
        <View style={styles.deleteIcon}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.deleteText}>{deleteLabel}</Text>
      </Pressable>
    ),
    [deleteLabel, enabled, performDelete, styles, testID],
  );

  return (
    <View style={styles.shadowShell}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        enabled={enabled}
        friction={1.15}
        rightThreshold={64}
        dragOffsetFromRightEdge={14}
        overshootRight={false}
        renderRightActions={renderRightAction}
        onSwipeableWillOpen={() => {
          if (swipeableRef.current) {
            registeredMethodsRef.current = swipeableRef.current;
            onWillOpen?.(swipeableRef.current);
          }
        }}
        onSwipeableOpen={() => {
          if (enabled) void Haptics.selectionAsync();
        }}
        onSwipeableClose={() => {
          const methods = registeredMethodsRef.current ?? swipeableRef.current;
          if (methods) onDidClose?.(methods);
          registeredMethodsRef.current = null;
        }}
        containerStyle={styles.swipeClip}
        childrenContainerStyle={styles.children}
        testID={testID}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    shadowShell: {
      marginBottom: 10,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surface,
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.14 : 0.045,
          shadowRadius: 8,
        },
        android: {
          elevation: isDark ? 0 : 1,
        },
      }),
    },
    swipeClip: {
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    children: {
      backgroundColor: Colors.surface,
    },
    deleteAction: {
      width: 88,
      height: '100%',
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: isDark ? '#B4232B' : '#D92D36',
    },
    deleteActionPressed: {
      opacity: 0.82,
    },
    deleteIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    deleteText: {
      color: '#FFFFFF',
      fontSize: 12,
      lineHeight: 15,
      fontFamily: FontFamily.semiBold,
      letterSpacing: 0.15,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
  });
