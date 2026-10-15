import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePois } from '../../lib/poiStore';
import { useSettings, useT } from '../../lib/settings';
import { Colors, fonts, themeName, useColors } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Zakładka „Menu”: ustawienia i informacje o danych mapy. */
export default function MenuScreen() {
  const colors = useColors();
  const { settings, setSetting } = useSettings();
  const { pois, status: poiStatus, errorDetail, refresh: refreshPois } = usePois();
  const t = useT();
  const m = t.menu;
  const languageSubtitle =
    settings.language === 'system' ? `${t.language.system} · ${t.langName}` : t.langName;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Section title={m.settings} colors={colors} first />
      <NavRow
        colors={colors}
        icon="language-outline"
        title={m.language}
        subtitle={languageSubtitle}
        onPress={() => router.push('/language')}
      />
      <NavRow
        colors={colors}
        icon="color-palette-outline"
        title={m.theme}
        subtitle={themeName(settings.theme)}
        onPress={() => router.push('/theme')}
      />
      <ChoiceRow
        colors={colors}
        icon="layers-outline"
        title={m.mapLayer}
        value={settings.mapLayer}
        options={[
          { value: 'topo', label: m.layerTopo },
          { value: 'standard', label: m.layerStandard },
        ]}
        onChange={(v) => setSetting('mapLayer', v)}
      />

      <Section title={m.about} colors={colors} />
      <NavRow
        colors={colors}
        icon="refresh-outline"
        title={m.refreshPois}
        subtitle={
          poiStatus === 'loading'
            ? t.poi.loading
            : poiStatus === 'error'
              ? `${t.poi.error}${errorDetail ? ` (${errorDetail})` : ''}`
              : m.refreshPoisSub(pois.length)
        }
        onPress={refreshPois}
      />
      <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
        <View style={styles.choiceHead}>
          <IconBox icon="map-outline" colors={colors} />
          <Text style={[styles.title, styles.flex, { color: colors.text }]}>{m.sources}</Text>
        </View>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>{m.sourcesText}</Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, colors, first }: { title: string; colors: Colors; first?: boolean }) {
  return (
    <Text style={[styles.section, !first && styles.sectionGap, { color: colors.textSecondary }]}>{title}</Text>
  );
}

function IconBox({ icon, colors }: { icon: IconName; colors: Colors }) {
  return (
    <View style={[styles.iconBox, { backgroundColor: colors.cardRaised }]}>
      <Ionicons name={icon} size={20} color={colors.accent} />
    </View>
  );
}

type NavRowProps = { colors: Colors; icon: IconName; title: string; subtitle?: string; onPress: () => void };

/** Wiersz prowadzący do osobnego ekranu. */
function NavRow({ colors, icon, title, subtitle, onPress }: NavRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
    >
      <IconBox icon={icon} colors={colors} />
      <View style={styles.flex}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

type ChoiceRowProps<T extends string | number> = {
  colors: Colors;
  icon: IconName;
  title: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

/** Ustawienie z dwiema–trzema opcjami – przełącznik od razu w wierszu, bez osobnego ekranu. */
function ChoiceRow<T extends string | number>({ colors, icon, title, value, options, onChange }: ChoiceRowProps<T>) {
  return (
    <View style={[styles.choiceCard, { backgroundColor: colors.card }]}>
      <View style={styles.choiceHead}>
        <IconBox icon={icon} colors={colors} />
        <Text style={[styles.title, styles.flex, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={[styles.segment, { backgroundColor: colors.background }]} accessibilityRole="radiogroup">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              style={[styles.segmentBtn, active && { backgroundColor: colors.accent }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${title}: ${o.label}`}
            >
              <Text
                style={[styles.segmentText, { color: active ? colors.accentText : colors.textSecondary }]}
                numberOfLines={1}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  section: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.4, marginLeft: 4, marginTop: 4 },
  sectionGap: { marginTop: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, minHeight: 64 },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 16 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  choiceCard: { padding: 14, borderRadius: 16, gap: 12 },
  choiceHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segmentBtn: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentText: { fontFamily: fonts.medium, fontSize: 14 },
  infoCard: { padding: 14, borderRadius: 16, gap: 10 },
  infoText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
});
