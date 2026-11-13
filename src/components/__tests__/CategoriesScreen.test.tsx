import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import CategoriesScreen from '../../../app/categories';
import { CategoryDao } from '../../db/categoryDao';
import { SparkToast } from '../SparkToast';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ back: jest.fn() }),
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Medium: 'medium' } }));
jest.mock('../../db/categoryDao', () => ({
  CategoryDao: {
    getTree: jest.fn(), create: jest.fn(), delete: jest.fn(),
    getUsageCount: jest.fn(), deleteMovingUsageToOther: jest.fn(),
  },
}));
jest.mock('../../theme/themeStore', () => ({ useThemeRevision: () => 0, useAppTheme: () => 'light' }));
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, tc: (value: string) => value }),
}));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../GlassDeleteModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  const { Text } = require('react-native');
  return ({ visible, title, message, onDelete }: any) => (visible
    ? React.createElement(View, null,
      title ? React.createElement(Text, null, title) : null,
      React.createElement(Text, null, message),
      React.createElement(Pressable, { testID: 'confirm-category-delete', onPress: onDelete }))
    : null);
});

describe('CategoriesScreen error feedback (BUG-30)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('kategori ekleme başarısız olursa kullanıcıya hata gösterir', async () => {
    (CategoryDao.getTree as jest.Mock).mockResolvedValue([]);
    (CategoryDao.create as jest.Mock).mockRejectedValue(new Error('constraint'));
    const screen = await render(<CategoriesScreen />);

    await fireEvent.press(await screen.findByText('empty_categories_cta'));
    await fireEvent.changeText(screen.getByPlaceholderText('new_category_placeholder'), 'Hobi');
    await act(async () => {
      fireEvent.press(screen.getByText('check'));
    });

    await waitFor(() => expect(SparkToast.show).toHaveBeenCalledWith('error_saving_data', 'error'));
  });

  it('ağaç yüklenemezse reddi sızdırmaz ve hata gösterir', async () => {
    (CategoryDao.getTree as jest.Mock).mockRejectedValue(new Error('db closed'));

    await render(<CategoriesScreen />);

    await waitFor(() => expect(SparkToast.show).toHaveBeenCalledWith('operation_failed', 'error'));
  });

  const treeWithChild = [{
    id: 1, name: 'Hobi', icon: 'tag-outline', color: '#7C6BFF', parent_id: null, is_system: 1,
    children: [{ id: 2, name: 'Kitap', icon: 'tag-outline', color: '#7C6BFF', parent_id: 1, is_system: 0 }],
  }];

  async function openDelete(screen: Awaited<ReturnType<typeof render>>) {
    await act(async () => { fireEvent.press(await screen.findByText('Hobi')); });
    await act(async () => { fireEvent.press(await screen.findByText('close')); });
  }

  it('kullanımdaki kategoride kayıtları "Diğer"e taşıyıp silmeyi önerir (BUG-13 eki)', async () => {
    (CategoryDao.getTree as jest.Mock).mockResolvedValue(treeWithChild);
    (CategoryDao.getUsageCount as jest.Mock).mockResolvedValue(3);
    const screen = await render(<CategoriesScreen />);

    await openDelete(screen);
    expect(await screen.findByText('category_in_use_title')).toBeTruthy();
    expect(screen.getByText('category_move_to_other_confirm')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('confirm-category-delete')); });

    expect(CategoryDao.deleteMovingUsageToOther).toHaveBeenCalledWith(2);
    expect(CategoryDao.delete).not.toHaveBeenCalled();
    await waitFor(() => expect(SparkToast.show).toHaveBeenCalledWith('category_moved_and_deleted', 'success'));
  });

  it('kullanılmayan kategoriyi doğrudan siler', async () => {
    (CategoryDao.getTree as jest.Mock).mockResolvedValue(treeWithChild);
    (CategoryDao.getUsageCount as jest.Mock).mockResolvedValue(0);
    const screen = await render(<CategoriesScreen />);

    await openDelete(screen);
    expect(await screen.findByText('confirm_delete_category')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('confirm-category-delete')); });

    expect(CategoryDao.delete).toHaveBeenCalledWith(2);
    expect(CategoryDao.deleteMovingUsageToOther).not.toHaveBeenCalled();
  });
});
