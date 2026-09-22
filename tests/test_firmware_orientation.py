"""Testa as funções reais do firmware no host, sem placa conectada."""
import pathlib
import subprocess
import tempfile
import unittest


class FirmwareOrientationTest(unittest.TestCase):
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
        a.acceleration=up; g.gyro={0,0,0};
      };
      auto sample = [&]() {
        clockMs += 25;
        return analyzeFallDetection(a,g,acc,gyro);
      };
      auto noFallFor = [&](int milliseconds) {
        for (int elapsed=0; elapsed<milliseconds; elapsed+=25)
          assert(sample() != "QUEDA CONFIRMADA");
      };
      auto impact = [&]() {
        a.acceleration={up.x*2.5f,up.y*2.5f,up.z*2.5f};
        assert(sample()=="ANALISANDO MOVIMENTO");
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

    }
  }
  refAccX=refAccY=refAccZ=0;
  assert(!isLyingPosition(0,0,9.81f));
}
'''
        with tempfile.TemporaryDirectory() as directory:
            cpp = pathlib.Path(directory) / "orientation.cpp"
            binary = pathlib.Path(directory) / "orientation"
            cpp.write_text(harness)
            subprocess.run(["clang++", "-std=c++11", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)


if __name__ == "__main__":
    unittest.main()
