import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { formatTakenAt } from '../lib/dates';
import { photoUri } from '../lib/photoFiles';
import { hasLocation } from '../lib/photoModel';
import { usePhotos } from '../lib/photos';
import { useT } from '../lib/settings';
import { Colors, fonts, useColors } from '../lib/theme';

/** Jedno zdjęcie: podgląd, data, miejsce, zmiana miejsca i usuwanie. Parametr: id. */
export default function PhotoScreen() {
  const colors = useColors();
  const t = useT();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { byId, removePhoto } = usePhotos();
  const photo = id ? byId.get(id) : undefined;

  if (!photo) {
    return (
      <View style={[styles.gone, { backgroundColor: colors.background }]}>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{t.photo.gone}</Text>
      </View>
    );
  }

  // Całe zdjęcie na szerokość ekranu, ale nie wyższe niż ~65% ekranu (pionowe zdjęcia)
  const ratio = photo.width > 0 && photo.height > 0 ? photo.height / photo.width : 0.75;
  const imageHeight = Math.min(width * ratio, height * 0.65);
  const located = hasLocation(photo);

  const confirmDelete = () =>
    Alert.alert(t.photo.deleteTitle, t.photo.deleteText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () => {
          router.back();
          removePhoto(photo.id);
        },
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Image
        source={{ uri: photoUri(photo.file) }}
        style={{ width, height: imageHeight, backgroundColor: colors.card }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={styles.info}>
        <InfoRow colors={colors} icon="calendar-outline" text={formatTakenAt(photo.takenAt) ?? t.photo.noDate} />
        <InfoRow
          colors={colors}
          icon="location-outline"
          text={located ? `${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}` : t.photo.noLocation}
        />
        <View style={styles.actions}>
          <ActionButton
            colors={colors}
            icon="pin-outline"
            label={located ? t.photo.changeLocation : t.photo.setLocation}
            onPress={() => router.push({ pathname: '/locate', params: { ids: photo.id } })}
          />
          <ActionButton colors={colors} icon="trash-outline" label={t.common.delete} danger onPress={confirmDelete} />
        </View>
      </View>
    </ScrollView>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function InfoRow({ colors, icon, text }: { colors: Colors; icon: IconName; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={[styles.meta, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

type ActionProps = { colors: Colors; icon: IconName; label: string; onPress: () => void; danger?: boolean };

function ActionButton({ colors, icon, label, onPress, danger }: ActionProps) {
  const color = danger ? colors.danger : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  gone: { flex: 1, alignItems: 'center', paddingTop: 60 },
  info: { padding: 16, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { fontFamily: fonts.regular, fontSize: 15 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, borderRadius: 14, paddingHorizontal: 12,
  },
  actionText: { fontFamily: fonts.semibold, fontSize: 15 },
});
