ALTER TABLE "currencies" DROP CONSTRAINT "currencies_currency_currencies_id_fk";
--> statement-breakpoint
ALTER TABLE "currencies" ADD COLUMN "ref" integer;--> statement-breakpoint
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_ref_currencies_id_fk" FOREIGN KEY ("ref") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currencies" DROP COLUMN "currency";