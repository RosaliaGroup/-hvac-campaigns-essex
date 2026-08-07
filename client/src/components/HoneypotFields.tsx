/**
 * Honeypot inputs (Layer 2). Two decoy fields a human never sees or fills.
 *
 * Positioned absolutely OFF-SCREEN (left:-9999px) rather than display:none —
 * smarter bots skip display:none fields, but happily fill visually-hidden ones.
 * Inputs are removed from the tab order (tabIndex={-1}), hidden from assistive
 * tech (aria-hidden on the wrapper), and opt out of autofill so a browser
 * never populates them for a real user.
 */

export interface HoneypotValues {
  website: string;
  company_url: string;
}

interface HoneypotFieldsProps {
  values: HoneypotValues;
  onChange: (values: HoneypotValues) => void;
}

export default function HoneypotFields({ values, onChange }: HoneypotFieldsProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: "auto",
        width: "1px",
        height: "1px",
        overflow: "hidden",
      }}
    >
      <label htmlFor="website">Website</label>
      <input
        type="text"
        id="website"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={values.website}
        onChange={(e) => onChange({ ...values, website: e.target.value })}
      />
      <label htmlFor="company_url">Company URL</label>
      <input
        type="text"
        id="company_url"
        name="company_url"
        tabIndex={-1}
        autoComplete="off"
        value={values.company_url}
        onChange={(e) => onChange({ ...values, company_url: e.target.value })}
      />
    </div>
  );
}
