import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
import { ActivityIndicator, Pressable } from 'react-native';
import { useImportPhotos } from '../../components/useImportPhotos';
import { useT } from '../../lib/settings';
import { fonts, useColors } from '../../lib/theme';

/** Zakładki: „Mapa” (szlaki + zdjęcia), „Zdjęcia” i „Menu”. */
export default function TabsLayout() {
  const colors = useColors();
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.medium },
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.map,
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: t.tabs.photos,
          headerRight: () => <AddPhotosButton />,
          tabBarIcon: ({ color, size }) => <Ionicons name="images-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t.tabs.menu,
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

/** „+” w nagłówku zakładki Zdjęcia. */
function AddPhotosButton() {
  const colors = useColors();
  const t = useT();
  const { busy, pick } = useImportPhotos();
  if (busy) return <ActivityIndicator color={colors.accent} style={{ paddingHorizontal: 16 }} />;
  return (
    <Pressable
      onPress={pick}
      hitSlop={12}
      style={{ paddingHorizontal: 16 }}
      accessibilityRole="button"
      accessibilityLabel={t.photos.add}
    >
      <Ionicons name="add" size={26} color={colors.accent} />
    </Pressable>
  );
}
