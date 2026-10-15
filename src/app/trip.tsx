import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TripSummary } from '../components/TripSummary';
import { roleLabel } from '../components/tripLabels';
import { poiName } from '../lib/pois';
import { useSettings, useT } from '../lib/settings';
import { fonts, POI_COLORS, useColors } from '../lib/theme';
import { useTrip } from '../lib/tripStore';

/** Planowana trasa: podsumowanie, punkty w kolejności (zmiana kolejności, usuwanie), odwrócenie, wyczyszczenie. */
export default function TripScreen() {
  const colors = useColors();
  const t = useT();
  const { lang } = useSettings();
  const { trip, ordered, route, move, remove, reverse, clear, retryRoute } = useTrip();

  if (ordered.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Ionicons name="trail-sign-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.trip.empty}</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.trip.emptyHint}</Text>
      </View>
    );
  }

  const confirmClear = () =>
    Alert.alert(t.trip.clearTitle, t.trip.clearText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.trip.clear,
        style: 'destructive',
        onPress: () => {
          clear();
          router.back();
        },
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <TripSummary route={route} pointCount={ordered.length} />
        {route.status === 'ready' && !route.exact && (
          <Pressable onPress={retryRoute} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: colors.accent }]}>{t.trip.retry}</Text>
          </Pressable>
        )}
      </View>

      {ordered.map((p, i) => {
        const name = poiName(p, lang);
        const details = [t.poi.kinds[p.kind], p.ele !== undefined ? t.poi.ele(p.ele) : null].filter(Boolean).join(' · ');
        return (
          <View key={p.id} style={[styles.row, { backgroundColor: colors.card }]}>
            <View style={[styles.number, { backgroundColor: POI_COLORS.route }]}>
              <Text style={[styles.numberText, { color: POI_COLORS.outline }]}>{i + 1}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.role, { color: colors.textSecondary }]}>{roleLabel(t, trip, p)}</Text>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{name}</Text>
              <Text style={[styles.details, { color: colors.textTertiary }]}>{details}</Text>
            </View>
            <IconBtn icon="chevron-up" label={t.trip.moveUp(name)} disabled={i === 0} onPress={() => move(p.id, -1)} />
            <IconBtn
              icon="chevron-down"
              label={t.trip.moveDown(name)}
              disabled={i === ordered.length - 1}
              onPress={() => move(p.id, 1)}
            />
            <IconBtn icon="close" label={t.trip.removePoint(name)} danger onPress={() => remove(p.id)} />
          </View>
        );
      })}

      <View style={styles.actions}>
        <Pressable
          onPress={reverse}
          style={({ pressed }) => [styles.action, { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
        >
          <Ionicons name="swap-vertical" size={18} color={colors.accent} />
          <Text style={[styles.actionText, { color: colors.accent }]}>{t.trip.reverse}</Text>
        </Pressable>
        <Pressable
          onPress={confirmClear}
          style={({ pressed }) => [styles.action, { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger }]}>{t.trip.clear}</Text>
        </Pressable>
      </View>
      <Text style={[styles.note, { color: colors.textTertiary }]}>{t.trip.timeNote}</Text>
    </ScrollView>
  );
}

type IconBtnProps = {
  icon: 'chevron-up' | 'chevron-down' | 'close';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function IconBtn({ icon, label, onPress, disabled, danger }: IconBtnProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.iconBtn, { opacity: disabled ? 0.3 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { padding: 14, borderRadius: 16, gap: 8 },
  link: { fontFamily: fonts.medium, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 12, paddingRight: 4, borderRadius: 16 },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontFamily: fonts.bold, fontSize: 13 },
  role: { fontFamily: fonts.medium, fontSize: 12 },
  name: { fontFamily: fonts.semibold, fontSize: 16 },
  details: { fontFamily: fonts.regular, fontSize: 13, marginTop: 1 },
  iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, borderRadius: 14, paddingHorizontal: 12,
  },
  actionText: { fontFamily: fonts.semibold, fontSize: 15 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, marginTop: 6 },
  empty: { flex: 1, alignItems: 'center', gap: 12, paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 18 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
