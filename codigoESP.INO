/*
 * ========================================
 * SISTEMA DE DETECÇÃO DE RISCO DE QUEDA
 * ========================================
 * * Desenvolvido para ESP32-C3
 * Sensor: MPU6050 (Acelerômetro + Giroscópio)
 * Comunicação: WiFi + API REST
 * * Funcionalidades:
 * - Calibração automática do sensor
 * - Detecção de queda em 3 etapas
 * - Monitoramento contínuo de movimento
 * - Envio de dados via WiFi para servidor
 * - Alertas em tempo real
 * * Autor: Fernando Stein
 * Data: Janeiro 2026
 * Versão do firmware: 2.0
 */

// ==========================================
// BIBLIOTECAS
// ==========================================
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "time.h"

const char* FIRMWARE_VERSION = "2.0";

// ==========================================
// CONFIGURAÇÕES - EDITE AQUI!
// ==========================================

// --- WiFi ---
const char* WIFI_SSID = "FernandoRede";
const char* WIFI_PASSWORD = "urubu123";

// --- API (coloque o IP do seu PC) ---
const char* API_URL_CHECKPOINT =
      "http://172.20.10.2:8080/api/checkpoint";

  const char* API_URL_SENSOR =
      "http://172.20.10.2:8080/api/sensor";
// --- Horário (NTP) ---
const char* NTP_SERVER = "a.st1.ntp.br";
const long  GMT_OFFSET_SEC = -10800;            // Brasília UTC-3
const int   DAYLIGHT_OFFSET_SEC = 0;

// --- Pinos I2C ---
#define SDA_PIN 8
#define SCL_PIN 9

// --- Leitura da bateria (divisor resistivo 100k/100k) ---
// Não conecte a bateria diretamente ao GPIO. Use o divisor de tensão.
#define BATTERY_ADC_PIN 4
const float BATTERY_DIVIDER_RATIO = 2.0;
const float BATTERY_MIN_VOLTAGE = 3.20;
const float BATTERY_MAX_VOLTAGE = 4.20;

// --- Limiares de Detecção de Queda ---
const float IMPACT_THRESHOLD = 12.0;            // m/s² - Impacto forte
const float ROTATION_THRESHOLD = 150.0;         // °/s - Rotação brusca
const float LYING_POSITION_THRESHOLD = 7.0;     // m/s² - Posição deitada
const unsigned long IMPACT_WINDOW = 500;        // no máximo 0,5s analisando
const unsigned long LYING_CONFIRMATION = 300;   // confirma a queda em 0,3s

const unsigned long SENSOR_INTERVAL = 25;
const unsigned long TELEMETRY_INTERVAL = 1000;
const unsigned long WIFI_RECONNECT_INTERVAL = 10000;

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================

// Sensor
Adafruit_MPU6050 mpu;
bool sensorConnected = false;

// Calibração
float refAccX = 0, refAccY = 0, refAccZ = 0;
float refGyroX = 0, refGyroY = 0, refGyroZ = 0;

// Estados de detecção de queda
enum FallState {
  NORMAL,
  SUDDEN_MOVEMENT_DETECTED,
  FALL_CONFIRMED
};

FallState fallState = NORMAL;
unsigned long suddenMovementTime = 0;
unsigned long fallConfirmedTime = 0;
bool fallAlertShown = false;

// Contadores
RTC_DATA_ATTR int checkpointCount = 0;
String lastStatus = "";
String deviceId = "";
unsigned long lastSensorRead = 0;
unsigned long lastTelemetrySend = 0;
unsigned long lastWiFiReconnectAttempt = 0;

// ==========================================
// FUNÇÕES - BATERIA
// ==========================================

float readBatteryVoltage() {
  const int samples = 12;
  uint32_t millivolts = 0;

  for (int i = 0; i < samples; i++) {
    millivolts += analogReadMilliVolts(BATTERY_ADC_PIN);
    delay(2);
  }

  float pinVoltage = (millivolts / (float)samples) / 1000.0;
  return pinVoltage * BATTERY_DIVIDER_RATIO;
}

