import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator, Modal, Image, Platform } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Utensils, ChevronDown, ChevronUp, Clock, Info, X, ChevronRight, Apple, Download } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Tipos
type Food = {
  name: string
  quantity: string
  unit: string
  calories?: string
  protein?: string
  carbs?: string
  fat?: string
  sodium?: string
  notes?: string
  substitutes?: { name: string; quantity: string; unit: string }[]
}

type Meal = {
  title: string
  time: string
  foods: Food[]
  notes?: string
}

type Variant = {
    id: string
    name: string
    meals: Meal[]
}

type Diet = {
  id: string
  title: string
  data: {
    goal?: string
    notes?: string
    meals: Meal[]
    variants?: Variant[]
    supplements?: Food[]
  }
  updated_at: string
}

export default function Diets() {
  const { user } = useAuth();
  const [diets, setDiets] = useState<Diet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Controle de Seleção
  const [selectedDiet, setSelectedDiet] = useState<Diet | null>(null);
  const [activeVariant, setActiveVariant] = useState<string>('default');
  const [openMeals, setOpenMeals] = useState<number[]>([]); // Índices abertos

  const loadDiets = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('data').eq('id', user.id).single();
      
      const status = profile?.data?.status || 'ativo';
      if (status !== 'ativo' && status !== 'active') {
        Alert.alert('Acesso Bloqueado', 'Sua conta está inativa. Contate seu personal.');
        return;
      }

      const linkedIds = profile?.data?.dietIds || [];

      let query = supabase.from('protocols').select('*').eq('type', 'diet').eq('status', 'active');
      
      if (linkedIds.length > 0) {
        query = query.or(`student_id.eq.${user.id},id.in.(${linkedIds.join(',')})`);
      } else {
        query = query.eq('student_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const sorted = (data || []).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setDiets(sorted);
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDiets();
  }, [loadDiets]);

  // Efeito de auto-seleção removido temporariamente para debug
  // O usuário terá que clicar na dieta se ela não carregar sozinha


  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiets();
    setRefreshing(false);
  };

  const handleOpenDiet = (d: Diet, reset = true) => {
    setSelectedDiet(d);
    if (reset) {
        // Se tiver variantes, seleciona a primeira
        if (d.data.variants && d.data.variants.length > 0) {
            setActiveVariant(d.data.variants[0].id);
        } else {
            setActiveVariant('default');
        }
        // Abre todas as refeições por padrão
        setOpenMeals([0, 1, 2, 3, 4, 5]); 
    }
  };

  const toggleMeal = (index: number) => {
    setOpenMeals(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Refeições Atuais
  const currentMeals = selectedDiet 
    ? (() => {
        let meals: Meal[] = [];
        if (activeVariant === 'default') {
            if (selectedDiet.data.variants && selectedDiet.data.variants.length > 0) {
                const first = selectedDiet.data.variants[0];
                // Removido o setState que causava loop infinito
                meals = first.meals;
            } else {
                meals = selectedDiet.data.meals;
            }
        } else {
            const v = selectedDiet.data.variants?.find(v => v.id === activeVariant);
            meals = v ? v.meals : [];
        }
        return meals || []; // Proteção contra undefined
    })()
    : [];

  // Totais da dieta atual
  const dietTotals = currentMeals.reduce((acc, m) => {
      if (!m.foods) return acc; // Proteção se foods for undefined
      m.foods.forEach(f => {
          acc.kcal += Number(f.calories || 0);
          acc.p += Number(f.protein || 0);
          acc.c += Number(f.carbs || 0);
          acc.g += Number(f.fat || 0);
      });
      return acc;
  }, { kcal: 0, p: 0, c: 0, g: 0 });

  const handleExportPDF = async () => {
    if (!selectedDiet) return;

    try {
        const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
                body { font-family: 'Helvetica', sans-serif; color: #333; padding: 20px; }
                h1 { color: #16a34a; text-align: center; margin-bottom: 5px; }
                .subtitle { text-align: center; color: #666; margin-bottom: 30px; font-size: 14px; }
                .meal-card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
                .meal-header { background: #f0fdf4; padding: 10px 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; }
                .meal-title { font-weight: bold; color: #166534; }
                .meal-time { font-size: 12px; color: #555; }
                .food-item { padding: 10px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
                .food-item:last-child { border-bottom: none; }
                .food-name { font-weight: 500; }
                .food-qty { font-weight: bold; color: #16a34a; }
                .macros { font-size: 10px; color: #888; margin-top: 4px; }
                .totals { margin-top: 30px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; font-weight: bold; }
                .subs { font-size: 10px; color: #666; margin-top: 4px; background: #f9f9f9; padding: 4px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>${selectedDiet.title}</h1>
            <div class="subtitle">${selectedDiet.data.goal || 'Plano Alimentar Personalizado'}</div>
            
            ${selectedDiet.data.notes ? `<div style="background:#fffbeb; padding:10px; border:1px solid #fcd34d; border-radius:6px; margin-bottom:20px; color:#92400e; font-size:12px;"><strong>Notas:</strong> ${selectedDiet.data.notes}</div>` : ''}

            ${currentMeals.map((meal, i) => `
                <div class="meal-card">
                    <div class="meal-header">
                        <span class="meal-title">${meal.title}</span>
                        <span class="meal-time">${meal.time}</span>
                    </div>
                    ${meal.foods ? meal.foods.map(f => `
                        <div class="food-item">
                            <div style="flex:1">
                                <div class="food-name">${f.name}</div>
                                ${f.calories ? `<div class="macros">${f.calories}kcal • P:${f.protein} • C:${f.carbs} • G:${f.fat}</div>` : ''}
                                ${f.substitutes && f.substitutes.length > 0 ? `
                                    <div class="subs">Ou: ${f.substitutes.map(s => `${s.name} (${s.quantity} ${s.unit})`).join(', ')}</div>
                                ` : ''}
                            </div>
                            <div class="food-qty">${f.quantity} ${f.unit}</div>
                        </div>
                    `).join('') : ''}
                </div>
            `).join('')}

            <div class="totals">
                TOTAL DIÁRIO: ${Math.round(dietTotals.kcal)} kcal 
                <span style="color:#ddd; margin:0 5px">|</span> P: ${Math.round(dietTotals.p)}g 
                <span style="color:#ddd; margin:0 5px">|</span> C: ${Math.round(dietTotals.c)}g 
                <span style="color:#ddd; margin:0 5px">|</span> G: ${Math.round(dietTotals.g)}g
            </div>
            
            <div style="text-align:center; margin-top:30px; color:#ccc; font-size:10px;">
                Gerado pelo App FitBody Pro
            </div>
          </body>
        </html>
        `;

        if (Platform.OS === 'web') {
            // Na Web, a forma mais confiável é abrir a impressão nativa
            // O usuário escolhe "Salvar como PDF" ou "Compartilhar"
            await Print.printAsync({ html: htmlContent });
        } else {
            // No Mobile, geramos o arquivo e compartilhamos (Salvar em Arquivos)
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Salvar Dieta' });
        }

    } catch (error) {
        Alert.alert('Erro', 'Não foi possível gerar o PDF.');
        console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Minha Dieta</Text>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}</Text>
        </View>

        {loading && <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 20 }} />}

        {!loading && !selectedDiet && diets.length === 0 && (
            <View style={styles.emptyState}>
                <Utensils size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>Nenhuma dieta ativa.</Text>
            </View>
        )}

        {!loading && !selectedDiet && diets.length > 0 && (
            <View>
                <Text style={{fontSize: 16, color: '#64748b', marginBottom: 16}}>Selecione uma dieta para ver os detalhes:</Text>
                {diets.map(d => (
                    <TouchableOpacity 
                        key={d.id} 
                        style={styles.dietHeaderCard}
                        onPress={() => handleOpenDiet(d)}
                    >
                        <Text style={styles.dietTitle}>{d.title}</Text>
                        <Text style={styles.dietGoal}>{d.data.goal || 'Sem objetivo definido'}</Text>
                        <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8}}>
                             <Text style={{color: '#16a34a', fontWeight: 'bold'}}>Ver Detalhes →</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        )}

        {selectedDiet && (
            <>
                {/* Botão Voltar e Exportar */}
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                    <TouchableOpacity 
                        onPress={() => setSelectedDiet(null)}
                        style={{flexDirection: 'row', alignItems: 'center'}}
                    >
                        <ChevronDown size={20} color="#64748b" style={{transform: [{rotate: '90deg'}]}} />
                        <Text style={{color: '#64748b', fontWeight: '600', marginLeft: 4}}>Voltar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={handleExportPDF}
                        style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12}}
                    >
                        <Download size={16} color="#16a34a" style={{marginRight: 6}} />
                        <Text style={{color: '#166534', fontWeight: 'bold', fontSize: 12}}>Baixar PDF</Text>
                    </TouchableOpacity>
                </View>

                {/* Cabeçalho da Dieta */}
                <View style={styles.dietHeaderCard}>
                    <Text style={styles.dietTitle}>{selectedDiet.title}</Text>
                    {selectedDiet.data.goal && (
                        <Text style={styles.dietGoal}>Objetivo: <Text style={{fontWeight: 'bold', color: '#16a34a'}}>{selectedDiet.data.goal}</Text></Text>
                    )}

                    {/* Variantes Selector */}
                    {selectedDiet.data.variants && selectedDiet.data.variants.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.variantScroll}>
                            {selectedDiet.data.variants.map(v => (
                                <TouchableOpacity
                                    key={v.id}
                                    style={[styles.variantChip, activeVariant === v.id && styles.variantChipActive]}
                                    onPress={() => setActiveVariant(v.id)}
                                >
                                    <Text style={[styles.variantText, activeVariant === v.id && styles.variantTextActive]}>
                                        {v.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Resumo de Macros */}
                    <View style={styles.macrosContainer}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroLabel}>KCAL</Text>
                            <Text style={[styles.macroValue, {color: '#1e3a8a'}]}>{Math.round(dietTotals.kcal)}</Text>
                        </View>
                        <View style={styles.macroDivider} />
                        <View style={styles.macroItem}>
                            <Text style={styles.macroLabel}>PROT</Text>
                            <Text style={[styles.macroValue, {color: '#16a34a'}]}>{Math.round(dietTotals.p)}g</Text>
                        </View>
                        <View style={styles.macroDivider} />
                        <View style={styles.macroItem}>
                            <Text style={styles.macroLabel}>CARB</Text>
                            <Text style={[styles.macroValue, {color: '#1e40af'}]}>{Math.round(dietTotals.c)}g</Text>
                        </View>
                        <View style={styles.macroDivider} />
                        <View style={styles.macroItem}>
                            <Text style={styles.macroLabel}>GORD</Text>
                            <Text style={[styles.macroValue, {color: '#9a3412'}]}>{Math.round(dietTotals.g)}g</Text>
                        </View>
                    </View>
                </View>

                {/* Notas */}
                {selectedDiet.data.notes && (
                    <View style={styles.notesBox}>
                        <Info size={16} color="#b45309" />
                        <Text style={styles.notesText}>{selectedDiet.data.notes}</Text>
                    </View>
                )}

                {/* Lista de Refeições */}
                <View style={styles.mealsContainer}>
                    {currentMeals.map((meal, index) => {
                        const isOpen = openMeals.includes(index);
                        const mealTotals = meal.foods.reduce((acc, f) => {
                            acc.kcal += Number(f.calories || 0);
                            acc.p += Number(f.protein || 0);
                            return acc;
                        }, { kcal: 0, p: 0 });

                        return (
                            <View key={index} style={styles.mealCard}>
                                <TouchableOpacity 
                                    style={[styles.mealHeader, isOpen && styles.mealHeaderOpen]}
                                    onPress={() => toggleMeal(index)}
                                >
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                                        <View style={styles.mealIndexBadge}>
                                            <Text style={styles.mealIndexText}>{index + 1}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.mealTitle}>{meal.title}</Text>
                                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                                <Clock size={12} color="#64748b" />
                                                <Text style={styles.mealTime}>{meal.time}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                        {!isOpen && (
                                            <Text style={styles.mealSummary}>{Math.round(mealTotals.kcal)} kcal</Text>
                                        )}
                                        {isOpen ? <ChevronUp size={20} color="#94a3b8" /> : <ChevronDown size={20} color="#94a3b8" />}
                                    </View>
                                </TouchableOpacity>

                                {isOpen && (
                                    <View style={styles.mealContent}>
                                        {meal.notes && (
                                            <Text style={styles.mealNotes}>Obs: {meal.notes}</Text>
                                        )}
                                        
                                        {meal.foods.map((food, fIdx) => (
                                            <View key={fIdx} style={styles.foodItem}>
                                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                                    <Text style={styles.foodName}>{food.name}</Text>
                                                    <Text style={styles.foodQty}>{food.quantity} {food.unit}</Text>
                                                </View>
                                                
                                                {/* Macros Food */}
                                                {food.calories && (
                                                    <Text style={styles.foodMacros}>
                                                        {food.calories}kcal • P:{food.protein} • C:{food.carbs} • G:{food.fat}
                                                    </Text>
                                                )}

                                                {/* Substitutos */}
                                                {food.substitutes && food.substitutes.length > 0 && (
                                                    <View style={styles.subsBox}>
                                                        <Text style={styles.subsLabel}>Opções de troca:</Text>
                                                        {food.substitutes.map((sub, sIdx) => (
                                                            <Text key={sIdx} style={styles.subText}>• {sub.name} ({sub.quantity} {sub.unit})</Text>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Suplementação */}
                {selectedDiet.data.supplements && selectedDiet.data.supplements.length > 0 && (
                    <View style={styles.supplementsSection}>
                        <Text style={styles.sectionTitle}>Suplementação</Text>
                        <View style={styles.supplementsCard}>
                            {selectedDiet.data.supplements.map((sup, idx) => (
                                <View key={idx} style={styles.supItem}>
                                    <View style={{flex: 1}}>
                                        <Text style={styles.supName}>{sup.name}</Text>
                                        {sup.notes && <Text style={styles.supNote}>{sup.notes}</Text>}
                                    </View>
                                    <Text style={styles.supQty}>{sup.quantity} {sup.unit}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
                
                <View style={{height: 40}} />
            </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  dateText: { fontSize: 12, color: '#64748b', textTransform: 'capitalize' },
  emptyState: { padding: 40, alignItems: 'center', backgroundColor: '#fff', borderRadius: 20 },
  emptyText: { color: '#94a3b8', marginTop: 16 },

  // Diet Header
  dietHeaderCard: {
      backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2
  },
  dietTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  dietGoal: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  
  // Variantes
  variantScroll: { flexDirection: 'row', marginBottom: 20 },
  variantChip: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0'
  },
  variantChipActive: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  variantText: { fontWeight: '600', color: '#64748b', fontSize: 13 },
  variantTextActive: { color: '#166534' },

  // Macros
  macrosContainer: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9'
  },
  macroItem: { alignItems: 'center', flex: 1 },
  macroLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginBottom: 4 },
  macroValue: { fontSize: 16, fontWeight: '800' },
  macroDivider: { width: 1, height: 24, backgroundColor: '#e2e8f0' },

  // Notes
  notesBox: {
      flexDirection: 'row', gap: 8, padding: 16, backgroundColor: '#fffbeb', 
      borderRadius: 16, borderWidth: 1, borderColor: '#fcd34d', marginBottom: 20
  },
  notesText: { fontSize: 13, color: '#92400e', flex: 1, lineHeight: 20 },

  // Meals
  mealsContainer: { gap: 12 },
  mealCard: {
      backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: '#f1f5f9',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1
  },
  mealHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 16, backgroundColor: '#fff'
  },
  mealHeaderOpen: { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  mealIndexBadge: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: '#dcfce7',
      alignItems: 'center', justifyContent: 'center'
  },
  mealIndexText: { fontWeight: '800', color: '#166534', fontSize: 14 },
  mealTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  mealTime: { fontSize: 12, color: '#64748b' },
  mealSummary: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  
  mealContent: { padding: 16 },
  mealNotes: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginBottom: 16 },
  
  foodItem: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 16 },
  foodName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  foodQty: { fontSize: 15, fontWeight: '700', color: '#16a34a' },
  foodMacros: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  
  subsBox: { marginTop: 8, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8 },
  subsLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  subText: { fontSize: 12, color: '#475569', marginBottom: 2 },

  // Supplements
  supplementsSection: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  supplementsCard: {
      backgroundColor: '#fff7ed', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#ffedd5'
  },
  supItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  supName: { fontSize: 14, fontWeight: '700', color: '#9a3412' },
  supNote: { fontSize: 12, color: '#c2410c' },
  supQty: { fontSize: 14, fontWeight: '700', color: '#ea580c' }
});
