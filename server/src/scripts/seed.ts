import { config } from '../config';
import bcrypt from 'bcryptjs';
import { supabase } from '../integrations/supabase';
import { logger } from '../shared/logger';

const ADMIN_EMAIL = config.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = config.SEED_ADMIN_PASSWORD;
const ADMIN_USERNAME = config.SEED_ADMIN_USERNAME;
const ADMIN_NAME = config.SEED_ADMIN_NAME;

const COLLEGE_NAME = config.SEED_COLLEGE_NAME;
const CAMPUS_NAME = config.SEED_CAMPUS_NAME;
const DOMAIN = config.SEED_DOMAIN;

async function seed() {
  logger.info('Seeding database…');

  // ── College ───────────────────────────────────────────────────────────────
  let collegeId: string;
  const { data: existingCollege } = await supabase
    .from('colleges')
    .select('id')
    .eq('name', COLLEGE_NAME)
    .maybeSingle();

  if (existingCollege) {
    collegeId = existingCollege.id;
    logger.info(`College already exists: ${collegeId}`);
  } else {
    const { data: college, error } = await supabase
      .from('colleges')
      .insert({ name: COLLEGE_NAME, is_active: true })
      .select('id')
      .single();

    if (error || !college) {
      throw new Error(`Failed to insert college: ${error?.message}`);
    }

    collegeId = college.id;
    logger.info(`College created: ${collegeId}`);
  }

  // ── Domain ───────────────────────────────────────────────────────────────
  const { data: existingDomain } = await supabase
    .from('college_domains')
    .select('id')
    .eq('domain', DOMAIN)
    .maybeSingle();

  if (existingDomain) {
    logger.info(`Domain already exists: ${DOMAIN}`);
  } else {
    const { error } = await supabase
      .from('college_domains')
      .insert({ college_id: collegeId, domain: DOMAIN, is_active: true });

    if (error) {
      throw new Error(`Failed to insert domain: ${error.message}`);
    }

    logger.info(`Domain created: ${DOMAIN}`);
  }

  // ── Campus ───────────────────────────────────────────────────────────────
  let campusId: string;
  const { data: existingCampus } = await supabase
    .from('campuses')
    .select('id')
    .eq('college_id', collegeId)
    .eq('name', CAMPUS_NAME)
    .maybeSingle();

  if (existingCampus) {
    campusId = existingCampus.id;
    logger.info(`Campus already exists: ${campusId}`);
  } else {
    const { data: campus, error } = await supabase
      .from('campuses')
      .insert({ college_id: collegeId, name: CAMPUS_NAME, is_active: true })
      .select('id')
      .single();

    if (error || !campus) {
      throw new Error(`Failed to insert campus: ${error?.message}`);
    }

    campusId = campus.id;
    logger.info(`Campus created: ${campusId}`);
  }

  // ── Admin user ──────────────────────────────────────────────────────────
  let adminId: string;
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (existingUser) {
    adminId = existingUser.id;
    logger.info(`Admin user already exists: ${adminId}`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: ADMIN_EMAIL,
        password_hash: passwordHash,
        is_admin: true,
        is_email_verified: true,
      })
      .select('id')
      .single();

    if (error || !user) {
      throw new Error(`Failed to insert admin user: ${error?.message}`);
    }

    adminId = user.id;
    logger.info(`Admin user created: ${adminId}`);
  }

  // ── Admin profile ───────────────────────────────────────────────────────
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', adminId)
    .maybeSingle();

  if (existingProfile) {
    // Update campus_id and onboarding_completed in case profile exists but is incomplete
    await supabase
      .from('profiles')
      .update({
        name: ADMIN_NAME,
        username: ADMIN_USERNAME,
        campus_id: campusId,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);

    logger.info('Admin profile updated');
  } else {
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: adminId,
        name: ADMIN_NAME,
        username: ADMIN_USERNAME,
        campus_id: campusId,
        onboarding_completed: true,
      });

    if (error) {
      throw new Error(`Failed to insert admin profile: ${error.message}`);
    }

    logger.info('Admin profile created');
  }

  logger.info('\n✓ Seed complete');
  logger.info(`  Email   : ${ADMIN_EMAIL}`);
  logger.info(`  Password: ${ADMIN_PASSWORD}`);
  logger.info(`  College : ${COLLEGE_NAME}`);
  logger.info(`  Campus  : ${CAMPUS_NAME}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed failed', { message: err.message });
    process.exit(1);
  });
