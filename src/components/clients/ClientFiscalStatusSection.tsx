import { RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Alert,AlertDescription } from "@/components/ui/alert";
import { useClientFiscalStatus } from "@/features/integra-contador/hooks/useClientFiscalStatus";
export function ClientFiscalStatusSection({organizationId,clientId,enabled}:{organizationId:string;clientId:string;enabled:boolean}){
  const {query,sync}=useClientFiscalStatus(organizationId,clientId,enabled); if(!enabled)return null;
  const status=query.data;const updating=Boolean(status?.run&&["queued","processing","waiting_external"].includes(status.run.status));
  return <Card aria-labelledby="fiscal-status-title"><CardHeader><CardTitle id="fiscal-status-title" className="flex items-center gap-2"><Mail className="h-5 w-5"/>Situação fiscal</CardTitle></CardHeader><CardContent className="space-y-4">
    {query.isLoading?<p role="status">Consultando situação fiscal…</p>:null}
    {query.isError?<Alert variant="destructive"><AlertDescription>Não foi possível consultar agora. Os demais dados do cliente continuam disponíveis.</AlertDescription></Alert>:null}
    {status?.indicator?<div role="status" aria-live="polite"><p className="font-medium">{status.indicator.hasNewMessages?"Há novas mensagens na Caixa Postal":"Nenhuma nova mensagem identificada"}</p><p className="text-sm text-muted-foreground">Atualizado em {new Date(status.indicator.fetchedAt).toLocaleString("pt-BR")}{status.indicator.stale?" · informação pode estar desatualizada":""}</p></div>:!query.isLoading?<p className="text-sm text-muted-foreground">Ainda não há consulta fiscal para este cliente.</p>:null}
    {status?.run?.status==="requires_action"?<Alert><AlertDescription>É necessário regularizar a procuração ou a configuração da integração antes de tentar novamente.</AlertDescription></Alert>:null}
    {status?.reviews?.map(review=><Alert key={review.id}><AlertDescription><strong>Revisão fiscal: </strong>{review.recommendedAction}<span className="ml-2 text-xs text-muted-foreground">({review.status})</span></AlertDescription></Alert>)}
    {updating?<p role="status" aria-live="polite">{status?.run?.status==="waiting_external"?"Aguardando retorno da Receita…":"Atualizando em segundo plano…"}</p>:null}
    <Button type="button" variant="outline" disabled={sync.isPending||updating} onClick={()=>sync.mutate(false)}><RefreshCw className={sync.isPending?"animate-spin":""}/>{updating?"Atualizando":"Sincronizar situação fiscal"}</Button>
  </CardContent></Card>;
}
