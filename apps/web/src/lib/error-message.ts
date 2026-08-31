// A thrown value from a Supabase client call isn't guaranteed to be an
// Error (e.g. a network-level rejection), so this is the shared fallback
// used anywhere a catch block needs to show the user something.
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}
