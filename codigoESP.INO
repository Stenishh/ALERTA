
// ==========================================
// BIBLIOTECAS
// ==========================================
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "time.h"

// ==========================================
// CONFIGURAÇÕES - EDITE AQUI!
// ==========================================

// --- WiFi ---
const char* WIFI_SSID = "Edson_2.4GHz";
const char* WIFI_PASSWORD = "ramos6738";

// --- API (coloque o IP do seu PC) ---
const char* API_URL_CHECKPOINT = "http://192.168.0.139:8080/api/checkpoint";
const char* API_URL_SENSOR = "http://192.168.0.139:8080/api/sensor";
// --- Horário (NTP) ---
const char* NTP_SERVER = "a.st1.ntp.br";
const long  GMT_OFFSET_SEC = -10800;            // Brasília UTC-3
const int   DAYLIGHT_OFFSET_SEC = 0;

// --- Pinos I2C ---
#define SDA_PIN 8
#define SCL_PIN 9

// --- Leitura da bateria (ESP32-C3 + divisor resistivo 100k/100k) ---
// Ligue o positivo da bateria ao GPIO abaixo através do divisor de tensão.
#define BATTERY_ADC_PIN 4
const float BATTERY_DIVIDER_RATIO = 2.0;
const float BATTERY_MIN_VOLTAGE = 3.20;
const float BATTERY_MAX_VOLTAGE = 4.20;

// --- Limiares de Detecção de Queda ---
const float IMPACT_THRESHOLD = 12.0;            // m/s² - Impacto forte
const float ROTATION_THRESHOLD = 150.0;         // °/s - Rotação brusca
const float LYING_POSITION_THRESHOLD = 7.0;     // m/s² - Posição deitada
const unsigned long IMPACT_WINDOW = 1000;       // 1s para detectar impacto
const unsigned long LYING_CONFIRMATION = 2000;  // 2s deitado = queda confirmada

// --- Intervalo de atualização ---
// >>> SOLUÇÃO AQUI: Alterado para 1000ms para evitar estouro de sockets HTTP
const int UPDATE_INTERVAL = 1000;                // 1 segundo de atualização

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
String chipId = "";
unsigned long lastWiFiReconnectAttempt = 0;

// ==========================================
// FUNÇÕES - IDENTIFICAÇÃO E BATERIA
// ==========================================

String getChipId() {
  uint64_t efuseMac = ESP.getEfuseMac();
  String high = String((uint16_t)(efuseMac >> 32), HEX);
  String low = String((uint32_t)efuseMac, HEX);
  while (high.length() < 4) high = "0" + high;
  while (low.length() < 8) low = "0" + low;
  String id = high + low;
  id.toUpperCase();
  return id;
}

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

