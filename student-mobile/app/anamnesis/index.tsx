import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ClipboardList, Clock, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react-native';

type Question = {
  id: string
  text: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'multi' | 'photo'
  options?: string[]
  required?: boolean
  exampleImage?: string
}

type AnamnesisModel = {
  id: string
  title: string
  questions: Question[]
  ends_at?: string
  personal_id: string
}

type AnamnesisResponse = {
  id: string
  created_at: string
  data: {
    modelId: string
    answers: Record<string, any>
  }
  renew_in_days?: number
}

export default function AnamnesisList() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<AnamnesisModel[]>([]);
  const [responses, setResponses] = useState<AnamnesisResponse[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user])
  );

  async function loadData() {
    try {
        setLoading(true);
        
        // Verificação de Status
        const { data: profile } = await supabase
             .from('profiles')
             .select('data')
             .eq('id', user?.id)
             .single();
         
        const status = profile?.data?.status || 'ativo';
        if (status !== 'ativo' && status !== 'active') {
             setIsBlocked(true);
        }

        // 1. Busca Modelos Atribuídos ao Aluno
        const { data: modelsData } = await supabase
            .from('protocols')
            .select('*')
            .eq('type', 'anamnesis_model')
            .eq('student_id', user?.id);
        
        // 2. Busca Respostas do Aluno
        const { data: responsesData } = await supabase
            .from('protocols')
            .select('*')
            .eq('type', 'anamnesis')
            .eq('student_id', user?.id)
            .order('created_at', { ascending: false });

        setModels((modelsData || []).map(d => ({
            id: d.id,
            title: d.title,
            questions: d.data?.questions || [],
            ends_at: d.ends_at,
            personal_id: d.personal_id
        })));

        setResponses((responsesData || []).map(d => ({
            id: d.id,
            created_at: d.created_at,
            data: d.data,
            renew_in_days: d.renew_in_days
        })));

    } catch (error) {
        console.error('Erro ao carregar anamneses:', error);
    } finally {
        setLoading(false);
    }
  }

  const getDaysLeft = (endsAt?: string) => {
      if (!endsAt) return null;
      const end = new Date(endsAt).getTime();
      const now = new Date().getTime();
      const diff = end - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days;
  };

  const handleStartAnswering = (modelId: string) => {
      if (isBlocked) {
          // Alert.alert('Atenção', 'Sua conta está inativa. Contate seu personal para responder.');
          // return;
          // Allowing mostly for viewing, but answering might be blocked. Logic says check isBlocked.
          // For now let's navigate and let the next screen handle or block here.
      }
      router.push({ pathname: '/anamnesis/answer', params: { modelId } });
  };

  const handleViewResponse = (responseId: string, modelId: string) => {
      router.push({ pathname: '/anamnesis/view', params: { responseId, modelId } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anamnese</Text>
        <View style={{ width: 40 }} /> 
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          
          {/* Section: Available */}
          <View style={styles.section}>
             <View style={styles.sectionHeader}>
                <ClipboardList size={20} color="#0f172a" />
                <Text style={styles.sectionTitle}>Disponíveis para Responder</Text>
             </View>

             {models.length === 0 ? (
                 <View style={styles.emptyCard}>
                     <Text style={styles.emptyText}>Nenhum formulário atribuído.</Text>
                 </View>
             ) : (
                 models.map(m => {
                    const days = getDaysLeft(m.ends_at);
                    let statusColor = '#64748b';
                    let statusBg = '#f1f5f9';
                    let statusText = '';
                    
                    const modelResponses = responses.filter(r => r.data.modelId === m.id);
                    const lastResponse = modelResponses[0];

                    if (lastResponse) {
                        if (m.ends_at) {
                            let nextDueDate = new Date(m.ends_at);
                            const now = new Date();
                            while (nextDueDate < now) {
                                nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                            }
                            const diff = nextDueDate.getTime() - now.getTime();
                            const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                            statusColor = '#16a34a';
                            statusBg = '#dcfce7';
                            statusText = `Vence em ${daysLeft} dias`;
                        } else {
                            statusColor = '#16a34a';
                            statusBg = '#dcfce7';
                            statusText = 'Respondida';
                        }
                    } else if (days !== null) {
                        if (days < 0) {
                            statusColor = '#ef4444';
                            statusBg = '#fee2e2';
                            statusText = `Vencida há ${Math.abs(days)} dias`;
                        } else if (days === 0) {
                            statusColor = '#f59e0b';
                            statusBg = '#fef3c7';
                            statusText = 'Vence hoje!';
                        } else {
                            statusColor = '#16a34a';
                            statusBg = '#dcfce7';
                            statusText = `Vence em ${days} dias`;
                        }
                    }

                    return (
                        <View key={m.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>{m.title}</Text>
                                {statusText ? (
                                    <View style={[styles.badge, { backgroundColor: statusBg }]}>
                                        <Text style={[styles.badgeText, { color: statusColor }]}>{statusText}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text style={styles.cardSubtitle}>{m.questions.length} perguntas</Text>
                            
                            <TouchableOpacity 
                                style={styles.button}
                                onPress={() => handleStartAnswering(m.id)}
                            >
                                <Text style={styles.buttonText}>Responder Agora</Text>
                                <ChevronRight size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    );
                 })
             )}
          </View>

          {/* Section: History */}
          <View style={styles.section}>
             <View style={styles.sectionHeader}>
                <Clock size={20} color="#0f172a" />
                <Text style={styles.sectionTitle}>Histórico de Envios</Text>
             </View>

             {responses.length === 0 ? (
                 <View style={styles.emptyCard}>
                     <Text style={styles.emptyText}>Nenhuma resposta enviada ainda.</Text>
                 </View>
             ) : (
                 responses.map(r => {
                     const modelTitle = models.find(m => m.id === r.data.modelId)?.title || 'Anamnese (Modelo removido)';
                     return (
                        <TouchableOpacity 
                            key={r.id} 
                            style={styles.historyCard}
                            onPress={() => handleViewResponse(r.id, r.data.modelId)}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.historyTitle}>{modelTitle}</Text>
                                <Text style={styles.historyDate}>
                                    Enviado em {new Date(r.created_at).toLocaleDateString('pt-BR')} às {new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            <View style={styles.historyStatus}>
                                <CheckCircle size={14} color="#16a34a" />
                                <Text style={styles.historyStatusText}>Enviado</Text>
                            </View>
                        </TouchableOpacity>
                     );
                 })
             )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  backButton: { padding: 8, marginLeft: -8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24 },
  
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  
  emptyCard: { 
    padding: 24, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed'
  },
  emptyText: { color: '#94a3b8' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 8 },
  cardSubtitle: { color: '#64748b', fontSize: 14, marginBottom: 16 },
  
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  button: {
    backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  historyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  historyTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  historyDate: { fontSize: 12, color: '#64748b', marginTop: 4 },
  historyStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  historyStatusText: { fontSize: 11, fontWeight: '700', color: '#16a34a' }
});
