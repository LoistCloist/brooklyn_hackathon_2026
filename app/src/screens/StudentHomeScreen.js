import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function StudentHomeScreen() {
  const { user, logOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>Student</Text>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Pressable style={styles.button} onPress={logOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  badge: {
    backgroundColor: '#F0FDF4', color: '#16A34A', fontWeight: '700',
    paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginBottom: 12, overflow: 'hidden',
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  email: { color: '#666', marginBottom: 32 },
  button: {
    backgroundColor: '#EF4444', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
