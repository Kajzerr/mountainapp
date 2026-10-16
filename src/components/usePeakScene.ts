// Dane do podpisów szczytów na ekranie zdjęcia: uzupełnienie danych z pliku (nachylenie telefonu itd.),
// ciężkie liczenie sceny (horyzont + widoczne szczyty) i automatyczne dopasowanie do linii gór na zdjęciu –
// każde raz na zdjęcie, poza renderowaniem.
import { useEffect, useMemo, useState } from 'react';
import { photoUri, readPhotoFileMeta } from '../lib/photoFiles';
import { loadSmallImage } from '../lib/photoPixels';
import { ALIGN_LIMITS, ALIGN_LIMITS_NO_TILT, alignToSkyline, edgeMap } from '../lib/skylineAlign';
import { FILE_META_VERSION, hasLocation, type Photo } from '../lib/photoModel';
import { usePhotos } from '../lib/photos';
import { analyzeScene, type CameraPose, horizontalFov, PAN_MARGIN, type PhotoScene, trueHeading } from '../lib/peakLabels';
import { isFrontCamera, tiltFromGravity } from '../lib/exifFile';
import type { Poi } from '../lib/pois';
import { usePois } from '../lib/poiStore';
import { loadDem } from '../lib/terrain';
import PROMINENCE from '../data/tatry-prominence.json';

export type PeakSceneStatus = 'loading' | 'ready' | 'noLocation' | 'noDirection' | 'outside' | 'poisLoading';

export type PeakSceneState = {
  status: PeakSceneStatus;
  scene?: PhotoScene<Poi>;
  /** Ustawienie aparatu z EXIF (przed ręczną poprawką) */
  exifHeading?: number;
  exifPitch: number;
  roll: number;
  /** Kąt widzenia w poziomie (stopnie) i proporcje zdjęcia (szerokość / wysokość) */
  hfov: number;
  aspect: number;
  /** Ustawienie po automatycznym dopasowaniu do linii gór (gdy się udało) */
  auto?: CameraPose;
  /** Trwa automatyczne dopasowanie */
  aligning: boolean;
};

/** Zmniejszone zdjęcie musi mieć takie proporcje jak zapisane wymiary (inaczej np. inaczej obrócone – pomijamy). */
const ASPECT_TOLERANCE = 0.03;

/** Gdy ręcznie obrócony kierunek odjedzie od środka policzonej sceny o więcej, liczymy scenę od nowa. */
const RECENTER_AFTER = PAN_MARGIN * 0.6;

