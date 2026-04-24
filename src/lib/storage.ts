import { supabase } from "@/lib/supabase";

const ANEXOS_BUCKET = "demanda-anexos";

export async function getAnexoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ANEXOS_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