int readBatteryPercentage(float voltage) {
  float percentage = (voltage - BATTERY_MIN_VOLTAGE) * 100.0 /
                     (BATTERY_MAX_VOLTAGE - BATTERY_MIN_VOLTAGE);
  return constrain((int)round(percentage), 0, 100);
}

// ==========================================
// FUNÇÕES - SENSOR MPU6050
// ==========================================

bool initSensor() {
  Wire.begin(SDA_PIN, SCL_PIN);
  
  if (!mpu.begin()) {
    Serial.println("❌ ERRO: MPU6050 não encontrado!");
    return false;
  }
  
  // Configurar ranges
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  
  Serial.println("✅ MPU6050 inicializado!");
  return true;
}

void calibrateSensor() {
  Serial.println("\n🔧 Calibrando sensor...");
  Serial.println("⚠️  Mantenha o sensor PARADO durante 3 segundos!");
  
  delay(1000);
  
  float sumAccX = 0, sumAccY = 0, sumAccZ = 0;
  float sumGyroX = 0, sumGyroY = 0, sumGyroZ = 0;
  const int samples = 50;
  
  for (int i = 0; i < samples; i++) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    
    sumAccX += a.acceleration.x;
    sumAccY += a.acceleration.y;
    sumAccZ += a.acceleration.z;
    sumGyroX += g.gyro.x;
    sumGyroY += g.gyro.y;
    sumGyroZ += g.gyro.z;
    
    delay(20);
    if (i % 10 == 0) Serial.print(".");
  }
  
  refAccX = sumAccX / samples;
  refAccY = sumAccY / samples;
  refAccZ = sumAccZ / samples;
  refGyroX = sumGyroX / samples;
  refGyroY = sumGyroY / samples;
  refGyroZ = sumGyroZ / samples;
  
  Serial.println("\n✅ Calibração concluída!");
  Serial.printf("   Referências: AccX=%.2f AccY=%.2f AccZ=%.2f\n", refAccX, refAccY, refAccZ);
}

float getTotalAcceleration(float x, float y, float z) {
  return sqrt(x*x + y*y + z*z);
}

bool isLyingPosition(float accZ) {
  return abs(accZ) < LYING_POSITION_THRESHOLD;
}

// ==========================================
// FUNÇÕES - WIFI
// ==========================================

void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
    Serial.printf("\n   Motivo do driver WiFi: %d\n",
                  info.wifi_sta_disconnected.reason);
  }
}

const char* wifiStatusText(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS: return "iniciando conexao";
    case WL_NO_SSID_AVAIL: return "SSID nao encontrado";
    case WL_SCAN_COMPLETED: return "varredura concluida";
    case WL_CONNECTED: return "conectado";
    case WL_CONNECT_FAILED: return "falha de autenticacao/senha";
    case WL_CONNECTION_LOST: return "conexao perdida";
    case WL_DISCONNECTED: return "desconectado";
    default: return "estado desconhecido";
  }
}

void connectWiFi() {
  Serial.printf("\n📡 Conexão direta com '%s'...\n", WIFI_SSID);

  WiFi.onEvent(onWiFiEvent);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(true);
  WiFi.setAutoReconnect(true);
  delay(300);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi conectado!");
    Serial.print("   IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Falha ao conectar WiFi");
    wl_status_t status = WiFi.status();
    Serial.printf("   Codigo: %d (%s)\n", status, wifiStatusText(status));
    Serial.println("   Continuando sem conexão...");
  }
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWiFiReconnectAttempt < WIFI_RECONNECT_INTERVAL) return;

  lastWiFiReconnectAttempt = now;
  Serial.println("\n📡 WiFi desconectado. Nova tentativa em segundo plano...");
  WiFi.reconnect();
}

// ==========================================
// FUNÇÕES - HORÁRIO (NTP)
// ==========================================

void syncTime() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  Serial.print("⏰ Sincronizando horário");
  
  int attempts = 0;
  while (attempts < 10) {
    time_t now = time(nullptr);
    if (now > 8 * 3600 * 2) {
      Serial.println(" OK!");
      return;
    }
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println(" Timeout");
}

