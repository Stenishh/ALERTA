/*
 * ========================================
 * SISTEMA DE DETECÇÃO DE RISCO DE QUEDA
 * ========================================
 * * Desenvolvido para ESP32-C3
 * Sensor: MPU6050 / MPU6515 (Acelerômetro + Giroscópio)
 * Comunicação: WiFi + API REST
 * * Funcionalidades:
 * - Calibração automática do sensor
 * - Detecção de queda em 3 etapas
 * - Monitoramento contínuo de movimento
 * - Envio de dados via WiFi para servidor
 * - Alertas em tempo real
 * * Autor: Fernando Stein
 * Data: Janeiro 2026
 * Versão do firmware: 2.3
 */

// ==========================================
// BIBLIOTECAS
// ==========================================
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_arduino_version.h>
#include <esp_system.h>
#include "time.h"

const char* FIRMWARE_VERSION = "2.3";

// ==========================================
// CONFIGURAÇÕES - EDITE AQUI!
// ==========================================

// --- WiFi ---
const char* WIFI_SSID = "FernandoRede";
const char* WIFI_PASSWORD = "urubu123";
// Perfil de diagnostico para a SuperMini; potencia menor pode reduzir o alcance.
const wifi_power_t WIFI_TX_POWER = WIFI_POWER_8_5dBm;

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
const float IMPACT_THRESHOLD = 18.0;            // m/s² - modulo total, incluindo gravidade
const float POSTURE_MAX_ROTATION = 30.0;        // °/s - postura so conta com pouca rotacao
const float POSTURE_GRAVITY_TOLERANCE = 2.0;    // m/s² - rejeitar aceleracao dinamica
// Angulo relativo a postura em pe calibrada: independe do eixo da montagem.
const float LYING_ANGLE_DEGREES = 60.0;
const unsigned long IMPACT_WINDOW = 4000;       // prazo total apos impacto
const unsigned long LYING_CONFIRMATION = 1200; // postura persistente por 1,2s
const unsigned long MAX_POSTURE_SAMPLE_GAP = 250; // nao contar pausas sem leituras

const unsigned long SENSOR_INTERVAL = 25;
const unsigned long TELEMETRY_INTERVAL = 1000;
const unsigned long WIFI_RECONNECT_INTERVAL = 30000;

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================

// Sensor
Adafruit_MPU6050 mpu;
bool sensorConnected = false;
bool calibrationRequested = false;
String calibrationId = "";
String calibrationResult = "";
unsigned long lastCalibrationReport = 0;
unsigned long calibrationCommandTime = 0;
uint8_t activeSensorAddress = 0;
uint8_t activeSensorIdentity = 0;

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
unsigned long lastPostureSample = 0;
bool fallAlertShown = false;

// Contadores
RTC_DATA_ATTR int checkpointCount = 0;
String lastStatus = "";
String deviceId = "";
unsigned long lastSensorRead = 0;
unsigned long lastTelemetrySend = 0;
unsigned long lastWiFiReconnectAttempt = 0;
unsigned long lastSensorInitAttempt = 0;
const unsigned long SENSOR_RETRY_INTERVAL = 10000;

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

// MPU6515: WHO_AM_I=0x74, registradores de movimento compativeis com MPU6500.
// Fonte: driver InvenSense inv_mpu6515 do kernel Android.
bool readSensorRegisters(uint8_t reg, uint8_t* data, uint8_t count) {
  Wire.beginTransmission(activeSensorAddress);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(activeSensorAddress, count) != count) return false;
  for (uint8_t i = 0; i < count; ++i) data[i] = Wire.read();
  return true;
}

