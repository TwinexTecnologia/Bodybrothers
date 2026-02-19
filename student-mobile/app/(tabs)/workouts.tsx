import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, Alert, Image, Dimensions, Platform } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Dumbbell, ChevronRight, X, Clock, Play, CheckCircle, ArrowRight, MessageSquare, ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { startSession, getWeeklyActivity } from '../../lib/history';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';

// Tipos
type ExerciseSet = {
    type: 'warmup' | 'feeder' | 'working' | 'custom' | 'topset'
    customLabel?: string
    series: string
    reps: string
    load: string
    rest: string
}

type Exercise = {
  name: string;
  sets?: ExerciseSet[];
  series: string;
  reps: string;
  load: string;
  rest: string;
  videoUrl?: string;
  video_url?: string;
  notes?: string;
  warmupSeries?: string
  warmupReps?: string
  warmupLoad?: string
  warmupRest?: string
  feederSeries?: string
  feederReps?: string
  feederLoad?: string
  feederRest?: string
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
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);

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

          const session = await startSession(w.id, w.title, user.id);
          setSelectedWorkout(null);
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

  const getYoutubeThumbnail = (url?: string) => {
      if (!url) return null;
      const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
      return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Seus Treinos</Text>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}</Text>
        </View>

        {loading && <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />}

        {!loading && workouts.length === 0 && (
            <View style={styles.emptyState}>
                <Dumbbell size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>Nenhum treino encontrado.</Text>
            </View>
        )}

        {workoutsByDay.map(group => (
            <View key={group.dayKey} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>{group.label}</Text>
                        {group.workouts[0]?.data.goal && (
                            <Text style={styles.sectionSubtitle}>Foco: <Text style={{color: '#3b82f6', fontWeight: 'bold'}}>{group.workouts[0].data.goal}</Text></Text>
                        )}
                    </View>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{group.workouts.length} {group.workouts.length === 1 ? 'treino' : 'treinos'}</Text>
                    </View>
                </View>

                {group.workouts.map(w => (
                    <View key={w.id} style={styles.workoutItem}>
                        <Text style={styles.workoutTitleItem}>{w.title}</Text>
                        <TouchableOpacity 
                            onPress={() => setSelectedWorkout(w)}
                        >
                            <LinearGradient
                                colors={['#0ea5e9', '#0284c7']}
                                start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                                style={styles.viewButton}
                            >
                                <Text style={styles.viewButtonText}>VER TREINO</Text>
                                <View style={styles.arrowBox}>
                                    <ArrowRight size={14} color="#0ea5e9" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        ))}

        {unscheduledWorkouts.length > 0 && (
            <View style={{ marginTop: 24 }}>
                <Text style={styles.otherTitle}>Outros Treinos Disponíveis</Text>
                {unscheduledWorkouts.map(w => (
                    <View key={w.id} style={styles.otherCard}>
                        <View>
                            <Text style={styles.otherCardTitle}>{w.title}</Text>
                            <Text style={styles.otherCardSub}>{w.data.exercises.length} exercícios</Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.otherButton}
                            onPress={() => setSelectedWorkout(w)}
                        >
                            <Text style={styles.otherButtonText}>Ver</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        )}
      </ScrollView>

      {/* Modal de Detalhes Moderno */}
      <Modal visible={!!selectedWorkout} animationType="slide" presentationStyle="pageSheet">
          {selectedWorkout && (
              <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                  {/* Header Azul Escuro */}
                  <LinearGradient
                      colors={['#1e3a8a', '#172554']}
                      style={styles.modalHeader}
                  >
                      <TouchableOpacity onPress={() => setSelectedWorkout(null)} style={styles.backButton}>
                          <ChevronLeft size={16} color="#fff" />
                          <Text style={{color: '#fff', fontWeight: 'bold'}}>Voltar</Text>
                      </TouchableOpacity>

                      <Text style={styles.modalTitle}>{selectedWorkout.title}</Text>
                      
                      <View style={styles.modalTags}>
                        {selectedWorkout.data.goal && (
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{selectedWorkout.data.goal}</Text>
                            </View>
                        )}
                        <View style={styles.tag}>
                            <Text style={styles.tagText}>{selectedWorkout.data.exercises.length} exercícios</Text>
                        </View>
                      </View>

                      <View style={styles.modalHero}>
                          <View style={styles.heroIcon}>
                              <Dumbbell size={32} color="#fff" />
                          </View>
                          
                          {activeDays.includes(new Date().getDay()) ? (
                              <View style={styles.doneBadge}>
                                  <CheckCircle size={20} color="#16a34a" />
                                  <Text style={styles.doneText}>TREINO REALIZADO</Text>
                              </View>
                          ) : (
                              <TouchableOpacity onPress={() => handleStartSession(selectedWorkout)}>
                                  <LinearGradient
                                      colors={['#10b981', '#059669']}
                                      style={styles.startButton}
                                  >
                                      <Play size={20} fill="#fff" color="#fff" />
                                      <Text style={styles.startButtonText}>INICIAR TREINO</Text>
                                  </LinearGradient>
                              </TouchableOpacity>
                          )}
                      </View>
                  </LinearGradient>

                  <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                      {selectedWorkout.data.notes && (
                          <View style={styles.notesBox}>
                              <MessageSquare size={18} color="#ea580c" style={{marginTop: 2}} />
                              <View>
                                  <Text style={styles.notesTitle}>Observações Gerais</Text>
                                  <Text style={styles.notesText}>{selectedWorkout.data.notes}</Text>
                              </View>
                          </View>
                      )}

                      {selectedWorkout.data.exercises.map((ex, i) => {
                          // Lógica Simplificada para pegar dados
                          let series = ex.series;
                          let reps = ex.reps;
                          let load = ex.load;
                          let rest = ex.rest;

                          // Se tiver sets definidos, tenta pegar do primeiro working set ou do primeiro set
                          if (ex.sets && ex.sets.length > 0) {
                              const workingSet = ex.sets.find(s => s.type === 'working');
                              if (workingSet) {
                                  series = workingSet.series;
                                  reps = workingSet.reps;
                                  load = workingSet.load;
                                  rest = workingSet.rest;
                              } else {
                                  series = ex.sets[0].series;
                                  reps = ex.sets[0].reps;
                                  load = ex.sets[0].load;
                                  rest = ex.sets[0].rest;
                              }
                          }

                          // Se series ainda estiver vazio, tenta pegar de warmup/feeder das props antigas
                          if (!series && ex.warmupSeries) { series = ex.warmupSeries; reps = ex.warmupReps || ''; }

                          return (
                              <View key={i} style={styles.exerciseCard}>
                                  {/* Coluna Esquerda */}
                                  <View style={{ flex: 1, paddingRight: 12 }}>
                                      <Text style={styles.exerciseName}>{ex.name}</Text>
                                      
                                      <View style={{ gap: 4 }}>
                                          <Text style={styles.simpleSetText}>
                                              <Text style={styles.simpleSetLabel}>SÉRIES: </Text>
                                              {series} x {reps}
                                          </Text>
                                          {load ? (
                                              <Text style={styles.simpleSetText}>
                                                  <Text style={styles.simpleSetLabel}>CARGA: </Text>
                                                  {load}
                                              </Text>
                                          ) : null}
                                          {rest ? (
                                              <Text style={styles.simpleSetText}>
                                                  <Text style={styles.simpleSetLabel}>DESCANSO: </Text>
                                                  {rest}
                                              </Text>
                                          ) : null}
                                      </View>

                                      {ex.notes && (
                                          <View style={styles.exNoteSimple}>
                                              <Text style={styles.exNoteText}>{ex.notes}</Text>
                                          </View>
                                      )}
                                  </View>

                                  {/* Coluna Direita (Thumbnail) */}
                                  {(ex.videoUrl || ex.video_url) ? (
                                      <TouchableOpacity 
                                          style={styles.thumbBoxSmall}
                                          onPress={() => setVideoModalUrl(ex.videoUrl || ex.video_url || null)}
                                      >
                                          <Image 
                                              source={{ uri: getYoutubeThumbnail(ex.videoUrl || ex.video_url) || 'https://via.placeholder.com/150' }} 
                                              style={{ width: '100%', height: '100%' }}
                                              resizeMode="cover"
                                          />
                                          <View style={styles.playOverlaySmall}>
                                              <Play size={24} fill="#fff" color="#fff" />
                                          </View>
                                      </TouchableOpacity>
                                  ) : null}
                              </View>
                          );
                      })}
                  </ScrollView>
              </View>
          )}
      </Modal>

      {/* Modal Video */}
      <Modal visible={!!videoModalUrl} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: '#000' }}>
              <View style={styles.videoHeader}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Vídeo</Text>
                  <TouchableOpacity onPress={() => setVideoModalUrl(null)} style={{ padding: 8 }}>
                      <X color="#fff" size={24} />
                  </TouchableOpacity>
              </View>
              {videoModalUrl && (
                  Platform.OS === 'web' ? (
                    <iframe 
                        src={videoModalUrl.includes('youtube') ? videoModalUrl.replace('watch?v=', 'embed/') : videoModalUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                  ) : (
                    <WebView 
                        source={{ uri: videoModalUrl.includes('youtube') ? videoModalUrl : videoModalUrl }} 
                        style={{ flex: 1 }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                    />
                  )
              )}
          </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 16 },
  headerRow: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 24, gap: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  dateText: { fontSize: 14, color: '#64748b', textTransform: 'capitalize', marginTop: 4 },
  emptyState: { padding: 40, alignItems: 'center', backgroundColor: '#fff', borderRadius: 20 },
  emptyText: { color: '#94a3b8', marginTop: 16 },

  // Cards da Lista
  sectionCard: {
      backgroundColor: '#fff', borderRadius: 24, marginBottom: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
      borderWidth: 1, borderColor: '#f1f5f9'
  },
  sectionHeader: {
      padding: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc', // Padding reduzido
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 8 }, // Flex 1 para não empurrar
  sectionSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  countBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, minWidth: 60, alignItems: 'center' }, // Menor
  countText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  workoutItem: { padding: 16 }, // Padding reduzido
  workoutTitleItem: { fontSize: 15, color: '#334155', marginBottom: 10, fontWeight: '500' },
  viewButton: {
      padding: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' // Menor
  },
  viewButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  arrowBox: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 8 },

  // Outros
  otherTitle: { fontSize: 16, fontWeight: '600', color: '#64748b', marginBottom: 16 },
  otherCard: { 
      backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 12,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderWidth: 1, borderColor: '#f1f5f9'
  },
  otherCardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  otherCardSub: { fontSize: 12, color: '#64748b' },
  otherButton: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  otherButtonText: { fontWeight: '700', color: '#0f172a', fontSize: 12 },

  // Modal
  modalHeader: { padding: 20, paddingBottom: 30 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 12 },
  modalTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, // Adicionado flexWrap
  tag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalHero: { marginTop: 20, alignItems: 'center', gap: 16 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  startButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, shadowColor: '#10b981', shadowOpacity: 0.4, shadowOffset: {width: 0, height: 10}, shadowRadius: 20, elevation: 10 },
  startButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  doneBadge: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30 },
  doneText: { color: '#16a34a', fontWeight: '700', fontSize: 14 },

  // Exercises - Novo Layout Horizontal
  notesBox: { backgroundColor: '#fff7ed', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#ffedd5', flexDirection: 'row', gap: 12, marginBottom: 24 },
  notesTitle: { color: '#ea580c', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  notesText: { color: '#9a3412', fontSize: 14, lineHeight: 20 },
  
  exerciseCard: {
      backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
      flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#f1f5f9',
      shadowColor: '#000', shadowOpacity: 0.02, shadowOffset: {width: 0, height: 2}, elevation: 1,
      alignItems: 'center'
  },
  // Thumb Pequena Direita
  thumbBoxSmall: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  playOverlaySmall: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  
  // Textos Simples
  simpleSetText: { fontSize: 13, color: '#334155', fontWeight: '500', marginBottom: 2 },
  simpleSetLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginRight: 4 },
  
  exerciseName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  exNoteSimple: { marginTop: 8, backgroundColor: '#fff7ed', padding: 8, borderRadius: 8 },
  exNoteText: { fontSize: 12, color: '#c2410c' }
});
