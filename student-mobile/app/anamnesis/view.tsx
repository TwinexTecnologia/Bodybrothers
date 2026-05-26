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
  title: string
  created_at: string
  personal_id?: string
  data: {
    modelId: string
    answers: Record<string, any>
    modelTitle?: string
    questions?: Question[]
  }
}

function normalizeStoredValue(value: any) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/^`+|`+$/g, '').trim();
}

function isPhotoAnswer(value: any) {
  if (typeof value !== 'string') return false;
  const normalized = normalizeStoredValue(value);
  return /^https?:\/\//i.test(normalized) && /(storage\/v1\/object\/|\.jpe?g($|\?)|\.png($|\?)|\.gif($|\?)|\.webp($|\?))/i.test(normalized);
}

function buildFallbackQuestionsFromAnswers(answers: Record<string, any>) {
  return Object.keys(answers || {}).map((key, index) => ({
    id: key,
    text: `Pergunta ${index + 1}`,
    type: isPhotoAnswer(answers[key]) ? 'photo' : 'text'
  }));
}

export default function AnamnesisView() {
  const { responseId, modelId } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<AnamnesisResponse | null>(null);
  const [model, setModel] = useState<AnamnesisModel | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (responseId) {
        loadData();
    }
  }, [responseId, modelId]);

  async function loadData() {
      try {
          setLoading(true);
          let recoveredFromCurrentModel = false;
          
          // Fetch Response
          const { data: respData } = await supabase
              .from('protocols')
              .select('*')
              .eq('id', responseId)
              .single();
          
          if (respData) {
              const fallbackQuestions = buildFallbackQuestionsFromAnswers(respData.data?.answers || {});
              const normalizedResponse = {
                  id: respData.id,
                  title: respData.title,
                  created_at: respData.created_at,
                  personal_id: respData.personal_id,
                  data: respData.data
              };

              setResponse(normalizedResponse);

              if (Array.isArray(respData.data?.questions) && respData.data.questions.length > 0) {
                  setQuestions(respData.data.questions);
              } else {
                  setQuestions(fallbackQuestions);
              }
          }

          // Fetch Model (if exists)
          const currentModelId = typeof modelId === 'string' ? modelId : respData?.data?.modelId;
          if (currentModelId) {
              const { data: modelData } = await supabase
                  .from('protocols')
                  .select('*')
                  .eq('id', currentModelId)
                  .single();
              
              if (modelData) {
                  const normalizedModel = {
                      id: modelData.id,
                      questions: modelData.data?.questions || []
                  };

                  setModel(normalizedModel);

                  if ((!respData?.data?.questions || respData.data.questions.length === 0) && normalizedModel.questions.length > 0) {
                      setQuestions(normalizedModel.questions);
                      recoveredFromCurrentModel = true;
                  }
              }
          }

          if (respData && (!respData.data?.questions || respData.data.questions.length === 0) && !recoveredFromCurrentModel) {
              const answerKeys = Object.keys(respData.data?.answers || {});
              const questionMap = new Map<string, Question>();

              if (respData.personal_id) {
                  const { data: allModels } = await supabase
                      .from('protocols')
                      .select('data')
                      .eq('personal_id', respData.personal_id)
                      .eq('type', 'anamnesis_model')
                      .limit(50);

                  (allModels || []).forEach((item: any) => {
                      const modelQuestions = item.data?.questions || [];
                      modelQuestions.forEach((question: any) => {
                          if (question?.id && (question?.text || question?.question)) {
                              questionMap.set(question.id, {
                                  id: question.id,
                                  text: question.text || question.question,
                                  type: question.type || 'text'
                              });
                          }
                      });
                  });
              }

              const recoveredQuestions = answerKeys.map((key, index) => {
                  const mapped = questionMap.get(key);
                  if (mapped) return mapped;

                  return {
                      id: key,
                      text: `Pergunta ${index + 1}`,
                      type: isPhotoAnswer(respData.data?.answers?.[key]) ? 'photo' : 'text'
                  };
              });

              setQuestions(recoveredQuestions.length > 0 ? recoveredQuestions : buildFallbackQuestionsFromAnswers(respData.data?.answers || {}));
          }

      } catch (error) {
          console.error('Error loading data', error);
          if (response?.data?.answers) {
              setQuestions(buildFallbackQuestionsFromAnswers(response.data.answers));
          }
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

  const responseTitle =
      response.data.modelTitle ||
      response.title?.replace(/^Resposta:\s*/i, '') ||
      'Anamnese';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <View>
            <Text style={styles.headerTitle}>Respostas Enviadas</Text>
            <Text style={styles.headerSubtitle}>
                {responseTitle} • {new Date(response.created_at).toLocaleDateString('pt-BR')} às {new Date(response.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
            </Text>
        </View>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {questions.length > 0 ? (
            questions.map((q, index) => {
                const rawAnswer = response.data.answers[q.id];
                const normalizedAnswer = normalizeStoredValue(rawAnswer);
                return (
                    <View key={q.id} style={styles.item}>
                        <Text style={styles.questionText}>{index + 1}. {q.text}</Text>
                        <View style={styles.answerBox}>
                            {(q.type === 'photo' || isPhotoAnswer(rawAnswer)) && normalizedAnswer ? (
                                <Image source={{ uri: normalizedAnswer }} style={styles.answerImage} resizeMode="contain" />
                            ) : (
                                <Text style={styles.answerText}>
                                    {Array.isArray(rawAnswer) ? rawAnswer.join(', ') : (String(normalizedAnswer || '-'))}
                                </Text>
                            )}
                        </View>
                    </View>
                );
            })
        ) : (
            <View>
                <Text style={styles.warningText}>Nenhuma resposta encontrada para este envio.</Text>
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
