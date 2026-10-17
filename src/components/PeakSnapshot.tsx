// Niewidoczna kopia zdjęcia z podpisami w większej rozdzielczości – do zapisu w galerii. Rysujemy ją poza
// ekranem, czekamy na wczytanie zdjęcia i robimy z niej plik JPEG (react-native-view-shot).
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { PixelRatio, Platform, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { CameraPose, PhotoScene } from '../lib/peakLabels';
import { photoUri } from '../lib/photoFiles';
import { exportSize } from '../lib/photoExport';
import type { Photo } from '../lib/photoModel';
import type { Poi } from '../lib/pois';
import { PeakOverlay } from './PeakOverlay';

type Props = {
  photo: Photo;
  scene: PhotoScene<Poi>;
  pose: CameraPose;
  aspect: number;
  /** Szerokość zdjęcia na ekranie (pt) – podpisy powiększamy w tej samej proporcji co zdjęcie */
  screenWidth: number;
  /** Rozwinięte nazwy (tryb kropek) */
  shown: ReadonlySet<string>;
  /** Adres pliku JPEG albo null przy błędzie */
  onDone: (uri: string | null) => void;
};

const noop = () => {};

export function PeakSnapshot({ photo, scene, pose, aspect, screenWidth, shown, onDone }: Props) {
  const ref = useRef<View>(null);
  const done = useRef(false);
  const finish = useRef(onDone);
  finish.current = onDone;
  // Rozmiar w pt tak dobrany, żeby plik miał rozmiar z exportSize (pt × gęstość ekranu = piksele)
  const px = exportSize(photo.width, photo.height);
  const ratio = PixelRatio.get();
  const width = px.width / ratio;
  const height = px.height / ratio;

  const end = (uri: string | null) => {
    if (done.current) return;
    done.current = true;
    finish.current(uri);
  };

  // Zabezpieczenie: gdy zdjęcie się nie wczyta, nie czekamy w nieskończoność
  useEffect(() => {
    const timer = setTimeout(() => end(null), 15000);
    return () => clearTimeout(timer);
  }, []);

  const capture = () => {
    // Dwie klatki zapasu, żeby podpisy i zdjęcie były już narysowane
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        captureRef(ref, {
          format: 'jpg',
          quality: 0.92,
          result: 'tmpfile',
          // Widok jest poza ekranem – na iOS domyślna metoda rysuje tylko to, co widać
          useRenderInContext: Platform.OS === 'ios',
        })
          .then((uri) => end(uri))
          .catch((e) => {
            console.warn('Could not capture photo with labels', e);
            end(null);
          });
      }),
    );
  };

  return (
    <View ref={ref} collapsable={false} style={[styles.offscreen, { width, height }]} pointerEvents="none">
      <Image
        source={{ uri: photoUri(photo.file) }}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        allowDownscaling={false}
        onLoad={capture}
        onError={() => end(null)}
      />
      <PeakOverlay
        scene={scene}
        pose={pose}
        aspect={aspect}
        width={width}
        height={height}
        shown={shown}
        onToggle={noop}
        interactive={false}
        scale={width / Math.max(screenWidth, 1)}
        snapshot
      />
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -20000, top: 0 },
});
