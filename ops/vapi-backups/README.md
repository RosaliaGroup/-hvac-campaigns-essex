# Vapi Mechanical assistant backups

Read-only, masked exports of the two Mechanical assistants and their tools, taken before the
Abrevo -> HVAC-repo tool conversion. Produced by `scripts/export-vapi-mechanical.cjs`.

- Assistants: Mechanical Inbound (...2894), Mechanical Outbound (...5b09).
- Tools are shared objects: the same tool id is attached to both assistants, so a PATCH to a tool changes both.
- Masked fields cannot be restored from these files. Secrets/credentials must be re-supplied on revert.
  (`headers.type` / `headers.properties` show as masked only because the field name matches the secret filter; the
  stored value is the literal string "[object Object]", i.e. no real header is configured.)
- To revert one tool: PATCH /tool/<id> with the `server.url` / `url` from the file for that tool.
