import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-5 bg-background-light dark:bg-background-dark">
        <Text className="text-xl font-bold text-charcoal dark:text-white mb-4">Esta pantalla no existe.</Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-sm text-primary">Ir a inicio</Text>
        </Link>
      </View>
    </>
  );
}
