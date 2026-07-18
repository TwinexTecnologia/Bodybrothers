# `create-personal-account` - contrato da landing

Endpoint:

```text
POST /functions/v1/create-personal-account
```

Headers obrigatorios para chamada da landing:

```text
Content-Type: application/json
x-landing-token: <LANDING_SIGNUP_TOKEN>
```

## Payload minimo

Usado quando o plano for `free`.

```json
{
  "name": "Joao Silva",
  "email": "joao@fitbodypro.com",
  "password": "123456",
  "phone": "11999999999",
  "brandName": "Joao Personal",
  "logoUrl": "",
  "plan": "free"
}
```

## Payload pago com recorrencia pronta

Usado quando o pagamento ja foi aprovado na landing e a landing tambem recebeu os dados do metodo recorrente.

O provider alvo agora e `asaas`.
O payload legado de `mercadopago` continua aceito temporariamente por compatibilidade, mas o formato recomendado para novas contas e o do Asaas.

```json
{
  "name": "Joao Silva",
  "email": "joao@fitbodypro.com",
  "password": "123456",
  "phone": "11999999999",
  "brandName": "Joao Personal",
  "logoUrl": "",
  "plan": "starter",
  "billingCycle": "monthly",
  "paymentStatus": "approved",
  "paymentProvider": "asaas",
  "paymentId": "pay_123456",
  "paymentAmount": 14.90,
  "paymentCurrency": "BRL",
  "providerReference": "landing_starter_20260714_001",
  "paymentDescription": "Assinatura FitBody Starter",
  "providerCustomerId": "cus_000001",
  "providerSubscriptionId": "sub_000001",
  "providerPaymentMethodToken": "a9a4d7c4-1234-5678-9abc-1234567890ab",
  "cardBrand": "Visa",
  "cardLastFour": "0406",
  "firstPaymentProviderPaymentId": "pay_123456",
  "paymentRawPayload": {
    "id": "pay_123456",
    "status": "RECEIVED"
  }
}
```

## Campos aceitos para recorrencia

- `providerCustomerId`
- `providerSubscriptionId`
- `providerPaymentMethodToken`
- `cardBrand`
- `cardLastFour`
- `firstPaymentProviderPaymentId`
- `paymentRawPayload`

## Campos legados ainda aceitos

- `providerPaymentProfileId`
- `providerCardId`
- `paymentMethodId`
- `issuerId`

## Regras atuais

- Plano pago via landing exige status de pagamento aprovado pelo provider.
- Para Asaas, os status equivalentes aceitos pelo backend sao `RECEIVED`, `CONFIRMED` e `RECEIVED_IN_CASH`.
- Para Mercado Pago, o status aceito continua sendo `approved`.
- Plano pago via landing exige `paymentProvider` e `paymentId`.
- A API aceita dois formatos de recorrencia:
- Formato novo recomendado para Asaas: `providerCustomerId + providerSubscriptionId + paymentId`.
- Formato legado de compatibilidade do Mercado Pago: `providerCustomerId + providerPaymentProfileId + paymentId` ou `providerCustomerId + providerCardId + paymentMethodId + paymentId`.
- Sem esses dados, a resposta volta com `recurringReady = false`.
- A resposta tambem informa `asaasReady` e `missingAsaasFields` para deixar claro se a landing ja esta pronta para o fluxo nativo do Asaas.

## Resposta relevante

```json
{
  "success": true,
  "userId": "uuid",
  "personalId": "uuid",
  "mode": "landing",
  "plan": "starter",
  "billingCycle": "monthly",
  "studentLimit": 10,
  "paymentRequired": true,
  "subscriptionStatus": "active",
  "recurringReady": true,
  "asaasReady": true,
  "ordersApiReady": false,
  "paymentMethodStored": true,
  "missingRecurringFields": [],
  "missingAsaasFields": [],
  "missingOrdersApiFields": []
}
```

## O que a API grava

- usuario e `profile`
- `personal_subscriptions`
- `subscription_payments` com o primeiro pagamento aprovado
- `personal_payment_methods`
- `profiles.data.paymentMethod` para compatibilidade com o fluxo atual do perfil

## Observacao para o dev da landing

- Para novas contas pagas, envie `paymentProvider = "asaas"`.
- O minimo para recorrencia pronta no Asaas e: `providerCustomerId`, `providerSubscriptionId` e `paymentId`.
- Se houver `providerPaymentMethodToken` e dados do cartao (`cardBrand`, `cardLastFour`), a API tambem persiste essas informacoes para compatibilidade de exibicao e futuras acoes.
- O payload antigo do Mercado Pago continua aceito temporariamente apenas para nao quebrar cadastros antigos enquanto a migracao total nao termina.
