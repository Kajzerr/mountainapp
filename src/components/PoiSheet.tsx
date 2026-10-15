import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Poi, poiName } from '../lib/pois';
import { useSettings, useT } from '../lib/settings';
import { Colors, fonts, POI_COLORS, useColors } from '../lib/theme';
import { useTrip } from '../lib/tripStore';
import { roleLabel } from './tripLabels';

type Props = { poi: Poi; onClose: () => void };

/** Karta wybranego punktu: nazwa, rodzaj, wysokość i dodanie do trasy (początek / punkt trasy / koniec). */
export function PoiSheet({ poi, onClose }: Props) {
  const colors = useColors();
  const t = useT();
  const { lang } = useSettings();
  const { trip, setStart, setEnd, addVia, remove } = useTrip();
  const [choosingVia, setChoosingVia] = useState(false);
  const role = roleLabel(t, trip, poi);
  // Miejsca do wyboru: przed każdym istniejącym punktem pośrednim albo za ostatnim (bez samego punktu)
  const viaCount = trip.via.filter((p) => p.id !== poi.id).length;

  const done = (action: () => void) => {
    action();
    onClose();
  };
  const onVia = () => (viaCount === 0 ? done(() => addVia(poi, 1)) : setChoosingVia(true));

  const details = [t.poi.kinds[poi.kind], poi.ele !== undefined ? t.poi.ele(poi.ele) : null].filter(Boolean).join(' · ');
  const otherName = lang === 'pl' && poi.namePl ? poi.name : null;

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.kindDot, { backgroundColor: POI_COLORS[poi.kind] }]} />
        <View style={styles.flex}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{poiName(poi, lang)}</Text>
          {otherName && <Text style={[styles.sub, { color: colors.textTertiary }]} numberOfLines={1}>{otherName}</Text>}
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{details}</Text>
          {role && <Text style={[styles.role, { color: colors.accent }]}>{t.poi.inTrip(role)}</Text>}
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.poi.close}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {choosingVia ? (
        <View style={styles.gap}>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{t.poi.viaPosition}</Text>
          <View style={styles.chips}>
            {Array.from({ length: viaCount + 1 }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                onPress={() => done(() => addVia(poi, n))}
                style={({ pressed }) => [styles.chip, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={t.trip.via(n)}
              >
                <Text style={[styles.chipText, { color: colors.accentText }]}>{t.poi.viaN(n)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.gap}>
          <View style={styles.row}>
            <SheetButton colors={colors} icon="flag-outline" label={t.poi.setStart} onPress={() => done(() => setStart(poi))} />
            <SheetButton colors={colors} icon="git-commit-outline" label={t.poi.addVia} onPress={onVia} />
            <SheetButton colors={colors} icon="flag" label={t.poi.setEnd} onPress={() => done(() => setEnd(poi))} />
          </View>
          {role && (
            <Pressable onPress={() => done(() => remove(poi.id))} hitSlop={8} accessibilityRole="button" style={styles.removeBtn}>
              <Text style={[styles.remove, { color: colors.danger }]}>{t.poi.remove}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

type ButtonProps = { colors: Colors; icon: 'flag-outline' | 'flag' | 'git-commit-outline'; label: string; onPress: () => void };

function SheetButton({ colors, icon, label, onPress }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={[styles.buttonText, { color: colors.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 14, elevation: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kindDot: { width: 14, height: 14, borderRadius: 7, marginTop: 5 },
  name: { fontFamily: fonts.semibold, fontSize: 18 },
  sub: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  role: { fontFamily: fonts.medium, fontSize: 13, marginTop: 4 },
  gap: { gap: 10 },
  row: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  buttonText: { fontFamily: fonts.medium, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 48, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  chipText: { fontFamily: fonts.semibold, fontSize: 16 },
  removeBtn: { alignSelf: 'center', paddingVertical: 4 },
  remove: { fontFamily: fonts.medium, fontSize: 14 },
});
