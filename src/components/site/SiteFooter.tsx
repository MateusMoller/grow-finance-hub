import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-heading font-bold text-sm">G</span>
              </div>
              <span className="font-heading font-bold text-lg">
                Grow <span className="text-primary">Finance</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Escritório contábil e financeiro com soluções digitais para o crescimento do seu negócio.
            </p>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">Empresa</h4>
            <ul className="space-y-2.5">
              {[["Sobre", "/sobre"], ["Soluções", "/solucoes"], ["Blog", "/blog"], ["Contato", "/contato"]].map(([label, href]) => (
                <li key={href}>
                  <Link to={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">Soluções</h4>
            <ul className="space-y-2.5">
              {["Contabilidade", "BPO Financeiro", "Departamento Pessoal", "Consultoria"].map((item) => (
                <li key={item}>
                  <span className="text-sm text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">Contato</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>contato@growfinance.com.br</li>
              <li>(11) 99999-9999</li>
              <li>São Paulo, SP</li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-12 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Grow Finance. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <Link to="/termos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacidade
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
