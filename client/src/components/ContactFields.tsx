import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Camera, Loader2, User, X } from "lucide-react";
import {
  US_STATES, PREFERRED_CONTACT_METHODS, COMMON_LANGUAGES, type ContactFieldsValue,
} from "@/lib/contactOptions";
import { fileToResizedDataUrl } from "@/lib/imageResize";

type Props = {
  value: ContactFieldsValue;
  onChange: (patch: Partial<ContactFieldsValue>) => void;
  /** Unique per-instance prefix so <label htmlFor> ids don't collide. */
  idPrefix?: string;
  /** Hide the photo uploader (e.g. when a screen renders it separately). */
  hidePhoto?: boolean;
};

/**
 * Shared editable contact-detail fields (mobile phone, address, emergency
 * contact, preferences, photo). Used by the dashboard team form and the field
 * app My Profile screen. Identity/permission fields live outside this block.
 */
export function ContactFields({ value, onChange, idPrefix = "cf", hidePhoto = false }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const id = (k: string) => `${idPrefix}-${k}`;

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError("");
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      onChange({ profilePhoto: dataUrl });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not process that image.");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {!hidePhoto && (
        <div className="space-y-2">
          <Label>Profile photo</Label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center border">
              {value.profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={photoBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {value.profilePhoto ? "Change" : "Upload"}
                </Button>
                {value.profilePhoto && (
                  <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => onChange({ profilePhoto: "" })}>
                    <X className="w-4 h-4" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG or PNG. Resized automatically.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
          </div>
          {photoError && <p className="text-xs text-red-600">{photoError}</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={id("mobile")}>Mobile phone</Label>
        <Input
          id={id("mobile")}
          type="tel"
          inputMode="tel"
          placeholder="(555) 123-4567"
          value={value.mobilePhone}
          onChange={(e) => onChange({ mobilePhone: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("street")}>Street address</Label>
        <Input
          id={id("street")}
          placeholder="123 Main St"
          value={value.streetAddress}
          onChange={(e) => onChange({ streetAddress: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor={id("city")}>City</Label>
          <Input
            id={id("city")}
            value={value.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={id("state")}>State</Label>
          <Select value={value.state} onValueChange={(v) => onChange({ state: v })}>
            <SelectTrigger id={id("state")}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {US_STATES.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor={id("zip")}>ZIP</Label>
          <Input
            id={id("zip")}
            inputMode="numeric"
            placeholder="07001"
            value={value.zipCode}
            onChange={(e) => onChange({ zipCode: e.target.value })}
          />
        </div>
      </div>

      <div className="pt-1">
        <p className="text-sm font-semibold mb-2">Emergency contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor={id("ecname")}>Name</Label>
            <Input
              id={id("ecname")}
              value={value.emergencyContactName}
              onChange={(e) => onChange({ emergencyContactName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("ecrel")}>Relationship</Label>
            <Input
              id={id("ecrel")}
              placeholder="Spouse"
              value={value.emergencyContactRelationship}
              onChange={(e) => onChange({ emergencyContactRelationship: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("ecphone")}>Phone</Label>
            <Input
              id={id("ecphone")}
              type="tel"
              inputMode="tel"
              placeholder="(555) 987-6543"
              value={value.emergencyContactPhone}
              onChange={(e) => onChange({ emergencyContactPhone: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={id("method")}>Preferred contact method</Label>
          <Select
            value={value.preferredContactMethod || undefined}
            onValueChange={(v) => onChange({ preferredContactMethod: v as ContactFieldsValue["preferredContactMethod"] })}
          >
            <SelectTrigger id={id("method")}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {PREFERRED_CONTACT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("lang")}>Preferred language</Label>
          <Input
            id={id("lang")}
            list={id("lang-list")}
            placeholder="English"
            value={value.preferredLanguage}
            onChange={(e) => onChange({ preferredLanguage: e.target.value })}
          />
          <datalist id={id("lang-list")}>
            {COMMON_LANGUAGES.map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>
      </div>
    </div>
  );
}
