import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  BREVO_SMTP_USER: z.string().min(1, 'BREVO_SMTP_USER is required'),
  BREVO_SMTP_KEY: z.string().min(1, 'BREVO_SMTP_KEY is required'),
  GMAIL_USER: z.email('GMAIL_USER must be a valid email'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SEED_ADMIN_EMAIL: z.email().default('admin@gmail.com'),
  SEED_ADMIN_PASSWORD: z.string().default('123!@#qweQWE'),
  SEED_ADMIN_USERNAME: z.string().default('admin'),
  SEED_ADMIN_NAME: z.string().default('John Doe'),
  SEED_COLLEGE_NAME: z.string().default('Thapar Institute of Engineering and Technology'),
  SEED_CAMPUS_NAME: z.string().default('Patiala, Punjab'),
  SEED_DOMAIN: z.string().default('thapar.edu')
});


const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment configuration:');
  result.error.issues.forEach((e) => {
    console.error(`  ${e.path.join('.')}: ${e.message}`);
  });
  process.exit(1);
}

export const config = result.data;
