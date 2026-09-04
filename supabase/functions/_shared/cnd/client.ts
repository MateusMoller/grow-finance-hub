export type CndCertificate = {
  taxpayerNumber: string;
  certificateType: number | null;
  controlCode: string;
  issuedAt: string;
  validUntil: string;
  pdfBase64: string;
};

export type CndResult = {
  status: number;
  message: string;
  certificate: CndCertificate | null;
  raw: Record<string, unknown>;
};

type CachedToken={value:string;expiresAt:number};
let cachedToken:CachedToken|null=null;
const sleep=(milliseconds:number)=>new Promise((resolve)=>setTimeout(resolve,milliseconds));

function contract() {
  const clientId=Deno.env.get("CND_SERPRO_CLIENT_ID")?.trim();
  const clientSecret=Deno.env.get("CND_SERPRO_CLIENT_SECRET")?.trim();
  if(!clientId||!clientSecret) throw new Error("CND_CONTRACT_NOT_CONFIGURED");
  const environment=Deno.env.get("CND_SERPRO_ENVIRONMENT")==="trial"?"trial":"production";
  return environment==="trial"
    ? {clientId,clientSecret,tokenUrl:"https://h-apigateway.conectagov.np.estaleiro.serpro.gov.br/oauth2/jwt-token",apiUrl:"https://h-apigateway.conectagov.np.estaleiro.serpro.gov.br/api-cnd-trial/v1/ConsultaCnd/certidao"}
    : {clientId,clientSecret,tokenUrl:"https://apigateway.conectagov.estaleiro.serpro.gov.br/oauth2/jwt-token",apiUrl:"https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cnd/v1/ConsultaCnd/certidao"};
}

async function accessToken(input:ReturnType<typeof contract>) {
  if(cachedToken&&cachedToken.expiresAt>Date.now()+30_000)return cachedToken.value;
  const tokenResponse=await fetch(input.tokenUrl,{method:"POST",headers:{Authorization:`Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`,"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:"grant_type=client_credentials"});
  if(!tokenResponse.ok)throw new Error(`CND_TOKEN_HTTP_${tokenResponse.status}`);
  const payload=await tokenResponse.json() as Record<string,unknown>;
  const value=String(payload.access_token||"");
  if(!value)throw new Error("CND_TOKEN_INVALID");
  cachedToken={value,expiresAt:Date.now()+Math.max(Number(payload.expires_in||300)-30,30)*1000};
  return value;
}

function normalize(payload:Record<string,unknown>):CndResult {
  const certificate=(payload.Certidao||payload.certidao) as Record<string,unknown>|undefined;
  const pdf=certificate?String(certificate.DocumentoPdf||certificate.documentoPdf||""):"";
  const controlCode=certificate?String(certificate.CodigoControle||certificate.codigoControle||""):"";
  return {status:Number(payload.Status??payload.status??99),message:String(payload.Mensagem||payload.mensagem||""),certificate:certificate&&pdf&&controlCode?{taxpayerNumber:String(certificate.ContribuinteCertidao||certificate.contribuinteCertidao||""),certificateType:certificate.TipoCertidao==null&&certificate.tipoCertidao==null?null:Number(certificate.TipoCertidao??certificate.tipoCertidao),controlCode,issuedAt:String(certificate.DataEmissao||certificate.dataEmissao||""),validUntil:String(certificate.DataValidade||certificate.dataValidade||""),pdfBase64:pdf}:null,raw:payload};
}

export async function issueFederalCnd(cnpj:string):Promise<CndResult> {
  const taxpayer=cnpj.replace(/\D/g,"");
  if(taxpayer.length!==14)throw new Error("CND_INVALID_CNPJ");
  const configured=contract();
  let key:string|undefined;
  for(let attempt=0;attempt<25;attempt+=1){
    if(attempt>0)await sleep(750);
    const token=await accessToken(configured);
    const apiResponse=await fetch(configured.apiUrl,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({TipoContribuinte:1,ContribuinteConsulta:taxpayer,CodigoIdentificacao:"9201",GerarCertidaoPdf:true,...(key?{Chave:key}:{})})});
    if(apiResponse.status===401){cachedToken=null;throw new Error("CND_UNAUTHORIZED");}
    const payload=await apiResponse.json().catch(()=>({Status:99,Mensagem:`HTTP ${apiResponse.status}`})) as Record<string,unknown>;
    const result=normalize(payload);
    if(result.status!==7)return result;
    key=String(payload.Chave||payload.chave||"")||undefined;
    if(!key)throw new Error("CND_PROCESSING_KEY_MISSING");
  }
  return {status:7,message:"A consulta continua em processamento.",certificate:null,raw:{Status:7}};
}
