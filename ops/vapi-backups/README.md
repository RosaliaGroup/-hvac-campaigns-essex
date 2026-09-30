# Vapi Mechanical assistant backups

Read-only, masked exports of the two Mechanical assistants and their tools, taken before the
Abrevo -> HVAC-repo tool conversion. Produced by `scripts/export-vapi-mechanical.cjs`.

- Assistants: Mechanical Inbound (...2894), Mechanical Outbound (...5b09).
- Tools are shared objects: the same tool id is attached to both assistants, so a PATCH to a tool changes both.
- Masked fields cannot be restored from these files. Secrets/credentials must be re-supplied on revert.
  (`headers` shows as masked because the field name matches the secret filter. CORRECTION 2026-09-30: the sendForm tool
  (…bc1f) DOES carry a static `x-vapi-secret` header (`headers.properties["x-vapi-secret"].value`), which is why it authenticates;
  this export cannot restore that value. To revert a change to that tool, re-set the header from VAPI_TOOL_SECRET.)
- To revert one tool: PATCH /tool/<id> with the `server.url` / `url` from the file for that tool.
