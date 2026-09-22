"""Testa as funções reais do firmware no host, sem placa conectada."""
import pathlib
import subprocess
import tempfile
import unittest


class FirmwareOrientationTest(unittest.TestCase):
    def test_calibration_preserves_gravity_and_rejects_motion(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / "codigoESP.INO").read_text()
        constants = source[source.index("const float IMPACT_THRESHOLD"):source.index("// Sensor\n")]
        states = source[source.index("// Calibração\n"):source.index("// Contadores")]
        geometry = source[source.index("float getTotalAcceleration("):source.index("// FUNÇÕES - WIFI")]
        calibration = source[source.index("bool calibrateSensor()"):source.index("float getTotalAcceleration(")]
        harness = r'''#include <algorithm>
#include <cassert>
#include <cmath>
using std::abs;
using std::isfinite;
constexpr float SENSORS_GRAVITY_STANDARD=9.80665f;
constexpr float DEG_TO_RAD=0.017453292519943295f;
template<class T> T constrain(T v,T lo,T hi) { return std::max(lo,std::min(hi,v)); }
struct Vector { float x,y,z; };
struct sensors_event_t { Vector acceleration{},gyro{}; };
struct SerialMock {
  void print(const char*) {}
  void println(const char*) {}
  template<class... Args> void printf(const char*,Args...) {}
} Serial;
void delay(int) {}
int mode=0, reads=0;
Vector mounting{0,0,1};
bool readMotion(sensors_event_t& a,sensors_event_t& g);
''' + constants + states + geometry + r'''
bool readMotion(sensors_event_t& a,sensors_event_t& g) {
  ++reads;
  a.acceleration={mounting.x*10.2f+ACC_OFFSET_X,
                  mounting.y*10.2f+ACC_OFFSET_Y,
                  mounting.z*10.2f+ACC_OFFSET_Z};
  g.gyro={0.05f,-0.03f,0.02f};
  if(mode==1) a.acceleration={0,0,0};
  if(mode==2) g.gyro.x=1.0f;
  if(mode==3) a.acceleration.x=NAN;
  if(mode==4 && reads%2) { a.acceleration.x=1; a.acceleration.y=0; a.acceleration.z=10.2f; }
  if(mode==5 && reads%2) g.gyro.x=-0.15f;
  return mode!=6;
}
''' + calibration + r'''
int main() {
  for (Vector v : {Vector{1,0,0},Vector{-1,0,0},Vector{0,1,0},Vector{0,-1,0},
                   Vector{0,0,1},Vector{0,0,-1},Vector{0.6f,0,0.8f}}) {
    mounting=v; mode=0; reads=0;
    assert(calibrateSensor());
    assert(abs(getTotalAcceleration(refAccX,refAccY,refAccZ)-SENSORS_GRAVITY_STANDARD)<0.001f);
    assert(abs(accScale-SENSORS_GRAVITY_STANDARD/10.2f)<0.001f);
    assert(abs(refGyroX-0.05f)<0.001f && abs(refGyroY+0.03f)<0.001f);
    assert(!isLyingPosition(v.x*9.81f,v.y*9.81f,v.z*9.81f));
  }
  mounting={0,0,1}; mode=0; assert(calibrateSensor());
  const float saved=refAccZ, savedScale=accScale, savedGyro=refGyroX;
  for(mode=1;mode<=6;++mode) {
    reads=0; assert(!calibrateSensor());
    assert(refAccZ==saved && accScale==savedScale && refGyroX==savedGyro);
  }
}
'''
        with tempfile.TemporaryDirectory() as directory:
            cpp = pathlib.Path(directory) / "calibration.cpp"
            binary = pathlib.Path(directory) / "calibration"
            cpp.write_text(harness)
            subprocess.run(["clang++", "-std=c++11", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_mounting_orientation_and_fall_confirmation(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / "codigoESP.INO").read_text()
        geometry = source[source.index("float getTotalAcceleration("):source.index("// FUNÇÕES - WIFI")]
        detector = source[source.index("String analyzeFallDetection("):source.index("// SETUP (INICIALIZAÇÃO)")]
        constants = source[source.index("const float IMPACT_THRESHOLD"):source.index("// Sensor\n")]
        states = source[source.index("// Calibração\n"):source.index("// Contadores")]
        harness = r'''#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdio>
#include <string>
using std::abs;
using std::isfinite;
using String = std::string;
constexpr float SENSORS_GRAVITY_STANDARD = 9.80665f;
constexpr float DEG_TO_RAD = 0.017453292519943295f;
template<class T> T constrain(T value, T low, T high) {
  return std::max(low, std::min(high, value));
}
struct Vector { float x, y, z; };
struct sensors_event_t { Vector acceleration{}, gyro{}; };
struct SerialMock {
  void println(const char*) {}
  template<class... Args> void printf(const char*, Args...) {}
} Serial;
unsigned long clockMs = 100;
unsigned long millis() { return clockMs; }
''' + constants + states + geometry + detector + r'''
int main() {
  // A mesma postura fisica com a placa girada em torno de varios eixos.
  for (int degrees = 0; degrees < 360; degrees += 15) {
    float t = degrees * DEG_TO_RAD;
    Vector upright{9.81f * std::sin(t), 0, 9.81f * std::cos(t)};
    Vector horizontal{9.81f * std::cos(t), 0, -9.81f * std::sin(t)};
    for (int axis = 0; axis < 3; ++axis) {
      // Permutar os eixos tambem testa montagens com gravidade em X, Y ou Z.
      auto permute = [axis](Vector v) {
        return axis == 0 ? v : axis == 1 ? Vector{v.y,v.z,v.x} : Vector{v.z,v.x,v.y};
      };
      Vector up = permute(upright), down = permute(horizontal);
      refAccX=up.x; refAccY=up.y; refAccZ=up.z;
      assert(!isLyingPosition(up.x,up.y,up.z));
      assert(isLyingPosition(down.x,down.y,down.z));
      assert(!isLyingPosition(0,0,0));
      Vector slight{up.x*0.8660254f+down.x*0.5f, up.y*0.8660254f+down.y*0.5f, up.z*0.8660254f+down.z*0.5f};
      assert(!isLyingPosition(slight.x,slight.y,slight.z));
      sensors_event_t a{}, g{};
      float acc, gyro;
      auto reset = [&]() {
        fallState=NORMAL; fallConfirmedTime=0; clockMs=100;
        fallTriggerArmed=true;
        refGyroX=refGyroY=refGyroZ=0; accScale=1.0f;
        a.acceleration=up; g.gyro={0,0,0};
      };
      auto sample = [&]() {
        clockMs += 25;
        sensors_event_t raw=a;
        raw.acceleration.x+=ACC_OFFSET_X;
        raw.acceleration.y+=ACC_OFFSET_Y;
        raw.acceleration.z+=ACC_OFFSET_Z;
        return analyzeFallDetection(raw,g,acc,gyro);
      };
      auto noFallFor = [&](int milliseconds) {
        for (int elapsed=0; elapsed<milliseconds; elapsed+=25)
          assert(sample() != "QUEDA CONFIRMADA");
      };
      auto impact = [&]() {
        const bool starting = fallState==NORMAL;
        a.acceleration={up.x*2.5f,up.y*2.5f,up.z*2.5f};
        assert(sample()==(starting ? "ANALISANDO MOVIMENTO" : "ANALISANDO"));
      };
      reset();
      assert(sample()=="PARADO");
      // Giro rapido seguido de inclinacao, sem impacto: nao e queda.
      g.gyro.x=4;
      noFallFor(300);
      a.acceleration=down;
      noFallFor(300);
      g.gyro.x=0;
      noFallFor(5000);
      assert(fallState==NORMAL);

      // Impacto seguido de postura inclinada estavel confirma, em qualquer montagem.
      reset(); impact(); a.acceleration=down;
      noFallFor(1200);
      assert(sample()=="QUEDA CONFIRMADA");
      a.acceleration=up;
      assert(sample()=="QUEDA CONFIRMADA");

      // Impacto, inclinacao breve e retorno em pe.
      reset(); impact(); a.acceleration=down;
      noFallFor(600); a.acceleration=up;
      noFallFor(4500); assert(fallState==NORMAL);

      // Inclinacao sem impacto tambem nao pode disparar pelo vetor de gravidade.
      reset(); a.acceleration=down;
      noFallFor(5000); assert(fallState==NORMAL);

      // Mesmo apos impacto, rotacao continua nao confirma; a janela expira.
      reset(); impact(); a.acceleration=down; g.gyro.x=4;
      noFallFor(4500); g.gyro.x=0;
      noFallFor(2000); assert(fallState==NORMAL);

      // Aceleracao dinamica lateral nao pode ser usada como postura estavel.
      reset(); impact();
      a.acceleration={down.x*1.5f,down.y*1.5f,down.z*1.5f};
      noFallFor(4500); assert(fallState==NORMAL);

      // Uma interrupcao de leitura nao conta como tempo de postura confirmada.
      reset(); impact(); a.acceleration=down;
      noFallFor(600); clockMs+=1000;
      noFallFor(1200); assert(sample()=="QUEDA CONFIRMADA");

      // Movimento durante a confirmacao reinicia a contagem.
      reset(); impact(); a.acceleration=down; noFallFor(600);
      g.gyro.x=4; noFallFor(100); g.gyro.x=0;
      noFallFor(1200); assert(sample()=="QUEDA CONFIRMADA");

      // Sem novas leituras antes do prazo final: nunca confirmar por tempo decorrido.
      reset(); impact(); a.acceleration=down; sample(); clockMs+=4500;
      assert(sample()!="QUEDA CONFIRMADA"); assert(fallState==NORMAL);

      // Um impacto realista de ~1,4 g tambem inicia a analise.
      reset();
      a.acceleration={up.x*1.4f, up.y*1.4f, up.z*1.4f};
      assert(sample()=="ANALISANDO MOVIMENTO");
      a.acceleration=down; noFallFor(1200);
      assert(sample()=="QUEDA CONFIRMADA");

      // Uma queda livre sustentada seguida da postura final confirma sem grande pico.
      reset();
      a.acceleration={0,0,0};
      assert(sample()=="ANALISANDO MOVIMENTO");
      noFallFor(125);
      a.acceleration=down; noFallFor(1200);
      assert(sample()=="QUEDA CONFIRMADA");

      // Uma leitura isolada de zero nao e evidencia de queda livre.
      reset(); a.acceleration={0,0,0}; sample();
      a.acceleration=down; noFallFor(4500); assert(fallState==NORMAL);

      // Todas as direcoes no plano horizontal, mais a posicao invertida.
      Vector side{(up.y*down.z-up.z*down.y)/9.81f,
                  (up.z*down.x-up.x*down.z)/9.81f,
                  (up.x*down.y-up.y*down.x)/9.81f};
      for (int direction=0; direction<360; direction+=45) {
        float angle=direction*DEG_TO_RAD;
        reset(); impact();
        a.acceleration={down.x*std::cos(angle)+side.x*std::sin(angle),
                        down.y*std::cos(angle)+side.y*std::sin(angle),
                        down.z*std::cos(angle)+side.z*std::sin(angle)};
        noFallFor(1200); assert(sample()=="QUEDA CONFIRMADA");
      }
      reset(); impact(); a.acceleration={-up.x,-up.y,-up.z};
      noFallFor(1200); assert(sample()=="QUEDA CONFIRMADA");

      // Queda lateral parcial: cerca de 45 graus entre em pe e deitado.
      reset(); impact();
      Vector lateralPartial{up.x * 0.7071068f + down.x * 0.7071068f,
                            up.y * 0.7071068f + down.y * 0.7071068f,
                            up.z * 0.7071068f + down.z * 0.7071068f};
      a.acceleration=lateralPartial;
      noFallFor(1200); assert(sample()=="QUEDA CONFIRMADA");

      // Queda livre sustentada + impacto confirma mesmo terminando sentado/vertical.
      reset(); noFallFor(500); a.acceleration={0,0,0}; noFallFor(300);
      impact(); a.acceleration=up; noFallFor(1200);
      assert(sample()=="QUEDA CONFIRMADA");

      // Impacto vertical isolado nao confirma; deitado parado continua PARADO.
      reset(); impact(); a.acceleration=up;
      noFallFor(4500); assert(fallState==NORMAL);
      reset(); a.acceleration=down; assert(sample()=="PARADO");
      noFallFor(4500); assert(fallState==NORMAL);

      // Lacuna entre amostras de baixa aceleracao nao conta como queda livre.
      reset(); a.acceleration={0,0,0}; sample(); clockMs+=200;
      sample(); impact(); a.acceleration=up;
      noFallFor(4500); assert(fallState==NORMAL);

      // Impulso antes da queda livre indica salto; pouso vertical nao confirma.
      reset(); impact(); a.acceleration={0,0,0}; noFallFor(300);
      impact(); a.acceleration=up; noFallFor(4500); assert(fallState==NORMAL);

      // Amostras invalidas cancelam a analise; alerta confirmado permanece latente.
      reset(); impact(); a.acceleration.x=NAN; sample(); assert(fallState==NORMAL);
      reset(); impact(); a.acceleration=down; noFallFor(1200); sample();
      a.acceleration.x=NAN; assert(sample()=="QUEDA CONFIRMADA");

      // Offset do giroscopio e ganho do acelerometro corrigidos antes da analise.
      reset(); refGyroX=0.12f; refGyroY=-0.08f; refGyroZ=0.06f;
      g.gyro={refGyroX,refGyroY,refGyroZ}; accScale=1.05f;
      a.acceleration={up.x/accScale,up.y/accScale,up.z/accScale};
      noFallFor(500); assert(gyro<0.001f && acc<0.01f);
      impact(); a.acceleration={down.x/accScale,down.y/accScale,down.z/accScale};
      noFallFor(1200); assert(sample()=="QUEDA CONFIRMADA");
      reset();
    }
  }
  refAccX=refAccY=refAccZ=0;
  // Sem referência calibrada, a postura não pode ser inferida.
  assert(getTotalAcceleration(refAccX,refAccY,refAccZ) < 1.0f);
}
'''
        with tempfile.TemporaryDirectory() as directory:
            cpp = pathlib.Path(directory) / "orientation.cpp"
            binary = pathlib.Path(directory) / "orientation"
            for offsets in [(0, 0, 0), (0.35, -0.25, 0.18), (-0.4, 0.3, -0.2)]:
                with self.subTest(offsets=offsets):
                    configured = harness
                    for axis, value in zip("XYZ", offsets):
                        configured = configured.replace(f"ACC_OFFSET_{axis} = 0.0f", f"ACC_OFFSET_{axis} = {value}f" if value else f"ACC_OFFSET_{axis} = 0.0f")
                    cpp.write_text(configured)
                    subprocess.run(["clang++", "-std=c++11", str(cpp), "-o", str(binary)], check=True)
                    subprocess.run([str(binary)], check=True)


if __name__ == "__main__":
    unittest.main()
