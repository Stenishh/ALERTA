"use client";

import { useState } from "react";
import { Activity, BellRing, CircleCheck, Move } from "lucide-react";
import styles from "./projeto.module.css";

const stages = [
  {
    label: "Caminhando",
    icon: Move,
    status: "Em movimento",
    tone: "moving",
    title: "Movimento habitual",
    detail: "A pessoa caminha usando a faixa com o dispositivo.",
    note: "O painel acompanha o estado recebido do dispositivo.",
  },
  {
    label: "Analisando",
    icon: Activity,
    status: "Analisando movimento",
    tone: "checking",
    title: "Sinais merecem atenção",
    detail: "Uma mudança brusca e a posição seguinte são analisadas pelo sensor.",
    note: "Um movimento isolado não confirma, por si só, que ocorreu uma queda.",
  },
  {
    label: "Aviso enviado",
    icon: BellRing,
    status: "Possível queda · verificar",
    tone: "alert",
    title: "A equipe recebe o aviso",
    detail: "Indícios compatíveis geram um alerta no painel de monitoramento.",
    note: "O aviso depende da comunicação Wi-Fi com o servidor.",
  },
  {
    label: "Verificação",
    icon: CircleCheck,
    status: "Equipe avaliando",
    tone: "resolved",
    title: "A situação é verificada",
    detail: "Um profissional vai até a pessoa e avalia o que aconteceu.",
    note: "A decisão sobre o atendimento cabe à equipe de cuidado.",
  },
] as const;

export function ProjectDemo() {
  const [stageIndex, setStageIndex] = useState(0);
  const stage = stages[stageIndex];
  const StageIcon = stage.icon;

  return (
    <div className={styles.demoCard}>
      <div className={styles.demoTabs} role="group" aria-label="Etapas da simulação">
        {stages.map(({ label, icon: Icon }, index) => (
          <button
            type="button"
            key={label}
            className={`${styles.demoTab} ${stageIndex === index ? styles.demoTabActive : ""}`}
            aria-pressed={stageIndex === index}
            onClick={() => setStageIndex(index)}
          >
            <Icon size={18} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className={styles.demoBody}>
        <div className={styles.demoNarrative}>
          <span className={styles.demoStepLabel}>ETAPA {String(stageIndex + 1).padStart(2, "0")} / 04</span>
          <span className={`${styles.demoStageIcon} ${styles[stage.tone]}`}><StageIcon size={30} /></span>
          <h3>{stage.title}</h3>
          <p>{stage.detail}</p>
          <div className={styles.demoNote}><CircleCheck size={18} /><span>{stage.note}</span></div>
        </div>
        <div className={styles.mockPanel}>
          <div className={styles.mockTop}><span><span className={styles.mockLogoDot} /> ALERTA</span><small>SIMULAÇÃO VISUAL</small></div>
          <div className={styles.mockContent}>
            <span className={styles.mockHeading}>Painel de monitoramento</span>
            <div className={styles.mockPatient}>
              <span className={styles.mockAvatar}>PF</span>
              <div><strong>Paciente fictício</strong><small>Exemplo de acompanhamento</small></div>
            </div>
            <div className={`${styles.mockStatus} ${styles[stage.tone]}`}>
              <StageIcon size={22} /><span>{stage.status}</span>
            </div>
            <p>O estado apresentado representa apenas esta demonstração.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
