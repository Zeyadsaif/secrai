import { z } from "zod";

/**
 * Server-side environment. Access only in server code (route handlers, server
 * components, scripts). Throws early if a required var is missing.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  MS_CLIENT_ID: z.string().uuid(),
  MS_CLIENT_SECRET: z.string().min(1),
  MS_REDIRECT_URI: z.string().url(),
  MS_AUTHORITY_HOST: z.string().url().default("https://login.microsoftonline.com"),
  SECRAI_ENCRYPTION_KEY: z.string().min(1),
  SYNC_SECRET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

/** Public vars are safe to read in the browser. */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
};
