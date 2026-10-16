// Zdjęcia w aplikacji: kontekst + zapis w AsyncStorage. Ekrany zmieniają zdjęcia tylko przez usePhotos().
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { nowLocal } from './dates';
import type { GeoPoint } from './exif';
import { deletePhotoFile, storePhotoFile } from './photoFiles';
import { hasLocation, newId, parsePhotos, type Photo, photoFromAsset, type PickedAsset } from './photoModel';
import { groupIntoPlaces, type Place } from './places';

const PHOTOS_KEY = 'mountainmap.photos.v1';

export type ImportResult = {
  added: Photo[];
  /** Ile wybranych zdjęć już było w aplikacji */
  duplicates: number;
  /** Ile nie udało się skopiować */
  failed: number;
};

type PhotosContextValue = {
  photos: Photo[];
  loaded: boolean;
  /** Miejsca na mapie (zdjęcia z lokalizacją, zgrupowane) */
  places: Place[];
  /** Zdjęcia bez lokalizacji */
  unlocated: Photo[];
  byId: Map<string, Photo>;
  importAssets: (assets: PickedAsset[]) => Promise<ImportResult>;
  setLocation: (ids: string[], point: GeoPoint) => void;
  /** Uzupełnia dane zdjęcia (np. dane z pliku albo ręczną poprawkę podpisów szczytów) */
  updatePhoto: (id: string, patch: Partial<Omit<Photo, 'id' | 'file'>>) => void;
  removePhoto: (id: string) => void;
};

const PhotosContext = createContext<PhotosContextValue | null>(null);

export function PhotosProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Aktualna lista także w funkcjach async (import trwa, a stan mógł się w tym czasie zmienić)
  const photosRef = useRef<Photo[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(PHOTOS_KEY)
      .then((json) => {
        const list = parsePhotos(json);
        photosRef.current = list;
        setPhotos(list);
      })
      .catch((e) => console.warn('Could not load photos', e))
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((change: (prev: Photo[]) => Photo[]) => {
    const next = change(photosRef.current);
    photosRef.current = next;
    setPhotos(next);
    AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(next)).catch((e) => console.warn('Could not save photos', e));
  }, []);

  const importAssets = useCallback(
    async (assets: PickedAsset[]): Promise<ImportResult> => {
      const known = new Set(photosRef.current.map((p) => p.source).filter(Boolean));
      const added: Photo[] = [];
      let duplicates = 0;
      let failed = 0;
      for (const asset of assets) {
        const id = newId();
        // Najpierw dane bez pliku – żeby nie kopiować duplikatów
        const draft = photoFromAsset(asset, id, '', nowLocal());
        if (draft.source && known.has(draft.source)) {
          duplicates++;
          continue;
        }
        try {
          draft.file = await storePhotoFile(asset.uri, id);
        } catch (e) {
          console.warn('Could not copy photo', e);
          failed++;
          continue;
        }
        if (draft.source) known.add(draft.source);
        added.push(draft);
      }
      if (added.length > 0) update((prev) => [...prev, ...added]);
      return { added, duplicates, failed };
    },
    [update],
  );

  const setLocation = useCallback(
    (ids: string[], point: GeoPoint) => {
      const set = new Set(ids);
      update((prev) =>
        // Inne miejsce = inna panorama: ręczna i automatyczna poprawka podpisów są już nieaktualne
        prev.map((p) =>
          set.has(p.id)
            ? { ...p, latitude: point.latitude, longitude: point.longitude, view: undefined, autoView: undefined }
            : p,
        ),
      );
    },
    [update],
  );

  const updatePhoto = useCallback(
    (id: string, patch: Partial<Omit<Photo, 'id' | 'file'>>) => {
      update((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [update],
  );

  const removePhoto = useCallback(
    (id: string) => {
      const photo = photosRef.current.find((p) => p.id === id);
      if (photo) deletePhotoFile(photo.file);
      update((prev) => prev.filter((p) => p.id !== id));
    },
    [update],
  );

  const value = useMemo(() => {
    const located = photos.filter(hasLocation);
    return {
      photos,
      loaded,
      places: groupIntoPlaces(located),
      unlocated: photos.filter((p) => !hasLocation(p)),
      byId: new Map(photos.map((p) => [p.id, p])),
      importAssets,
      setLocation,
      updatePhoto,
      removePhoto,
    };
  }, [photos, loaded, importAssets, setLocation, updatePhoto, removePhoto]);

  return <PhotosContext.Provider value={value}>{children}</PhotosContext.Provider>;
}

export function usePhotos(): PhotosContextValue {
  const ctx = useContext(PhotosContext);
  if (!ctx) throw new Error('usePhotos must be used inside PhotosProvider');
  return ctx;
}
