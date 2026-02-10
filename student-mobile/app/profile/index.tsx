import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Image, Platform, Modal } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Save, Lock, Camera, User as UserIcon, X } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', type: 'error' as 'success' | 'error' });
  const [emailConfirmModalVisible, setEmailConfirmModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const showAlert = (title: string, message: string, type: 'success' | 'error' = 'error') => {
      setModalConfig({ title, message, type });
      setModalVisible(true);
  };

  useEffect(() => {
    if (user) {
        loadProfile();
        setEmail(user.email || '');
    }
  }, [user]);

  async function loadProfile() {
    try {
        if (!user?.id) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error) {
            console.error('Profile fetch error:', error);
            return;
        }
        
        if (data) {
            setFullName(data.full_name || user.user_metadata?.full_name || '');
            
            // Handle JSON data field
            let jsonData = data.data;
            if (typeof jsonData === 'string') {
                try {
                    jsonData = JSON.parse(jsonData);
                } catch (e) {
                    console.error('JSON Parse error:', e);
                    jsonData = {};
                }
            }
            jsonData = jsonData || {};

            // Priority: JSON.phone > JSON.whatsapp > Column phone > Auth phone
            const phoneValue = jsonData.phone || jsonData.whatsapp || data.phone || user.phone || '';
            setPhone(phoneValue);

            const avatarValue = jsonData.avatarUrl || data.avatar_url || user.user_metadata?.avatar_url || null;
            setAvatarUrl(avatarValue);
        }

    } catch (error) {
        console.error(error);
        showAlert('Erro', 'Não foi possível carregar seu perfil.', 'error');
    } finally {
        setLoading(false);
    }
  }

  const pickImage = async () => {
    try {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            uploadAvatar(result.assets[0]);
        }
    } catch (e) {
        showAlert('Erro', 'Não foi possível selecionar a imagem.', 'error');
    }
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
      try {
          setUploadingAvatar(true);
          const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
          const fileNameOnly = `${user?.id}-${Date.now()}.${fileExt}`;
          const filePath = `avatars/${fileNameOnly}`;

          let fileBody;

          if (Platform.OS === 'web') {
              // Na Web, precisamos converter a URI (blob:) para um objeto Blob real
              const response = await fetch(asset.uri);
              fileBody = await response.blob();
          } else {
              // No Mobile (Native), usamos FormData conforme documentação do Supabase
              const formData = new FormData();
              formData.append('file', {
                  uri: asset.uri,
                  name: fileNameOnly,
                  type: asset.mimeType || 'image/jpeg'
              } as any);
              fileBody = formData;
          }

          const { error: uploadError } = await supabase.storage
               .from('logos')
               .upload(filePath, fileBody, {
                   cacheControl: '3600',
                   upsert: true,
                   contentType: asset.mimeType || 'image/jpeg'
               });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
              .from('logos')
              .getPublicUrl(filePath);
          
          // Add timestamp to force refresh
          setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
      } catch (error: any) {
          console.error('Upload error:', error);
          showAlert('Erro', `Falha ao enviar foto: ${error.message || 'Erro desconhecido'}`, 'error');
      } finally {
          setUploadingAvatar(false);
      }
  };

  const formatPhone = (text: string) => {
    // Remove tudo que não é dígito
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 11) {
        formatted = cleaned.substring(0, 11);
    }

    if (cleaned.length > 10) {
        // (11) 91234-5678
        formatted = cleaned.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (cleaned.length > 5) {
        // (11) 1234-5678
        formatted = cleaned.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (cleaned.length > 2) {
        // (11) 123...
        formatted = cleaned.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    } else {
        formatted = cleaned;
    }

    return formatted;
  };

  const handlePhoneChange = (text: string) => {
      setPhone(formatPhone(text));
  };

  const validateEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
  };

  const confirmEmailChange = async () => {
      setEmailConfirmModalVisible(false);
      setSaving(true);
      try {
          // Salva os outros dados primeiro (telefone, foto)
          await handleSaveDataOnly();

          // Atualiza Email
          const { error: authError } = await supabase.auth.updateUser({ email: newEmail });
          if (authError) throw authError;
          showAlert('Sucesso', 'Perfil atualizado! Verifique seu email para confirmar o novo endereço.', 'success');
      } catch (error: any) {
          showAlert('Erro', error.message || 'Falha ao atualizar email.', 'error');
      } finally {
          setSaving(false);
      }
  };

  const handleSaveDataOnly = async () => {
      // Mesma lógica de salvar dados, mas sem a parte do email
      const { data: currentProfile } = await supabase.from('profiles').select('data').eq('id', user?.id).single();
      let currentData = currentProfile?.data || {};
      if (typeof currentData === 'string') { try { currentData = JSON.parse(currentData); } catch (e) { currentData = {}; } }
      
      const updates = {
          data: { ...currentData, phone: phone, whatsapp: phone, avatarUrl: avatarUrl },
          updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
      if (error) throw error;
  };

  async function handleSave() {
    setSaving(true);

    // Validação do Telefone
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        setSaving(false);
        const msg = 'Por favor, insira um número de telefone válido no formato (DD) 99999-9999 ou (DD) 9999-9999.';
        showAlert('Telefone Inválido', msg, 'error');
        return;
    }

    // Validação de Email (Mudança)
    if (user?.email && email !== user.email && !emailConfirmModalVisible) {
        if (!validateEmail(email)) {
            setSaving(false);
            showAlert('Email Inválido', 'Por favor, insira um endereço de email válido.', 'error');
            return;
        }

        setSaving(false);
        setNewEmail(email);
        setEmailConfirmModalVisible(true);
        return;
    }

    try {
        // 1. Buscar dados atuais para não sobrescrever outros campos do JSON 'data'
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('data')
            .eq('id', user?.id)
            .single();

        let currentData = currentProfile?.data || {};
        
        // Garante que currentData é um objeto
        if (typeof currentData === 'string') {
            try {
                currentData = JSON.parse(currentData);
            } catch (e) {
                currentData = {};
            }
        }
        
        // 2. Atualizar Profile (Telefone e Avatar dentro de 'data')
        const updates = {
            data: {
                ...currentData,
                phone: phone,
                whatsapp: phone, // Personal App uses 'whatsapp' field
                avatarUrl: avatarUrl
            },
            updated_at: new Date().toISOString()
        };

        const { error: profileError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user?.id);

        if (profileError) throw profileError;

        // 3. Atualizar Email (Se mudou)
        // Se chegou aqui, ou o email não mudou, ou já foi tratado pelo modal
        if (user?.email && email !== user.email) {
             // Lógica movida para confirmEmailChange, aqui só chega se pular validação (não deve acontecer)
        } else {
            showAlert('Sucesso', 'Seus dados foram atualizados com sucesso!', 'success');
        }

    } catch (error: any) {
        console.error('Save error:', error);
        showAlert('Erro', error.message || 'Falha ao atualizar perfil.', 'error');
    } finally {
        setSaving(false);
    }
  }

  const handleChangePassword = async () => {
      if (!email) return;
      try {
          await supabase.auth.resetPasswordForEmail(email);
          showAlert('Email Enviado', 'Verifique seu email para redefinir a senha.', 'success');
      } catch (error) {
          showAlert('Erro', 'Não foi possível enviar o email de redefinição.', 'error');
      }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meu Perfil</Text>
          <View style={{width: 24}} /> 
      </View>

      {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 40}} />
      ) : (
          <ScrollView contentContainerStyle={styles.content}>
              
              {/* Avatar Section */}
              <View style={styles.avatarContainer}>
                  <View style={styles.avatarWrapper}>
                      {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                      ) : (
                          <View style={styles.avatarPlaceholder}>
                              <UserIcon size={40} color="#cbd5e1" />
                          </View>
                      )}
                      <TouchableOpacity style={styles.cameraButton} onPress={pickImage} disabled={uploadingAvatar}>
                          {uploadingAvatar ? (
                              <ActivityIndicator size="small" color="#fff" />
                          ) : (
                              <Camera size={20} color="#fff" />
                          )}
                      </TouchableOpacity>
                  </View>
                  <Text style={styles.avatarHint}>Toque na câmera para alterar</Text>
              </View>

              <View style={styles.formGroup}>
                  <Text style={styles.label}>Nome Completo</Text>
                  <TextInput
                      style={[styles.input, styles.disabledInput]}
                      value={fullName}
                      editable={false}
                      placeholder="Seu nome"
                  />
                  <Text style={styles.helperText}>O nome é definido pelo seu Personal.</Text>
              </View>

              <View style={styles.formGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                  />
              </View>

              <View style={styles.formGroup}>
                  <Text style={styles.label}>Telefone / WhatsApp</Text>
                  <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={handlePhoneChange}
                      placeholder="(00) 00000-0000"
                      keyboardType="phone-pad"
                      maxLength={15} // (11) 91234-5678 = 15 chars
                  />
              </View>

              <TouchableOpacity 
                  style={styles.saveButton} 
                  onPress={handleSave}
                  disabled={saving || uploadingAvatar}
              >
                  {saving ? (
                      <ActivityIndicator color="#fff" />
                  ) : (
                      <>
                          <Save size={20} color="#fff" />
                          <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                      </>
                  )}
              </TouchableOpacity>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Segurança</Text>
              
              <TouchableOpacity style={styles.passwordButton} onPress={handleChangePassword}>
                  <Lock size={20} color="#64748b" />
                  <Text style={styles.passwordButtonText}>Redefinir Senha</Text>
              </TouchableOpacity>

          </ScrollView>
      )}

      {/* Email Confirmation Modal */}
      <Modal
          animationType="slide"
          transparent={true}
          visible={emailConfirmModalVisible}
          onRequestClose={() => setEmailConfirmModalVisible(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: '#fff9c4', borderWidth: 2, borderColor: '#f59e0b' }]}>
                  <View style={[styles.modalIcon, { backgroundColor: '#fef3c7' }]}>
                      <Text style={{ fontSize: 40 }}>⚠️</Text>
                  </View>
                  <Text style={[styles.modalTitle, { color: '#b45309' }]}>ALERTA CRÍTICO</Text>
                  <Text style={[styles.modalMessage, { color: '#92400e', fontWeight: '500' }]}>
                      Você está alterando seu email de login!
                  </Text>
                  <Text style={[styles.modalMessage, { color: '#92400e', marginTop: -10 }]}>
                      Atual: <Text style={{fontWeight: 'bold'}}>{user?.email}</Text>{'\n'}
                      Novo: <Text style={{fontWeight: 'bold'}}>{newEmail}</Text>
                  </Text>
                  <Text style={[styles.modalMessage, { color: '#92400e', fontSize: 13 }]}>
                      Se confirmar, você precisará usar o NOVO email para entrar no aplicativo. Deseja mesmo continuar?
                  </Text>
                  
                  <View style={{ width: '100%', gap: 12 }}>
                      <TouchableOpacity 
                          style={[styles.modalButton, { backgroundColor: '#d97706' }]} 
                          onPress={confirmEmailChange}
                      >
                          <Text style={styles.modalButtonText}>Sim, alterar email</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                          style={[styles.modalButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d97706' }]} 
                          onPress={() => {
                              setEmailConfirmModalVisible(false);
                              setSaving(false);
                              setEmail(user?.email || ''); // Reverte
                          }}
                      >
                          <Text style={[styles.modalButtonText, { color: '#d97706' }]}>Cancelar</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      {/* Custom Modal */}
      <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={[styles.modalIcon, modalConfig.type === 'success' ? styles.modalIconSuccess : styles.modalIconError]}>
                      <Text style={{ fontSize: 32 }}>
                          {modalConfig.type === 'success' ? '✅' : '❌'}
                      </Text>
                  </View>
                  <Text style={styles.modalTitle}>{modalConfig.title}</Text>
                  <Text style={styles.modalMessage}>{modalConfig.message}</Text>
                  <TouchableOpacity 
                      style={[styles.modalButton, modalConfig.type === 'success' ? styles.modalButtonSuccess : styles.modalButtonError]} 
                      onPress={() => setModalVisible(false)}
                  >
                      <Text style={styles.modalButtonText}>OK</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
      padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  content: { padding: 24 },

  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  cameraButton: {
      position: 'absolute', bottom: 0, right: 0,
      backgroundColor: '#3b82f6', width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#f8fafc'
  },
  avatarHint: { marginTop: 8, fontSize: 12, color: '#94a3b8' },

  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  input: {
      backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
      padding: 14, fontSize: 16, color: '#0f172a'
  },
  disabledInput: { backgroundColor: '#f1f5f9', color: '#64748b' },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 6 },

  saveButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: '#0f172a', padding: 16, borderRadius: 12, marginTop: 12,
      shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },

  passwordButton: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0'
  },
  passwordButtonText: { color: '#475569', fontWeight: '600', fontSize: 15 },

  // Modal Styles
  modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24
  },
  modalContent: {
      backgroundColor: '#fff', borderRadius: 24, padding: 32, width: '100%', maxWidth: 340, alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5
  },
  modalIcon: {
      width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16
  },
  modalIconSuccess: { backgroundColor: '#dcfce7' },
  modalIconError: { backgroundColor: '#fee2e2' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalButton: {
      width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center'
  },
  modalButtonSuccess: { backgroundColor: '#16a34a' },
  modalButtonError: { backgroundColor: '#ef4444' },
  modalButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
