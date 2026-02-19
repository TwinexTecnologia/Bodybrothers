import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { router } from 'expo-router';
import { ChevronLeft, CreditCard, AlertCircle, CheckCircle, Clock, Calendar, Download } from 'lucide-react-native';
import { useFinancialStatus } from '../../hooks/useFinancialStatus';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const frequencyMap: Record<string, string> = {
    weekly: 'Semanal',
    monthly: 'Mensal',
    bimonthly: 'Bimestral',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual'
};

export default function Financial() {
  const { user } = useAuth();
  const { loading, plan, financialInfo, chargesList, overdueCount } = useFinancialStatus();

  const displayList = chargesList.filter(c => {
      if (c.status === 'overdue') return true;
      const today = new Date();
      today.setHours(0,0,0,0);
      if (c.date >= today) return true;
      return false;
  }).slice(0, 5); // Show top 5 on mobile

  const nextCharge = chargesList.find(c => c.date >= new Date(new Date().setHours(0,0,0,0)));
  const freqLabel = plan?.frequency ? frequencyMap[plan.frequency] : 'Mensal';
  const suffix = plan?.frequency === 'weekly' ? '/sem' : plan?.frequency === 'annual' ? '/ano' : '/mês';

  const handleExportPDF = async () => {
      if (!chargesList.length || !user || !plan) return;

      try {
        const html = `
          <html>
            <head>
              <style>
                body { font-family: 'Helvetica', sans-serif; padding: 40px; }
                h1 { color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                th { background-color: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase; }
                .status-paid { color: #16a34a; font-weight: bold; }
                .status-overdue { color: #ef4444; font-weight: bold; }
                .status-pending { color: #f59e0b; font-weight: bold; }
              </style>
            </head>
            <body>
              <h1>Extrato Financeiro</h1>
              <p>Aluno: ${user.user_metadata?.full_name || user.email}</p>
              <p>Plano: ${plan.title} (R$ ${plan.price.toFixed(2)})</p>
              
              <table>
                <thead>
                  <tr>
                    <th>Data Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  ${chargesList.map(c => `
                    <tr>
                      <td>${new Date(c.date).toLocaleDateString('pt-BR')}</td>
                      <td>R$ ${c.amount.toFixed(2)}</td>
                      <td class="status-${c.status}">
                        ${c.status === 'paid' ? 'PAGO' : c.status === 'overdue' ? 'ATRASADO' : 'PENDENTE'}
                      </td>
                      <td>${c.payment ? new Date(c.payment.paidAt).toLocaleDateString('pt-BR') : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </body>
          </html>
        `;

        if (Platform.OS === 'web') {
             await Print.printAsync({ html });
        } else {
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        }

      } catch (error) {
          Alert.alert('Erro', 'Não foi possível gerar o PDF.');
          console.error(error);
      }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financeiro</Text>
        {plan && (
            <TouchableOpacity onPress={handleExportPDF} style={styles.pdfButton}>
                <Download size={20} color="#0f172a" />
            </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#000" />
        </View>
      ) : plan ? (
        <ScrollView contentContainerStyle={styles.content}>
            
            {/* Plan Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.row}>
                        <CreditCard size={20} color="#64748b" />
                        <Text style={styles.cardTitle}>Meu Plano</Text>
                    </View>
                    <View style={styles.activeBadge}>
                        <Text style={styles.activeText}>ATIVO</Text>
                    </View>
                </View>
                
                <View style={styles.cardBody}>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    <Text style={styles.planSub}>Cobrança {freqLabel.toLowerCase()}</Text>
                    
                    <View style={styles.priceContainer}>
                        <Text style={styles.price}>R$ {plan.price.toFixed(2)}</Text>
                        <Text style={styles.suffix}>{suffix}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoGrid}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Dia de Vencimento</Text>
                            <View style={styles.row}>
                                <Calendar size={16} color="#0f172a" />
                                <Text style={styles.value}>Dia {financialInfo.dueDay || plan.due_day}</Text>
                            </View>
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={styles.label}>Próximo Pagamento</Text>
                            <Text style={styles.value}>
                                {nextCharge ? nextCharge.date.toLocaleDateString('pt-BR') : '—'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Status Alert */}
            {overdueCount > 0 ? (
                <View style={[styles.alert, styles.alertDanger]}>
                    <View style={[styles.iconBox, styles.iconDanger]}>
                        <AlertCircle size={24} color="#ef4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.alertTitle, { color: '#991b1b' }]}>Pendência Identificada</Text>
                        <Text style={[styles.alertText, { color: '#b91c1c' }]}>
                            Você possui {overdueCount} mensalidade(s) em aberto.
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={[styles.alert, styles.alertSuccess]}>
                    <View style={[styles.iconBox, styles.iconSuccess]}>
                        <CheckCircle size={24} color="#16a34a" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.alertTitle, { color: '#166534' }]}>Situação Regular</Text>
                        <Text style={[styles.alertText, { color: '#15803d' }]}>
                            Suas mensalidades estão em dia.
                        </Text>
                    </View>
                </View>
            )}

            {/* List */}
            <Text style={styles.sectionTitle}>Próximos Lançamentos</Text>
            <View style={styles.listContainer}>
                {displayList.length === 0 ? (
                    <View style={styles.emptyList}>
                        <Text style={styles.emptyText}>Nenhuma cobrança próxima.</Text>
                    </View>
                ) : (
                    displayList.map((item, i) => (
                        <View key={i} style={[styles.listItem, i === displayList.length - 1 && { borderBottomWidth: 0 }]}>
                            <View style={[styles.row, { flex: 1, marginRight: 16 }]}>
                                <View style={[styles.statusIcon, item.status === 'paid' ? styles.bgSuccess : styles.bgGray]}>
                                    {item.status === 'paid' ? <CheckCircle size={16} color="#16a34a" /> : <Clock size={16} color="#64748b" />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.listTitle} numberOfLines={1} ellipsizeMode="tail">Mensalidade</Text>
                                    <Text style={[styles.listSub, item.status === 'overdue' && { color: '#ef4444' }]} numberOfLines={1} ellipsizeMode="tail">
                                        {item.status === 'paid' ? `Pago em ${new Date(item.payment.paidAt).toLocaleDateString('pt-BR')}` : `Vence em ${item.date.toLocaleDateString('pt-BR')}`}
                                    </Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end', minWidth: 100 }}>
                                <Text style={styles.listAmount}>R$ {item.amount.toFixed(2)}</Text>
                                <Text style={[
                                    styles.listStatus, 
                                    item.status === 'paid' ? { color: '#16a34a' } : item.status === 'overdue' ? { color: '#ef4444' } : { color: '#f59e0b' }
                                ]}>
                                    {item.status === 'paid' ? 'PAGO' : item.status === 'overdue' ? 'ATRASADO' : 'PENDENTE'}
                                </Text>
                            </View>
                        </View>
                    ))
                )}
            </View>

        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
                <CreditCard size={32} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>Nenhum plano vinculado</Text>
            <Text style={styles.emptyDesc}>Entre em contato com seu personal para configurar seu plano.</Text>
        </View>
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
  pdfButton: { padding: 8, marginRight: -8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24 },

  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginLeft: 8 },
  activeBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  activeText: { color: '#166534', fontSize: 12, fontWeight: '700' },
  
  cardBody: { padding: 24 },
  planTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  planSub: { color: '#64748b', fontSize: 14, marginBottom: 16 },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end' },
  price: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  suffix: { color: '#64748b', fontSize: 16, marginLeft: 4 },
  
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 24 },
  
  infoGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  value: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },

  alert: { flexDirection: 'row', padding: 16, borderRadius: 16, marginBottom: 24, gap: 16, alignItems: 'center' },
  alertSuccess: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  alertDanger: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  iconBox: { padding: 8, borderRadius: 20 },
  iconSuccess: { backgroundColor: '#dcfce7' },
  iconDanger: { backgroundColor: '#fee2e2' },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertText: { fontSize: 14 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  listContainer: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  statusIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bgSuccess: { backgroundColor: '#dcfce7' },
  bgGray: { backgroundColor: '#f1f5f9' },
  listTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  listSub: { fontSize: 12, color: '#64748b' },
  listAmount: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  listStatus: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  
  emptyList: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#94a3b8' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  emptyDesc: { textAlign: 'center', color: '#64748b' }
});
