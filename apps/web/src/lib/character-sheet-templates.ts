import type { CharacterSheetTemplate } from "@rising-moon/shared-types";
import type { Tables } from "@/lib/supabase/database.types";

export function toCharacterSheetTemplate(
  row: Tables<"character_sheet_templates">,
): CharacterSheetTemplate {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    definition: row.definition,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