String getFormattedTime() {
  time_t now = time(nullptr);
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "N/A";
  }
  
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%d/%m/%Y %H:%M:%S", &timeinfo);
  return String(buffer);
}

// ==========================================
// FUNÇÕES - API (COM LEITURA DE RESET)
// ==========================================

// Adicionado parâmetro checkForReset
bool sendToAPI(const char* url, String jsonPayload, bool checkForReset) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  HTTPClient http;
  http.begin(url);
  
  http.setConnectTimeout(400);
  http.setTimeout(600);
  
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonPayload);

  Serial.print("HTTP POST: ");
  Serial.println(httpCode);

  String response = "";
  if (httpCode > 0) {
    response = http.getString();
    Serial.println(response);
  } else {
    Serial.println(http.errorToString(httpCode));
  }
  
  // >>> LÓGICA DO BOTÃO DE RESET ADICIONADA AQUI <<<
  if (checkForReset && httpCode == 200) {
    if (response.indexOf("\"acknowledgeFall\": true") >= 0 ||
        response.indexOf("\"acknowledgeFall\":true") >= 0) {
      Serial.println("\n✅ ALERTA CONFIRMADO NO PAINEL!");
      Serial.println("Retornando a deteccao ao estado normal...");
      fallState = NORMAL;
      suddenMovementTime = 0;
      fallConfirmedTime = 0;
      fallAlertShown = false;
      lastStatus = "";
    }

    if (response.indexOf("\"reset\": true") >= 0 || response.indexOf("\"reset\":true") >= 0) {
      Serial.println("\n🔄 COMANDO DE RESET REMOTO RECEBIDO!");
      Serial.println("Reiniciando a placa...");
      delay(1000); 
      ESP.restart(); 
    }
  }
  // >>> FIM DA LÓGICA DE RESET <<<
  
  http.end();
  
  return (httpCode == 200);
}

void sendCheckpoint(int checkpoint, String timestamp) {
  String json = "{";
  json += "\"deviceId\":\"" + deviceId + "\",";
  json += "\"checkpoint\":" + String(checkpoint) + ",";
  json += "\"timestamp\":\"" + timestamp + "\"";
  json += "}";
  
  sendToAPI(API_URL_CHECKPOINT, json, false); // False = não checa reset no checkpoint
}

void sendSensorData(float accX, float accY, float accZ, 
                    float gyroX, float gyroY, float gyroZ,
                    float accMag, float gyroMag, String status, int checkpoint) {
  float batteryVoltage = readBatteryVoltage();
  int batteryPercentage = readBatteryPercentage(batteryVoltage);

  String json = "{";
  json += "\"deviceId\":\"" + deviceId + "\",";
  json += "\"accelX\":" + String(accX, 2) + ",";
  json += "\"accelY\":" + String(accY, 2) + ",";
  json += "\"accelZ\":" + String(accZ, 2) + ",";
  json += "\"gyroX\":" + String(gyroX, 2) + ",";
  json += "\"gyroY\":" + String(gyroY, 2) + ",";
  json += "\"gyroZ\":" + String(gyroZ, 2) + ",";
  json += "\"accMagnitude\":" + String(accMag, 2) + ",";
  json += "\"gyroMagnitude\":" + String(gyroMag, 2) + ",";
  json += "\"battery\":" + String(batteryPercentage) + ",";
  json += "\"batteryVoltage\":" + String(batteryVoltage, 2) + ",";
  json += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"status\":\"" + status + "\",";
  json += "\"checkpoint\":" + String(checkpoint);
  json += "}";
  
  sendToAPI(API_URL_SENSOR, json, true); // True = checa reset nos dados do sensor
}

// ==========================================
// FUNÇÕES - DETECÇÃO DE QUEDA (SUA LÓGICA ORIGINAL)
// ==========================================

