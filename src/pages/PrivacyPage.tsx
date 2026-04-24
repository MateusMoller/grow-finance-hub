import { SiteLegalLayout } from "@/components/site/SiteLegalLayout";

const privacySections = [
  {
    title: "1. Dados que podemos coletar",
    paragraphs: [
      "Podemos coletar dados fornecidos diretamente por voce em formularios, cadastro de newsletter, contatos comerciais e acessos a areas protegidas do sistema.",
      "Esses dados podem incluir nome, e-mail, telefone, empresa, cargo, informacoes de uso da plataforma e dados tecnicos necessarios para seguranca, autenticacao e melhoria da experiencia.",
    ],
  },
  {
    title: "2. Como os dados sao utilizados",
    paragraphs: [
      "Os dados sao utilizados para responder solicitacoes, operar funcionalidades do site e da area interna, enviar comunicacoes relacionadas ao servico, melhorar fluxos de atendimento e manter seguranca da plataforma.",
      "Tambem podemos utilizar informacoes para analise interna, acompanhamento de performance dos servicos, prevencao de fraude e cumprimento de obrigacoes legais e regulatorias.",
    ],
  },
  {
    title: "3. Compartilhamento de informacoes",
    paragraphs: [
      "Nao comercializamos dados pessoais. O compartilhamento pode ocorrer apenas quando necessario para operacao tecnica do servico, integracoes contratadas, atendimento de exigencia legal ou defesa de direitos da Grow.",
      "Sempre que houver participacao de terceiros no tratamento de dados, buscamos trabalhar com fornecedores que adotem padroes adequados de confidencialidade e seguranca.",
    ],
  },
  {
    title: "4. Armazenamento, seguranca e retencao",
    paragraphs: [
      "Adotamos medidas tecnicas e organizacionais para proteger os dados contra acesso nao autorizado, perda, alteracao, divulgacao indevida ou qualquer tratamento inadequado.",
      "Os dados sao mantidos pelo periodo necessario para cumprir as finalidades descritas nesta politica, atender obrigacoes legais, resguardar direitos e suportar a continuidade dos servicos.",
    ],
  },
  {
    title: "5. Direitos do titular",
    paragraphs: [
      "Voce pode solicitar confirmacao de tratamento, acesso, correcao, atualizacao, anonimização quando aplicavel, exclusao ou informacoes sobre compartilhamento, nos termos da legislacao vigente.",
      "Tambem pode revogar consentimentos quando o tratamento depender dessa base legal, observadas as hipoteses em que a manutencao dos dados seja necessaria por obrigacao legal ou execucao contratual.",
    ],
  },
  {
    title: "6. Contato sobre privacidade",
    paragraphs: [
      "Solicitacoes relacionadas a privacidade, dados pessoais ou exercicio de direitos podem ser enviadas para os canais oficiais informados no site.",
      "Ao continuar utilizando o site e os servicos da Grow, voce declara estar ciente desta Politica de Privacidade e das finalidades aqui descritas.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <SiteLegalLayout
      eyebrow="Privacidade"
      title="Politica de Privacidade"
      description="Explicamos aqui como a Grow trata dados pessoais e informacoes coletadas em nossos canais institucionais e operacionais."
      updatedAt="24 de abril de 2026"
      sections={privacySections}
      asideTitle="Compromisso"
      asideText="Tratamos dados com foco em seguranca, uso legitimo e transparencia, sempre dentro do contexto necessario para operar nossos servicos e relacoes comerciais."
    />
  );
}
