// Podpisy szczytów nałożone na zdjęcie: linia horyzontu (svg), kropki przy wierzchołkach i nazwy.
// Od DOTS_FROM szczytów pokazujemy same kropki – nazwa pojawia się i znika po dotknięciu kropki.
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { type CameraPose, DOTS_FROM, horizonLine, layoutLabels, type PhotoScene } from '../lib/peakLabels';
import { type Poi, poiName } from '../lib/pois';
import { useSettings, useT } from '../lib/settings';
import { fonts, PHOTO_OVERLAY } from '../lib/theme';

type Props = {
  scene: PhotoScene<Poi>;
  pose: CameraPose;
  aspect: number;
  /** Rozmiar zdjęcia na ekranie (pt) */
  width: number;
  height: number;
  /** Nazwy pokazane w trybie kropek (id punktów) */
  shown: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** Podczas dopasowywania palcem kropki nie reagują na dotyk */
  interactive: boolean;
};

const LABEL_WIDTH = 150;
const HIT = 44;

export function PeakOverlay({ scene, pose, aspect, width, height, shown, onToggle, interactive }: Props) {
  const t = useT();
  const { lang } = useSettings();
  const labels = useMemo(() => layoutLabels(scene, pose, aspect), [scene, pose, aspect]);
  const line = useMemo(() => horizonLine(scene, pose, aspect), [scene, pose, aspect]);
  const dots = labels.length >= DOTS_FROM;

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents={interactive ? 'box-none' : 'none'}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {line.map((segment, i) => (
          <Polyline
            key={i}
            points={segment.map((p) => `${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={PHOTO_OVERLAY.horizon}
            strokeWidth={1.5}
            strokeOpacity={0.85}
          />
        ))}
      </Svg>
      {labels.map((label, i) => {
        const peak = label.view.peak;
        const name = poiName(peak, lang);
        const x = label.x * width;
        const y = label.y * height;
        const showName = !dots || shown.has(peak.id);
        // Co druga nazwa wyżej, żeby sąsiednie się nie nakładały
        const lift = 34 + (i % 2) * 34;
        const left = Math.min(Math.max(x - LABEL_WIDTH / 2, 0), width - LABEL_WIDTH);
        return (
          <View key={peak.id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {showName && (
              <>
                <View
                  pointerEvents="none"
                  style={[styles.stem, { left: x - 0.75, top: y - lift + 24, height: lift - 30 }]}
                />
                <View pointerEvents="none" style={[styles.label, { left, top: y - lift - 6, width: LABEL_WIDTH }]}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {t.peaks.meta(peak.ele, (label.view.distance / 1000).toFixed(1))}
                  </Text>
                </View>
              </>
            )}
            <Pressable
              onPress={() => onToggle(peak.id)}
              disabled={!dots}
              style={[styles.hit, { left: x - HIT / 2, top: y - HIT / 2 }]}
              accessibilityRole={dots ? 'button' : 'text'}
              accessibilityLabel={t.peaks.dotA11y(name)}
            >
              <View style={styles.dot} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const shadow = {
  textShadowColor: PHOTO_OVERLAY.shadow,
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  hit: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: PHOTO_OVERLAY.dot,
    borderWidth: 2, borderColor: PHOTO_OVERLAY.dotBorder,
  },
  stem: { position: 'absolute', width: 1.5, backgroundColor: PHOTO_OVERLAY.dot },
  label: { position: 'absolute', alignItems: 'center' },
  name: { fontFamily: fonts.semibold, fontSize: 13, color: PHOTO_OVERLAY.text, ...shadow },
  meta: { fontFamily: fonts.regular, fontSize: 10, color: PHOTO_OVERLAY.text, ...shadow },
});
