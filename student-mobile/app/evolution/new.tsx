import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { ChevronLeft, Camera, X, Save } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const POSES = [
    { id: 'front', label: 'Frente' },
    { id: 'side', label: 'Lado' },
    { id: 'back', label: 'Costas' }
];

export default function NewEvolution() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<Record<string, string>>({}); // id -> uri
  const [uploading, setUploading] = useState<string | null>(null);
  
  const [fields, setFields] = useState<{id: string, label: string, exampleUrl?: string}[]>([
      { id: 'front', label: 'Frente' },
      { id: 'side', label: 'Lado' },
      { id: 'back', label: 'Costas' }
  ]);

  React.useEffect(() => {
      if (user) loadPersonalConfig();
  }, [user]);

  async function loadPersonalConfig() {
      try {
          // Tenta ler do PRÓPRIO PERFIL (Mais seguro contra RLS)
          const { data: myself } = await supabase
              .from('profiles')
              .select('data, personal_id')
              .eq('id', user?.id)
              .single();

          // Prioridade: Config no perfil do aluno (propagada pelo personal)
          const ownFields = myself?.data?.config?.evolutionFields;
          if (Array.isArray(ownFields) && ownFields.length > 0) {
              setFields(ownFields);
              return;
          }

          // Fallback: Tenta ler do personal (Legado / Risco de RLS)
          if (myself?.personal_id) {
              const { data: personal } = await supabase
                  .from('profiles')
                  .select('data')
                  .eq('id', myself.personal_id)
                  .single();
              
              const personalFields = personal?.data?.config?.evolutionFields;
              if (Array.isArray(personalFields) && personalFields.length > 0) {
                  setFields(personalFields);
              }
          }
      } catch (err) {
          console.log('Erro ao carregar config:', err);
      }
  }

  const pickImage = async (poseId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
        uploadPhoto(poseId, result.assets[0]);
    }
  };

  const takePhoto = async (poseId: string) => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
          Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar fotos.');
          return;
      }

      const result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
          uploadPhoto(poseId, result.assets[0]);
      }
  };

  const uploadPhoto = async (poseId: string, asset: ImagePicker.ImagePickerAsset) => {
      try {
          setUploading(poseId);

          // Normaliza para JPEG para evitar falhas com HEIC e tipos inconsistentes no iPhone.
          const manipulated = await ImageManipulator.manipulateAsync(
              asset.uri,
              [],
              { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
          );

          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          const filePath = `${user?.id}/evolution/${fileName}`;
          const response = await fetch(manipulated.uri);
          const fileBody = await response.arrayBuffer();

          const { error: uploadError } = await supabase.storage
               .from('anamnesis-files')
               .upload(filePath, fileBody, {
                   cacheControl: '3600',
                   upsert: false,
                   contentType: 'image/jpeg'
               });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
              .from('anamnesis-files')
              .getPublicUrl(filePath);
          
          setPhotos(prev => ({ ...prev, [poseId]: data.publicUrl }));
      } catch (error: any) {
          console.error('Upload error:', error);
          Alert.alert('Erro', 'Falha ao enviar imagem.');
      } finally {
          setUploading(null);
      }
  };

  const handleSubmit = async () => {
      if (Object.keys(photos).length === 0) {
          Alert.alert('Atenção', 'Adicione pelo menos uma foto.');
          return;
      }

      try {
          setSubmitting(true);

          // Usa o vínculo oficial do aluno para evitar falhas quando ainda não existe protocolo anterior.
          const { data: studentProfile, error: studentError } = await supabase
              .from('profiles')
              .select('personal_id')
              .eq('id', user?.id)
              .single();

          if (studentError) throw studentError;

          const personalId = studentProfile?.personal_id;
          
          if (!personalId) {
              Alert.alert('Erro', 'Não foi possível identificar seu Personal Trainer.');
              setSubmitting(false);
              return;
          }

          const { error } = await supabase.from('protocols').insert({
              student_id: user?.id,
              personal_id: personalId,
              type: 'photos',
              title: 'Evolução Fotográfica',
              data: {
                  photos: photos
              },
              starts_at: new Date().toISOString()
          });
          
          if (error) throw error;

          Alert.alert('Sucesso', 'Fotos salvas com sucesso!', [
              { text: 'OK', onPress: () => router.back() }
          ]);

      } catch (error) {
          console.error('Submit error:', error);
          // If error is about personal_id, we might need to fetch it.
          // Let's assume for now it might work or we catch it.
          Alert.alert('Erro', 'Falha ao salvar evolução.');
      } finally {
          setSubmitting(false);
      }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Evolução</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
            Adicione fotos atuais para comparar com seus resultados anteriores. Tente manter o mesmo ângulo e iluminação.
        </Text>

        <View style={styles.grid}>
            {fields.map(pose => (
                <View key={pose.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{pose.label}</Text>
                    
                    {photos[pose.id] ? (
                        <View style={styles.previewContainer}>
                            <Image source={{ uri: photos[pose.id] }} style={styles.preview} />
                            <TouchableOpacity 
                                style={styles.removeButton}
                                onPress={() => setPhotos(prev => {
                                    const next = { ...prev };
                                    delete next[pose.id];
                                    return next;
                                })}
                            >
                                <X size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.actions}>
                            {pose.exampleUrl && (
                                <View style={styles.exampleContainer}>
                                    <Image source={{ uri: pose.exampleUrl }} style={styles.exampleImage} />
                                    <View style={styles.exampleOverlay}>
                                        <Text style={styles.exampleText}>Exemplo</Text>
                                    </View>
                                </View>
                            )}
                            
                            <View style={styles.buttonsRow}>
                                <TouchableOpacity 
                                    style={styles.actionButton}
                                    onPress={() => takePhoto(pose.id)}
                                    disabled={!!uploading}
                                >
                                    {uploading === pose.id ? <ActivityIndicator color="#64748b" /> : <Camera size={24} color="#64748b" />}
                                    <Text style={styles.actionText}>Câmera</Text>
                                </TouchableOpacity>
                                
                                <View style={styles.divider} />
                                
                                <TouchableOpacity 
                                    style={styles.actionButton}
                                    onPress={() => pickImage(pose.id)}
                                    disabled={!!uploading}
                                >
                                    <Text style={styles.actionText}>Galeria</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            ))}
        </View>

        <TouchableOpacity 
            style={[styles.submitButton, (submitting || Object.keys(photos).length === 0) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || Object.keys(photos).length === 0}
        >
            {submitting ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <>
                    <Save size={20} color="#fff" />
                    <Text style={styles.submitText}>Salvar Evolução</Text>
                </>
            )}
        </TouchableOpacity>

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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  backButton: { padding: 8, marginLeft: -8 },
  content: { padding: 24 },
  
  description: { color: '#64748b', fontSize: 14, marginBottom: 24, textAlign: 'center' },

  grid: { gap: 16 },
  card: {
      backgroundColor: '#fff', borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: '#e2e8f0'
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12, textAlign: 'center' },
  
  actions: { backgroundColor: '#f8fafc', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1', overflow: 'hidden' },
  buttonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 },
  
  exampleContainer: {
      height: 220,
      position: 'relative',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
      backgroundColor: '#e5e7eb'
  },
  exampleImage: { width: '100%', height: '100%', resizeMode: 'contain', opacity: 0.96 },
  exampleOverlay: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  exampleText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  
  actionButton: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  divider: { width: 1, height: 24, backgroundColor: '#cbd5e1' },

  previewContainer: { position: 'relative', aspectRatio: 3/4, borderRadius: 12, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  removeButton: {
      position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(239, 68, 68, 0.9)',
      padding: 8, borderRadius: 20
  },

  submitButton: {
      backgroundColor: '#0f172a', padding: 18, borderRadius: 16, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32, marginBottom: 40
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700' }
});
