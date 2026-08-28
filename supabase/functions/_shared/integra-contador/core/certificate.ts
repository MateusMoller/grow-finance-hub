export type CertificateMetadata={secretRef:string;fingerprint:string;expiresAt:string};
export interface CertificateProvider{get(connectionId:string):Promise<CertificateMetadata>;}
export class SecretReferenceCertificateProvider implements CertificateProvider{constructor(private resolve:(id:string)=>Promise<CertificateMetadata>){} get(id:string){return this.resolve(id)}}
