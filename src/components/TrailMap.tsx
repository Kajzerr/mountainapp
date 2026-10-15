import { ReactNode, Ref } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { MapPressEvent, Region, UrlTile } from 'react-native-maps';
import { TATRY_REGION, TILE_CACHE_MAX_AGE_S, TOPO_TILES, TRAIL_TILES } from '../lib/mapConfig';
import { tileCacheDir } from '../lib/photoFiles';
import { useSettings, useT } from '../lib/settings';
import { fonts, useTheme } from '../lib/theme';

type Props = {
  mapRef?: Ref<MapView>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  onRegionChangeComplete?: (region: Region) => void;
  onPress?: (e: MapPressEvent) => void;
  children?: ReactNode;
};

/**
 * Mapa Tatr: podkład (topograficzny z OpenTopoMap albo systemowy) + nakładka ze znakowanymi szlakami.
 * Działa w Expo Go (react-native-maps: Apple Maps na iOS, Google Maps na Androidzie).
 */
export function TrailMap({ mapRef, initialRegion = TATRY_REGION, showsUserLocation, onRegionChangeComplete, onPress, children }: Props) {
  const { settings } = useSettings();
  const { colors, dark } = useTheme();
  const t = useT();
  const topo = settings.mapLayer === 'topo';
  // Na Androidzie „none” chowa mapę Google pod kafelkami topo; na iOS robi to shouldReplaceMapContent.
  // Zwykła mapa: na Androidzie wersja terenowa (z rzeźbą), na iOS jej nie ma – zostaje standardowa.
  const mapType = topo ? (Platform.OS === 'android' ? 'none' : 'standard') : Platform.OS === 'android' ? 'terrain' : 'standard';

  return (
    <View style={styles.flex}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        mapType={mapType}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass
        toolbarEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={onPress}
      >
        {topo && (
          <UrlTile
            urlTemplate={TOPO_TILES.url}
            maximumNativeZ={TOPO_TILES.maxNativeZoom}
            maximumZ={19}
            shouldReplaceMapContent
            tileCachePath={tileCacheDir('topo')}
            tileCacheMaxAge={TILE_CACHE_MAX_AGE_S}
            zIndex={0}
          />
        )}
        <UrlTile
          urlTemplate={TRAIL_TILES.url}
          maximumNativeZ={TRAIL_TILES.maxNativeZoom}
          maximumZ={19}
          tileCachePath={tileCacheDir('trails')}
          tileCacheMaxAge={TILE_CACHE_MAX_AGE_S}
          zIndex={1}
        />
        {children}
      </MapView>
      {/* Podpis autorów danych – wymagany przez licencje OpenStreetMap / OpenTopoMap. Tło: kolor motywu + 70% krycia (B3) */}
      <View style={[styles.attribution, { backgroundColor: colors.background + 'B3' }]} pointerEvents="none">
        <Text style={[styles.attributionText, { color: colors.textSecondary }]} numberOfLines={1}>
          {t.map.attribution}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  attribution: { position: 'absolute', left: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2, borderTopRightRadius: 6, maxWidth: '100%' },
  attributionText: { fontFamily: fonts.regular, fontSize: 9 },
});
