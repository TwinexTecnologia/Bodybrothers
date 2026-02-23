import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  async function handleLogin() {
    if (!email || !password) return Alert.alert('Atenção', 'Preencha email e senha.');
    
    setLoading(true);
    console.log('Tentando login com:', email); // Debug

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
        });

        if (error) {
            console.error('Erro Supabase:', error);
            throw error;
        }

        console.log('Login sucesso:', data.user?.id);
        
        // Redirecionamento explícito
        if (data.user) {
            router.replace('/(tabs)/dashboard');
        }
    } catch (error: any) {
        console.error('Catch erro:', error);
        Alert.alert('Erro no Login', error.message === 'Invalid login credentials' ? 'Email ou senha incorretos.' : error.message);
    } finally {
        setLoading(false);
    }
  }

  async function handleRecovery() {
    if (!email) return Alert.alert('Atenção', 'Digite seu email para recuperar a senha.');

    setLoading(true);
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        Alert.alert('Sucesso', 'Email de recuperação enviado! Verifique sua caixa de entrada.');
        setIsRecovering(false);
    } catch (error: any) {
        Alert.alert('Erro', error.message);
    } finally {
        setLoading(false);
    }
  }

  return (
    <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={styles.container}
    >
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, width: '100%' }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Logo */}
                <Image
                    source={{ uri: "https://cdtouwfxwuhnlzqhcagy.supabase.co/storage/v1/object/public/Imagens/ChatGPT%20Image%209%20de%20fev.%20de%202026%2C%2022_23_47.png" }}
                    style={styles.logo}
                    resizeMode="contain"
                />

                {/* Card de Login */}
                <View style={styles.card}>
                    <Text style={styles.title}>
                        {isRecovering ? 'Recuperar Senha' : 'Bem-vindo de volta!'}
                    </Text>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="seuemail@exemplo.com"
                                placeholderTextColor="#94a3b8"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        {!isRecovering && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Senha</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Sua senha"
                                    placeholderTextColor="#94a3b8"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setIsRecovering(true)} style={{ alignSelf: 'flex-end' }}>
                                    <Text style={styles.forgotLink}>Esqueci minha senha</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity 
                            style={styles.button} 
                            onPress={isRecovering ? handleRecovery : handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isRecovering ? 'Enviar Link' : 'Acessar Painel'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {isRecovering && (
                            <TouchableOpacity 
                                style={styles.backButton}
                                onPress={() => setIsRecovering(false)}
                            >
                                <Text style={styles.backButtonText}>Cancelar e voltar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <Text style={styles.footer}>
                    © 2026 Twinex Tecnologia. Todos os direitos reservados.
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40
  },
  logo: {
    width: '100%',
    height: 120, // Reduzido
    marginBottom: 20,
    zIndex: 1,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20, // Reduzido padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // Sombra mais sutil
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 20,
    zIndex: 2,
  },
  title: {
    fontSize: 22, // Levemente menor
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 20
  },
  form: {
    gap: 12 // Menor gap
  },
  inputGroup: {
    gap: 6
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 45, // Altura padrão
    textAlignVertical: 'center',
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc' // Fundo mais leve
  },
  forgotLink: {
    fontSize: 13,
    color: '#0ea5e9',
    fontWeight: '600',
    marginTop: 4
  },
  button: {
    backgroundColor: '#0ea5e9',
    padding: 12, // Botão mais compacto
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  backButton: {
    alignItems: 'center',
    padding: 8
  },
  backButtonText: {
    color: '#64748b',
    fontSize: 14
  },
  footer: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 0,
    textAlign: 'center'
  }
});
