import type { Metadata } from "next";
import Image from "next/image";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BellRing,
  HeartHandshake,
  Move,
  Radio,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import logo from "@/public/logo/ALERTA Logo.png";
import { ProjectDemo } from "./project-demo";
import styles from "./projeto.module.css";

export const metadata: Metadata = {
  title: "Conheça o ALERTA | Tecnologia para apoiar o cuidado",
  description:
    "Conheça o dispositivo vestível ALERTA, como ele identifica indícios de queda e avisa a equipe por meio de um painel de monitoramento.",
  openGraph: {
    title: "ALERTA — tecnologia para apoiar o cuidado",
    description:
      "Entenda como o dispositivo vestível, o sensor de movimento e o painel trabalham juntos para apoiar a equipe de cuidado.",
  },
};

const steps = [
  {
    number: "01",
    icon: Move,
    title: "A pessoa usa a faixa",
    description:
      "Um pequeno dispositivo com ESP32 e sensor de movimento fica preso firmemente ao peito ou à cintura, em uma faixa semelhante às usadas por corredores.",
  },
  {
    number: "02",
    icon: Activity,
    title: "O movimento é analisado",
    description:
      "O dispositivo observa mudanças bruscas de movimento e a posição após o evento. Esses sinais podem indicar uma possível queda.",
  },
  {
    number: "03",
    icon: Wifi,
    title: "O aviso chega ao painel",
    description:
      "Quando há indícios compatíveis, o dispositivo envia as informações por Wi-Fi ao servidor e o painel mostra um alerta visível.",
  },
  {
    number: "04",
    icon: HeartHandshake,
    title: "A equipe verifica",
    description:
      "Um profissional confere a situação da pessoa e decide o atendimento adequado. A avaliação humana continua essencial.",
  },
];

