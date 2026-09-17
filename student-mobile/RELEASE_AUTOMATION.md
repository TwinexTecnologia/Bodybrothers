# Release Mobile

## Fluxo local

Roda release com incremento automatico da versao publica e envio automatico para as lojas:

```bash
npm run release:prod
```

Atalho equivalente:

```bash
npm run release:all
```

Comandos disponiveis:

```bash
npm run release:android
npm run release:ios
npm run release:prod
npm run release -- all minor
npm run release -- android major
npm run release -- ios patch --dry-run
```

## O que foi automatizado

- `package.json` virou a fonte da versao publica do app.
- `app.config.js` sincroniza essa versao com o Expo.
- `eas.json` usa `appVersionSource: remote`.
- `ios.buildNumber` e `android.versionCode` passam a ser incrementados pelo EAS.
- `eas build --auto-submit` gera e envia o build automaticamente.

## Fluxo pelo GitHub

Existe um workflow manual em `.github/workflows/release-mobile.yml`.

Na aba Actions, rode `Release Mobile App` e escolha:

- plataforma: `all`, `ios` ou `android`
- incremento de versao: `patch`, `minor` ou `major`

O workflow:

- instala dependencias
- incrementa a versao publica
- commita `package.json` e `package-lock.json`
- dispara build e submit automatico

## Pre-requisitos

- `EXPO_TOKEN` configurado nos secrets do GitHub
- credenciais de submit do iOS configuradas no EAS/App Store Connect
- conta de servico do Google Play configurada no EAS para submit Android

Sem isso, o build pode ate gerar, mas o submit automatico nao conclui.
