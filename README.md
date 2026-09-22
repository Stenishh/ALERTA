# 🏥 ALERTA — Assistência Local de Emergência e Resposta a Tombos Acidentais.

**Monitoramento Inteligente e Prevenção de Quedas em Tempo Real**

---

## 🌟 Visão Geral

O **ALERTA** é um ecossistema de saúde digital (e-Health) projetado para enfrentar um dos maiores desafios da segurança hospitalar: as quedas de pacientes. Unindo hardware vestível (wearable) e uma interface web de alta performance, o sistema oferece monitoramento contínuo e detecção imediata de acidentes.

O projeto foi concebido para o ambiente dinâmico de hospitais e clínicas, onde cada segundo conta para salvar uma vida ou prevenir complicações graves.

---

## 🚀 Como Funciona?

O sistema opera em uma estrutura de três pilares:

### 1. ⌚ O Dispositivo (Hardware)
Um colete ergonômico equipado com um microcontrolador **ESP32** e sensores de movimento (acelerômetro). O algoritmo em **C++** processa os dados localmente para identificar padrões de queda livre e impactos bruscos com alta precisão.

### 2. 🛰️ A Transmissão
Os eventos detectados são enviados via **Wi-Fi** para o servidor através de uma API segura, garantindo que o status do paciente seja atualizado instantaneamente no painel de controle.

### 3. 🖥️ O Dashboard (Software)
Uma interface moderna desenvolvida que permite à equipe de enfermagem visualizar, de forma centralizada, a telemetria e a atividade de todos os pacientes da unidade.

---

## ✨ Funcionalidades Principais

- **🚨 Alerta Crítico de Queda**  
  Notificação visual imediata em caso de acidente, sobrepondo qualquer outra atividade no dashboard.

- **📊 Monitoramento em Tempo Real**  
  Visualização constante do status do paciente: _Em Movimento_, _Parado_ ou _Offline_.

- **🔋 Gestão de Telemetria**  
  Acompanhamento do nível de bateria e qualidade do sinal Wi-Fi de cada dispositivo para garantir a continuidade do serviço.

- **📋 Prontuário Rápido**  
  Acesso imediato a informações críticas como  grau de risco do paciente, remédios usados periodicamente, entre outros 

- **🌙 Modo Noturno**  
  Interface otimizada para reduzir a fadiga ocular durante os plantões noturnos.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|-----------|
| **Hardware** | ESP32, Acelerômetro Triaxial, C++ |
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS |
| **Gerenciamento** | React Hooks |
| **Backend/Banco** | Flask, persistência local em JSON |
| **Design** | Figma (Prototipagem UX/UI) |

---

## 📁 Estrutura do Projeto

```
app/ e components/  Dashboard Next.js
backend/             API Flask e testes
hooks/ e lib/        Integração do frontend com a API
codigoESP.INO        Firmware do ESP32 + MPU6050
```

---


## 🚧 Instalação e Execução

### Iniciar tudo com um comando

Com as dependências instaladas conforme as instruções abaixo, execute na raiz
do projeto:

```bash
npm run iniciar
```

Esse comando inicia o site em `http://localhost:3000` e a API em
`http://localhost:8080`. Use **Ctrl+C** para encerrar os dois serviços.
O script encontra automaticamente o Python com Flask em `backend/.venv`,
`venv`, `.venv` ou no sistema, sem precisar ativar o ambiente manualmente.
Se uma das portas estiver ocupada, ele avisa e não inicia outra instância.

### Parar os serviços

Em outro terminal, na raiz do projeto, execute:

```bash
npm run parar
```

Solicita o encerramento dos processos nas portas `3000` e `8080` cujo diretório
de execução seja a raiz deste projeto ou sua pasta `backend`. Funciona também
para serviços iniciados separadamente. Requer `lsof` (macOS ou Linux).
Se ainda houver serviços em escuta após a espera, o comando informa seus PIDs
e retorna erro. Serviços em outras portas não são encerrados.

Para conferir os processos antes de encerrar, use `npm run parar -- --dry-run`.

### Consultar portas e localizar os serviços

```bash
npm run portas
```

Lista as portas TCP em escuta, os endereços, os processos e seus PIDs.
Destaca o frontend em `http://localhost:3000` e o backend em
`http://localhost:8080`, mostrando os caminhos do código e os diretórios dos
processos para ajudar a identificar se pertencem a este projeto. Se iniciar
um serviço em outra porta, consulte a tabela completa. Requer `lsof`
(já disponível no macOS; no Linux, instale pelo gerenciador de pacotes).
A consulta não inicia nem encerra serviços.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

A API fica disponível na porta `8080`. Os dispositivos vinculados e a última
telemetria são persistidos em `backend/data/devices.json`, criado automaticamente.

### Frontend

```bash
cp .env.example .env.local
npm install
npm run dev
```

Por padrão, o navegador acessa o backend em `http://localhost:8080`. Se o painel
for aberto em outro computador, altere `NEXT_PUBLIC_API_URL` em `.env.local` para
o IP da máquina que executa o Flask.

### ESP32

No arquivo `codigoESP.INO`:

