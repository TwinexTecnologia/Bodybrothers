import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { finishSession } from '../lib/history';
import { Clock, StopCircle, CheckCircle, X, MessageSquare, Play } from 'lucide-react-native';

type ExerciseSet = {
    type: 'warmup' | 'feeder' | 'working' | 'custom'
    customLabel?: string
    series: string
    reps: string
    load: string
    rest: string
}

type Exercise = {
    name: string
    sets?: ExerciseSet[]
    series: string
    reps: string
    load: string
    rest: string
    notes?: string
    videoUrl?: string
    warmupSeries?: string
    warmupReps?: string
    warmupLoad?: string
    warmupRest?: string
    feederSeries?: string
    feederReps?: string
    feederLoad?: string
    feederRest?: string
}

type Workout = {
    id: string
    title: string
    data: {
        exercises: Exercise[]
        notes?: string
    }
}

export default function Session() {
    const { sessionId } = useLocalSearchParams();
    const [workout, setWorkout] = useState<Workout | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [sessionNotes, setSessionNotes] = useState('');
    
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (sessionId) {
            loadSession();
        }
    }, [sessionId]);

    useEffect(() => {
        timerRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    async function loadSession() {
        try {
            // Busca a sessão para pegar o workout_id e start_time
            const { data: sessionData, error: sessionError } = await supabase
                .from('workout_history')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (sessionError || !sessionData) throw new Error('Sessão não encontrada');

            // Calcula tempo decorrido inicial
            const start = new Date(sessionData.started_at);
            const now = new Date();
            const diffSec = Math.floor((now.getTime() - start.getTime()) / 1000);
            setElapsedSeconds(diffSec);

            // Busca o treino
            const { data: workoutData, error: workoutError } = await supabase
                .from('protocols')
                .select('*')
                .eq('id', sessionData.workout_id)
                .single();

            if (workoutError) throw workoutError;
            setWorkout(workoutData);

        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível carregar o treino.');
            router.back();
        } finally {
            setLoading(false);
        }
    }

    async function handleFinish() {
        if (!sessionId) return;
        try {
            await finishSession(sessionId as string, elapsedSeconds, sessionNotes);
            setShowFinishModal(false);
            Alert.alert('Parabéns!', 'Treino finalizado com sucesso!', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }
            ]);
        } catch (error) {
            Alert.alert('Erro', 'Falha ao finalizar treino.');
        }
    }

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (loading || !workout) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text>Carregando treino...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.workoutTitle}>{workout.title}</Text>
                    <View style={styles.timerBadge}>
                        <Clock size={16} color="#3b82f6" />
                        <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    style={styles.finishButton}
                    onPress={() => setShowFinishModal(true)}
                >
                    <StopCircle color="#fff" size={20} />
                    <Text style={styles.finishButtonText}>Finalizar</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {workout.data.exercises.map((ex, i) => (
                    <View key={i} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.indexBadge}>
                                <Text style={styles.indexText}>{i + 1}</Text>
                            </View>
                            <Text style={styles.exerciseName}>{ex.name}</Text>
                        </View>

                        <View style={styles.setsContainer}>
                            {(() => {
                                // Lógica de renderização de sets (mesma do workouts.tsx)
                                let setsToRender: ExerciseSet[] = ex.sets || [];
                                if (setsToRender.length === 0) {
                                    if (ex.series || ex.reps) {
                                        setsToRender.push({ 
                                            type: 'working', 
                                            series: ex.series || '', 
                                            reps: ex.reps || '', 
                                            load: ex.load || '', 
                                            rest: ex.rest || '' 
                                        });
                                    }
                                }

                                return setsToRender.map((set, idx) => (
                                    <View key={idx} style={styles.setRow}>
                                        <Text style={styles.setType}>{set.type === 'working' ? 'Trabalho' : 'Aquecimento'}</Text>
                                        <Text style={styles.setDetails}>{set.series} x {set.reps}</Text>
                                        <Text style={styles.setLoad}>{set.load || '-'}</Text>
                                        <Text style={styles.setRest}>{set.rest || '-'}</Text>
                                    </View>
                                ));
                            })()}
                        </View>
                        
                        {ex.notes && (
                            <View style={styles.noteBox}>
                                <Text style={styles.noteText}>{ex.notes}</Text>
                            </View>
                        )}
                    </View>
                ))}
            </ScrollView>

            <Modal visible={showFinishModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Finalizar Treino?</Text>
                        <Text style={styles.modalSubtitle}>Como foi o treino de hoje?</Text>
                        
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Aumentei carga no supino..."
                            multiline
                            numberOfLines={4}
                            value={sessionNotes}
                            onChangeText={setSessionNotes}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setShowFinishModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={handleFinish}
                            >
                                <Text style={styles.confirmButtonText}>Concluir</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    workoutTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    timerText: { fontSize: 16, fontWeight: '600', color: '#3b82f6', fontFamily: 'monospace' },
    finishButton: {
        backgroundColor: '#ef4444',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 20,
        paddingHorizontal: 16
    },
    finishButtonText: { color: '#fff', fontWeight: 'bold' },
    content: { padding: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    indexBadge: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: '#f1f5f9',
        alignItems: 'center', justifyContent: 'center', marginRight: 10
    },
    indexText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
    exerciseName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
    setsContainer: { gap: 8 },
    setRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        padding: 8, backgroundColor: '#f8fafc', borderRadius: 8
    },
    setType: { fontSize: 12, color: '#64748b', width: 80 },
    setDetails: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1 },
    setLoad: { fontSize: 14, color: '#334155', width: 60, textAlign: 'right' },
    setRest: { fontSize: 12, color: '#64748b', width: 60, textAlign: 'right' },
    noteBox: {
        marginTop: 12, padding: 10, backgroundColor: '#fff7ed',
        borderRadius: 8, borderWidth: 1, borderColor: '#ffedd5'
    },
    noteText: { fontSize: 12, color: '#c2410c' },
    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center', padding: 20
    },
    modalContent: {
        backgroundColor: '#fff', width: '100%', borderRadius: 24, padding: 24
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
    modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 12, padding: 16, minHeight: 100, textAlignVertical: 'top',
        marginBottom: 20
    },
    modalButtons: { flexDirection: 'row', gap: 12 },
    modalButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
    cancelButton: { backgroundColor: '#f1f5f9' },
    confirmButton: { backgroundColor: '#10b981' },
    cancelButtonText: { fontWeight: 'bold', color: '#64748b' },
    confirmButtonText: { fontWeight: 'bold', color: '#fff' }
});
