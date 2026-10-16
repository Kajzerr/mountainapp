// Warstwa podpisów szczytów na ekranie zdjęcia: liczenie sceny, podpisy, ręczne dopasowanie palcem
// (przesunięcie w bok = kierunek, w pionie = pochylenie) i pasek z komunikatem oraz przyciskami na dole zdjęcia.
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { type CameraPose, DOTS_FROM, layoutLabels } from '../lib/peakLabels';
import type { Photo } from '../lib/photoModel';
import { usePhotos } from '../lib/photos';
import { useT } from '../lib/settings';
import { fonts, PHOTO_OVERLAY } from '../lib/theme';
import { PeakOverlay } from './PeakOverlay';
import { usePeakScene } from './usePeakScene';

type Props = {
  photo: Photo;
  /** Pole, w którym zdjęcie jest wpasowane (contentFit="contain") */
  boxWidth: number;
  boxHeight: number;
  adjusting: boolean;
  onAdjustingChange: (value: boolean) => void;
};

export function PeaksLayer({ photo, boxWidth, boxHeight, adjusting, onAdjustingChange }: Props) {
  const t = useT();
  const { updatePhoto } = usePhotos();
  const state = usePeakScene(photo, true);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });

  // Prostokąt, który faktycznie zajmuje zdjęcie w polu (paski po bokach albo u góry i dołu)
  const scale = Math.min(boxWidth / (photo.width || 1), boxHeight / (photo.height || 1));
  const rectW = photo.width ? photo.width * scale : boxWidth;
  const rectH = photo.height ? photo.height * scale : boxHeight;
  const degPerPt = state.hfov / Math.max(rectW, 1);

  const base: CameraPose | null =
    state.exifHeading === undefined && !photo.view
      ? null
      : {
          heading: photo.view?.heading ?? state.exifHeading ?? 0,
          pitch: photo.view?.pitch ?? state.exifPitch,
          roll: state.roll,
          hfov: state.hfov,
        };
  const pose: CameraPose | null = base
    ? { ...base, heading: (base.heading - drag.dx * degPerPt + 360) % 360, pitch: base.pitch + drag.dy * degPerPt }
    : null;

  // PanResponder tworzymy raz – aktualne wartości czyta z refa
  const latest = useRef({ pose, photoId: photo.id });
  latest.current = { pose, photoId: photo.id };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => setDrag({ dx: g.dx, dy: g.dy }),
      onPanResponderRelease: () => {
        const p = latest.current.pose;
        if (p) {
          updatePhoto(latest.current.photoId, {
            view: { heading: Math.round(p.heading * 100) / 100, pitch: Math.round(p.pitch * 100) / 100 },
          });
        }
        setDrag({ dx: 0, dy: 0 });
      },
      onPanResponderTerminate: () => setDrag({ dx: 0, dy: 0 }),
    }),
  ).current;

  const toggle = useCallback(
    (id: string) =>
      setShown((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  const scene = state.scene;
  const dotsMode = useMemo(
    () => (scene && pose ? layoutLabels(scene, pose, state.aspect).length >= DOTS_FROM : false),
    [scene, pose, state.aspect],
  );

  const message =
    state.status === 'loading' ? t.peaks.loading
    : state.status === 'noLocation' ? t.peaks.noLocation
    : state.status === 'noDirection' ? t.peaks.noDirection
    : state.status === 'outside' ? t.peaks.outside
    : state.status === 'poisLoading' ? t.peaks.poisLoading
    : adjusting ? t.peaks.adjustHint
    : dotsMode ? t.peaks.tapHint
    : t.peaks.estimated;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {scene && pose && (
        <View
          style={{ position: 'absolute', left: (boxWidth - rectW) / 2, top: (boxHeight - rectH) / 2, width: rectW, height: rectH }}
          pointerEvents="box-none"
        >
          <PeakOverlay
            scene={scene}
            pose={pose}
            aspect={state.aspect}
            width={rectW}
            height={rectH}
            shown={shown}
            onToggle={toggle}
            interactive={!adjusting}
          />
          {adjusting && <View style={StyleSheet.absoluteFill} {...responder.panHandlers} />}
        </View>
      )}
      <View style={styles.bar} pointerEvents="box-none">
        {state.status === 'loading' && <ActivityIndicator color={PHOTO_OVERLAY.text} size="small" />}
        <Text style={styles.message}>{message}</Text>
        {state.status === 'ready' && (
          <View style={styles.buttons}>
            {photo.view && !adjusting && (
              <BarButton icon="refresh" label={t.peaks.reset} onPress={() => updatePhoto(photo.id, { view: undefined })} />
            )}
            <BarButton
              icon={adjusting ? 'checkmark' : 'move'}
              label={adjusting ? t.peaks.done : t.peaks.adjust}
              onPress={() => onAdjustingChange(!adjusting)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function BarButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color={PHOTO_OVERLAY.text} />
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: PHOTO_OVERLAY.panel,
  },
  message: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: PHOTO_OVERLAY.text },
  buttons: { flexDirection: 'row', gap: 6 },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 10, borderRadius: 10,
    borderWidth: 1, borderColor: PHOTO_OVERLAY.text,
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 13, color: PHOTO_OVERLAY.text },
});
