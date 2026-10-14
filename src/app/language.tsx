import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DICTS, isSupported, LANGS, type LanguageSetting, supportedLanguage } from '../lib/i18n';
import { useSettings, useT } from '../lib/settings';
import { fonts, useColors } from '../lib/theme';

/** Wybór języka (Menu → Język). „System” = język telefonu, a gdy go nie mamy – angielski. */
export default function LanguageScreen() {
  const colors = useColors();
  const t = useT();
  const { settings, setSetting, systemCode } = useSettings();
  const systemLang = supportedLanguage(systemCode);
  const options: LanguageSetting[] = ['system', ...LANGS];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.screens.language }} />
      {options.map((option) => {
        const selected = settings.language === option;
        // Nazwę języka pokazujemy w nim samym („Polski”, „English”), żeby każdy znalazł swój
        const title = option === 'system' ? t.language.system : DICTS[option].langName;
        const subtitle =
          option === 'system'
            ? isSupported(systemCode)
              ? t.language.systemDesc(DICTS[systemLang].langName)
              : t.language.systemFallback
            : undefined;
        return (
          <Pressable
            key={option}
            onPress={() => setSetting('language', option)}
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
            accessibilityLabel={t.language.a11y(title)}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.cardRaised }]}>
              {option === 'system' ? (
                <Ionicons name="phone-portrait-outline" size={20} color={colors.accent} />
              ) : (
                <Text style={[styles.code, { color: colors.accent }]}>{option.toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.text }]}>{title}</Text>
              {subtitle && <Text style={[styles.desc, { color: colors.textSecondary }]}>{subtitle}</Text>}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 2, minHeight: 64 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  code: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.5 },
  name: { fontFamily: fonts.semibold, fontSize: 16 },
  desc: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
});