export default function ProjetoPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href="#inicio" aria-label="ALERTA, voltar ao início">
            <span className={styles.brandMark}><Activity size={20} strokeWidth={2.5} /></span>
            <span>ALERTA</span>
          </a>
          <nav className={styles.nav} aria-label="Navegação da página">
            <a href="#como-funciona">Como funciona</a>
            <a href="#demonstracao">Demonstração</a>
            <a href="#tecnologia">Tecnologia</a>
          </nav>
          <a className={styles.headerCta} href="#demonstracao">Ver demonstração <ArrowRight size={16} /></a>
        </div>
      </header>

      <main id="inicio">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> PROJETO FETIN · TECNOLOGIA EM SAÚDE</span>
              <h1 id="hero-title">Mais atenção para <em>cada movimento.</em></h1>
              <p>
                O ALERTA é um dispositivo vestível que identifica <strong>indícios de queda</strong> e
                avisa uma equipe de cuidado por meio de um painel de monitoramento.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#como-funciona">Entenda o funcionamento <ArrowRight size={18} /></a>
                <a className={styles.secondaryButton} href="#demonstracao">Explore a simulação <ArrowDown size={18} /></a>
              </div>
              <div className={styles.heroFootnote}><ShieldCheck size={18} /> Apoio à avaliação da equipe. Não substitui o cuidado profissional.</div>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.visualTopline}><span className={styles.liveDot} /> DA PESSOA À EQUIPE</div>
              <div className={styles.visualFlow}>
                <div className={styles.flowTile}>
                  <span className={styles.flowIcon}><Activity size={27} /></span>
                  <strong>Dispositivo</strong>
                  <small>Faixa vestível</small>
                </div>
                <span className={styles.flowConnector} aria-hidden="true"><ArrowRight size={22} /></span>
                <div className={styles.flowTile}>
                  <span className={styles.flowIcon}><Radio size={27} /></span>
                  <strong>Conexão</strong>
                  <small>Wi-Fi</small>
                </div>
                <span className={styles.flowConnector} aria-hidden="true"><ArrowRight size={22} /></span>
                <div className={styles.flowTile}>
                  <span className={styles.flowIcon}><BellRing size={27} /></span>
                  <strong>Equipe</strong>
                  <small>Avalia o aviso</small>
                </div>
              </div>
              <div className={styles.visualMessage}>
                <span className={styles.messageIcon}><HeartHandshake size={21} /></span>
                <span><strong>Tecnologia a serviço do cuidado</strong><small>Uma informação a mais para orientar a verificação.</small></span>
              </div>
              <span className={styles.visualCaption}>ESQUEMA ILUSTRATIVO DO FLUXO</span>
            </div>
          </div>
        </section>

        <section className={styles.intro} aria-labelledby="intro-title">
          <div className={styles.sectionContainer}>
            <span className={styles.sectionKicker}>O PROJETO</span>
            <div className={styles.introGrid}>
              <h2 id="intro-title">Um sinal de atenção quando ele pode fazer diferença.</h2>
              <p>
                Em ambientes de cuidado, uma possível queda precisa ser percebida e verificada.
                O ALERTA reúne um sensor usado no corpo, comunicação sem fio e um painel para
                ajudar a equipe a acompanhar o movimento e receber avisos. O sistema apoia a
                resposta; quem confirma o que aconteceu e presta assistência é a equipe.
              </p>
            </div>
          </div>
        </section>

        <section id="como-funciona" className={styles.stepsSection} aria-labelledby="steps-title">
          <div className={styles.sectionContainer}>
            <span className={styles.sectionKicker}>PASSO A PASSO</span>
            <h2 id="steps-title" className={styles.sectionTitle}>Como o ALERTA funciona</h2>
            <p className={styles.sectionLead}>Do movimento da pessoa à avaliação profissional, em quatro etapas.</p>
            <div className={styles.stepsGrid}>
              {steps.map(({ number, icon: Icon, title, description }) => (
                <article className={styles.stepCard} key={number}>
                  <div className={styles.stepTop}><span className={styles.stepIcon}><Icon size={23} /></span><span className={styles.stepNumber}>{number}</span></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="demonstracao" className={styles.demoSection} aria-labelledby="demo-title">
          <div className={styles.sectionContainer}>
            <span className={styles.sectionKicker}>VEJA NA PRÁTICA</span>
            <h2 id="demo-title" className={styles.sectionTitle}>Acompanhe um cenário simulado</h2>
            <p className={styles.sectionLead}>Selecione uma etapa e veja como a informação evolui até a verificação pela equipe.</p>
            <ProjectDemo />
          </div>
        </section>

        <section id="tecnologia" className={styles.techSection} aria-labelledby="tech-title">
          <div className={styles.sectionContainer}>
            <div className={styles.techLayout}>
              <div>
                <span className={styles.sectionKicker}>POR DENTRO DO ALERTA</span>
                <h2 id="tech-title" className={styles.sectionTitle}>Pequeno no corpo. Claro para a equipe.</h2>
                <p className={styles.sectionLead}>
                  O protótipo combina um ESP32, um sensor de movimento e um painel web. O dispositivo
                  analisa as leituras localmente e comunica seus estados por Wi-Fi.
                </p>
                <div className={styles.techTags}><span>ESP32</span><span>Sensor de movimento</span><span>Wi-Fi</span><span>Painel web</span></div>
              </div>
              <div className={styles.techDiagram} aria-label="Representação ilustrativa do dispositivo preso em uma faixa vestível">
                <div className={styles.strap}><div className={styles.device}><Activity size={36} strokeWidth={2.3} /><span>ALERTA</span></div></div>
                <p>Faixa vestível com dispositivo firmemente preso ao corpo</p>
                <small>Representação ilustrativa; a aparência física pode variar.</small>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.limitSection} aria-labelledby="limit-title">
          <div className={styles.sectionContainer}>
            <div className={styles.limitCard}>
              <span className={styles.limitIcon}><ShieldCheck size={29} /></span>
              <div>
                <span className={styles.sectionKicker}>USO RESPONSÁVEL</span>
                <h2 id="limit-title">Um aviso para verificar, não um diagnóstico.</h2>
                <p>
                  Movimentos parecidos com uma queda podem gerar um aviso, e nem toda queda terá
                  os mesmos sinais. Conexão e posicionamento do dispositivo também influenciam o
                  funcionamento. O ALERTA não evita quedas nem garante identificar todas elas:
                  seu papel é apoiar a observação e a resposta da equipe.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <div className={styles.sectionContainer}>
            <Image src={logo} alt="Logo do projeto ALERTA" className={styles.finalLogo} sizes="(max-width: 700px) 110px, 145px" />
            <div><span className={styles.sectionKicker}>PROJETO FETIN</span><h2 id="final-title">ALERTA — tecnologia para apoiar o cuidado.</h2><p>Conheça o protótipo e converse com a equipe sobre como a tecnologia pode ajudar quem cuida.</p></div>
            <a href="#inicio" className={styles.backTop}>Voltar ao início ↑</a>
          </div>
        </section>
      </main>
      <footer className={styles.footer}><span>ALERTA · Fetin</span><span>Página de apresentação do protótipo</span></footer>
    </div>
  );
}