bool writeSensorRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(activeSensorAddress);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool configureMPU6515() {
  if (!writeSensorRegister(0x6B, 0x80)) return false; // Reset
  delay(100);
  if (!writeSensorRegister(0x6B, 0x01)) return false; // PLL, acordado
  delay(100);
  // Eixos ativos, 100 Hz, filtro gyro ~20 Hz, +/-500 graus/s, +/-8 g.
  const uint8_t registers[] = {0x6C, 0x19, 0x1A, 0x1B, 0x1C, 0x1D};
  const uint8_t values[] =    {0x00, 0x09, 0x04, 0x08, 0x10, 0x04};
  for (unsigned int i = 0; i < sizeof(registers); ++i) {
    uint8_t actual = 0;
    if (!writeSensorRegister(registers[i], values[i]) ||
        !readSensorRegisters(registers[i], &actual, 1) || actual != values[i]) {
      Serial.printf("[I2C] Falha ao configurar/verificar registro 0x%02X\n", registers[i]);
      return false;
    }
  }
  uint8_t identity = 0;
  if (!readSensorRegisters(0x75, &identity, 1) || identity != 0x74) return false;
  delay(100);
  return true;
}

bool readMotion(sensors_event_t& a, sensors_event_t& g) {
  uint8_t bytes[14];
  if (!readSensorRegisters(0x3B, bytes, sizeof(bytes))) return false;
  auto signedWord = [&](int offset) -> int16_t {
    return (int16_t)((uint16_t(bytes[offset]) << 8) | bytes[offset + 1]);
  };
  a = {};
  g = {};
  // Ambos configurados em +/-8 g (4096 LSB/g) e +/-500 graus/s (65,5 LSB/(grau/s)).
  const float accelScale = SENSORS_GRAVITY_STANDARD / 4096.0f;
  const float gyroScale = DEG_TO_RAD / 65.5f;
  a.acceleration.x = signedWord(0) * accelScale;
  a.acceleration.y = signedWord(2) * accelScale;
  a.acceleration.z = signedWord(4) * accelScale;
  g.gyro.x = signedWord(8) * gyroScale;
  g.gyro.y = signedWord(10) * gyroScale;
  g.gyro.z = signedWord(12) * gyroScale;
  return true;
}

bool initSensor() {
  lastSensorInitAttempt = millis();
  Wire.end();
  if (!Wire.begin(SDA_PIN, SCL_PIN, 100000)) {
    Serial.println("[I2C] Falha ao iniciar o barramento.");
    return false;
  }
  Wire.setTimeOut(50);
  Serial.printf("[I2C] SDA=GPIO %d, SCL=GPIO %d, clock=100 kHz\n", SDA_PIN, SCL_PIN);
  unsigned int found = 0;
  unsigned int errors = 0;
  uint8_t sensorAddress = 0;
  for (uint8_t address = 1; address < 127; ++address) {
    Wire.beginTransmission(address);
    const uint8_t result = Wire.endTransmission();
    if (result == 0) {
      ++found;
      Serial.printf("[I2C] Dispositivo respondeu em 0x%02X\n", address);
      if (address == 0x68 || address == 0x69) {
        Wire.beginTransmission(address);
        Wire.write(0x75);  // WHO_AM_I do MPU6050
        if (Wire.endTransmission(false) == 0 && Wire.requestFrom(address, (uint8_t)1) == 1) {
          const int identity = Wire.read();
          Serial.printf("[I2C] 0x%02X WHO_AM_I=0x%02X (suportados: MPU6050=0x68, MPU6515=0x74)\n", address, identity);
          if ((identity == 0x68 || identity == 0x74) && sensorAddress == 0) {
            sensorAddress = address;
            activeSensorIdentity = identity;
          }
        } else {
          Serial.println("[I2C] Falha ao ler a identificacao do sensor.");
        }
      }
    } else if (result != 2) {
      ++errors;  // NACK de endereco (2) e normal para enderecos vazios.
    }
  }
  Serial.printf("[I2C] Resumo: %u dispositivo(s), %u erro(s) de barramento\n", found, errors);
  if (!sensorAddress) {
    Serial.println("[I2C] Nenhum MPU6050/MPU6515 identificado. Conferir alimentacao, GND, SDA/SCL e modelo do sensor.");
    return false;
  }
  activeSensorAddress = sensorAddress;
  for (int attempt = 0; attempt < 5; ++attempt) {
    uint8_t identity = 0;
    if (!readSensorRegisters(0x75, &identity, 1) || identity != activeSensorIdentity) {
      Serial.println("[I2C] Identificacao instavel; inicializacao interrompida.");
      return false;
    }
    Serial.printf("[I2C] Confirmacao ID %d/5: 0x%02X\n", attempt + 1, identity);
    delay(20);
  }
  if (activeSensorIdentity == 0x74) {
    Serial.println("[I2C] ID 0x74 confirmado; usando perfil compativel com MPU6515.");
    if (!configureMPU6515()) return false;
  } else {
    if (!mpu.begin(sensorAddress, &Wire)) return false;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }
  Serial.println("[I2C] Sensor inicializado; verificando leituras na calibracao.");
  return true;
}

