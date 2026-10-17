// Warstwa podpisów szczytów na ekranie zdjęcia: liczenie sceny, podpisy (po automatycznym dopasowaniu do linii gór,
// gdy się udało), ręczne dopasowanie palcem (przesunięcie w bok = kierunek, w pionie = pochylenie) i pasek
// z komunikatem oraz przyciskami na dole zdjęcia. „Zapisz” zapisuje zdjęcie z widocznymi nazwami w galerii.
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { type CameraPose, DOTS_FROM, layoutLabels } from '../lib/peakLabels';
import { saveToGallery } from '../lib/photoExport';
import type { Photo } from '../lib/photoModel';
import { usePhotos } from '../lib/photos';
import { useT } from '../lib/settings';
import { fonts, PHOTO_OVERLAY } from '../lib/theme';
import { PeakOverlay } from './PeakOverlay';
import { PeakSnapshot } from './PeakSnapshot';
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
  // Zapis zdjęcia z podpisami: trwa (snapshot narysowany poza ekranem) i komunikat po zakończeniu
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Prostokąt, który faktycznie zajmuje zdjęcie w polu (paski po bokach albo u góry i dołu)
  const scale = Math.min(boxWidth / (photo.width || 1), boxHeight / (photo.height || 1));
  const rectW = photo.width ? photo.width * scale : boxWidth;
  const rectH = photo.height ? photo.height * scale : boxHeight;
  const degPerPt = state.hfov / Math.max(rectW, 1);

  const base: CameraPose | null =
    state.exifHeading === undefined && !photo.view
      ? null
      : {
          // Kolejność: ręczna poprawka („Dopasuj”) → automatyczne dopasowanie do linii gór → czujniki z EXIF
          heading: photo.view?.heading ?? state.auto?.heading ?? state.exifHeading ?? 0,
          pitch: photo.view?.pitch ?? state.auto?.pitch ?? state.exifPitch,
          roll: state.auto?.roll ?? state.roll,
          hfov: state.auto?.hfov ?? state.hfov,
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

  const onSnapshot = useCallback(
    (uri: string | null) => {
      // GPS z oryginału; kierunek – ten, w którym stoją podpisy (po dopasowaniu, względem północy geograficznej)
      const p = latest.current.pose;
      const gps =
        photo.latitude !== undefined && photo.longitude !== undefined
          ? {
              latitude: photo.latitude,
              longitude: photo.longitude,
              altitude: photo.altitude,
              direction: p?.heading,
              directionRef: 'T' as const,
            }
          : undefined;
      const result = uri ? saveToGallery(uri, gps) : Promise.resolve('failed' as const);
      result
        .then((r) => setNotice(r === 'saved' ? t.peaks.saved : r === 'shared' ? null : t.peaks.saveFailed))
        .finally(() => setSaving(false));
    },
    [t, photo.latitude, photo.longitude, photo.altitude],
  );

  const message =
    saving ? t.peaks.saving
    : notice ? notice
    : state.status === 'loading' ? t.peaks.loading
    : state.status === 'noLocation' ? t.peaks.noLocation
    : state.status === 'noDirection' ? t.peaks.noDirection
    : state.status === 'outside' ? t.peaks.outside
    : state.status === 'poisLoading' ? t.peaks.poisLoading
    : adjusting ? t.peaks.adjustHint
    : state.aligning ? t.peaks.aligning
    : dotsMode ? t.peaks.tapHint
    : state.auto && !photo.view ? t.peaks.autoAligned
    : t.peaks.estimated;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Podczas automatycznego dopasowania podpisów nie pokazujemy – inaczej przeskoczyłyby po chwili */}
      {scene && pose && !state.aligning && (
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
      {saving && scene && pose && (
        <PeakSnapshot
          photo={photo}
          scene={scene}
          pose={pose}
          aspect={state.aspect}
          screenWidth={rectW}
          shown={shown}
          onDone={onSnapshot}
        />
      )}
      <View style={styles.bar} pointerEvents="box-none">
        {(state.status === 'loading' || state.aligning || saving) && <ActivityIndicator color={PHOTO_OVERLAY.text} size="small" />}
        <Text style={styles.message}>{message}</Text>
        {state.status === 'ready' && (
          <View style={styles.buttons}>
            {!adjusting && !state.aligning && pose && (
              <BarButton
                icon="download-outline"
                accessibilityLabel={t.peaks.save}
                disabled={saving}
                onPress={() => {
                  setNotice(null);
                  setSaving(true);
                }}
              />
            )}
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

type BarButtonProps = {
  icon: IconName;
  /** Bez tekstu – sama ikona, wtedy wymagany accessibilityLabel */
  label?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress: () => void;
};

function BarButton({ icon, label, accessibilityLabel, disabled, onPress }: BarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, !label && styles.iconButton, { opacity: pressed || disabled ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={icon} size={label ? 16 : 20} color={PHOTO_OVERLAY.text} />
      {label && <Text style={styles.buttonText}>{label}</Text>}
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
  iconButton: { width: 44, justifyContent: 'center', paddingHorizontal: 0 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 13, color: PHOTO_OVERLAY.text },
});
