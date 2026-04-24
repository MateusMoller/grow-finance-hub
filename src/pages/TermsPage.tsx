import { SiteLegalLayout } from "@/components/site/SiteLegalLayout";

const termsSections = [
  {
    title: "1. Objeto",
    paragraphs: [
      "Estes Termos regulam o acesso e o uso do site institucional, dos canais digitais e das areas restritas disponibilizadas pela Grow Contabilidade.",
      "Ao navegar no site ou utilizar qualquer funcionalidade vinculada a nossos servicos, voce concorda com estas condicoes de uso e com a legislacao aplicavel.",
    ],
  },
  {
    title: "2. Uso permitido da plataforma",
    paragraphs: [
      "O usuario compromete-se a utilizar o site e os recursos da Grow de forma licita, etica e compativel com a finalidade informativa, comercial e operacional da plataforma.",
      "Nao e permitido praticar atos que comprometam seguranca, disponibilidade, integridade do sistema, reputacao da empresa ou direitos de terceiros.",
    ],
  },
  {
    title: "3. Acesso a areas restritas",
    paragraphs: [
      "Algumas funcionalidades dependem de login, credenciais e autorizacoes especificas. O usuario e responsavel por manter seus dados de acesso em sigilo e por comunicar qualquer uso indevido identificado.",
      "A Grow pode restringir, suspender ou revogar acessos quando houver indicios de uso inadequado, violacao destes Termos ou risco operacional para a plataforma.",
    ],
  },
  {
    title: "4. Conteudo, propriedade intelectual e materiais",
    paragraphs: [
      "Textos, estrutura visual, marcas, fluxos, documentos, interfaces, codigos, conteudos e demais elementos do site pertencem a Grow ou sao utilizados mediante autorizacao.",
      "Nao e permitido copiar, reproduzir, distribuir, adaptar ou explorar esses materiais sem autorizacao previa, salvo nos limites expressamente permitidos por lei.",
    ],
  },
  {
    title: "5. Limitacoes e responsabilidades",
    paragraphs: [
      "A Grow busca manter informacoes atualizadas e servicos disponiveis, mas nao garante ausencia de indisponibilidade temporaria, falhas tecnicas, interrupcoes ou necessidade de manutencao.",
      "O uso das informacoes publicadas no site deve considerar o contexto de cada empresa. Conteudos institucionais nao substituem avaliacao tecnica individualizada quando ela for necessaria.",
    ],
  },
  {
    title: "6. Alteracoes e disposicoes finais",
    paragraphs: [
      "Estes Termos podem ser atualizados a qualquer momento para refletir evolucoes do site, ajustes operacionais, exigencias legais ou novos recursos disponibilizados pela Grow.",
      "A continuidade de uso da plataforma apos publicacao de alteracoes sera interpretada como ciencia das condicoes vigentes na data mais recente indicada nesta pagina.",
    ],
  },
];

export default function TermsPage() {
  return (
    <SiteLegalLayout
      eyebrow="Condicoes de uso"
      title="Termos"
      description="Estas condicoes apresentam as regras gerais de uso do site, das interfaces publicas e dos ambientes digitais disponibilizados pela Grow."
      updatedAt="24 de abril de 2026"
      sections={termsSections}
      asideTitle="Leitura rapida"
      asideText="Esses Termos definem como o site pode ser utilizado, quais responsabilidades existem em acessos protegidos e como a Grow trata seus conteudos, acessos e operacao digital."
    />
  );
}
