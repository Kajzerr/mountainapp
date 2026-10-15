import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useT } from '../lib/settings';
import { fonts, useColors } from '../lib/theme';
import { formatDuration } from '../lib/trip';
import type { RouteState } from '../lib/tripStore';

/** Długość, przewyższenia i czas trasy w jednej linii (albo stan: liczę / za mało punktów). */
export function TripSummary({ route, pointCount }: { route: RouteState; pointCount: number }) {
  const colors = useColors();
  const t = useT();
  if (pointCount < 2) {
    return <Text style={[styles.muted, { color: colors.textSecondary }]}>{t.trip.needMore}</Text>;
  }
  if (route.status !== 'ready') {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.muted, { color: colors.textSecondary }]}>{t.trip.computing}</Text>
      </View>
    );
  }
  const s = route.stats;
  return (
    <View>
      <Text style={[styles.stats, { color: colors.text }]}>
        {[t.trip.km(s.distanceM), t.trip.up(s.ascentM), t.trip.down(s.descentM), t.trip.time(formatDuration(s.minutes))].join('   ')}
      </Text>
      {!route.exact && <Text style={[styles.muted, { color: colors.danger }]}>{t.trip.approx}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stats: { fontFamily: fonts.semibold, fontSize: 15 },
  muted: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
});
