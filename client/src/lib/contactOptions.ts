/**
 * Shared option lists + value shape for technician contact-detail forms
 * (dashboard Team Management + field-app My Profile).
 */

export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

export const PREFERRED_CONTACT_METHODS: { value: "phone" | "text" | "email"; label: string }[] = [
  { value: "phone", label: "Phone call" },
  { value: "text", label: "Text message" },
  { value: "email", label: "Email" },
];

export const COMMON_LANGUAGES = ["English", "Spanish", "Portuguese", "Polish", "Mandarin", "Other"];

/** Contact-detail fields a technician can edit about themselves. */
export type ContactFieldsValue = {
  mobilePhone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  preferredContactMethod: "" | "phone" | "text" | "email";
  preferredLanguage: string;
  profilePhoto: string; // base64 data URL, or "" for none
};

export const emptyContactFields: ContactFieldsValue = {
  mobilePhone: "",
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  preferredContactMethod: "",
  preferredLanguage: "",
  profilePhoto: "",
};

/** Build a ContactFieldsValue from a (possibly-null) server profile record. */
export function contactFieldsFrom(p: Partial<Record<keyof ContactFieldsValue, string | null>> | null | undefined): ContactFieldsValue {
  return {
    mobilePhone: p?.mobilePhone ?? "",
    streetAddress: p?.streetAddress ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    zipCode: p?.zipCode ?? "",
    emergencyContactName: p?.emergencyContactName ?? "",
    emergencyContactRelationship: p?.emergencyContactRelationship ?? "",
    emergencyContactPhone: p?.emergencyContactPhone ?? "",
    preferredContactMethod: (p?.preferredContactMethod as ContactFieldsValue["preferredContactMethod"]) ?? "",
    preferredLanguage: p?.preferredLanguage ?? "",
    profilePhoto: p?.profilePhoto ?? "",
  };
}

/**
 * Convert form values into a tRPC payload: "" → null so blanks clear the field
 * server-side, and preferredContactMethod "" → null (not a valid enum value).
 */
export function contactFieldsToPayload(v: ContactFieldsValue) {
  const s = (x: string) => (x.trim() === "" ? null : x.trim());
  return {
    mobilePhone: s(v.mobilePhone),
    streetAddress: s(v.streetAddress),
    city: s(v.city),
    state: s(v.state),
    zipCode: s(v.zipCode),
    emergencyContactName: s(v.emergencyContactName),
    emergencyContactRelationship: s(v.emergencyContactRelationship),
    emergencyContactPhone: s(v.emergencyContactPhone),
    preferredContactMethod: v.preferredContactMethod === "" ? null : v.preferredContactMethod,
    preferredLanguage: s(v.preferredLanguage),
    profilePhoto: v.profilePhoto.trim() === "" ? null : v.profilePhoto,
  };
}
