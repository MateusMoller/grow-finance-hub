import { SiteLegalLayout } from "@/components/site/SiteLegalLayout";

const termsSections = [
  {
    title: "1. Objeto",
    paragraphs: [
      "Estes Termos regulam o acesso e o uso do site institucional, dos canais digitais e das áreas restritas disponibilizadas pela Grow Contabilidade.",
      "Ao navegar no site ou utilizar qualquer funcionalidade vinculada a nossos serviços, você concorda com estas condições de uso e com a legislação aplicável.",
    ],
  },
  {
    title: "2. Uso permitido da plataforma",
    paragraphs: [
      "O usuário compromete-se a utilizar o site e os recursos da Grow de forma lícita, ética e compatível com a finalidade informativa, comercial e operacional da plataforma.",
      "Não é permitido praticar atos que comprometam segurança, disponibilidade, integridade do sistema, reputação da empresa ou direitos de terceiros.",
    ],
  },
  {
    title: "3. Acesso a areas restritas",
    paragraphs: [
      "Algumas funcionalidades dependem de login, credenciais e autorizações específicas. O usuário é responsável por manter seus dados de acesso em sigilo e por comunicar qualquer uso indevido identificado.",
      "A Grow pode restringir, suspender ou revogar acessos quando houver indícios de uso inadequado, violação destes Termos ou risco operacional para a plataforma.",
    ],
  },
  {
    title: "4. Conteudo, propriedade intelectual e materiais",
    paragraphs: [
      "Textos, estrutura visual, marcas, fluxos, documentos, interfaces, códigos, conteúdos e demais elementos do site pertencem à Grow ou são utilizados mediante autorização.",
      "Não é permitido copiar, reproduzir, distribuir, adaptar ou explorar esses materiais sem autorização prévia, salvo nos limites expressamente permitidos por lei.",
    ],
  },
  {
    title: "5. Limitacoes e responsabilidades",
    paragraphs: [
      "A Grow busca manter informações atualizadas e serviços disponíveis, mas não garante ausência de indisponibilidade temporária, falhas técnicas, interrupções ou necessidade de manutenção.",
      "O uso das informações publicadas no site deve considerar o contexto de cada empresa. Conteúdos institucionais não substituem avaliação técnica individualizada quando ela for necessária.",
    ],
  },
  {
    title: "6. Alteracoes e disposicoes finais",
    paragraphs: [
      "Estes Termos podem ser atualizados a qualquer momento para refletir evoluções do site, ajustes operacionais, exigências legais ou novos recursos disponibilizados pela Grow.",
      "A continuidade de uso da plataforma após publicação de alterações será interpretada como ciência das condições vigentes na data mais recente indicada nesta página.",
    ],
  },
];

export default function TermsPage() {
  return (
    <SiteLegalLayout
      eyebrow="Condições de uso"
      title="Termos"
      description="Estas condições apresentam as regras gerais de uso do site, das interfaces públicas e dos ambientes digitais disponibilizados pela Grow."
      updatedAt="24 de abril de 2026"
      sections={termsSections}
      asideTitle="Leitura rápida"
      asideText="Esses Termos definem como o site pode ser utilizado, quais responsabilidades existem em acessos protegidos e como a Grow trata seus conteúdos, acessos e operação digital."
    />
  );
}
