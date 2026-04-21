// Type declarations for @expo/vector-icons
declare module '@expo/vector-icons' {
  import { ComponentType } from 'react';
  import { TextProps } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export const MaterialCommunityIcons: ComponentType<IconProps>;
  export const MaterialIcons: ComponentType<IconProps>;
  export const FontAwesome: ComponentType<IconProps>;
  export const Ionicons: ComponentType<IconProps>;
  export const Feather: ComponentType<IconProps>;
  export const AntDesign: ComponentType<IconProps>;
  export const Entypo: ComponentType<IconProps>;
  export const EvilIcons: ComponentType<IconProps>;
  export const FontAwesome5: ComponentType<IconProps>;
  export const Foundation: ComponentType<IconProps>;
  export const Octicons: ComponentType<IconProps>;
  export const SimpleLineIcons: ComponentType<IconProps>;
  export const Zocial: ComponentType<IconProps>;
}

// Type declarations for expo-file-system/legacy
declare module 'expo-file-system/legacy' {
  export function readAsStringAsync(
    fileUri: string,
    options?: { encoding?: 'utf8' | 'base64'; position?: number; length?: number }
  ): Promise<string>;

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: { encoding?: 'utf8' | 'base64' }
  ): Promise<void>;

  export function getInfoAsync(
    fileUri: string,
    options?: { size?: boolean; md5?: boolean }
  ): Promise<{ exists: boolean; isDirectory: boolean; modificationTime: number; size: number; uri: string; md5?: string }>;

  export function deleteAsync(
    fileUri: string,
    options?: { idempotent?: boolean }
  ): Promise<void>;

  export function copyAsync(
    options: { from: string; to: string }
  ): Promise<void>;

  export function moveAsync(
    options: { from: string; to: string }
  ): Promise<void>;

  export function makeDirectoryAsync(
    fileUri: string,
    options?: { intermediates?: boolean }
  ): Promise<void>;

  export function readDirectoryAsync(
    fileUri: string
  ): Promise<string[]>;

  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;

  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }
}
