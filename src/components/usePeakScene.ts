// Dane do podpisów szczytów na ekranie zdjęcia: uzupełnienie danych z pliku (nachylenie telefonu itd.)
// i ciężkie liczenie sceny (horyzont + widoczne szczyty) – raz na zdjęcie, poza renderowaniem.
import { useEffect, useMemo, useState } from 'react';
import { readPhotoFileMeta } from '../lib/photoFiles';
import { hasLocation, type Photo } from '../lib/photoModel';
import { usePhotos } from '../lib/photos';
import { analyzeScene, horizontalFov, PAN_MARGIN, type PhotoScene, trueHeading } from '../lib/peakLabels';
import { tiltFromGravity } from '../lib/exifFile';
import type { Poi } from '../lib/pois';
import { usePois } from '../lib/poiStore';
import { loadDem } from '../lib/terrain';

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
};

/** Gdy ręcznie obrócony kierunek odjedzie od środka policzonej sceny o więcej, liczymy scenę od nowa. */
const RECENTER_AFTER = PAN_MARGIN * 0.6;

export function usePeakScene(photo: Photo, active: boolean): PeakSceneState {
  const { updatePhoto } = usePhotos();
  const { pois, status: poisStatus } = usePois();
  const peaks = useMemo(() => pois.filter((p) => p.kind === 'peak'), [pois]);

  // 1. Raz na zdjęcie: dane prosto z pliku (iPhone: nachylenie; starsze importy: kierunek i ogniskowa)
  useEffect(() => {
    if (!active || photo.fileMetaRead) return;
    let meta: ReturnType<typeof readPhotoFileMeta> = {};
    try {
      meta = readPhotoFileMeta(photo.file);
    } catch (e) {
      console.warn('Could not read photo file metadata', e);
    }
    const patch: Partial<Photo> = { fileMetaRead: true };
    const orientation = photo.orientation ?? meta.orientation ?? (photo.height > photo.width ? 6 : 1);
    if (meta.gravity) {
      const tilt = tiltFromGravity(meta.gravity, orientation);
      patch.pitch = Math.round(tilt.pitch * 100) / 100;
      patch.roll = Math.round(tilt.roll * 100) / 100;
    }
    if (photo.direction === undefined && meta.direction !== undefined) patch.direction = meta.direction;
    if (photo.directionRef === undefined && meta.directionRef) patch.directionRef = meta.directionRef;
    if (photo.focal35 === undefined && meta.focal35 !== undefined) patch.focal35 = meta.focal35;
    if (photo.orientation === undefined && meta.orientation !== undefined) patch.orientation = meta.orientation;
    updatePhoto(photo.id, patch);
  }, [active, photo, updatePhoto]);

  const aspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 4 / 3;
  const hfov = horizontalFov(photo.width || 4, photo.height || 3, photo.focal35);
  const exifHeading = photo.direction !== undefined ? trueHeading(photo.direction, photo.directionRef) : undefined;
  const wantedHeading = photo.view?.heading ?? exifHeading;

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
  const ready = active && photo.fileMetaRead === true && located && center !== undefined && peaks.length > 0;

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

  let status: PeakSceneStatus = 'loading';
  if (!located) status = 'noLocation';
  else if (photo.fileMetaRead && exifHeading === undefined && !photo.view) status = 'noDirection';
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
  };
}
