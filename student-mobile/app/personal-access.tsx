import React from 'react';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldAlert, LogOut } from 'lucide-react-native';
import { useAuth } from '../lib/auth';

export default function PersonalAccessScreen() {
  const { session, role, signOut } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (role === 'aluno') {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrapper}>
          <ShieldAlert size={32} color="#dc2626" />
        </View>

        <Text style={styles.title}>Acesso do personal identificado</Text>
        <Text style={styles.description}>
          Este aplicativo continua disponível apenas para alunos. Para acessar sua conta de personal,
          use o painel web ou o web mobile.
        </Text>

        <TouchableOpacity style={styles.button} onPress={() => void signOut()}>
          <LogOut size={18} color="#fff" />
          <Text style={styles.buttonText}>Sair deste login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
