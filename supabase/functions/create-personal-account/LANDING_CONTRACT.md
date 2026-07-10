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

Usado quando o pagamento ja foi aprovado na landing e a landing tambem recebeu os dados do cartao/metodo recorrente.

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
  "paymentProvider": "mercadopago",
  "paymentId": "166424321888",
  "paymentAmount": 14.90,
  "paymentCurrency": "BRL",
  "providerReference": "landing_starter_20260630_001",
  "paymentDescription": "Assinatura FitBody Starter",
  "providerCustomerId": "123456789-abcd",
  "providerCardId": "abcdef123456",
  "paymentMethodId": "master",
  "issuerId": "1234",
  "cardBrand": "Mastercard",
  "cardLastFour": "0406",
  "firstPaymentProviderPaymentId": "166424321888",
  "providerSubscriptionId": "sub_optional_123",
  "paymentRawPayload": {
    "id": 166424321888,
    "status": "approved"
  }
}
```

## Campos aceitos para recorrencia

- `providerCustomerId`
- `providerCardId`
- `paymentMethodId`
- `issuerId`
- `cardBrand`
- `cardLastFour`
- `firstPaymentProviderPaymentId`
- `providerSubscriptionId`
- `paymentRawPayload`

## Regras atuais

- Plano pago via landing exige `paymentStatus = "approved"`.
- Plano pago via landing exige `paymentProvider` e `paymentId`.
- Os campos de recorrencia ainda sao opcionais para compatibilidade, mas sem eles a resposta volta com `recurringReady = false`.

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
  "paymentMethodStored": true,
  "missingRecurringFields": []
}
```

## O que a API grava

- usuario e `profile`
- `personal_subscriptions`
- `subscription_payments` com o primeiro pagamento aprovado
- `personal_payment_methods`
- `profiles.data.paymentMethod` para compatibilidade com o fluxo atual do perfil
