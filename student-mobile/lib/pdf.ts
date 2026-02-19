import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

export const generateAndShareWorkoutPdf = async (studentId: string, studentName: string) => {
    try {
        // 1. Buscar Treinos Completos
        // Primeiro pega os IDs vinculados ao perfil
        const { data: profile } = await supabase.from('profiles').select('data').eq('id', studentId).single();
        const workoutIds = profile?.data?.workoutIds || [];

        let query = supabase.from('protocols').select('*').eq('type', 'workout').eq('status', 'active');
        
        if (workoutIds.length > 0) {
            query = query.or(`student_id.eq.${studentId},id.in.(${workoutIds.join(',')})`);
        } else {
            query = query.eq('student_id', studentId);
        }

        const { data: workouts, error } = await query;

        if (error || !workouts || workouts.length === 0) {
            alert('Nenhum treino encontrado para exportar.');
            return;
        }

        // 2. Montar HTML
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                h1 { color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
                .meta { color: #64748b; font-size: 12px; margin-bottom: 30px; }
                
                .workout { margin-bottom: 40px; page-break-inside: avoid; }
                .workout-title { font-size: 18px; font-weight: bold; color: #1e293b; background: #f1f5f9; padding: 10px; border-radius: 8px; margin-bottom: 10px; }
                .workout-notes { font-size: 12px; color: #64748b; font-style: italic; margin-bottom: 10px; padding: 0 10px; }
                
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #0f172a; color: #fff; text-align: left; padding: 8px; }
                td { border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: middle; }
                tr:nth-child(even) { background-color: #f8fafc; }
                
                .th-ex { width: 40%; }
                .th-sets { width: 15%; }
                .th-load { width: 20%; }
                .th-rest { width: 10%; }
                .th-obs { width: 15%; }
            </style>
        </head>
        <body>
            <h1>Ficha de Treino - ${studentName.toUpperCase()}</h1>
            <div class="meta">Gerado via FitBody Pro em ${new Date().toLocaleDateString('pt-BR')}</div>

            ${workouts.map((w: any) => `
                <div class="workout">
                    <div class="workout-title">${w.title}</div>
                    ${w.data.notes ? `<div class="workout-notes">Obs: ${w.data.notes}</div>` : ''}
                    
                    <table>
                        <thead>
                            <tr>
                                <th class="th-ex">Exercício</th>
                                <th class="th-sets">Séries/Reps</th>
                                <th class="th-load">Carga</th>
                                <th class="th-rest">Descanso</th>
                                <th class="th-obs">Obs</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(w.data.exercises || []).map((ex: any) => {
                                // Lógica de formatação igual ao painel web
                                let setsText = '';
                                if (ex.sets && ex.sets.length > 0) {
                                    const mainSet = ex.sets.find((s: any) => s.type === 'working') || ex.sets[0];
                                    setsText = `${mainSet.series} x ${mainSet.reps}`;
                                    if (ex.sets.length > 1) setsText += '*';
                                } else {
                                    setsText = `${ex.series || '-'} x ${ex.reps || '-'}`;
                                }

                                let loadText = ex.load || '';
                                if (ex.sets && ex.sets.length > 0) {
                                    loadText = ex.sets[0].load || '';
                                }

                                return `
                                    <tr>
                                        <td>${ex.name}</td>
                                        <td>${setsText}</td>
                                        <td>${loadText}</td>
                                        <td>${ex.rest || ''}</td>
                                        <td>${ex.notes || ''}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `).join('')}
        </body>
        </html>
        `;

        // 3. Gerar PDF
        const { uri } = await Print.printToFileAsync({
            html: htmlContent,
            base64: false
        });

        // 4. Compartilhar
        await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Treinos - ${studentName}`
        });

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Não foi possível gerar o PDF. Tente novamente.');
    }
};