String analyzeFallDetection(sensors_event_t &a, sensors_event_t &g, 
                            float &accMagnitude, float &gyroMagnitude) {
  // Calcular aceleração total
  float totalAcc = getTotalAcceleration(a.acceleration.x, a.acceleration.y, a.acceleration.z);
  
  // Calcular diferenças em relação às referências
  float diffAccX = abs(a.acceleration.x - refAccX);
  float diffAccY = abs(a.acceleration.y - refAccY);
  float diffAccZ = abs(a.acceleration.z - refAccZ);
  float diffGyroX = abs(g.gyro.x - refGyroX);
  float diffGyroY = abs(g.gyro.y - refGyroY);
  float diffGyroZ = abs(g.gyro.z - refGyroZ);
  
  // Magnitudes de mudança
  accMagnitude = sqrt(diffAccX*diffAccX + diffAccY*diffAccY + diffAccZ*diffAccZ);
  gyroMagnitude = sqrt(diffGyroX*diffGyroX + diffGyroY*diffGyroY + diffGyroZ*diffGyroZ);
  
  // Converter giroscópio para graus/segundo
  float gyroDegPerSec = gyroMagnitude * 57.2958; // rad/s para deg/s
  
  unsigned long currentTime = millis();
  
  // Máquina de estados de detecção de queda
  switch (fallState) {
    case NORMAL:
      // Detectar movimento súbito (rotação brusca OU impacto forte)
      if (gyroDegPerSec > ROTATION_THRESHOLD || accMagnitude > IMPACT_THRESHOLD) {
        fallState = SUDDEN_MOVEMENT_DETECTED;
        suddenMovementTime = currentTime;
        fallConfirmedTime = 0;
        fallAlertShown = false;
        Serial.println("\n⚠️  MOVIMENTO SÚBITO DETECTADO!");
        return "ANALISANDO MOVIMENTO";
      }
      
      // Status normal
      if (accMagnitude > 2.0 || gyroDegPerSec > 20) {
        return "EM MOVIMENTO";
      } else {
        return "PARADO";
      }
      
    case SUDDEN_MOVEMENT_DETECTED:
      // Verificar se está em posição deitada
      if (isLyingPosition(a.acceleration.z)) {
        if (fallConfirmedTime == 0) {
          fallConfirmedTime = currentTime;
        }
        
        // Confirma rapidamente quando a posição deitada permanece estável.
        if (currentTime - fallConfirmedTime >= LYING_CONFIRMATION) {
          fallState = FALL_CONFIRMED;
          if (!fallAlertShown) {
            Serial.println("\n╔════════════════════════════════╗");
            Serial.println("║  * QUEDA CONFIRMADA * ║");
            Serial.println("║  PESSOA CAIDA - ATENÇÃO!       ║");
            Serial.println("╚════════════════════════════════╝");
            Serial.printf("Tempo deitado: %lu ms\n\n", currentTime - fallConfirmedTime);
            fallAlertShown = true;
          }
          return "QUEDA CONFIRMADA";
        }
      } else {
        fallConfirmedTime = 0;

        if (currentTime - suddenMovementTime >= IMPACT_WINDOW) {
          fallState = NORMAL;
          fallAlertShown = false;
          Serial.println("Movimento brusco sem queda - retornando ao normal");
          return (accMagnitude > 2.0 || gyroDegPerSec > 20)
                     ? "EM MOVIMENTO"
                     : "PARADO";
        }
      }
      break;
      
    case FALL_CONFIRMED:
      // Mantém a queda latente até o painel devolver acknowledgeFall=true.
      // Assim uma oscilação momentânea do WiFi não perde o pop-up.
      return "QUEDA CONFIRMADA";
  }
  
  return "ANALISANDO";
}

// ==========================================
// SETUP (INICIALIZAÇÃO)
// ==========================================

