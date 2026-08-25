import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import SettingsDataScreen from '../../../app/settings-data';
import { VendorDao } from '../../db/vendorDao';
import { SparkToast } from '../SparkToast';

const mockTriggerRefresh = jest.fn();

const vendors = [
  {
    id: 1,
    name: 'Alpha Market',
    logo_uri: null,
    default_category_id: null,
    created_at: '2026-08-01',
  },
  {
    id: 2,
    name: 'Beta Store',
    logo_uri: null,
    default_category_id: null,
    created_at: '2026-08-02',
  },
  {
    id: 3,
    name: 'Gamma Shop',
    logo_uri: null,
    default_category_id: null,
    created_at: '2026-08-03',
  },
];

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('react-native-reanimated');

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const templates: Record<string, string> = {
        vendor_selected_count: '{count} vendors selected',
        vendor_delete_selected: 'Delete selected ({count})',
        confirm_delete_vendors_warning:
          'Delete {vendorCount} vendors and {expenseCount} linked transactions',
        confirm_delete_vendors_no_expenses: 'Delete {vendorCount} vendors',
        vendors_deleted_bulk: '{count} vendors deleted',
      };
      let value = templates[key] ?? key;
      Object.entries(params ?? {}).forEach(([name, replacement]) => {
        value = value.replace(`{${name}}`, replacement);
      });
      return value;
    },
  }),
}));

jest.mock('../../context/RefreshContext', () => ({
  useRefresh: () => ({ refreshKey: 0, triggerRefresh: mockTriggerRefresh }),
}));

jest.mock('../../db/vendorDao', () => ({
  VendorDao: {
    getAll: jest.fn(),
    updateLogo: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    countExpenses: jest.fn(),
    countExpensesForVendors: jest.fn(),
  },
}));

jest.mock('../BackupSection', () => () => null);
jest.mock('../VendorOptionsSheet', () => () => null);
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../SettingsInfoHint', () => ({
  SettingsInfoHintModal: () => null,
  SettingsInfoIconButton: () => null,
}));
jest.mock('../GlassDeleteModal', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return ({ visible, title, message, onDelete }: any) => {
    if (!visible) return null;
    return React.createElement(
      View,
      { testID: 'vendor-delete-modal' },
      React.createElement(Text, null, title),
      React.createElement(Text, null, message),
      React.createElement(
        Pressable,
        { testID: 'vendor-delete-modal-confirm', onPress: onDelete },
        React.createElement(Text, null, 'confirm'),
      ),
    );
  };
});

describe('SettingsDataScreen vendor multi-selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (VendorDao.getAll as jest.Mock).mockResolvedValue(vendors);
    (VendorDao.countExpensesForVendors as jest.Mock).mockResolvedValue(0);
    (VendorDao.deleteMany as jest.Mock).mockResolvedValue(0);
  });

  it('enters an explicit selection mode and toggles individual vendors', async () => {
    const screen = await render(<SettingsDataScreen />);
    await waitFor(() => expect(screen.getByTestId('vendor-tile-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('vendor-multi-select-enter'));
    expect(screen.getByTestId('vendor-selection-delete').props.accessibilityState)
      .toEqual({ disabled: true });

    await fireEvent.press(screen.getByTestId('vendor-tile-1'));
    await fireEvent.press(screen.getByTestId('vendor-tile-3'));

    expect(screen.getByText('2 vendors selected')).toBeTruthy();
    expect(screen.getByTestId('vendor-tile-1').props.accessibilityState)
      .toEqual({ checked: true });
    expect(screen.getByTestId('vendor-tile-2').props.accessibilityState)
      .toEqual({ checked: false });
    expect(screen.getByTestId('vendor-tile-3').props.accessibilityState)
      .toEqual({ checked: true });
  });

  it('selects and clears every vendor from one action', async () => {
    const screen = await render(<SettingsDataScreen />);
    await waitFor(() => expect(screen.getByTestId('vendor-tile-1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('vendor-multi-select-enter'));

    await fireEvent.press(screen.getByTestId('vendor-selection-toggle-all'));
    expect(screen.getByText('3 vendors selected')).toBeTruthy();
    vendors.forEach(vendor => {
      expect(screen.getByTestId(`vendor-tile-${vendor.id}`).props.accessibilityState)
        .toEqual({ checked: true });
    });

    await fireEvent.press(screen.getByTestId('vendor-selection-toggle-all'));
    expect(screen.getByText('0 vendors selected')).toBeTruthy();
  });

  it('shows aggregate impact and deletes the selected vendors atomically after confirmation', async () => {
    (VendorDao.countExpensesForVendors as jest.Mock).mockResolvedValue(5);
    (VendorDao.deleteMany as jest.Mock).mockResolvedValue(2);
    (VendorDao.getAll as jest.Mock)
      .mockResolvedValueOnce(vendors)
      .mockResolvedValueOnce([vendors[2]]);
    const screen = await render(<SettingsDataScreen />);
    await waitFor(() => expect(screen.getByTestId('vendor-tile-1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('vendor-multi-select-enter'));
    await fireEvent.press(screen.getByTestId('vendor-tile-1'));
    await fireEvent.press(screen.getByTestId('vendor-tile-2'));

    await fireEvent.press(screen.getByTestId('vendor-selection-delete'));
    await waitFor(() => {
      expect(VendorDao.countExpensesForVendors).toHaveBeenCalledWith([1, 2]);
      expect(screen.getByText('Delete 2 vendors and 5 linked transactions')).toBeTruthy();
    });
    expect(VendorDao.deleteMany).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('vendor-delete-modal-confirm'));
    await waitFor(() => expect(VendorDao.deleteMany).toHaveBeenCalledWith([1, 2]));
    await waitFor(() => expect(screen.queryByTestId('vendor-selection-panel')).toBeNull());
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
    expect(SparkToast.show).toHaveBeenCalledWith(
      '2 vendors deleted',
      'success',
      'vendor_deleted_desc',
    );
  });
});
