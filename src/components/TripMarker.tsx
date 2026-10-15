import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { poiName } from '../lib/pois';
import { useSettings } from '../lib/settings';
import { fonts, POI_COLORS } from '../lib/theme';
import type { TripPoint } from '../lib/trip';
import { useBriefTracking } from './useBriefTracking';

type Props = { point: TripPoint; number: number; label: string; onPress: (p: TripPoint) => void };

/** Punkt planowanej trasy: kółko z numerem w kolejności przejścia. */
export function TripMarker({ point, number, label, onPress }: Props) {
  const { lang } = useSettings();
  const tracking = useBriefTracking([number]);
  return (
    <Marker
      coordinate={{ latitude: point.latitude, longitude: point.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracking}
      onPress={() => onPress(point)}
      accessibilityLabel={`${label}: ${poiName(point, lang)}`}
      zIndex={4}
    >
      <View style={styles.box}>
        <View style={[styles.circle, { backgroundColor: POI_COLORS.route, borderColor: POI_COLORS.outline }]}>
          <Text style={[styles.text, { color: POI_COLORS.outline }]}>{number}</Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  box: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.bold, fontSize: 13 },
});
