const bcrypt = require('bcryptjs');
const { query, initDb } = require('./index');

async function seed() {
  console.log('[Seed] Initializing Akazi database...');

  await initDb();

  // Reset collections for clean state
  try {
    await query('DELETE FROM notifications');
    await query('DELETE FROM applications');
    await query('DELETE FROM jobs');
    await query('DELETE FROM job_seekers');
    await query('DELETE FROM employers');
    await query('DELETE FROM users');
  } catch (e) {
    console.warn('[Seed] Truncate notice:', e.message);
  }

  const defaultPassword = await bcrypt.hash('Akazi@2026', 10);

  // 1. System Administrator
  const adminRes = await query(
    `INSERT INTO users (role, status, name, email, password_hash, phone, terms_accepted)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    ['admin', 'approved', 'Akazi Administrator', 'admin@akazi.rw', defaultPassword, '+250 788 123 000', true]
  );
  const adminId = adminRes.rows[0].id;
  console.log(`[Seed] Created Admin: admin@akazi.rw (ID: ${adminId})`);

  // 2. Verified Real Employer: Kigali Serena Hotel
  const hotelUserRes = await query(
    `INSERT INTO users (role, status, name, email, password_hash, phone, terms_accepted)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    ['employer', 'approved', 'Claudine Mukamana', 'hotel@serena.rw', defaultPassword, '+250 788 444 111', true]
  );
  const hotelUserId = hotelUserRes.rows[0].id;

  const hotelEmpRes = await query(
    `INSERT INTO employers (user_id, company_name, industry, website, location, contact_person, description, logo_url, registration_doc_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      hotelUserId,
      'Kigali Serena Hotel',
      'Hospitality & Tourism',
      'https://www.serenahotels.com',
      'Nyarugenge, Kigali',
      'Claudine Mukamana (Human Resources)',
      'A leading 5-star hotel in Kigali providing hospitality, dining, conference facilities, and international accommodation services.',
      '',
      '/uploads/documents/serena_hotel_rdb_registration.pdf'
    ]
  );
  const hotelEmpId = hotelEmpRes.rows[0].id;

  // Real positions created by Kigali Serena Hotel: Waitress, Chef, Front Desk Receptionist
  // Position 1: Restaurant Waitress / Waiter
  await query(
    `INSERT INTO jobs (
      employer_id, title, category, job_type, workplace_type, location,
      salary_range, working_conditions, responsibilities, description,
      requirements, benefits, custom_fields, deadline, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      hotelEmpId,
      'Restaurant Waitress / Waiter',
      'Food & Beverage Service',
      'full-time',
      'On-site',
      'Kigali Serena Hotel, Nyarugenge',
      '180,000 - 220,000 RWF / month',
      'Shift-based schedule (morning shift: 6:30 AM - 3:00 PM or evening shift: 2:30 PM - 11:00 PM). Uniform provided. One hot meal per shift provided on site.',
      'Welcome dining guests courteously, present menus, take accurate food and beverage orders, coordinate with kitchen staff, serve meals, and maintain a clean dining room.',
      'We are hiring hospitality service staff for our main dining restaurant and garden terrace.',
      '• Secondary school certificate or TVET hospitality training\n• Good spoken English and Kinyarwanda (French is an added advantage)\n• Friendly, respectful customer service attitude\n• Physical fitness for standing and walking during service',
      'Duty meals, health insurance contribution, staff transport allowance for night shifts.',
      JSON.stringify([
        { id: 'experience_years', label: 'Previous experience in restaurant or hotel service (in years or months)', type: 'text', required: true }
      ]),
      '2026-10-30',
      'active'
    ]
  );

  // Position 2: Line Cook / Commis Chef
  await query(
    `INSERT INTO jobs (
      employer_id, title, category, job_type, workplace_type, location,
      salary_range, working_conditions, responsibilities, description,
      requirements, benefits, custom_fields, deadline, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      hotelEmpId,
      'Line Cook / Commis Chef',
      'Culinary & Kitchen',
      'full-time',
      'On-site',
      'Kigali Serena Hotel, Nyarugenge',
      '220,000 - 280,000 RWF / month',
      'Hot kitchen environment. 6 working days per week on scheduled shifts. Chef uniforms and laundry provided.',
      'Prepare food ingredients (mis en place), assist senior chefs in hot line cooking, maintain strict food hygiene standards, monitor food storage temperatures, and clean station after service.',
      'Join our culinary brigade delivering fresh local and international cuisine to restaurant and banquet guests.',
      '• Culinary arts diploma or vocational certificate from recognized institution\n• At least 1 year of practical kitchen experience\n• Knowledge of food safety and sanitation principles\n• Ability to work efficiently in a high-paced kitchen team',
      'Duty meals, medical insurance coverage, career progression opportunities within hotel group.',
      JSON.stringify([]),
      '2026-10-25',
      'active'
    ]
  );

  // Position 3: Front Desk Receptionist
  await query(
    `INSERT INTO jobs (
      employer_id, title, category, job_type, workplace_type, location,
      salary_range, working_conditions, responsibilities, description,
      requirements, benefits, custom_fields, deadline, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      hotelEmpId,
      'Front Desk Receptionist',
      'Front Office & Customer Service',
      'full-time',
      'On-site',
      'Kigali Serena Hotel, Nyarugenge',
      '250,000 - 320,000 RWF / month',
      '8-hour rotating shifts (day and night). Front office uniform provided.',
      'Greet arriving guests, process check-ins and check-outs, issue room keys, handle guest inquiries and phone calls, resolve guest requests, and process room payments.',
      'We are looking for a welcoming, organized Front Desk Receptionist to represent our hotel and deliver high quality guest hospitality.',
      '• Diploma or Bachelor degree in Hospitality Management, Public Relations, or related field\n• Fluent in English and Kinyarwanda; French is a strong asset\n• Computer literacy and familiarity with hotel reservation systems or basic database tools\n• Professional appearance and calm communication under pressure',
      'Uniforms, meal during shift, medical insurance, continuous training.',
      JSON.stringify([
        { id: 'languages', label: 'Languages spoken fluently', type: 'text', required: true }
      ]),
      '2026-11-05',
      'active'
    ]
  );

  // 3. Pending Employer for Administrator Verification Review: Inyange Dairy Logistics Ltd
  const pendingUserRes = await query(
    `INSERT INTO users (role, status, name, email, password_hash, phone, terms_accepted)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    ['employer', 'pending', 'Jean Bosco Hakizimana', 'logistics@inyange.rw', defaultPassword, '+250 788 555 777', true]
  );
  const pendingUserId = pendingUserRes.rows[0].id;

  await query(
    `INSERT INTO employers (user_id, company_name, industry, website, location, contact_person, description, logo_url, registration_doc_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      pendingUserId,
      'Inyange Logistics Distribution Ltd',
      'Transportation & Logistics',
      'https://inyangeindustries.com',
      'Masaka, Kicukiro, Kigali',
      'Jean Bosco Hakizimana',
      'Refrigerated milk and beverage distribution network supplying retail stores and regional markets across Eastern and Northern provinces.',
      '',
      '/uploads/documents/inyange_logistics_registration.pdf'
    ]
  );

  // Admin notification for pending review
  await query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      adminId,
      'New Business Verification Request',
      'Inyange Logistics Distribution Ltd registered and submitted incorporation documents for verification.',
      'employer_approval',
      '/admin'
    ]
  );

  // 4. Sample Job Seeker: Eric Manzi
  const seekerUserRes = await query(
    `INSERT INTO users (role, status, name, email, password_hash, phone, terms_accepted)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    ['employee', 'approved', 'Eric Manzi', 'eric.manzi@example.rw', defaultPassword, '+250 788 333 222', true]
  );
  const seekerUserId = seekerUserRes.rows[0].id;

  await query(
    `INSERT INTO job_seekers (user_id, national_id, date_of_birth, education_level, location, headline, bio, skills, resume_url, portfolio_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      seekerUserId,
      '1199880012345678',
      '1998-05-14',
      'TVET Hospitality Certificate',
      'Gasabo, Kigali',
      'Food & Beverage Service Specialist',
      'Experienced waiter with 2 years in customer hospitality and event catering.',
      'Customer Care, Table Service, English, Kinyarwanda, Cash Handling',
      '/uploads/resumes/eric_manzi_cv.pdf',
      ''
    ]
  );

  console.log('[Seed] Database seeded with realistic baseline: Admin, Kigali Serena Hotel (3 positions), pending employer (Inyange Logistics), and candidate Eric Manzi.');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}

module.exports = { seed };