bool calibrateSensor() {
  Serial.println("\n🔧 Calibrando sensor...");
  Serial.println("⚠️  Fixe o sensor no colete ou cinto. Fique EM PE e PARADO durante a calibracao!");
  
  delay(1000);
  
  float sumAccX = 0, sumAccY = 0, sumAccZ = 0;
  float sumGyroX = 0, sumGyroY = 0, sumGyroZ = 0;
  const int samples = 100; // 1 s de preparo + 100 leituras de 20 ms = cerca de 3 s.
  
  for (int i = 0; i < samples; i++) {
    sensors_event_t a, g;
    if (!readMotion(a, g)) {
      Serial.println("[I2C] Leitura incompleta na calibracao; sensor nao liberado.");
      return false;
    }
    
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
  return true;
}

float getTotalAcceleration(float x, float y, float z) {
  return sqrt(x*x + y*y + z*z);
}

bool isLyingPosition(float accX, float accY, float accZ) {
  const float referenceMagnitude = getTotalAcceleration(refAccX, refAccY, refAccZ);
  const float currentMagnitude = getTotalAcceleration(accX, accY, accZ);
  // Sem vetor de gravidade utilizavel, nao inferir postura (ex.: queda livre).
  if (referenceMagnitude < 1.0f || currentMagnitude < 1.0f) return false;
  const float cosine = constrain(
      (accX * refAccX + accY * refAccY + accZ * refAccZ) /
          (referenceMagnitude * currentMagnitude),
      -1.0f, 1.0f);
  return cosine < cos(LYING_ANGLE_DEGREES * DEG_TO_RAD);
}

// ==========================================
// FUNÇÕES - WIFI
// ==========================================

void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
    const uint8_t reason = info.wifi_sta_disconnected.reason;
    Serial.printf("\n[WiFi %lu ms] Desconectado: %u (%s)\n", millis(),
                  reason, WiFi.STA.disconnectReasonName((wifi_err_reason_t)reason));
  } else if (event == ARDUINO_EVENT_WIFI_STA_CONNECTED) {
    Serial.println("\n[WiFi] Associado ao ponto de acesso; aguardando IP (DHCP).");
  } else if (event == ARDUINO_EVENT_WIFI_STA_GOT_IP) {
    Serial.printf("\n[WiFi] IP recebido: %s | sinal: %d dBm | canal: %d\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI(), WiFi.channel());
  }
}

