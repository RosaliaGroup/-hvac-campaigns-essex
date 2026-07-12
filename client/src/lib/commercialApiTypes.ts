/**
 * Type-only bridge to the commercial server procedures. Uses tRPC output
 * inference so the client stays in lockstep with the router (no hand-maintained
 * duplicate shapes). All imports here are `type` and erased at build time.
 */
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type RO = inferRouterOutputs<AppRouter>;

export type CommercialListResult = RO["opportunities"]["commercial"]["list"];
export type CommercialListItem = CommercialListResult["items"][number];
export type CommercialDetail = RO["opportunities"]["commercial"]["get"];
export type CommercialStage = RO["opportunities"]["commercial"]["stages"]["list"][number];
export type ConversionValidation = RO["opportunities"]["commercial"]["convertToJobValidate"];
export type Salesperson = RO["opportunities"]["salespeople"][number];
