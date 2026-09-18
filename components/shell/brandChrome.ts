import type { BrandId } from "@/lib/brands";

// Brand-dependent chrome styling, in one place because the sidebar and the topbar both
// need it and a drift between them is exactly the sort of thing nobody notices.
//
// The palette is ours, mapped from the reference UI's:
//
//   reference #06B6D4 cyan     -> #43AFCD  Kognoz cyan
//   reference #8B5CF6 violet   -> #6B4FC9  Konverz violet
//   reference #EC4899 magenta  -> #B52879  Konverz magenta
//   reference #0F172A ground   -> unchanged. Not a brand colour — the dark surface the
//                                 accents sit on, and shared by both brands.
//
// Status colours are deliberately NOT brand colours. Tailwind's emerald-600 is #059669,
// which is exactly our AUDIT_OK token, so the emerald utilities used for "verified" are
// already on-palette and stay as they are.

/** Right-hand descriptor on a brand row and in the topbar pill. UI copy, not brand data. */
export const BRAND_DESCRIPTOR: Record<BrandId, string> = {
  kognoz: "Consulting",
  konverz: "Talent AI"
};

/** Sidebar avatar square — mirrors the reference's cyan→blue and violet→magenta. */
export const BRAND_AVATAR: Record<BrandId, string> = {
  kognoz: "bg-gradient-to-br from-[#43AFCD] to-[#005184]",
  konverz: "bg-gradient-to-br from-[#6B4FC9] to-[#B52879]"
};

/** Ring around the selected brand row. */
export const BRAND_RING: Record<BrandId, string> = {
  kognoz: "ring-1 ring-[#43AFCD]/40",
  konverz: "ring-1 ring-[#6B4FC9]/40"
};

/** Dot on the selected brand row. */
export const BRAND_DOT: Record<BrandId, string> = {
  kognoz: "bg-[#43AFCD] shadow-sm shadow-[#43AFCD]",
  konverz: "bg-[#6B4FC9] shadow-sm shadow-[#6B4FC9]"
};

/** The topbar's brand pill. Dark ground, brand-tinted for Konverz. */
export const BRAND_PILL: Record<BrandId, string> = {
  kognoz: "bg-slate-900 text-white border-slate-700 hover:bg-slate-800",
  konverz: "bg-[#241540] text-violet-100 border-[#3A2460] hover:bg-[#2E1A50]"
};

/** The dot inside that pill. */
export const BRAND_PILL_DOT: Record<BrandId, string> = {
  kognoz: "bg-[#43AFCD]",
  konverz: "bg-[#B52879]"
};

/**
 * The primary "+ Create" button.
 *
 * Dark ground into the brand accent, as the reference does. Both start from the same
 * slate so only the accent end moves when you switch.
 */
export const BRAND_CREATE_BTN: Record<BrandId, string> = {
  kognoz: "bg-gradient-to-r from-[#0F172A] to-[#005184] hover:to-[#00629E]",
  konverz: "bg-gradient-to-r from-[#0F172A] to-[#6B4FC9] hover:to-[#7C5FD8]"
};

/** The chrome accent, shared by both brands — see the note in Sidebar.tsx. */
export const CHROME_ACCENT = "#43AFCD";

/** Status green for dots on the dark rail, legible where AUDIT_OK would be too dark. */
export const CHROME_OK = "#88B787";