void setup() {
  Serial.begin(115200);
  delay(2000);

  analogReadResolution(12);
  analogSetPinAttenuation(BATTERY_ADC_PIN, ADC_11db);
  
  Serial.println("\n\n╔════════════════════════════════════════╗");
  Serial.println("║  SISTEMA DE DETECÇÃO DE RISCO DE QUEDA ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.printf("   Firmware: v%s\n", FIRMWARE_VERSION);
  
  // 1. Conectar WiFi
  Serial.println("\n[1/3] Conectando ao WiFi...");
  connectWiFi();
  deviceId = WiFi.macAddress();
  Serial.print("   Device ID: ");
  Serial.println(deviceId);
  
  if (WiFi.status() == WL_CONNECTED) {
    // 2. Sincronizar horário
    Serial.println("\n[2/3] Sincronizando horário...");
    syncTime();
    Serial.print("   Horário: ");
    Serial.println(getFormattedTime());
  }
  
  // 3. Inicializar sensor
  Serial.println("\n[3/3] Inicializando sensor MPU6050...");
  if (initSensor()) {
    sensorConnected = true;
    calibrateSensor();
  } else {
    Serial.println("❌ ERRO CRÍTICO: Sensor não encontrado!");
    Serial.println("Verifique as conexões:");
    Serial.println("  • SDA -> GPIO 8");
    Serial.println("  • SCL -> GPIO 9");
    Serial.println("  • VCC -> 3.3V");
    Serial.println("  • GND -> GND");
  }
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║  SISTEMA INICIADO - MONITORANDO...     ║");
  Serial.println("╚════════════════════════════════════════╝\n");
}

// ==========================================
// LOOP (EXECUÇÃO CONTÍNUA)
// ==========================================

void loop() {
  maintainWiFi();

  if (!sensorConnected) {
    Serial.println("⚠️  Sensor desconectado. Aguardando...");
    delay(5000);
    return;
  }

  unsigned long now = millis();
  if (now - lastSensorRead < SENSOR_INTERVAL) {
    delay(1);
    return;
  }
  lastSensorRead = now;
  
  // Ler dados do sensor
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  
  // Analisar detecção de queda
  float accMagnitude, gyroMagnitude;
  String status = analyzeFallDetection(a, g, accMagnitude, gyroMagnitude);

  bool statusChanged = status != lastStatus;
  bool telemetryDue = now - lastTelemetrySend >= TELEMETRY_INTERVAL;
  bool shouldPublish = statusChanged || telemetryDue;

  if (statusChanged) {
    Serial.println("\n>>> MUDANÇA DE STATUS DETECTADA <<<");
    Serial.printf("Anterior: %s\n", lastStatus.length() > 0 ? lastStatus.c_str() : "N/A");
    Serial.printf("Atual: %s\n", status.c_str());
    Serial.println(">>> ============================== <<<\n");
    lastStatus = status;
  }

  if (shouldPublish) {
    Serial.println("\n===== Leituras do Sensor =====");
    Serial.printf("AccX: %.2f | AccY: %.2f | AccZ: %.2f m/s²\n",
                  a.acceleration.x, a.acceleration.y, a.acceleration.z);
    Serial.printf("GyroX: %.2f | GyroY: %.2f | GyroZ: %.2f °/s\n",
                  g.gyro.x * 57.2958, g.gyro.y * 57.2958, g.gyro.z * 57.2958);
    Serial.printf("Magnitude Acc: %.2f m/s² | Magnitude Gyro: %.2f °/s\n",
                  accMagnitude, gyroMagnitude * 57.2958);

    float batteryVoltage = readBatteryVoltage();
    Serial.printf("Bateria: %d%% (%.2f V) | WiFi: %d dBm\n",
                  readBatteryPercentage(batteryVoltage),
                  batteryVoltage,
                  WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
    Serial.printf("\nCheckpoint #%d | Status: %s\n", checkpointCount, status.c_str());

    if (WiFi.status() == WL_CONNECTED) {
      sendSensorData(a.acceleration.x, a.acceleration.y, a.acceleration.z,
                     g.gyro.x * 57.2958, g.gyro.y * 57.2958, g.gyro.z * 57.2958,
                     accMagnitude, gyroMagnitude * 57.2958, status, checkpointCount);
    }

    Serial.println("==============================\n");
    checkpointCount++;
    lastTelemetrySend = millis();
  }
}
