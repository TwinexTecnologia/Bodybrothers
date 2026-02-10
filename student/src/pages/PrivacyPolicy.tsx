import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', lineHeight: '1.6', color: '#333' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#0f172a' }}>Política de Privacidade</h1>
      <p style={{ color: '#64748b', marginBottom: '40px' }}>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>1. Introdução</h2>
        <p>
          O aplicativo <strong>FitBody Pro</strong> ("nós", "nosso" ou "aplicativo") respeita a sua privacidade e está comprometido em proteger os seus dados pessoais. 
          Esta Política de Privacidade explica como coletamos, usamos e compartilhamos informações sobre você quando utiliza nosso aplicativo móvel e nossos serviços.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>2. Informações que Coletamos</h2>
        <p>Coletamos as seguintes informações para fornecer e melhorar nossos serviços:</p>
        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '10px' }}>
          <li><strong>Informações de Cadastro:</strong> Nome, e-mail e dados de login fornecidos pelo seu personal trainer ou academia.</li>
          <li><strong>Dados de Saúde e Fitness:</strong> Informações sobre seus treinos, histórico de exercícios, medidas corporais e respostas de anamnese.</li>
          <li><strong>Mídia:</strong> Fotos que você envia voluntariamente para acompanhamento de evolução física (fotos de "antes e depois").</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>3. Como Usamos Suas Informações</h2>
        <p>Utilizamos seus dados exclusivamente para:</p>
        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '10px' }}>
          <li>Permitir o acesso à sua conta e funcionalidades do aplicativo.</li>
          <li>Permitir que seu personal trainer acompanhe seu progresso e prescreva treinos e dietas personalizados.</li>
          <li>Enviar notificações importantes sobre seus treinos e pagamentos.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>4. Compartilhamento de Dados</h2>
        <p>
          Não vendemos nem alugamos suas informações pessoais para terceiros. Seus dados são compartilhados apenas com:
        </p>
        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '10px' }}>
          <li><strong>Seu Personal Trainer/Academia:</strong> Para que possam prestar o serviço de acompanhamento.</li>
          <li><strong>Provedores de Serviço:</strong> Empresas que nos ajudam a operar o aplicativo (como serviços de hospedagem e banco de dados), sob estritas obrigações de confidencialidade.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>5. Segurança</h2>
        <p>
          Implementamos medidas de segurança técnicas e organizacionais adequadas para proteger seus dados pessoais contra acesso não autorizado, alteração, divulgação ou destruição.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>6. Exclusão de Dados</h2>
        <p>
          Você tem o direito de solicitar a exclusão de sua conta e de seus dados pessoais. Para isso, entre em contato com seu personal trainer ou envie um e-mail para o suporte do aplicativo.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>7. Contato</h2>
        <p>
          Se tiver dúvidas sobre esta Política de Privacidade, entre em contato conosco através do suporte técnico fornecido no aplicativo.
        </p>
      </section>
    </div>
  );
}
