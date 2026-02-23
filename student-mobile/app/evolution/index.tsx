import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Plus, Calendar, ArrowRight, ChevronDown, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

type PhotoRecord = {
    id: string
    date: string
    photos: string[]
    origin: 'anamnesis' | 'standalone'
}

export default function Evolution() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PhotoRecord[]>([]);
  
  const [selectedIdA, setSelectedIdA] = useState<string | null>(null);
  const [selectedIdB, setSelectedIdB] = useState<string | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'A' | 'B' | null>(null);
  const [evolutionMode, setEvolutionMode] = useState('anamnesis');

  useFocusEffect(
    useCallback(() => {
      if (user) loadConfigAndPhotos();
    }, [user])
  );

  async function loadConfigAndPhotos() {
      try {
          setLoading(true);
          
          // 1. Get Personal ID
          const { data: student } = await supabase
            .from('profiles')
            .select('personal_id')
            .eq('id', user?.id)
            .single();

          let mode = 'anamnesis';
          if (student?.personal_id) {
              const { data: personal } = await supabase
                .from('profiles')
                .select('data')
                .eq('id', student.personal_id)
                .single();
              
              if (personal?.data?.config?.evolutionMode) {
                  mode = personal.data.config.evolutionMode;
              }
          }
          setEvolutionMode(mode);

          // 2. Fetch photos
          let query = supabase
            .from('protocols')
            .select('*')
            .eq('student_id', user?.id)
            .order('created_at', { ascending: true });

          if (mode === 'standalone') {
              query = query.in('type', ['anamnesis', 'photos']);
          } else {
              query = query.eq('type', 'anamnesis');
          }

          const { data, error } = await query;
          if (error) throw error;

          const extractImages = (obj: any): string[] => {
              const images: string[] = [];
              if (!obj) return images;

              if (typeof obj === 'string') {
                  try {
                      const parsed = JSON.parse(obj);
                      if (typeof parsed === 'object') return extractImages(parsed);
                  } catch (e) {}
              }

              const processValue = (val: any) => {
                  if (typeof val === 'string') {
                      if ((val.includes('supabase') && val.includes('/storage/')) || val.match(/\.(jpeg|jpg|png|webp|heic)(\?.*)?$/i)) {
                          images.push(val);
                      }
                  } else if (typeof val === 'object' && val !== null) {
                      Object.values(val).forEach(processValue);
                  }
              }
              processValue(obj);
              return images;
          };

          const processed = (data || []).map(item => {
              const rawData = item.content || item.data || {};
              const photos = extractImages(rawData);
              return {
                  id: item.id,
                  date: item.created_at,
                  photos,
                  origin: item.type === 'photos' ? 'standalone' : 'anamnesis'
              };
          }).filter(item => item.photos.length > 0);

          setHistory(processed);

          // Default selection: First and Last
          if (processed.length >= 2) {
             // Only set if not already set, or if current selection is invalid
             if (!selectedIdA || !processed.find(p => p.id === selectedIdA)) setSelectedIdA(processed[0].id);
             if (!selectedIdB || !processed.find(p => p.id === selectedIdB)) setSelectedIdB(processed[processed.length - 1].id);
          } else if (processed.length === 1) {
             if (!selectedIdA) setSelectedIdA(processed[0].id);
             if (!selectedIdB) setSelectedIdB(processed[0].id);
          }

      } catch (error) {
          console.error('Error loading evolution:', error);
      } finally {
          setLoading(false);
      }
  }

  const openSelector = (side: 'A' | 'B') => {
      setSelectingFor(side);
      setModalVisible(true);
  };

  const handleSelect = (id: string) => {
      if (selectingFor === 'A') setSelectedIdA(id);
      if (selectingFor === 'B') setSelectedIdB(id);
      setModalVisible(false);
      setSelectingFor(null);
  };

  const recordA = history.find(h => h.id === selectedIdA);
  const recordB = history.find(h => h.id === selectedIdB);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  // Determine photos to show
  const photosA = recordA?.photos || [];
  const photosB = recordB?.photos || [];
  const maxPhotos = Math.max(photosA.length, photosB.length);
  const comparisonRows = Array.from({ length: maxPhotos }).map((_, i) => ({
      photoA: photosA[i] || null,
      photoB: photosB[i] || null,
      index: i
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minha Evolução</Text>
        {evolutionMode === 'standalone' && (
            <TouchableOpacity onPress={() => router.push('/evolution/new')} style={styles.addButton}>
                <Plus size={24} color="#0f172a" />
            </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#000" />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
                {evolutionMode === 'standalone' 
                    ? 'Você ainda não enviou fotos de evolução.' 
                    : 'Nenhuma foto encontrada nas anamneses.'}
            </Text>
            {evolutionMode === 'standalone' && (
                <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/evolution/new')}>
                    <Text style={styles.emptyButtonText}>Adicionar Fotos</Text>
                </TouchableOpacity>
            )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
            {/* Controls */}
            <View style={styles.controlsCard}>
                <View style={styles.controlRow}>
                    <TouchableOpacity style={styles.selector} onPress={() => openSelector('A')}>
                        <Text style={styles.selectorLabel}>ANTES</Text>
                        <View style={styles.selectorBox}>
                            <Text style={styles.selectorDate}>{recordA ? formatDate(recordA.date) : '--/--'}</Text>
                            <ChevronDown size={16} color="#64748b" />
                        </View>
                    </TouchableOpacity>
                    
                    <View style={styles.arrowContainer}>
                        <ArrowRight size={20} color="#94a3b8" />
                    </View>

                    <TouchableOpacity style={styles.selector} onPress={() => openSelector('B')}>
                        <Text style={styles.selectorLabel}>DEPOIS</Text>
                        <View style={styles.selectorBox}>
                            <Text style={styles.selectorDate}>{recordB ? formatDate(recordB.date) : '--/--'}</Text>
                            <ChevronDown size={16} color="#64748b" />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Comparison Grid */}
            <View style={styles.grid}>
                {comparisonRows.map((row, i) => (
                    <View key={i} style={styles.comparisonRow}>
                        <View style={styles.photoContainer}>
                            {row.photoA ? (
                                <Image source={{ uri: row.photoA }} style={styles.photo} resizeMode="cover" />
                            ) : (
                                <View style={styles.noPhoto}><Text style={styles.noPhotoText}>Sem foto</Text></View>
                            )}
                            <View style={styles.photoBadge}><Text style={styles.photoBadgeText}>{i + 1}</Text></View>
                        </View>
                        
                        <View style={styles.photoContainer}>
                            {row.photoB ? (
                                <Image source={{ uri: row.photoB }} style={styles.photo} resizeMode="cover" />
                            ) : (
                                <View style={styles.noPhoto}><Text style={styles.noPhotoText}>Sem foto</Text></View>
                            )}
                            <View style={[styles.photoBadge, { backgroundColor: '#16a34a' }]}><Text style={styles.photoBadgeText}>{i + 1}</Text></View>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
      )}

      {/* Selection Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Selecione uma Data</Text>
                      <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                          <X size={24} color="#0f172a" />
                      </TouchableOpacity>
                  </View>
                  <FlatList
                      data={history}
                      keyExtractor={item => item.id}
                      renderItem={({ item }) => (
                          <TouchableOpacity 
                            style={[
                                styles.optionItem, 
                                (selectingFor === 'A' && selectedIdA === item.id) || (selectingFor === 'B' && selectedIdB === item.id) ? styles.optionSelected : null
                            ]}
                            onPress={() => handleSelect(item.id)}
                          >
                              <View>
                                  <Text style={styles.optionDate}>{new Date(item.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</Text>
                                  <Text style={styles.optionSub}>{item.photos.length} fotos • {item.origin === 'standalone' ? 'Evolução' : 'Anamnese'}</Text>
                              </View>
                              {((selectingFor === 'A' && selectedIdA === item.id) || (selectingFor === 'B' && selectedIdB === item.id)) && (
                                  <View style={styles.checkCircle} />
                              )}
                          </TouchableOpacity>
                      )}
                  />
              </View>
          </View>
      </Modal>

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
  addButton: { padding: 8, marginRight: -8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24 },
  
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: '#64748b', fontSize: 16, marginBottom: 24 },
  emptyButton: { backgroundColor: '#0f172a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyButtonText: { color: '#fff', fontWeight: '600' },

  controlsCard: {
      backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selector: { flex: 1 },
  selectorLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 4, textAlign: 'center' },
  selectorBox: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0'
  },
  selectorDate: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  arrowContainer: { paddingHorizontal: 12 },

  grid: { gap: 16 },
  comparisonRow: { flexDirection: 'row', gap: 12 },
  photoContainer: { flex: 1, aspectRatio: 3/4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e2e8f0', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { color: '#94a3b8', fontSize: 12 },
  photoBadge: { 
      position: 'absolute', top: 8, left: 8, backgroundColor: '#0f172a', 
      width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' 
  },
  photoBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  closeButton: { padding: 4 },
  optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  optionSelected: { backgroundColor: '#f8fafc' },
  optionDate: { fontSize: 16, fontWeight: '600', color: '#0f172a', textTransform: 'capitalize' },
  optionSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  checkCircle: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0f172a' }
});