void connectWiFi() {
  Serial.print("\n📡 Conectando ao WiFi");
  
  // Limpa conexões antigas para conectar bem no Hotspot
  WiFi.mode(WIFI_STA);       
  WiFi.disconnect();         
  delay(100);                
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
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
    Serial.println("   Continuando sem conexão...");
  }
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWiFiReconnectAttempt >= 10000) {
    lastWiFiReconnectAttempt = now;
    Serial.println("📡 WiFi desconectado. Tentando reconectar...");
    WiFi.reconnect();
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
  
  http.setConnectTimeout(1500);
  http.setTimeout(1500);
  
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonPayload);
  
  // >>> LÓGICA DO BOTÃO DE RESET ADICIONADA AQUI <<<
  if (checkForReset && httpCode >= 200 && httpCode < 300) {
    String response = http.getString();
    if (response.indexOf("\"reset\": true") >= 0 || response.indexOf("\"reset\":true") >= 0) {
      Serial.println("\n🔄 COMANDO DE RESET REMOTO RECEBIDO!");
      Serial.println("Reiniciando a placa...");
      delay(1000); 
      ESP.restart(); 
    }
  }
  // >>> FIM DA LÓGICA DE RESET <<<
  
  http.end();
  
  return (httpCode >= 200 && httpCode < 300);
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
  json += "\"chipId\":\"" + chipId + "\",";
  json += "\"timestamp\":\"" + getFormattedTime() + "\",";
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
        
        // Se ficou deitado por 2 segundos = QUEDA CONFIRMADA
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
        // Se levantou antes de 2s, não foi queda
        fallAlertShown = false;
        Serial.println("Movimento brusco sem queda - retornando ao normal");
      }
      
      // Timeout - voltou ao normal
      if (currentTime - suddenMovementTime > IMPACT_WINDOW && fallConfirmedTime == 0) {
        fallState = NORMAL;
        fallAlertShown = false;
        Serial.println("Movimento brusco sem queda - retornando ao normal");
      }
      break;
      
    case FALL_CONFIRMED:
      // Após queda, continua monitorando movimento
      if (gyroDegPerSec > 50 || accMagnitude > 2.0) {
        return "MOVIMENTO APOS QUEDA";
      } else {
        return "PARADO APOS QUEDA";
      }
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
  chipId = getChipId();
  
  Serial.println("\n\n╔════════════════════════════════════════╗");
  Serial.println("║  SISTEMA DE DETECÇÃO DE RISCO DE QUEDA ║");
  Serial.println("╚════════════════════════════════════════╝");
  
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
  
  // Ler dados do sensor
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  
  // Analisar detecção de queda
  float accMagnitude, gyroMagnitude;
  String status = analyzeFallDetection(a, g, accMagnitude, gyroMagnitude);
  
  // Exibir dados no Serial
  Serial.println("\n===== Leituras do Sensor =====");
  Serial.printf("AccX: %.2f | AccY: %.2f | AccZ: %.2f m/s²\n", 
                a.acceleration.x, a.acceleration.y, a.acceleration.z);
  Serial.printf("GyroX: %.2f | GyroY: %.2f | GyroZ: %.2f °/s\n", 
                g.gyro.x * 57.2958, g.gyro.y * 57.2958, g.gyro.z * 57.2958);
  Serial.printf("Magnitude Acc: %.2f m/s² | Magnitude Gyro: %.2f °/s\n", 
                accMagnitude, gyroMagnitude * 57.2958);
  float displayedBatteryVoltage = readBatteryVoltage();
  Serial.printf("Bateria: %d%% (%.2f V) | WiFi: %d dBm\n",
                readBatteryPercentage(displayedBatteryVoltage),
                displayedBatteryVoltage, WiFi.RSSI());
  
  Serial.printf("\nCheckpoint #%d | Status: %s\n", checkpointCount, status.c_str());
  
  // Enviar dados CONSTANTEMENTE para API se WiFi estiver conectado
  if (WiFi.status() == WL_CONNECTED) {
    // >>> SOLUÇÃO AQUI: Linha comentada para evitar encavalar redes HTTP (já mandamos tudo pelo sensor mesmo)
    // sendCheckpoint(checkpointCount, getFormattedTime());
    
    sendSensorData(a.acceleration.x, a.acceleration.y, a.acceleration.z,
                   g.gyro.x * 57.2958, g.gyro.y * 57.2958, g.gyro.z * 57.2958,
                   accMagnitude, gyroMagnitude * 57.2958, status, checkpointCount);
  }
  
  // Notificar mudança de status
  if (status != lastStatus) {
    Serial.println("\n>>> MUDANÇA DE STATUS DETECTADA <<<");
    Serial.printf("Anterior: %s\n", lastStatus.length() > 0 ? lastStatus.c_str() : "N/A");
    Serial.printf("Atual: %s\n", status.c_str());
    Serial.println(">>> ============================== <<<\n");
    lastStatus = status;
  }
  
  Serial.println("==============================\n");
  
  checkpointCount++;
  delay(UPDATE_INTERVAL);
}
