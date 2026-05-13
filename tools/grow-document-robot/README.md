# Grow Document Robot

O modulo de obrigacoes agora pode operar de duas formas:

## 1. Modo Web 100 por cento

Nao exige instalar nada.

Fluxo:

- entrar em `Obrigacoes > Central de Documentos`
- arrastar os PDFs para a area de envio
- revisar o preview
- clicar em `Enviar lote para a central`

Se o match for confiavel, o backend:

- vincula o documento
- conclui a obrigacao quando ela for satisfeita
- fecha a tarefa do setor
- atualiza o calendario
- emite protocolo
- publica no portal do cliente

Se houver ambiguidade, o documento vai para triagem manual.

## 2. Modo Robo Local Windows

Esse modo aproxima a Grow do comportamento do e-Continuo.

O robo:

- monitora uma ou mais pastas
- detecta PDFs novos ou alterados
- evita duplicidade por `hash + nome + tamanho + maquina`
- extrai texto nativo do PDF
- tenta detectar `CNPJ` e `competencia`
- envia o arquivo para `obligation-files`
- registra a ingestao no `grow-obligations-module` como `source_kind = local_robot`
- persiste fila local para sobreviver a reinicios e falhas de rede

## Configuracao local

Arquivo preparado:

```text
tools/grow-document-robot/runtime/config.local.json
```

Pontos principais:

- projeto Supabase: `vgkmcerjlwnzbiukinhd`
- pasta monitorada padrao: `C:/Grow/Entrada-eContinuo`
- arquivo de estado: `tools/grow-document-robot/runtime/state.json`
- log local: `tools/grow-document-robot/runtime/robot-run.log`

## Uso manual do robo

1. Ajuste apenas os campos operacionais se necessario:
   - `machineId`
   - `folders`
   - `scanIntervalMs`
   - `retryDelayMs`
2. Compile:

```powershell
npm.cmd run build:robot
```

3. Execute:

```powershell
npm.cmd run robot:start
```

## Instalar inicializacao automatica no Windows

Para registrar uma tarefa automatica no logon do Windows:

```powershell
npm.cmd run robot:install-task
```

Para remover a tarefa automatica:

```powershell
npm.cmd run robot:uninstall-task
```

## Observacoes

- O backend da Grow continua sendo a fonte de verdade para vinculo, conclusao, protocolo, portal e notificacoes.
- Nesta primeira versao, a analise local prioriza texto nativo do PDF. Se o PDF vier sem texto util, ele ainda sera enviado, mas pode cair em revisao humana.
- O arquivo `config.local.json` fica ignorado no Git para nao versionar credenciais operacionais.