void scanWiFiDiagnostic() {
  Serial.println("[WiFi] Procurando redes de 2,4 GHz antes de conectar...");
  const int count = WiFi.scanNetworks(false, true);
  if (count < 0) {
    Serial.printf("[WiFi] Falha na varredura: %d\n", count);
  } else {
    Serial.printf("[WiFi] Redes encontradas: %d\n", count);
    bool found = false;
    for (int i = 0; i < count; ++i) {
      if (WiFi.SSID(i) != WIFI_SSID) continue;
      found = true;
      Serial.printf("[WiFi] Rede alvo: %s | sinal: %d dBm | canal: %d | seguranca: %d\n",
                    WIFI_SSID, WiFi.RSSI(i), WiFi.channel(i),
                    (int)WiFi.encryptionType(i));
    }
    if (!found) Serial.println("[WiFi] Rede alvo NAO encontrada nesta varredura.");
  }
  WiFi.scanDelete();
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
  if (!WiFi.setSleep(false)) Serial.println("[WiFi] Falha ao desativar economia de energia.");
  // O loop controla as tentativas para nao disputar com a reconexao automatica.
  WiFi.setAutoReconnect(false);
  delay(300);
  if (!WiFi.setTxPower(WIFI_TX_POWER)) Serial.println("[WiFi] Falha ao ajustar potencia TX.");
  Serial.printf("[WiFi] Potencia TX configurada: %.2f dBm\n", (int)WiFi.getTxPower() / 4.0);
  scanWiFiDiagnostic();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWiFiReconnectAttempt = millis();

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
    Serial.println("   Continuando sem conexao. Nova tentativa controlada pelo loop.");
  }
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWiFiReconnectAttempt < WIFI_RECONNECT_INTERVAL) return;

  lastWiFiReconnectAttempt = now;
  Serial.println("\n📡 WiFi desconectado. Nova tentativa em segundo plano...");
  // WL_CONNECTED so chega depois do IP. Pode haver uma conexao em andamento
  // mesmo sem esse status: encerre-a antes de solicitar outra ao driver.
  if (!WiFi.disconnect(false, false)) {
    Serial.println("   Nao foi possivel encerrar a tentativa anterior.");
    return;
  }
  delay(100);  // Permite processar o evento de desconexao antes da nova tentativa.
  if (!WiFi.reconnect()) {
    Serial.println("   Driver nao iniciou a tentativa. Aguardando novo intervalo.");
  }
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
    if (response.indexOf("\"calibrate\": true") >= 0 || response.indexOf("\"calibrate\":true") >= 0) {
      int key = response.indexOf("\"calibrationId\"");
      int colon = key >= 0 ? response.indexOf(':', key) : -1;
      int start = colon >= 0 ? response.indexOf('"', colon + 1) : -1;
      int end = start >= 0 ? response.indexOf('"', start + 1) : -1;
      if (start >= 0 && end > start && end - start == 37) {
        calibrationId = response.substring(start + 1, end);
        calibrationRequested = true;
        calibrationCommandTime = millis();
        calibrationResult = "";
      }
    }
  }
  // >>> FIM DA LÓGICA DE RESET <<<
  
  http.end();
  
  return (httpCode == 200);
}

