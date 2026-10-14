import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useColors } from '../lib/theme';

type Props = { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void };

/** Okrągły przycisk nad mapą (moja pozycja, rodzaj mapy…). */
export function MapButton({ icon, label, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
});
