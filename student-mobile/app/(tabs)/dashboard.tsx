import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useAuth } from '../../lib/auth';
import { getWeeklyFrequency, getWeeklyActivity } from '../../lib/history';
import { Check, X, LogOut, Activity } from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [frequency, setFrequency] = useState(0);
  const [activeDays, setActiveDays] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const freq = await getWeeklyFrequency(user.id);
      const days = await getWeeklyActivity(user.id);
      setFrequency(freq);
      setActiveDays(days);
    } catch (error) {
      console.error(error);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const todayIndex = new Date().getDay();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, Aluno(a)</Text>
            <Text style={styles.subtitle}>Vamos treinar hoje?</Text>
          </View>
          <TouchableOpacity onPress={() => { signOut(); router.replace('/(auth)/login'); }} style={styles.logoutButton}>
            <LogOut size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Card de Frequência */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Activity size={20} color="#3b82f6" />
              <Text style={styles.cardTitle}>Frequência Semanal</Text>
            </View>
            <Text style={styles.freqCount}>{frequency} treinos</Text>
          </View>

          <View style={styles.daysRow}>
            {weekDays.map((day, i) => {
              const isActive = activeDays.includes(i);
              const isToday = i === todayIndex;
              const isPast = i < todayIndex;

              let bgColor = '#f1f5f9';
              let borderColor = 'transparent';
              let textColor = '#94a3b8';

              if (isActive) {
                bgColor = '#dcfce7';
                borderColor = '#10b981';
                textColor = '#166534';
              } else if (isToday) {
                bgColor = '#eff6ff';
                borderColor = '#3b82f6';
                textColor = '#1e40af';
              } else if (isPast) {
                bgColor = '#fff';
                borderColor = '#e2e8f0';
                textColor = '#cbd5e1';
              }

              return (
                <View key={i} style={styles.dayColumn}>
                  <View
                    style={[
                      styles.dayCircle,
                      { backgroundColor: bgColor, borderColor: borderColor, borderWidth: isActive || isToday ? 2 : 1 },
                    ]}
                  >
                    {isActive ? (
                      <Check size={14} color="#166534" strokeWidth={3} />
                    ) : isPast ? (
                      <X size={14} color="#cbd5e1" />
                    ) : (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isToday ? '#3b82f6' : 'transparent' }} />
                    )}
                  </View>
                  <Text style={[styles.dayText, { color: isToday ? '#3b82f6' : '#64748b', fontWeight: isToday ? 'bold' : 'normal' }]}>
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Atalho para Treinos */}
        <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/(tabs)/workouts')}>
          <Text style={styles.ctaText}>VER MEUS TREINOS</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  freqCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 12,
  },
  ctaButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
