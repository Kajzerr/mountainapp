import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSettings, useT } from '../lib/settings';
import { Colors, fonts, PALETTES, THEME_ORDER, themeName, useColors } from '../lib/theme';

/** Wybór motywu (Menu → Motyw). Zmiana działa od razu. */
export default function ThemeScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const { settings, setSetting } = useSettings();
  const t = useT();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.screens.theme }} />
      {THEME_ORDER.map((id) => {
        const selected = settings.theme === id;
        return (
          <Pressable
            key={id}
            onPress={() => setSetting('theme', id)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: colors.card,
                borderColor: selected ? colors.accent : 'transparent',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t.theme.a11y(themeName(id))}
          >
            {id === 'system' ? (
              <View style={styles.previewPair}>
                <Preview palette={PALETTES.dark.colors} half="left" />
                <Preview palette={PALETTES.light.colors} half="right" />
              </View>
            ) : (
              <Preview palette={PALETTES[id].colors} />
            )}
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.text }]}>{themeName(id)}</Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                {id === 'system' && selected
                  ? `${t.theme.desc.system} ${t.theme.systemNow(themeName(scheme === 'light' ? 'light' : 'dark'))}`
                  : t.theme.desc[id]}
              </Text>
            </View>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={selected ? colors.accent : colors.textTertiary}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Miniatura ekranu w danym motywie: tło, karta z akcentem i „liniami tekstu”. */
function Preview({ palette: p, half }: { palette: Colors; half?: 'left' | 'right' }) {
  return (
    <View
      style={[
        styles.preview,
        { backgroundColor: p.background, borderColor: p.border },
        half === 'left' && styles.previewLeft,
        half === 'right' && styles.previewRight,
      ]}
      accessible={false}
    >
      <View style={[styles.previewCard, { backgroundColor: p.card }]}>
        <View style={[styles.previewDot, { backgroundColor: p.accent }]} />
        <View style={[styles.previewLine, { backgroundColor: p.text, width: '70%' }]} />
        <View style={[styles.previewLine, { backgroundColor: p.textTertiary, width: '45%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 16, borderWidth: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 16 },
  desc: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  previewPair: { flexDirection: 'row', width: 64 },
  preview: { width: 64, height: 56, borderRadius: 12, borderWidth: 1, padding: 7, justifyContent: 'center' },
  previewLeft: { width: 32, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0, paddingRight: 0 },
  previewRight: { width: 32, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0, paddingLeft: 0 },
  previewCard: { borderRadius: 6, padding: 6, gap: 4 },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  previewLine: { height: 3, borderRadius: 1.5 },
});