1. configure `WIFI_SSID` e `WIFI_PASSWORD`;
2. ajuste `API_URL_SENSOR` e `API_URL_CHECKPOINT` para o IP da máquina do Flask;
3. confirme o pino `BATTERY_ADC_PIN` e o valor de `BATTERY_DIVIDER_RATIO` de
   acordo com o divisor resistivo usado no hardware;
4. grave o firmware e vincule no dashboard o mesmo MAC exibido como `Device ID`
   no monitor serial.

O exemplo está configurado para uma bateria Li-ion/LiPo de 3,2–4,2 V ligada ao
GPIO 4 por um divisor 100k/100k. Nunca conecte a bateria diretamente a um ADC do
ESP32.

### Uso como colete ou cinto

O mesmo firmware usa a direção da gravidade na calibração como referência,
permitindo fixar o sensor em orientações diferentes no colete ou no cinto.
Prenda o dispositivo firmemente e mantenha a pessoa em pé e parada durante a
calibração ao iniciar. Ao mudar a posição de montagem, reinicie o dispositivo
nessa postura para calibrar novamente.

Na ficha do paciente, **Calibrar sensor** permite solicitar uma nova calibração
sem reiniciar. Confirme as instruções no pop-up com a pessoa já em pé e parada.
O dispositivo precisa estar online e com o firmware atualizado para receber o
comando. O pop-up aguarda o início confirmado pela placa, mostra uma contagem
estimada de 3 segundos e só exibe sucesso após receber o resultado do ESP32.
Falhas são informadas; sem confirmação em 30 segundos, a espera expira.
**Reiniciar dispositivo** também abre uma confirmação antes de enviar o comando.

O firmware **2.7** usa a magnitude dos três eixos, sem depender de qual face
está voltada para cima. Há duas formas de confirmar uma queda dentro de 4 s:

- Impacto acima de 13 m/s² ou queda livre sustentada abaixo de 3,5 m/s² por
  pelo menos 100 ms, seguidos de inclinação maior que 60° da referência.
- Queda livre sustentada **antes** do impacto, seguida de estabilização em
  qualquer posição, inclusive sentada ou vertical. Se o evento começar com
  impacto, essa segunda via fica desativada para reduzir alertas de saltos.

As duas vias exigem 1,2 s de confirmação, aceleração próxima de 1 g (tolerância
2 m/s²) e rotação de até 90°/s. Lacunas acima de 250 ms reiniciam a confirmação;
acima de 75 ms interrompem a contagem contínua de queda livre. Durante a análise,
o envio HTTP e a reconexão Wi-Fi são adiados para preservar as leituras.
O alerta confirmado permanece ativo até o atendimento no painel.

A velocidade estimada também participa da decisão: a queda livre usa o tempo
abaixo de 3,5 m/s² e o impacto acumula o impulso acelerométrico. Assim, uma
inclinação lenta ou um toque isolado não basta para confirmar uma queda.

A calibração rejeita leituras inválidas e movimentos, calcula os offsets do
giroscópio e normaliza o módulo da gravidade. A referência de postura **não é**
um offset do acelerômetro: subtraí-la eliminaria a gravidade indevidamente.
Os parâmetros `ACC_OFFSET_X/Y/Z` aceitam bias em m/s² medido por calibração em
seis faces; o padrão é zero, porque uma única postura não permite determinar
os três offsets independentemente. Essas correções são aplicadas antes dos
limiares e do cálculo de postura. Deitado e imóvel passa a ser `PARADO`.

Os testes sintéticos cobrem diferentes montagens, quedas à frente, atrás,
laterais, inversão, posição final vertical, offsets, giros, impulsos de salto,
lacunas e leituras inválidas. Execute `python3 -B -m unittest discover -s tests -v`
(requer `clang++`). Os limiares ainda precisam de validação física com o sensor
fixado: quedas lentas, pouca queda livre e saltos com impulso não amostrado
podem causar perdas ou falsos alertas. O HTTP continua síncrono fora da análise,
podendo ocultar o início de um evento. Não há garantia de detectar toda queda.

### Contrato principal da API

| Método | Endpoint | Consumidor |
|---|---|---|
| `POST` | `/api/sensor` | ESP32 envia movimento, bateria e RSSI |
| `POST` | `/api/checkpoint` | ESP32 envia sinal de atividade opcional |
| `GET` | `/api/patients` | Dashboard lista telemetria real |
| `POST` | `/api/devices` | Dashboard vincula MAC e paciente |
| `GET` | `/api/alerts?status=pending` | Dashboard consulta quedas abertas |
| `PATCH` | `/api/alerts/:id` | Dashboard atende ou descarta uma queda |
| `POST` | `/api/devices/:id/reset` | Agenda reset remoto do ESP32 |
| `POST` | `/api/devices/:id/calibrate` | Agenda calibração remota do sensor |
| `POST` | `/api/calibration` | ESP32 confirma início e resultado da calibração |

### Validação

```bash
npm run lint
npm run build
cd backend && python -m unittest -v test_app.py
```

---

## 👥 Equipe e Contato

- **Antonio Augusto** — Software Engineer (INATEL)
- **Fernando Puebla** — Software Engineer (INATEL)

---

## 📄 Licença

Projeto em desenvolvimento. Todos os direitos reservados.