export function usePeakScene(photo: Photo, active: boolean): PeakSceneState {
  const { updatePhoto } = usePhotos();
  const { pois, status: poisStatus } = usePois();
  // Szczyty z wybitnością (wybór ważniejszych podpisów); punkty spoza wbudowanego pliku jej nie mają
  const peaks = useMemo(
    () =>
      pois
        .filter((p) => p.kind === 'peak')
        .map((p) => ({ ...p, prominence: (PROMINENCE as Record<string, number>)[p.id] })),
    [pois],
  );

  // 1. Raz na zdjęcie: dane prosto z pliku (iPhone: nachylenie; starsze importy: kierunek, ogniskowa, obiektyw)
  const metaDone = (photo.fileMetaVersion ?? 0) >= FILE_META_VERSION;
  useEffect(() => {
    if (!active || metaDone) return;
    let meta: ReturnType<typeof readPhotoFileMeta> = {};
    try {
      meta = readPhotoFileMeta(photo.file);
    } catch (e) {
      console.warn('Could not read photo file metadata', e);
    }
    const patch: Partial<Photo> = { fileMetaVersion: FILE_META_VERSION };
    const orientation = photo.orientation ?? meta.orientation ?? (photo.height > photo.width ? 6 : 1);
    const lens = photo.lens ?? meta.lens;
    if (meta.gravity) {
      const tilt = tiltFromGravity(meta.gravity, orientation, isFrontCamera(lens));
      patch.pitch = Math.round(tilt.pitch * 100) / 100;
      patch.roll = Math.round(tilt.roll * 100) / 100;
    }
    if (photo.direction === undefined && meta.direction !== undefined) patch.direction = meta.direction;
    if (photo.directionRef === undefined && meta.directionRef) patch.directionRef = meta.directionRef;
    if (photo.focal35 === undefined && meta.focal35 !== undefined) patch.focal35 = meta.focal35;
    if (photo.orientation === undefined && meta.orientation !== undefined) patch.orientation = meta.orientation;
    if (photo.lens === undefined && meta.lens) patch.lens = meta.lens;
    updatePhoto(photo.id, patch);
  }, [active, metaDone, photo, updatePhoto]);

  const aspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 4 / 3;
  const hfov = horizontalFov(photo.width || 4, photo.height || 3, photo.focal35);
  const exifHeading = photo.direction !== undefined ? trueHeading(photo.direction, photo.directionRef) : undefined;
  const wantedHeading = photo.view?.heading ?? photo.autoView?.heading ?? exifHeading;

  // 2. Środek sceny: kierunek z EXIF albo z ręcznej poprawki; nowa scena dopiero po dużym obrocie
  const [center, setCenter] = useState<number | undefined>(wantedHeading);
  useEffect(() => {
    if (wantedHeading === undefined) return;
    setCenter((c) => {
      if (c === undefined) return wantedHeading;
      const diff = Math.abs(((wantedHeading - c + 540) % 360) - 180);
      return diff > RECENTER_AFTER ? wantedHeading : c;
    });
  }, [wantedHeading]);

  const [result, setResult] = useState<{ key: string; status: PeakSceneStatus; scene?: PhotoScene<Poi> } | null>(null);
  const located = hasLocation(photo);
  const key = `${photo.id}|${photo.latitude}|${photo.longitude}|${center}|${hfov}|${peaks.length}`;
  const ready = active && metaDone && located && center !== undefined && peaks.length > 0;

  // 3. Ciężkie liczenie po narysowaniu ekranu (setTimeout), żeby najpierw pokazał się wskaźnik ładowania
  useEffect(() => {
    if (!ready || result?.key === key || !hasLocation(photo) || center === undefined) return;
    const timer = setTimeout(() => {
      const dem = loadDem();
      const scene = dem ? analyzeScene(dem, peaks, photo, center, hfov) : null;
      setResult(scene ? { key, status: 'ready', scene } : { key, status: 'outside' });
    }, 50);
    return () => clearTimeout(timer);
  }, [ready, key, result?.key, peaks, photo, center, hfov]);

  // 4. Automatyczne dopasowanie do linii gór – raz na zdjęcie, po policzeniu sceny; wynik (albo null) zapisujemy
  const scene = result?.key === key && result.status === 'ready' ? result.scene : undefined;
  const wantAlign = active && !!scene && photo.autoView === undefined && exifHeading !== undefined;
  const [aligning, setAligning] = useState(false);
  useEffect(() => {
    if (!wantAlign || !scene || exifHeading === undefined) return;
    let cancelled = false;
    setAligning(true);
    const hasTilt = photo.pitch !== undefined;
    const base: CameraPose = { heading: exifHeading, pitch: photo.pitch ?? 0, roll: photo.roll ?? 0, hfov };
    (async () => {
      let autoView: Photo['autoView'] = null;
      try {
        const image = await loadSmallImage(photoUri(photo.file));
        if (cancelled) return;
        if (Math.abs(image.width / image.height - aspect) <= ASPECT_TOLERANCE * aspect) {
          const edges = edgeMap(image.data, image.width, image.height, 4);
          const r = alignToSkyline(scene.horizon, base, aspect, edges, hasTilt ? ALIGN_LIMITS : ALIGN_LIMITS_NO_TILT);
          if (r.confident) {
            const round = (v: number) => Math.round(v * 100) / 100;
            autoView = { heading: round(r.pose.heading), pitch: round(r.pose.pitch), roll: round(r.pose.roll), hfov: round(r.pose.hfov) };
          }
        }
      } catch (e) {
        console.warn('Could not align peak labels to the photo', e);
      }
      if (!cancelled) updatePhoto(photo.id, { autoView });
    })().finally(() => {
      if (!cancelled) setAligning(false);
    });
    return () => {
      cancelled = true;
      setAligning(false);
    };
    // Liczymy raz dla danej sceny; zmiana pozostałych pól zdjęcia nie wymaga ponownego dopasowania
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAlign, scene]);

  let status: PeakSceneStatus = 'loading';
  if (!located) status = 'noLocation';
  else if (metaDone && exifHeading === undefined && !photo.view) status = 'noDirection';
  else if (peaks.length === 0) status = poisStatus === 'ready' ? 'outside' : 'poisLoading';
  else if (result?.key === key) status = result.status;

  return {
    status,
    scene: status === 'ready' ? result?.scene : undefined,
    exifHeading,
    exifPitch: photo.pitch ?? 0,
    roll: photo.roll ?? 0,
    hfov,
    aspect,
    auto: photo.autoView ?? undefined,
    aligning: aligning || wantAlign,
  };
}
