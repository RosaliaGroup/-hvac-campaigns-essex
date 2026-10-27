import {afterEach,describe,expect,it} from "vitest";
import {probeLushaConnection} from "./lushaCredentialProbe";

const original=process.env.LUSHA_API_KEY;
afterEach(()=>{
  if(original===undefined)delete process.env.LUSHA_API_KEY;
  else process.env.LUSHA_API_KEY=original;
});
describe("Lusha credential probe",()=>{
  it("does not call the API without a key",async()=>{
    delete process.env.LUSHA_API_KEY;
    const fetchMock=(async()=>{throw new Error("unexpected network request");}) as typeof fetch;
    expect(await probeLushaConnection(fetchMock)).toEqual({
      configured:false,authenticated:false,status:"missing-key",
    });
  });
  it("checks account usage only and never exposes key or response body",async()=>{
    process.env.LUSHA_API_KEY="unit-test-secret";
    const fetchMock=(async(url:unknown,init?:RequestInit)=>{
      expect(url).toBe("https://api.lusha.com/account/usage");
      expect(init?.method).toBe("GET");
      expect(init?.headers).toMatchObject({api_key:"unit-test-secret"});
      return {ok:true,status:200} as Response;
    }) as typeof fetch;
    const result=await probeLushaConnection(fetchMock);
    expect(result).toEqual({configured:true,authenticated:true,status:200,note:undefined});
    expect(JSON.stringify(result)).not.toContain("unit-test-secret");
  });
  it("reports permission failure without retries or contact lookup",async()=>{
    process.env.LUSHA_API_KEY="unit-test-secret";
    let calls=0;
    const fetchMock=(async()=>{calls++;return {ok:false,status:403} as Response;}) as typeof fetch;
    const result=await probeLushaConnection(fetchMock);
    expect(calls).toBe(1);
    expect(result.authenticated).toBe(false);
    expect(result.status).toBe(403);
  });
});
