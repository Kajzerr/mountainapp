// Podpisy szczytów nałożone na zdjęcie: linia horyzontu (svg), kropki przy wierzchołkach i nazwy.
// Od DOTS_FROM szczytów pokazujemy same kropki – nazwa pojawia się i znika po dotknięciu kropki.
// Tryb `snapshot` (zapis zdjęcia z podpisami): bez linii horyzontu i bez kropek bez nazwy, wszystko powiększone
// o `scale`, żeby podpisy zajmowały tę samą część zdjęcia co na ekranie.
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
  /** Powiększenie podpisów (zapis zdjęcia w większej rozdzielczości niż na ekranie) */
  scale?: number;
  /** Tylko rozwinięte nazwy, bez linii horyzontu – do zapisu zdjęcia */
  snapshot?: boolean;
};

const LABEL_WIDTH = 150;
const HIT = 44;

export function PeakOverlay({
  scene, pose, aspect, width, height, shown, onToggle, interactive, scale = 1, snapshot = false,
}: Props) {
  const t = useT();
  const { lang } = useSettings();
  const labels = useMemo(() => layoutLabels(scene, pose, aspect), [scene, pose, aspect]);
  const line = useMemo(() => horizonLine(scene, pose, aspect), [scene, pose, aspect]);
  const dots = labels.length >= DOTS_FROM;
  const k = scale;
  const sized = useMemo(() => scaledStyles(k), [k]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents={interactive ? 'box-none' : 'none'}>
      {!snapshot && (
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
      )}
      {labels.map((label, i) => {
        const peak = label.view.peak;
        const name = poiName(peak, lang);
        const x = label.x * width;
        const y = label.y * height;
        const showName = !dots || shown.has(peak.id);
        if (snapshot && !showName) return null;
        // Co druga nazwa wyżej, żeby sąsiednie się nie nakładały
        const lift = (34 + (i % 2) * 34) * k;
        const labelWidth = LABEL_WIDTH * k;
        const hit = HIT * k;
        const left = Math.min(Math.max(x - labelWidth / 2, 0), width - labelWidth);
        return (
          <View key={peak.id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {showName && (
              <>
                <View
                  pointerEvents="none"
                  style={[sized.stem, { left: x - 0.75 * k, top: y - lift + 24 * k, height: lift - 30 * k }]}
                />
                <View pointerEvents="none" style={[styles.label, { left, top: y - lift - 6 * k, width: labelWidth }]}>
                  <Text style={sized.name} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={sized.meta} numberOfLines={1}>
                    {t.peaks.meta(peak.ele, (label.view.distance / 1000).toFixed(1))}
                  </Text>
                </View>
              </>
            )}
            <Pressable
              onPress={() => onToggle(peak.id)}
              disabled={!dots}
              style={[styles.hit, { left: x - hit / 2, top: y - hit / 2, width: hit, height: hit }]}
              accessibilityRole={dots ? 'button' : 'text'}
              accessibilityLabel={t.peaks.dotA11y(name)}
            >
              <View style={sized.dot} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', alignItems: 'center' },
});

/** Rozmiary kropki, kreski i tekstu – na ekranie k = 1, przy zapisie zdjęcia większe. */
function scaledStyles(k: number) {
  const shadow = {
    textShadowColor: PHOTO_OVERLAY.shadow,
    textShadowOffset: { width: 0, height: 1 * k },
    textShadowRadius: 3 * k,
  };
  return StyleSheet.create({
    dot: {
      width: 12 * k, height: 12 * k, borderRadius: 6 * k, backgroundColor: PHOTO_OVERLAY.dot,
      borderWidth: 2 * k, borderColor: PHOTO_OVERLAY.dotBorder,
    },
    stem: { position: 'absolute', width: 1.5 * k, backgroundColor: PHOTO_OVERLAY.dot },
    name: { fontFamily: fonts.semibold, fontSize: 13 * k, color: PHOTO_OVERLAY.text, ...shadow },
    meta: { fontFamily: fonts.regular, fontSize: 10 * k, color: PHOTO_OVERLAY.text, ...shadow },
  });
}
