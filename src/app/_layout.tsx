// Importujemy tylko używane grubości – reszta nie trafia do aplikacji
import { Sora_400Regular } from '@expo-google-fonts/sora/400Regular';
import { Sora_500Medium } from '@expo-google-fonts/sora/500Medium';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance, View } from 'react-native';
import { PhotosProvider } from '../lib/photos';
import { SettingsProvider, useSettings, useT } from '../lib/settings';
import { fonts, PALETTES, useTheme } from '../lib/theme';

/** Ustawienia muszą być dostępne zanim cokolwiek wybierze kolory. */
export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppNavigator />
    </SettingsProvider>
  );
}

/** Główny nawigator: zakładki + ekrany zdjęć + ekrany z Menu. */
function AppNavigator() {
  const { colors, dark } = useTheme();
  const { settings, loaded: settingsLoaded } = useSettings();
  const t = useT();
  const [fontsLoaded, fontError] = useFonts({
    Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold,
  });

  // Elementy systemowe (alerty, klawiatura, wybór zdjęć) w jasnej/ciemnej wersji zgodnej z motywem.
  // Dla „System” zdejmujemy wymuszenie – wtedy decyduje telefon.
  useEffect(() => {
    if (!settingsLoaded) return;
    Appearance.setColorScheme(settings.theme === 'system' ? 'unspecified' : dark ? 'dark' : 'light');
  }, [settingsLoaded, settings.theme, dark]);

  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  // Czekamy chwilę na czcionki i ustawienia (przy błędzie czcionek – jedziemy dalej na systemowej)
  if ((!fontsLoaded && !fontError) || !settingsLoaded) {
    return <View style={{ flex: 1, backgroundColor: PALETTES.dark.colors.background }} />;
  }

  return (
    <ThemeProvider value={theme}>
      <PhotosProvider>
        <Stack
          screenOptions={{
            headerBackTitle: t.common.back,
            headerTitleStyle: { fontFamily: fonts.semibold },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="place" options={{ title: '' }} />
          <Stack.Screen name="photo" options={{ title: t.screens.photo }} />
          <Stack.Screen name="locate" options={{ presentation: 'modal', title: t.screens.locate }} />
          <Stack.Screen name="theme" options={{ title: t.screens.theme }} />
          <Stack.Screen name="language" options={{ title: t.screens.language }} />
        </Stack>
        <StatusBar style={dark ? 'light' : 'dark'} />
      </PhotosProvider>
    </ThemeProvider>
  );
}
