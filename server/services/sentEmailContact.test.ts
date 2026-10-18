import { describe, it, expect, vi } from "vitest";
import { ensureSentEmailContact } from "./sentEmailContact";
function database(existing: unknown[]) {
  const tx: any = {
    select: vi.fn(() => tx),
    from: vi.fn(() => tx),
    where: vi.fn(() => tx),
    limit: vi.fn(async () => existing),
    insert: vi.fn(() => tx),
    values: vi.fn(async () => [{ insertId: 12 }]),
    update: vi.fn(() => tx),
    set: vi.fn(() => tx),
  };
  return { tx, db: { transaction: async (fn: any) => fn(tx) } as any };
}
describe("Sent email CRM contacts", () => {
  it("reuses existing CRM contacts without overwriting their details", async () => {
    const { tx, db } = database([{ id: 4 }]);
    expect(
      await ensureSentEmailContact(db, {
        id: 7,
        email: "a@example.com",
        name: "A",
      })
    ).toBe(4);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.set).toHaveBeenCalledWith({ customerId: 4 });
  });
  it("creates a main CRM contact and links the communication contact", async () => {
    const { tx, db } = database([]);
    expect(
      await ensureSentEmailContact(db, {
        id: 7,
        email: " A@Example.com ",
        name: "Ana",
        phone: "2015550123",
      })
    ).toBe(12);
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Ana",
        email: "a@example.com",
        phone: "2015550123",
        source: "HVAC Prospecting Task",
      })
    );
    expect(tx.set).toHaveBeenCalledWith({ customerId: 12 });
  });
});

 it("keeps email-only selected outreach visible while phone research is pending", async () => {
 const {tx,db}=database([]);
 await ensureSentEmailContact(db,{id:8,email:"new@building.com",name:"New",source:"gmail-selected"});
 expect(tx.values).toHaveBeenCalledWith(expect.objectContaining({email:"new@building.com",phone:null,source:"Gmail Selected"}));
 expect(tx.set).toHaveBeenCalledWith({customerId:12});
 });

it("splits a verified person name into dedicated fields on intake",async()=>{
 const {tx,db}=database([]);
 await ensureSentEmailContact(db,{id:9,email:"matt@example.com",name:"Matt Steier",company:"VanRock CRE"});
 expect(tx.values).toHaveBeenCalledWith(expect.objectContaining({firstName:"Matt",lastName:"Steier",displayName:"Matt Steier",companyName:"VanRock CRE"}));
});
it("repairs empty person fields and company display labels without replacing existing names",async()=>{
 const {tx,db}=database([{id:4,displayName:"VanRock CRE",companyName:"VanRock CRE",firstName:null,lastName:null}]);
 await ensureSentEmailContact(db,{id:9,email:"matt@example.com",name:"Matt Steier",company:"VanRock CRE"});
 expect(tx.set).toHaveBeenCalledWith(expect.objectContaining({firstName:"Matt",lastName:"Steier",displayName:"Matt Steier"}));
});
it("never turns an email or company into a first and last name",async()=>{
 const {tx,db}=database([]);
 await ensureSentEmailContact(db,{id:9,email:"matt@example.com",name:"VanRock CRE",company:"VanRock CRE"});
 expect(tx.values).toHaveBeenCalledWith(expect.objectContaining({firstName:null,lastName:null}));
});
it("preserves a conflicting staff-entered full name",async()=>{
 const {tx,db}=database([{id:4,displayName:"Example Company",firstName:"Mary",lastName:"Smith"}]);
 await ensureSentEmailContact(db,{id:9,email:"matt@example.com",name:"Matt Steier"});
 expect(tx.set).toHaveBeenCalledWith({displayName:"Mary Smith"});
});
