import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  FolderOpen,
  FileText,
  File,
  Upload,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Calendar,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const categories = [
  { name: "Documentos Cadastrais", count: 45, icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20" },
  { name: "Documentos Fiscais", count: 128, icon: File, color: "bg-primary/10 text-primary" },
  { name: "Documentos Contábeis", count: 87, icon: FolderOpen, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20" },
  { name: "Dept. Pessoal", count: 63, icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/20" },
  { name: "Contratos", count: 32, icon: File, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/20" },
  { name: "Formulários", count: 55, icon: FileText, color: "bg-muted text-muted-foreground" },
];

const documents = [
  { name: "Contrato Social - ABC Tecnologia", category: "Documentos Cadastrais", client: "ABC Tecnologia Ltda", date: "15/03/2026", size: "2.4 MB", type: "PDF" },
  { name: "DARF - Março 2026", category: "Documentos Fiscais", client: "Tech Solutions SA", date: "14/03/2026", size: "156 KB", type: "PDF" },
  { name: "Balancete Fevereiro", category: "Documentos Contábeis", client: "Startup XYZ ME", date: "10/03/2026", size: "1.8 MB", type: "XLSX" },
  { name: "Holerite - João Silva", category: "Dept. Pessoal", client: "Beta Serviços SA", date: "05/03/2026", size: "98 KB", type: "PDF" },
  { name: "Proposta Comercial #2026-034", category: "Contratos", client: "Nova Empresa Ltda", date: "18/03/2026", size: "3.1 MB", type: "PDF" },
  { name: "Ficha de Admissão", category: "Formulários", client: "Comércio Rápido Ltda", date: "17/03/2026", size: "420 KB", type: "PDF" },
  { name: "DRE Trimestral Q1", category: "Documentos Contábeis", client: "ABC Tecnologia Ltda", date: "12/03/2026", size: "2.1 MB", type: "XLSX" },
  { name: "Certidão Negativa FGTS", category: "Documentos Fiscais", client: "Tech Solutions SA", date: "08/03/2026", size: "310 KB", type: "PDF" },
];

const typeColors: Record<string, string> = {
  PDF: "bg-destructive/10 text-destructive",
  XLSX: "bg-primary/10 text-primary",
  DOC: "bg-blue-100 text-blue-700 dark:bg-blue-900/20",
};

export default function DocumentosPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");

  const cats = ["Todos", ...categories.map(c => c.name)];
  const filtered = documents.filter((d) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.client.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "Todos" && d.category !== catFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Documentos</h1>
            <p className="text-sm text-muted-foreground">Central de documentos organizados por cliente e categoria</p>
          </div>
          <Button className="gap-2">
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setCatFilter(cat.name === catFilter ? "Todos" : cat.name)}
              className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${catFilter === cat.name ? "ring-2 ring-primary" : "bg-card"}`}
            >
              <div className={`h-8 w-8 rounded-lg ${cat.color} flex items-center justify-center mb-2`}>
                <cat.icon className="h-4 w-4" />
              </div>
              <div className="text-xs font-medium truncate">{cat.name}</div>
              <div className="text-lg font-bold">{cat.count}</div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground" placeholder="Buscar documento..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Documents table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">Documento</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Cliente</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Tamanho</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((doc, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">{doc.category}</td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Building2 className="h-3 w-3" />{doc.client}
                      </span>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />{doc.date}
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={`text-xs border-0 ${typeColors[doc.type] || "bg-muted"}`}>{doc.type}</Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{doc.size}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
