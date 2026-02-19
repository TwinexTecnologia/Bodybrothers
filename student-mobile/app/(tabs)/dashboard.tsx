import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useAuth } from '../../lib/auth';
import { getWeeklyFrequency, getWeeklyActivity } from '../../lib/history';
import { Check, X, LogOut, Activity, Dumbbell, Utensils, ChevronRight, Bell, AlertCircle, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../hooks/useNotifications';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { notifications, hasCritical } = useNotifications();
  const [frequency, setFrequency] = useState(0);
  const [activeDays, setActiveDays] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ workouts: 0, diets: 0, name: '' });
  const [modalVisible, setModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const freq = await getWeeklyFrequency(user.id);
      const days = await getWeeklyActivity(user.id);
      setFrequency(freq);
      setActiveDays(days);

      // Carregar contagens e nome (igual ao site)
      const { data: profile } = await supabase.from('profiles').select('full_name, data').eq('id', user.id).single();
      
      const workoutIds = profile?.data?.workoutIds || [];
      const dietIds = profile?.data?.dietIds || [];

      // Contar Treinos
      let workoutQuery = supabase.from('protocols').select('id', { count: 'exact', head: true }).eq('type', 'workout').eq('status', 'active');
      if (workoutIds.length > 0) workoutQuery = workoutQuery.or(`student_id.eq.${user.id},id.in.(${workoutIds.join(',')})`);
      else workoutQuery = workoutQuery.eq('student_id', user.id);
      const { count: workoutCount } = await workoutQuery;

      // Contar Dietas
      let dietQuery = supabase.from('protocols').select('id', { count: 'exact', head: true }).eq('type', 'diet').eq('status', 'active');
      if (dietIds.length > 0) dietQuery = dietQuery.or(`student_id.eq.${user.id},id.in.(${dietIds.join(',')})`);
      else dietQuery = dietQuery.eq('student_id', user.id);
      const { count: dietCount } = await dietQuery;

      setStats({
          name: profile?.full_name?.split(' ')[0] || 'Aluno',
          workouts: workoutCount || 0,
          diets: dietCount || 0
      });

    } catch (error) {
      console.error(error);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Abre o modal automaticamente se tiver alertas críticos (igual ao site)
  useEffect(() => {
    if (hasCritical) {
        setModalVisible(true);
    }
  }, [hasCritical]);

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
            <Text style={styles.greeting}>Olá, {stats.name} 👋</Text>
            <Text style={styles.subtitle}>Resumo do seu progresso hoje.</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.iconButton}>
                <Bell size={24} color="#64748b" />
                {notifications.length > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{notifications.length}</Text>
                    </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { signOut(); router.replace('/(auth)/login'); }} style={styles.iconButton}>
                <LogOut size={24} color="#64748b" />
              </TouchableOpacity>
          </View>
        </View>

        {/* Alerta Crítico */}
        {hasCritical && (
            <TouchableOpacity 
                style={styles.criticalBanner} 
                onPress={() => setModalVisible(true)}
            >
                <View style={styles.criticalIcon}>
                    <AlertCircle size={24} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.criticalTitle}>Atenção Necessária</Text>
                    <Text style={styles.criticalText}>Você possui pendências urgentes.</Text>
                </View>
                <ChevronRight size={20} color="#dc2626" />
            </TouchableOpacity>
        )}

        {/* Card de Frequência */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Activity size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Frequência Semanal</Text>
                <Text style={styles.freqCount}>{frequency} treinos</Text>
              </View>
            </View>
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

        {/* Grid de Cards Grandes */}
        <View style={styles.grid}>
            <TouchableOpacity style={styles.bigCard} onPress={() => router.push('/(tabs)/workouts')}>
                <View style={[styles.iconBox, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}>
                    <Dumbbell size={24} color="#3b82f6" />
                </View>
                <View>
                    <Text style={styles.bigCardLabel}>Meus Treinos</Text>
                    <Text style={styles.bigCardValue}>{stats.workouts}</Text>
                    <Text style={[styles.bigCardSub, { color: '#3b82f6' }]}>{stats.workouts > 0 ? 'Ver lista' : 'Nenhum ativo'}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bigCard} onPress={() => router.push('/(tabs)/diets')}>
                <View style={[styles.iconBox, { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                    <Utensils size={24} color="#10b981" />
                </View>
                <View>
                    <Text style={styles.bigCardLabel}>Minha Dieta</Text>
                    <Text style={styles.bigCardValue}>{stats.diets}</Text>
                    <Text style={[styles.bigCardSub, { color: '#10b981' }]}>{stats.diets > 0 ? 'Ver plano' : 'Nenhuma ativa'}</Text>
                </View>
            </TouchableOpacity>
        </View>

        {/* Card CTA Escuro */}
        <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Pronto para treinar?</Text>
            <Text style={styles.ctaText}>Acesse seu treino de hoje e registre seu progresso.</Text>
            <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/(tabs)/workouts')}>
                <Text style={styles.ctaButtonText}>Ir para Treinos</Text>
                <ChevronRight size={16} color="#fff" />
            </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal de Notificações */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Notificações</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {notifications.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Bell size={48} color="#cbd5e1" />
                        <Text style={styles.emptyText}>Tudo em dia!</Text>
                        <Text style={styles.emptySub}>Você não tem novas notificações.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={[styles.notifCard, item.daysRemaining < 0 && styles.notifCardUrgent]}
                                onPress={() => {
                                    setModalVisible(false);
                                    if (item.type === 'anamnesis') router.push('/anamnesis');
                                    else if (item.type === 'financial') router.push('/financial');
                                }}
                            >
                                <View style={[
                                    styles.notifIcon, 
                                    { backgroundColor: item.daysRemaining < 0 ? '#fee2e2' : '#fff7ed' }
                                ]}>
                                    {item.type === 'anamnesis' ? (
                                        <Activity size={20} color={item.daysRemaining < 0 ? '#dc2626' : '#ea580c'} />
                                    ) : (
                                        <Clock size={20} color={item.daysRemaining < 0 ? '#dc2626' : '#ea580c'} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.notifTitle, item.daysRemaining < 0 && { color: '#dc2626' }]}>
                                        {item.type === 'anamnesis' ? 'Anamnese' : 'Financeiro'}
                                    </Text>
                                    <Text style={styles.notifMessage}>{item.message}</Text>
                                    <Text style={styles.notifDate}>
                                        {new Date(item.date).toLocaleDateString()}
                                    </Text>
                                </View>
                                <ChevronRight size={16} color="#cbd5e1" />
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>
        </View>
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
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingRight: 4, // Margem extra para não colar na borda
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4
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
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9'
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden'
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
  
  // Grid
  grid: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 24
  },
  bigCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16, // Reduzido
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    justifyContent: 'space-between',
    minHeight: 120 // Reduzido de 140
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12, // Reduzido de 48
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1
  },
  bigCardLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  bigCardValue: { fontSize: 24, color: '#0f172a', fontWeight: 'bold', marginVertical: 4 },
  bigCardSub: { fontSize: 12, fontWeight: '500' },

  // CTA Card
  ctaCard: {
      backgroundColor: '#0f172a',
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 5
  },
  ctaTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  ctaText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  ctaButton: {
      backgroundColor: '#3b82f6',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 8
  },
  ctaButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Icon Button & Badge
  iconButton: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0',
      position: 'relative'
  },
  badge: {
      position: 'absolute', top: -4, right: -4,
      backgroundColor: '#ef4444', width: 18, height: 18, borderRadius: 9,
      alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff'
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Critical Banner
  criticalBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#fef2f2', padding: 16, borderRadius: 16, marginBottom: 24,
      borderWidth: 1, borderColor: '#fee2e2'
  },
  criticalIcon: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: '#fee2e2',
      alignItems: 'center', justifyContent: 'center'
  },
  criticalTitle: { color: '#991b1b', fontWeight: 'bold', fontSize: 16 },
  criticalText: { color: '#b91c1c', fontSize: 14 },

  // Modal Styles
  modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'
  },
  modalContent: {
      backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, height: '70%', shadowColor: '#000', shadowOffset: {width: 0, height: -4},
      shadowOpacity: 0.1, shadowRadius: 10, elevation: 10
  },
  modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#334155', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  
  notifCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#fff', padding: 16, borderRadius: 16,
      borderWidth: 1, borderColor: '#f1f5f9'
  },
  notifCardUrgent: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  notifIcon: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center'
  },
  notifTitle: { fontSize: 14, fontWeight: 'bold', color: '#ea580c', marginBottom: 2 },
  notifMessage: { fontSize: 14, color: '#334155', marginBottom: 4 },
  notifDate: { fontSize: 12, color: '#94a3b8' }
});
