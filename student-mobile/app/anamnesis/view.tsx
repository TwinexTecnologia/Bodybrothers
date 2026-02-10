import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

type Question = {
  id: string
  text: string
  type: string
}

type AnamnesisModel = {
  id: string
  questions: Question[]
}

type AnamnesisResponse = {
  id: string
  created_at: string
  data: {
    modelId: string
    answers: Record<string, any>
  }
}

export default function AnamnesisView() {
  const { responseId, modelId } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<AnamnesisResponse | null>(null);
  const [model, setModel] = useState<AnamnesisModel | null>(null);

  useEffect(() => {
    if (responseId) {
        loadData();
    }
  }, [responseId, modelId]);

  async function loadData() {
      try {
          setLoading(true);
          
          // Fetch Response
          const { data: respData } = await supabase
              .from('protocols')
              .select('*')
              .eq('id', responseId)
              .single();
          
          if (respData) {
              setResponse({
                  id: respData.id,
                  created_at: respData.created_at,
                  data: respData.data
              });
          }

          // Fetch Model (if exists)
          if (modelId) {
              const { data: modelData } = await supabase
                  .from('protocols')
                  .select('*')
                  .eq('id', modelId)
                  .single();
              
              if (modelData) {
                  setModel({
                      id: modelData.id,
                      questions: modelData.data?.questions || []
                  });
              }
          }

      } catch (error) {
          console.error('Error loading data', error);
      } finally {
          setLoading(false);
      }
  }

  if (loading) {
      return (
          <SafeAreaView style={styles.container}>
              <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>
          </SafeAreaView>
      );
  }

  if (!response) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <View>
            <Text style={styles.headerTitle}>Respostas Enviadas</Text>
            <Text style={styles.headerSubtitle}>
                {new Date(response.created_at).toLocaleDateString('pt-BR')} às {new Date(response.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
            </Text>
        </View>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {model ? (
            model.questions.map((q, index) => {
                const answer = response.data.answers[q.id];
                return (
                    <View key={q.id} style={styles.item}>
                        <Text style={styles.questionText}>{index + 1}. {q.text}</Text>
                        <View style={styles.answerBox}>
                            {q.type === 'photo' && answer ? (
                                <Image source={{ uri: answer }} style={styles.answerImage} resizeMode="contain" />
                            ) : (
                                <Text style={styles.answerText}>
                                    {Array.isArray(answer) ? answer.join(', ') : (String(answer || '-'))}
                                </Text>
                            )}
                        </View>
                    </View>
                );
            })
        ) : (
            <View>
                <Text style={styles.warningText}>O modelo original foi removido. Dados brutos:</Text>
                <View style={styles.rawContainer}>
                    <Text style={styles.rawText}>{JSON.stringify(response.data.answers, null, 2)}</Text>
                </View>
            </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  headerSubtitle: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  backButton: { padding: 8, marginLeft: -8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24 },

  item: { marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 24 },
  questionText: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 12 },
  answerBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  answerText: { fontSize: 16, color: '#0f172a' },
  answerImage: { width: '100%', height: 300, borderRadius: 8 },

  warningText: { color: '#ef4444', marginBottom: 8 },
  rawContainer: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 8 },
  rawText: { fontFamily: 'monospace', fontSize: 12 }
});
