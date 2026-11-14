// Re-export the canonical generated schema.
//
// This file used to be a second, independently generated copy of the database
// types. Two copies drift: this one was last regenerated on 2026-10-23 and had
// fallen behind the live database (missing tables like `promoters`,
// `checkout_questions` and columns like `orders.checkout_answers`), which
// produced misleading "column does not exist" errors all over the app.
//
// Consumers now resolve through the single generated file, so a schema change
// only has to be picked up in one place.
export * from "@/integrations/supabase/types";
