import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';
it('does not override Communications endpoints when prospect intake is merged', () => {
 const source = ts.createSourceFile('crmCommunications.ts', readFileSync(new URL('./crmCommunications.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
 const statement = source.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => d.name.getText(source) === 'crmCommunicationsRouter')) as ts.VariableStatement;
 const declaration = statement.declarationList.declarations.find(d => d.name.getText(source) === 'crmCommunicationsRouter')!;
 const object = (declaration.initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
 const names = object.properties.map(p => p.name?.getText(source));
 expect(new Set(names).size).toBe(names.length);
 expect(names).toEqual(expect.arrayContaining(['saveVerifiedProspect', 'composeEmail', 'replyEmail', 'openCustomerContact', 'sendJob']));
});