bool reportCalibration(String status) {
  String url = String(API_URL_SENSOR);
  url = url.substring(0, url.lastIndexOf('/')) + "/calibration";
  String json = "{\"deviceId\":\"" + deviceId + "\",\"calibrationId\":\"" +
                calibrationId + "\",\"status\":\"" + status + "\"}";
  return sendToAPI(url.c_str(), json, false);
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
// FUNÇÕES - DETECÇÃO DE QUEDA (COLETE OU CINTO)
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
      // Rotacao isolada e mudanca do vetor de gravidade nao sao impactos.
      if (totalAcc > IMPACT_THRESHOLD) {
        fallState = SUDDEN_MOVEMENT_DETECTED;
        suddenMovementTime = currentTime;
        lastPostureSample = currentTime;
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
      
    case SUDDEN_MOVEMENT_DETECTED: {
      // Expirar mesmo se continuar inclinado ou girando.
      if (currentTime - suddenMovementTime >= IMPACT_WINDOW) {
        fallState = NORMAL;
        fallConfirmedTime = 0;
        fallAlertShown = false;
        return (accMagnitude > 2.0 || gyroDegPerSec > 20)
                   ? "EM MOVIMENTO" : "PARADO";
      }

      if (currentTime - lastPostureSample > MAX_POSTURE_SAMPLE_GAP) {
        fallConfirmedTime = 0;
      }
      lastPostureSample = currentTime;

      // Acelerometro estima postura apenas quando predomina a gravidade.
      const bool stablePosture =
          abs(totalAcc - SENSORS_GRAVITY_STANDARD) <= POSTURE_GRAVITY_TOLERANCE &&
          gyroDegPerSec <= POSTURE_MAX_ROTATION &&
          isLyingPosition(a.acceleration.x, a.acceleration.y, a.acceleration.z);
      if (!stablePosture) {
        fallConfirmedTime = 0;
        break;
      }
      if (fallConfirmedTime == 0) fallConfirmedTime = currentTime;
      if (currentTime - fallConfirmedTime >= LYING_CONFIRMATION) {
        fallState = FALL_CONFIRMED;
        fallAlertShown = true;
        Serial.println("QUEDA CONFIRMADA: impacto seguido de inclinacao persistente.");
        return "QUEDA CONFIRMADA";
      }
      break;
    }

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
  Serial.printf("   Compilado: %s %s | Arduino ESP32: %s\n", __DATE__, __TIME__, ESP_ARDUINO_VERSION_STR);
  Serial.printf("   Chip: %s | revisao: %d | motivo reset: %d\n",
                ESP.getChipModel(), ESP.getChipRevision(), (int)esp_reset_reason());
  
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
  Serial.println("\n[3/3] Inicializando sensor MPU6050/MPU6515...");
  if (initSensor()) {
    sensorConnected = calibrateSensor();
  } else {
    Serial.println("❌ ERRO CRÍTICO: Sensor não encontrado!");
    Serial.println("Verifique as conexões:");
    Serial.println("  • SDA -> GPIO 8");
    Serial.println("  • SCL -> GPIO 9");
    Serial.println("  • VCC -> 3.3V");
    Serial.println("  • GND -> GND");
  }
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println(sensorConnected ? "║  SENSOR PRONTO - MONITORANDO...       ║"
                                 : "║  SEM SENSOR - DETECCAO INDISPONIVEL   ║");
  Serial.println("╚════════════════════════════════════════╝\n");
}

// ==========================================
// LOOP (EXECUÇÃO CONTÍNUA)
// ==========================================

void loop() {
  maintainWiFi();

  if (millis() - calibrationCommandTime > 30000) {
    calibrationRequested = false;
    calibrationResult = "";
  }

  if (calibrationRequested && millis() - lastCalibrationReport >= 1000) {
    lastCalibrationReport = millis();
    if (reportCalibration("running")) {
      calibrationRequested = false;
      sensorConnected = calibrateSensor();
      calibrationResult = sensorConnected ? "completed" : "failed";
      // Preservar queda já confirmada até o atendimento pelo painel.
      if (sensorConnected && fallState != FALL_CONFIRMED) {
        fallState = NORMAL;
        suddenMovementTime = 0;
        fallConfirmedTime = 0;
        fallAlertShown = false;
      }
      lastStatus = "";
      lastSensorInitAttempt = millis();
    }
  }

  // Reportar inclusive falhas de sensor; tentar novamente se o Wi-Fi oscilar.
  if (calibrationResult.length() && millis() - lastCalibrationReport >= 1000) {
    lastCalibrationReport = millis();
    if (reportCalibration(calibrationResult)) calibrationResult = "";
  }

  if (!sensorConnected) {
    if (millis() - lastSensorInitAttempt >= SENSOR_RETRY_INTERVAL) {
      Serial.println("[I2C] Tentando detectar o sensor novamente...");
      if (initSensor()) {
        sensorConnected = calibrateSensor();
        lastStatus = "";
      }
    }
    delay(1);
    return;
  }

  unsigned long now = millis();
  if (now - lastSensorRead < SENSOR_INTERVAL) {
    delay(1);
    return;
  }
  lastSensorRead = now;
  
  // Ler dados do sensor
  sensors_event_t a, g;
  if (!readMotion(a, g)) {
    Serial.println("[I2C] Leitura incompleta. Deteccao suspensa ate recuperar o sensor.");
    sensorConnected = false;
    lastSensorInitAttempt = millis();
    return;
  }
  
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
