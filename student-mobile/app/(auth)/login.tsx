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
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={styles.label}>Senha</Text>
                                    <TouchableOpacity onPress={() => setIsRecovering(true)}>
                                        <Text style={styles.forgotLink}>Esqueci minha senha</Text>
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Sua senha"
                                    placeholderTextColor="#94a3b8"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
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
    height: 400, // Aumentado para ficar maior
    marginBottom: 0,
    zIndex: 1,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 8,
    marginTop: -80, // Mais grudado ainda
    zIndex: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 24
  },
  form: {
    gap: 16
  },
  inputGroup: {
    gap: 8
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
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#eff6ff'
  },
  forgotLink: {
    fontSize: 14,
    color: '#0ea5e9',
    fontWeight: '600'
  },
  button: {
    backgroundColor: '#0ea5e9',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
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
