import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Alert, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Save, X, Camera, Upload, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

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

export default function AnamnesisAnswer() {
  const { modelId } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<AnamnesisModel | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // ID of question being uploaded

  useEffect(() => {
    if (modelId && user) {
        fetchModel();
    }
  }, [modelId, user]);

  async function fetchModel() {
      try {
          setLoading(true);
          const { data } = await supabase
              .from('protocols')
              .select('*')
              .eq('id', modelId)
              .single();
          
          if (data) {
              setModel({
                  id: data.id,
                  title: data.title,
                  questions: data.data?.questions || [],
                  ends_at: data.ends_at,
                  personal_id: data.personal_id
              });
          }
      } catch (error) {
          console.error('Error fetching model', error);
          Alert.alert('Erro', 'Não foi possível carregar o formulário.');
          router.back();
      } finally {
          setLoading(false);
      }
  }

  const handleAnswerChange = (qId: string, value: any) => {
      setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const toggleMultiSelect = (qId: string, option: string) => {
      const current = (answers[qId] as string[]) || [];
      if (current.includes(option)) {
          handleAnswerChange(qId, current.filter(item => item !== option));
      } else {
          handleAnswerChange(qId, [...current, option]);
      }
  };

  const pickImage = async (qId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Don't enforce editing, let them upload original
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
        uploadPhoto(qId, result.assets[0]);
    }
  };

  const uploadPhoto = async (qId: string, asset: ImagePicker.ImagePickerAsset) => {
      try {
          setUploading(qId);
          const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${user?.id}/${fileName}`;

          // Create FormData
          const formData = new FormData();
          formData.append('file', {
              uri: asset.uri,
              name: fileName,
              type: asset.mimeType || 'image/jpeg'
          } as any);

          const { error: uploadError } = await supabase.storage
               .from('anamnesis-files')
               .upload(filePath, formData, {
                   cacheControl: '3600',
                   upsert: false
               });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
              .from('anamnesis-files')
              .getPublicUrl(filePath);
          
          handleAnswerChange(qId, data.publicUrl);
      } catch (error: any) {
          console.error('Upload error:', error);
          Alert.alert('Erro no upload', error.message || 'Falha ao enviar imagem.');
      } finally {
          setUploading(null);
      }
  };

  const handleSubmit = async () => {
      if (!model || !user) return;

      const missing = model.questions.filter(q => q.required && (
          answers[q.id] === undefined || 
          answers[q.id] === null ||
          (typeof answers[q.id] === 'string' && answers[q.id].trim() === '') || 
          (Array.isArray(answers[q.id]) && answers[q.id].length === 0)
      ));

      if (missing.length > 0) {
          console.log('Missing fields:', missing.map(q => q.text));
          console.log('Current answers:', answers);
          Alert.alert('Campos Obrigatórios', `Faltam responder: \n\n${missing.map(q => q.text).join('\n')}`);
          return;
      }

      try {
          setSubmitting(true);
          const { error } = await supabase.from('protocols').insert({
            personal_id: model.personal_id,
            student_id: user.id,
            type: 'anamnesis',
            title: `Resposta: ${model.title}`,
            data: {
                modelId: model.id,
                answers: answers
            },
            starts_at: new Date().toISOString()
        });

        if (error) throw error;

        Alert.alert('Sucesso', 'Anamnese enviada com sucesso!', [
            { text: 'OK', onPress: () => router.back() }
        ]);

      } catch (error) {
          console.error('Submit error:', error);
          Alert.alert('Erro', 'Falha ao enviar respostas. Tente novamente.');
      } finally {
          setSubmitting(false);
      }
  };

  if (loading) {
      return (
          <SafeAreaView style={styles.container}>
              <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>
          </SafeAreaView>
      );
  }

  if (!model) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{model.title}</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {model.questions.map((q, index) => (
            <View key={q.id} style={styles.questionContainer}>
                <Text style={styles.questionLabel}>
                    {index + 1}. {q.text} {q.required && <Text style={{color: '#ef4444'}}>*</Text>}
                </Text>

                {q.exampleImage && (
                    <View style={styles.exampleContainer}>
                        <Text style={styles.exampleLabel}>Imagem de Referência:</Text>
                        <Image source={{ uri: q.exampleImage }} style={styles.exampleImage} resizeMode="contain" />
                    </View>
                )}

                {/* TEXT INPUT */}
                {q.type === 'text' && (
                    <TextInput 
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                        multiline
                        placeholder="Sua resposta..."
                        value={answers[q.id] || ''}
                        onChangeText={text => handleAnswerChange(q.id, text)}
                    />
                )}

                {/* NUMBER INPUT */}
                {q.type === 'number' && (
                    <TextInput 
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        value={answers[q.id] || ''}
                        onChangeText={text => handleAnswerChange(q.id, text)}
                    />
                )}

                {/* BOOLEAN INPUT */}
                {q.type === 'boolean' && (
                    <View style={styles.booleanContainer}>
                        <TouchableOpacity 
                            style={[styles.booleanOption, answers[q.id] === 'Sim' && styles.booleanSelected]}
                            onPress={() => handleAnswerChange(q.id, 'Sim')}
                        >
                            <Text style={[styles.booleanText, answers[q.id] === 'Sim' && styles.booleanTextSelected]}>Sim</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.booleanOption, answers[q.id] === 'Não' && styles.booleanSelected]}
                            onPress={() => handleAnswerChange(q.id, 'Não')}
                        >
                            <Text style={[styles.booleanText, answers[q.id] === 'Não' && styles.booleanTextSelected]}>Não</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* SELECT INPUT */}
                {q.type === 'select' && q.options && (
                    <View style={styles.optionsContainer}>
                        {q.options.map(opt => (
                            <TouchableOpacity 
                                key={opt}
                                style={[styles.optionItem, answers[q.id] === opt && styles.optionSelected]}
                                onPress={() => handleAnswerChange(q.id, opt)}
                            >
                                <View style={[styles.radioCircle, answers[q.id] === opt && styles.radioCircleSelected]}>
                                    {answers[q.id] === opt && <View style={styles.radioInner} />}
                                </View>
                                <Text style={styles.optionText}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* MULTI SELECT INPUT */}
                {q.type === 'multi' && q.options && (
                    <View style={styles.optionsContainer}>
                        {q.options.map(opt => {
                            const selected = (answers[q.id] || []).includes(opt);
                            return (
                                <TouchableOpacity 
                                    key={opt}
                                    style={[styles.optionItem, selected && styles.optionSelected]}
                                    onPress={() => toggleMultiSelect(q.id, opt)}
                                >
                                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                                        {selected && <Check size={14} color="#fff" />}
                                    </View>
                                    <Text style={styles.optionText}>{opt}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                )}

                {/* PHOTO INPUT */}
                {q.type === 'photo' && (
                    <View style={styles.photoContainer}>
                        {answers[q.id] ? (
                            <View>
                                <Image source={{ uri: answers[q.id] }} style={styles.previewImage} />
                                <TouchableOpacity 
                                    style={styles.removePhoto}
                                    onPress={() => handleAnswerChange(q.id, null)}
                                >
                                    <X size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity 
                                style={styles.uploadButton}
                                onPress={() => pickImage(q.id)}
                                disabled={uploading === q.id}
                            >
                                {uploading === q.id ? (
                                    <ActivityIndicator color="#64748b" />
                                ) : (
                                    <>
                                        <Camera size={24} color="#64748b" />
                                        <Text style={styles.uploadText}>Tirar ou Escolher Foto</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}

            </View>
        ))}

        <TouchableOpacity 
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
        >
            {submitting ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <>
                    <Save size={20} color="#fff" />
                    <Text style={styles.submitText}>Enviar Respostas</Text>
                </>
            )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1, textAlign: 'center' },
  backButton: { padding: 8, marginLeft: -8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24 },

  questionContainer: { marginBottom: 32 },
  questionLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  
  exampleContainer: { marginBottom: 16, backgroundColor: '#fff', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  exampleLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  exampleImage: { width: '100%', height: 200, borderRadius: 4 },

  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12,
    padding: 16, fontSize: 16, color: '#0f172a'
  },

  booleanContainer: { flexDirection: 'row', gap: 16 },
  booleanOption: {
    flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1',
    alignItems: 'center', backgroundColor: '#fff'
  },
  booleanSelected: { borderColor: '#0f172a', backgroundColor: '#f1f5f9' },
  booleanText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  booleanTextSelected: { color: '#0f172a' },

  optionsContainer: { gap: 12 },
  optionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1'
  },
  optionSelected: { borderColor: '#0f172a', backgroundColor: '#f8fafc' },
  optionText: { fontSize: 16, color: '#334155' },
  
  radioCircle: {
      width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1',
      alignItems: 'center', justifyContent: 'center'
  },
  radioCircleSelected: { borderColor: '#0f172a' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0f172a' },

  checkbox: {
      width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1',
      alignItems: 'center', justifyContent: 'center'
  },
  checkboxSelected: { borderColor: '#0f172a', backgroundColor: '#0f172a' },

  photoContainer: {
      borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 12,
      backgroundColor: '#f8fafc', overflow: 'hidden'
  },
  uploadButton: {
      padding: 32, alignItems: 'center', justifyContent: 'center', gap: 8
  },
  uploadText: { color: '#64748b', fontWeight: '600' },
  previewImage: { width: '100%', height: 250, resizeMode: 'cover' },
  removePhoto: {
      position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(239, 68, 68, 0.9)',
      padding: 8, borderRadius: 20
  },

  submitButton: {
      backgroundColor: '#0f172a', padding: 18, borderRadius: 16, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700' }
});
