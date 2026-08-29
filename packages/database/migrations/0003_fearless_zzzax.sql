CREATE TYPE "public"."business_party_homologation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "business_party_roles" DROP CONSTRAINT "business_party_roles_role_check";--> statement-breakpoint
ALTER TABLE "business_parties" ADD COLUMN "homologation_status" "business_party_homologation_status";--> statement-breakpoint
ALTER TABLE "business_parties" ADD COLUMN "homologation_notes" varchar(500);--> statement-breakpoint
CREATE INDEX "business_parties_tenant_homologation_idx" ON "business_parties" USING btree ("tenant_id","homologation_status");--> statement-breakpoint
ALTER TABLE "business_party_roles" ADD CONSTRAINT "business_party_roles_role_check" CHECK ("business_party_roles"."role" in ('customer', 'shipper', 'consignee', 'carrier', 'partner', 'supplier'));