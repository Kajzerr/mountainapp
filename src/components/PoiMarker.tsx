import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { type Poi, poiName } from '../lib/pois';
import { useSettings, useT } from '../lib/settings';
import { POI_COLORS } from '../lib/theme';
import { useBriefTracking } from './useBriefTracking';

type Props = { poi: Poi; selected: boolean; onPress: (poi: Poi) => void };

/** Punkt charakterystyczny na mapie: kolorowa kropka (kolor = rodzaj punktu), większa po wybraniu. */
export const PoiMarker = memo(function PoiMarker({ poi, selected, onPress }: Props) {
  const t = useT();
  const { lang } = useSettings();
  const tracking = useBriefTracking([selected]);
  const size = selected ? 22 : poi.kind === 'junction' ? 10 : 14;
  return (
    <Marker
      coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracking}
      onPress={() => onPress(poi)}
      accessibilityLabel={`${t.poi.kinds[poi.kind]}: ${poiName(poi, lang)}`}
      zIndex={selected ? 3 : 1}
    >
      {/* Obszar dotyku większy niż kropka */}
      <View style={styles.hit}>
        <View
          style={[
            styles.dot,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: POI_COLORS[poi.kind], borderColor: POI_COLORS.outline },
          ]}
        />
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  hit: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  dot: { borderWidth: 2 },
});
