import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import growIcon from "@/assets/grow-icon.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[#efeff2] dark:bg-[#031029]">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            <Link to="/" className="flex items-center gap-3">
              <img src={growIcon} alt="Grow" className="h-8 w-8 rounded-md" />
              <span className="font-heading text-lg font-semibold text-foreground">Grow Contabilidade</span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Parceiro estrategico de empresas que buscam crescimento com organizacao, compliance e inteligencia.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Servicos</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/solucoes" className="hover:text-foreground">Contabilidade Consultiva</Link></li>
              <li><Link to="/solucoes" className="hover:text-foreground">Assessoria Fiscal</Link></li>
              <li><Link to="/solucoes" className="hover:text-foreground">Departamento Pessoal</Link></li>
              <li><Link to="/solucoes" className="hover:text-foreground">Abertura de Empresas</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Institucional</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Sobre a Grow</Link></li>
              <li><Link to="/#clientes" className="hover:text-foreground">Clientes</Link></li>
              <li><Link to="/contato" className="hover:text-foreground">Contato</Link></li>
              <li><Link to="/login" className="hover:text-foreground">Area interna</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Contato</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>R. Júlio de Castilhos, 2579 - Sl 205 - Centro, Taquara - RS</li>
                <li>Telefone: (51) 99532-5592</li>
                <li>E-mail: contato@contabilidadegrow.com.br</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Assine nossa newsletter</p>
              <div className="mt-2 flex gap-2">
                <Input placeholder="Seu e-mail" className="h-9 bg-white dark:border-[#28355f] dark:bg-[#0a1734]" />
                <Button size="sm" className="h-9 rounded-full px-4 dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]">Inscrever</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Grow Contabilidade. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacidade" className="hover:text-foreground">Politica de Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
