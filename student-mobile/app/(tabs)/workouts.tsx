import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Dumbbell, ChevronRight, X, Clock, Play, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { startSession, getWeeklyActivity } from '../../lib/history';
import { router } from 'expo-router';

// Tipos simplificados
type Exercise = {
  name: string;
  series: string;
  reps: string;
  load: string;
  rest: string;
  videoUrl?: string;
  notes?: string;
};

type Workout = {
  id: string;
  title: string;
  data: {
    goal?: string;
    exercises: Exercise[];
    notes?: string;
  };
};

const DAYS_MAP: Record<string, string> = {
  'seg': 'Segunda-feira', 'ter': 'Terça-feira', 'qua': 'Quarta-feira',
  'qui': 'Quinta-feira', 'sex': 'Sexta-feira', 'sab': 'Sábado', 'dom': 'Domingo'
};
const DAYS_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export default function Workouts() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [schedule, setSchedule] = useState<Record<string, string[]>>({});
  const [activeDays, setActiveDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('data').eq('id', user.id).single();
      
      const status = profile?.data?.status || 'ativo';
      if (status !== 'ativo' && status !== 'active') {
        Alert.alert('Acesso Bloqueado', 'Sua conta está inativa. Contate seu personal.');
        return;
      }

      const linkedIds = profile?.data?.workoutIds || [];
      const sched = profile?.data?.workoutSchedule || {};
      setSchedule(sched);

      // Carrega dias ativos
      const days = await getWeeklyActivity(user.id);
      setActiveDays(days);

      let query = supabase.from('protocols').select('*').eq('type', 'workout').eq('status', 'active');
      
      if (linkedIds.length > 0) {
        query = query.or(`student_id.eq.${user.id},id.in.(${linkedIds.join(',')})`);
      } else {
        query = query.eq('student_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWorkouts(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
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

  const handleStartSession = async (w: Workout) => {
      try {
          if (!user) return;

          const todayIndex = new Date().getDay();
          if (activeDays.includes(todayIndex)) {
              Alert.alert('Descanso', 'Você já treinou hoje! Volte amanhã. 💪');
              return;
          }

          // Iniciar sessão
          const session = await startSession(w.id, w.title, user.id);
          // Fechar modal
          setSelectedWorkout(null);
          // Navegar para tela de sessão
          router.push({ pathname: '/session', params: { sessionId: session.id } });
      } catch (error) {
          Alert.alert('Erro', 'Não foi possível iniciar o treino.');
      }
  }

  // Agrupamento
  const workoutsByDay = DAYS_ORDER.map(dayKey => {
      const workoutIdsForDay: string[] = [];
      Object.entries(schedule).forEach(([wId, days]) => {
          if (Array.isArray(days)) {
              const normalizedDays = days.map(d => d.toLowerCase());
              if (normalizedDays.includes(dayKey)) workoutIdsForDay.push(wId);
          }
      });
      const dayWorkouts = workouts.filter(w => workoutIdsForDay.includes(w.id));
      return { dayKey, label: DAYS_MAP[dayKey], workouts: dayWorkouts };
  }).filter(group => group.workouts.length > 0);

  const unscheduledWorkouts = workouts.filter(w => {
      const days = schedule ? schedule[w.id] : undefined;
      return !days || !Array.isArray(days) || days.length === 0;
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.headerTitle}>Meus Treinos</Text>

        {loading && <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />}

        {!loading && workouts.length === 0 && (
            <View style={styles.emptyState}>
                <Dumbbell size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>Nenhum treino encontrado.</Text>
            </View>
        )}

        {workoutsByDay.map(group => (
            <View key={group.dayKey} style={styles.section}>
                <Text style={styles.sectionTitle}>{group.label}</Text>
                {group.workouts.map(w => (
                    <TouchableOpacity key={w.id} style={styles.card} onPress={() => setSelectedWorkout(w)}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{w.title}</Text>
                            <Text style={styles.cardSubtitle}>{w.data.exercises.length} exercícios • {w.data.goal || 'Geral'}</Text>
                        </View>
                        <ChevronRight color="#cbd5e1" />
                    </TouchableOpacity>
                ))}
            </View>
        ))}

        {unscheduledWorkouts.length > 0 && (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Outros Treinos</Text>
                {unscheduledWorkouts.map(w => (
                    <TouchableOpacity key={w.id} style={styles.card} onPress={() => setSelectedWorkout(w)}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{w.title}</Text>
                            <Text style={styles.cardSubtitle}>{w.data.exercises.length} exercícios</Text>
                        </View>
                        <ChevronRight color="#cbd5e1" />
                    </TouchableOpacity>
                ))}
            </View>
        )}
      </ScrollView>

      {/* Modal de Detalhes */}
      <Modal visible={!!selectedWorkout} animationType="slide" presentationStyle="pageSheet">
          {selectedWorkout && (
              <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                  <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={() => setSelectedWorkout(null)} style={styles.closeButton}>
                          <X color="#0f172a" size={24} />
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>{selectedWorkout.title}</Text>
                      <View style={{ width: 40 }} />
                  </View>
                  
                  <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                      {selectedWorkout.data.notes && (
                          <View style={styles.notesBox}>
                              <Text style={styles.notesText}>{selectedWorkout.data.notes}</Text>
                          </View>
                      )}

                      {selectedWorkout.data.exercises.map((ex, i) => (
                          <View key={i} style={styles.exerciseCard}>
                              <View style={styles.exerciseHeader}>
                                  <View style={styles.exerciseIndex}>
                                      <Text style={styles.indexText}>{i + 1}</Text>
                                  </View>
                                  <Text style={styles.exerciseName}>{ex.name}</Text>
                              </View>
                              <View style={styles.exerciseDetails}>
                                  <View style={styles.detailItem}>
                                      <Text style={styles.detailLabel}>SÉRIES</Text>
                                      <Text style={styles.detailValue}>{ex.series} x {ex.reps}</Text>
                                  </View>
                                  {ex.load && (
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>CARGA</Text>
                                        <Text style={styles.detailValue}>{ex.load}</Text>
                                    </View>
                                  )}
                                  <View style={styles.detailItem}>
                                      <Text style={styles.detailLabel}>DESC.</Text>
                                      <Text style={styles.detailValue}>{ex.rest}</Text>
                                  </View>
                              </View>
                              {ex.notes && <Text style={styles.exerciseNotes}>{ex.notes}</Text>}
                          </View>
                      ))}
                  </ScrollView>

                  <View style={styles.footer}>
                      <TouchableOpacity style={styles.startButton} onPress={() => handleStartSession(selectedWorkout)}>
                          <Play fill="#fff" color="#fff" size={20} />
                          <Text style={styles.startButtonText}>INICIAR TREINO</Text>
                      </TouchableOpacity>
                  </View>
              </SafeAreaView>
          )}
      </Modal>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
  },
  emptyText: {
      color: '#94a3b8',
      marginTop: 16,
  },
  // Modal
  modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
  },
  closeButton: {
      padding: 8,
  },
  modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#0f172a',
  },
  notesBox: {
      backgroundColor: '#fff7ed',
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#ffedd5',
  },
  notesText: {
      color: '#c2410c',
  },
  exerciseCard: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
  },
  exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
  },
  exerciseIndex: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#f1f5f9',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
  },
  indexText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#64748b',
  },
  exerciseName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#0f172a',
      flex: 1,
  },
  exerciseDetails: {
      flexDirection: 'row',
      gap: 16,
  },
  detailItem: {
      flex: 1,
      backgroundColor: '#f8fafc',
      padding: 8,
      borderRadius: 8,
  },
  detailLabel: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#94a3b8',
      marginBottom: 2,
  },
  detailValue: {
      fontSize: 14,
      fontWeight: '600',
      color: '#334155',
  },
  exerciseNotes: {
      marginTop: 8,
      fontSize: 12,
      color: '#64748b',
      fontStyle: 'italic',
  },
  footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#f1f5f9',
  },
  startButton: {
      backgroundColor: '#2563eb',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 16,
      gap: 8,
  },
  startButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
  },
});
