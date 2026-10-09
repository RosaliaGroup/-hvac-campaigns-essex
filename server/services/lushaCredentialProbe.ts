/** One-time, non-billable Lusha API-key check. No contact search or phone reveal.
 * Logs HTTP status only, never the key or response payload.
 */
export async function probeLushaConnection(fetchImpl: typeof fetch = fetch) {
  const key = process.env.LUSHA_API_KEY?.trim();
  if (!key) return {configured:false, authenticated:false, status:"missing-key"};
  try {
    const response = await fetchImpl("https://api.lusha.com/account/usage", {
      method:"GET",
      headers: {api_key:key,Accept:"application/json"},
      signal:AbortSignal.timeout(10_000),
    });
    return {
      configured:true,
      authenticated:response.ok,
      status:response.status,
      note:response.status===403?"API key lacks permission or account plan does not allow this endpoint":
        response.status===429?"Rate limited; do not retry until reset":undefined,
    };
  } catch(error) {
    return {configured:true,authenticated:false,status:"network-error",
      note:error instanceof Error?error.name:"unknown"};
  }
}
export function startLushaConnectionProbe() {
  if(process.env.NODE_ENV!=="production")return;
  const timer=setTimeout(()=>{
    void probeLushaConnection().then(result=>
      console.info("[Lusha API] Credential check:",JSON.stringify(result))
    ).catch(()=>console.warn("[Lusha API] Credential check failed"));
  },20_000);
  timer.unref();
}
