import { SiteLegalLayout } from "@/components/site/SiteLegalLayout";

const privacySections = [
  {
    title: "1. Dados que podemos coletar",
    paragraphs: [
      "Podemos coletar dados fornecidos diretamente por você em formulários, cadastro de newsletter, contatos comerciais e acessos a áreas protegidas do sistema.",
      "Esses dados podem incluir nome, e-mail, telefone, empresa, cargo, informações de uso da plataforma e dados técnicos necessários para segurança, autenticação e melhoria da experiência.",
    ],
  },
  {
    title: "2. Como os dados são utilizados",
    paragraphs: [
      "Os dados são utilizados para responder solicitações, operar funcionalidades do site e da área interna, enviar comunicações relacionadas ao serviço, melhorar fluxos de atendimento e manter segurança da plataforma.",
      "Também podemos utilizar informações para análise interna, acompanhamento de performance dos serviços, prevenção de fraude e cumprimento de obrigações legais e regulatórias.",
    ],
  },
  {
    title: "3. Compartilhamento de informações",
    paragraphs: [
      "Não comercializamos dados pessoais. O compartilhamento pode ocorrer apenas quando necessário para operação técnica do serviço, integrações contratadas, atendimento de exigência legal ou defesa de direitos da Grow.",
      "Sempre que houver participação de terceiros no tratamento de dados, buscamos trabalhar com fornecedores que adotem padrões adequados de confidencialidade e segurança.",
    ],
  },
  {
    title: "4. Armazenamento, segurança e retenção",
    paragraphs: [
      "Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado, perda, alteração, divulgação indevida ou qualquer tratamento inadequado.",
      "Os dados são mantidos pelo período necessário para cumprir as finalidades descritas nesta política, atender obrigações legais, resguardar direitos e suportar a continuidade dos serviços.",
    ],
  },
  {
    title: "5. Direitos do titular",
    paragraphs: [
      "Você pode solicitar confirmação de tratamento, acesso, correção, atualização, anonimização quando aplicável, exclusão ou informações sobre compartilhamento, nos termos da legislação vigente.",
      "Também pode revogar consentimentos quando o tratamento depender dessa base legal, observadas as hipóteses em que a manutenção dos dados seja necessária por obrigação legal ou execução contratual.",
    ],
  },
  {
    title: "6. Contato sobre privacidade",
    paragraphs: [
      "Solicitações relacionadas à privacidade, dados pessoais ou exercício de direitos podem ser enviadas para os canais oficiais informados no site.",
      "Ao continuar utilizando o site e os serviços da Grow, você declara estar ciente desta Política de Privacidade e das finalidades aqui descritas.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <SiteLegalLayout
      eyebrow="Privacidade"
      title="Política de Privacidade"
      description="Explicamos aqui como a Grow trata dados pessoais e informações coletadas em nossos canais institucionais e operacionais."
      updatedAt="24 de abril de 2026"
      sections={privacySections}
      asideTitle="Compromisso"
      asideText="Tratamos dados com foco em segurança, uso legítimo e transparência, sempre dentro do contexto necessário para operar nossos serviços e relações comerciais."
    />
  );
}
