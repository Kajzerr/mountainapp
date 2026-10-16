// Piksele zmniejszonego zdjęcia do automatycznego dopasowania podpisów (skylineAlign.ts): expo-image-manipulator
// zmniejsza zdjęcie (także HEIC, już obrócone tak jak na ekranie) i zapisuje je jako JPEG w base64,
// a jpeg-js (czysty JS – działa w Expo Go) rozpakowuje go do RGBA.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { base64ToBytes } from './dem';

/** Szerokość zmniejszonego zdjęcia – wystarcza do znalezienia grani, a liczy się szybko. */
export const ALIGN_WIDTH = 320;

export type SmallImage = { width: number; height: number; data: Uint8Array };

export async function loadSmallImage(uri: string, width = ALIGN_WIDTH): Promise<SmallImage> {
  const context = ImageManipulator.manipulate(uri).resize({ width });
  const image = await context.renderAsync();
  try {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.9 });
    if (!saved.base64) throw new Error('No base64 data');
    const decoded = decode(base64ToBytes(saved.base64), { useTArray: true, formatAsRGBA: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  } finally {
    image.release();
    context.release();
  }
}
