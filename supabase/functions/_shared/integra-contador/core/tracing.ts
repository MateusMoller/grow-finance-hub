export function newCorrelationId(){return crypto.randomUUID()}
export async function requestTag(seed:string){const data=new TextEncoder().encode(seed);const hash=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(hash)].slice(0,16).map(v=>v.toString(16).padStart(2,"0")).join("").slice(0,32)}
