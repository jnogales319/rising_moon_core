import { expect, test } from "vitest";
import type { Tables } from "@/lib/supabase/database.types";
import { toCharacterSheetTemplate } from "./character-sheet-templates";

const ROW: Tables<"character_sheet_templates"> = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "66666666-7777-8888-9999-000000000000",
  name: "Fate Core",
  definition: { skills: [{ name: "Fight", rating: 2 }] },
  is_default: false,
  created_at: "2026-11-13T00:00:00.000Z",
  updated_at: "2026-11-13T00:00:00.000Z",
};

test("maps every snake_case DB column to its camelCase shared-type field", () => {
  expect(toCharacterSheetTemplate(ROW)).toEqual({
    id: ROW.id,
    ownerId: ROW.owner_id,
    name: ROW.name,
    definition: ROW.definition,
    isDefault: ROW.is_default,
    createdAt: ROW.created_at,
    updatedAt: ROW.updated_at,
  });
});

test("passes through a non-object definition unchanged, since the jsonb column has no shape constraint", () => {
  const arrayRow: Tables<"character_sheet_templates"> = {
    ...ROW,
    definition: [1, 2, 3],
  };

  expect(toCharacterSheetTemplate(arrayRow).definition).toEqual([1, 2, 3]);
});
