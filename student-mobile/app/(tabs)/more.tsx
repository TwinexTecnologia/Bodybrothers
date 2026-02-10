import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { User, FileText, Camera, DollarSign, LogOut, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

export default function More() {
  const { user, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      if (user) {
          loadProfile();
      }
    }, [user])
  );

  async function loadProfile() {
      try {
          if (!user?.id) return;
          const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
          
          if (data) {
              setFullName(data.full_name || '');
              let jsonData = data.data;
              if (typeof jsonData === 'string') {
                  try { jsonData = JSON.parse(jsonData); } catch (e) { jsonData = {}; }
              }
              jsonData = jsonData || {};
              setAvatarUrl(jsonData.avatarUrl || data.avatar_url || null);
          }
      } catch (error) {
          // Silent error
      }
  }

  const handleSignOut = async () => {
    Alert.alert(
        'Sair',
        'Deseja realmente sair do aplicativo?',
        [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sair', style: 'destructive', onPress: async () => {
                await signOut();
                router.replace('/(auth)/login');
            }}
        ]
    );
  };

  const menuItems = [
      { 
          icon: User, 
          label: 'Meu Perfil', 
          sub: 'Dados pessoais e senha', 
          route: '/profile',
          color: '#3b82f6',
          bg: '#eff6ff'
      },
      { 
          icon: FileText, 
          label: 'Anamnese', 
          sub: 'Histórico de saúde', 
          route: '/anamnesis',
          color: '#8b5cf6',
          bg: '#f5f3ff'
      },
      { 
          icon: Camera, 
          label: 'Minha Evolução', 
          sub: 'Fotos de antes e depois', 
          route: '/evolution',
          color: '#10b981',
          bg: '#ecfdf5'
      },
      { 
          icon: DollarSign, 
          label: 'Financeiro', 
          sub: 'Pagamentos e pendências', 
          route: '/financial',
          color: '#f59e0b',
          bg: '#fffbeb'
      },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
          <Text style={styles.headerTitle}>Mais Opções</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
          {/* User Card */}
          <View style={styles.userCard}>
              <View style={styles.avatarContainer}>
                  {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  ) : (
                      <View style={styles.avatarPlaceholder}>
                          <User size={40} color="#64748b" />
                      </View>
                  )}
              </View>
              <View style={styles.userInfo}>
                  <Text style={styles.userName}>{fullName || 'Aluno'}</Text>
                  <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
          </View>

          <Text style={styles.sectionTitle}>Geral</Text>
          
          <View style={styles.menuGroup}>
              {menuItems.map((item, index) => (
                  <TouchableOpacity 
                      key={index} 
                      style={[
                          styles.menuItem, 
                          index === menuItems.length - 1 && { borderBottomWidth: 0 }
                      ]}
                      onPress={() => router.push(item.route as any)}
                  >
                      <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                          <item.icon size={20} color={item.color} />
                      </View>
                      <View style={{flex: 1}}>
                          <Text style={styles.menuLabel}>{item.label}</Text>
                          <Text style={styles.menuSub}>{item.sub}</Text>
                      </View>
                      <ChevronRight size={20} color="#cbd5e1" />
                  </TouchableOpacity>
              ))}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
              <LogOut size={20} color="#ef4444" />
              <Text style={styles.logoutText}>Sair do Aplicativo</Text>
          </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 24, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  content: { padding: 24, paddingTop: 12 },

  userCard: {
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#fff', padding: 24, borderRadius: 24, marginBottom: 32,
      shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3
  },
  avatarContainer: {
      marginBottom: 16,
      shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4
  },
  avatar: {
      width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', borderWidth: 4, borderColor: '#fff'
  },
  avatarPlaceholder: {
      width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', borderWidth: 4, borderColor: '#fff',
      alignItems: 'center', justifyContent: 'center'
  },
  userInfo: { alignItems: 'center' },
  userName: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 4, textAlign: 'center' },
  userEmail: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  userRole: { fontSize: 14, color: '#64748b' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, marginLeft: 8 },
  
  menuGroup: {
      backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 32,
      shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1
  },
  menuItem: {
      flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16,
      borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
      backgroundColor: '#fff' // Necessário para touchable
  },
  iconBox: {
      width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center'
  },
  menuLabel: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  menuSub: { fontSize: 13, color: '#94a3b8' },

  logoutButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: 16, backgroundColor: '#fef2f2', borderRadius: 16, borderWidth: 1, borderColor: '#fee2e2'
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },

  versionText: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginTop: 32 }
});
