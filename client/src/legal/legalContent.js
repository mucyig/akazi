// ─────────────────────────────────────────────────────────────────────────────
// Akazi legal text. EDIT THE VALUES BELOW so they match your real company,
// then have a Rwandan lawyer review the page before you rely on it.
// ─────────────────────────────────────────────────────────────────────────────
export const COMPANY = {
  name: 'Akazi',                      // CONFIRM: your registered legal name, e.g. "Akazi Ltd"
  email: 'support@akazi.rw',          // CONFIRM: a mailbox you actually read
  address: 'Kigali, Rwanda',          // CONFIRM: your registered address
  fee: '5,000 RWF',                   // must match PAYPACK_EMPLOYER_FEE_RWF on the server
  updated: '2026-10-10',              // change this date whenever the text changes (YYYY-MM-DD)
  responseDays: 30,                   // how fast you promise to answer privacy requests
  applicationRetentionMonths: 24,     // CONFIRM: how long applications are kept after a job closes
};

// The short version, shown at the top of the page
export const HIGHLIGHTS = [
  { icon: 'shield', en: 'Every employer is checked by our team before they can hire.', rw: 'Buri mukoresha asuzumwa n’itsinda ryacu mbere y’uko ahabwa uburenganzira bwo gushaka abakozi.' },
  { icon: 'ban', en: 'Nobody should pay to get a job. If an employer asks you for money, report it to us.', rw: 'Nta muntu ukwiye kwishyura ngo abone akazi. Nihagira umukoresha ugusaba amafaranga, bitumenyeshe.' },
  { icon: 'lock', en: 'Your CV and documents are private. Only the employers you apply to can open them.', rw: 'CV n’inyandiko zawe ni ibanga. Abakoresha usabye akazi gusa ni bo bashobora kuzifungura.' },
  { icon: 'eye', en: 'We do not sell your data and we do not use advertising trackers.', rw: 'Ntitugurisha amakuru yawe kandi ntidukoresha ibikurikirana ku bw’amatangazo.' },
  { icon: 'user', en: 'You can ask us to correct or delete your data at any time.', rw: 'Ushobora kudusaba gukosora cyangwa gusiba amakuru yawe igihe icyo ari cyo cyose.' },
];

const c = COMPANY;

// Block types: p (paragraph), ul (list), callout (tone: info | warn), table (head + rows)
export const TERMS = {
  id: 'terms',
  label: { en: 'Terms of Use', rw: 'Amategeko yo gukoresha' },
  sections: [
    {
      id: 'about', title: { en: 'About these terms', rw: 'Ibyerekeye aya mategeko' },
      blocks: [
        { type: 'p', text: `Akazi is an online platform, operated by ${c.name}, that connects job seekers with verified employers in Rwanda. These terms are the agreement between you and ${c.name} when you create an account or use the website.` },
        { type: 'p', text: 'By creating an account, or by using Akazi, you confirm that you have read these terms and the Privacy Policy and that you accept them. If you do not accept them, please do not use Akazi.' },
        { type: 'p', text: 'You must be at least 18 years old to use Akazi.' },
      ],
    },
    {
      id: 'accounts', title: { en: 'Your account', rw: 'Konti yawe' },
      blocks: [
        { type: 'ul', items: [
          'Give accurate, complete and current information, and keep it up to date.',
          'Keep one account per person or business. Do not create accounts for other people without their permission.',
          'Keep your password private. You are responsible for what happens under your account, so tell us straight away if you think someone else has used it.',
          'We may ask you to confirm your email address and, for employers, to provide business documents.',
        ] },
      ],
    },
    {
      id: 'seekers', title: { en: 'For job seekers', rw: 'Ku bashaka akazi' },
      blocks: [
        { type: 'ul', items: [
          'Applying is free. Akazi never charges job seekers.',
          'Everything you put in an application must be true. Do not claim qualifications or experience you do not have.',
          'When you apply, the employer can see the details you submit: your name, email, phone number, gender, CV, answers and attachments.',
          'Messaging opens only after an employer approves your application, and the employer writes first.',
          'Interview times are shown in Rwanda time (CAT, UTC+2). Please check the date and time carefully.',
          'Akazi does not guarantee that you will receive interviews or a job.',
        ] },
        { type: 'callout', tone: 'warn', text: 'Never pay anyone to get a job, interview or placement. No genuine employer on Akazi may ask you for money. If one does, stop and report it to us.' },
      ],
    },
    {
      id: 'employers', title: { en: 'For employers', rw: 'Ku bakoresha' },
      blocks: [
        { type: 'ul', items: [
          'You must be authorised to act for the business you register and must upload a genuine registration document.',
          'Our team reviews every employer. We can approve, decline or ask for more information, and we do not have to give detailed reasons.',
          `After approval you pay a one-time verification fee of ${c.fee} to activate your account (see "Verification fee and payments").`,
          'Job posts must be real, accurate and lawful. Describe the role, location, pay and requirements honestly.',
          'You must not discriminate on the basis of gender, ethnicity, religion, disability, age or other protected grounds, and you must follow Rwandan labour law.',
          'You may use applicants’ personal data only to assess and contact them about the job they applied for. Do not share it, sell it, or use it for marketing.',
          'You must never ask a candidate for money, deposits, "training fees" or personal banking details.',
        ] },
      ],
    },
    {
      id: 'payments', title: { en: 'Verification fee and payments', rw: 'Amafaranga yo kwemeza n’ubwishyu' },
      blocks: [
        { type: 'p', text: `The employer verification fee is ${c.fee}, paid once, by mobile money (MTN or Airtel) through our payment partner PayPack. You approve the payment on your own phone. We never see or store your mobile money PIN.` },
        { type: 'ul', items: [
          'Your account is activated only when the payment is confirmed by the payment provider. This usually takes a minute.',
          'If you were charged but your account was not activated, contact us with your payment reference and we will fix it or refund you.',
          'The fee is not refunded once your account has been activated, unless we made a mistake or the law requires it.',
          'If we change the fee, the new amount applies to new employers only. Anyone who has already paid is not charged again.',
        ] },
      ],
    },
    {
      id: 'conduct', title: { en: 'Rules of conduct', rw: 'Amabwiriza y’imyitwarire' },
      blocks: [
        { type: 'p', text: 'You agree not to:' },
        { type: 'ul', items: [
          'post fake, misleading or illegal jobs, or run scams of any kind;',
          'ask for or take money from candidates;',
          'harass, threaten, insult or discriminate against anyone;',
          'pretend to be another person or business;',
          'upload viruses, or try to break into, overload or scrape the service;',
          'collect other people’s details for any purpose other than hiring;',
          'send spam, or share adult, violent or hateful content.',
        ] },
      ],
    },
    {
      id: 'messages', title: { en: 'Messages and interviews', rw: 'Ubutumwa n’ibiganiro by’akazi' },
      blocks: [
        { type: 'p', text: 'Messages are stored so that both people can read the conversation. We do not read private messages as a routine. We may review them if someone reports a problem, to keep people safe, or if the law requires it.' },
        { type: 'p', text: 'Keep conversations respectful and about the job. Interviews and any agreement you reach are between you and the other person; Akazi is not a party to them.' },
      ],
    },
    {
      id: 'content', title: { en: 'Your content', rw: 'Ibyo utanga' },
      blocks: [
        { type: 'p', text: 'You keep ownership of your CV, documents, job posts and messages. You give us permission to store them and to show them to the people they are meant for (for example, the employer you apply to), only so we can run Akazi. We may remove content that breaks these terms.' },
      ],
    },
    {
      id: 'moderation', title: { en: 'Our right to act', rw: 'Uburenganzira bwacu bwo gukumira' },
      blocks: [
        { type: 'p', text: 'To protect users we may remove a job post, decline an employer, or suspend or close an account that breaks these terms, looks fraudulent, or puts others at risk. Where it is reasonable, we will tell you why. You can ask us to review a decision by writing to us.' },
      ],
    },
    {
      id: 'disclaimer', title: { en: 'What Akazi is, and is not', rw: 'Akazi icyo ari cyo n’icyo kitari cyo' },
      blocks: [
        { type: 'p', text: 'Akazi is a platform that helps people find each other. We are not an employer, a recruitment agent, or a party to any job offer or contract. Employer verification is a check of the documents provided; it is not a guarantee of an employer’s conduct, and it is not an endorsement.' },
        { type: 'p', text: 'We work hard to keep Akazi available and accurate, but we provide it "as is" and cannot promise it will always be uninterrupted or free of errors.' },
      ],
    },
    {
      id: 'api', title: { en: 'Developer API & Partner Use', rw: 'Amategeko y�abatekinisiye (Developer API)' },
      blocks: [
        { type: 'p', text: 'Akazi provides a public developer API to enable partners, Telegram/WhatsApp bots, and educational portals to display verified job listings in Rwanda.' },
        { type: 'ul', items: [
          'Attribution: Any site, bot, or application using the API must clearly display \"Powered by Akazi.rw\" and link the apply action directly to the original Akazi job URL.',
          'Free Tier Limits: Free API keys are subject to strict rate limits (120 requests/hour) to protect platform stability. Circumventing limits, scraping, or attempting to harvest private data results in immediate key revocation.',
          'Commercial & Enterprise: High-volume usage, instant webhooks, and ATS automated posting require a Commercial or Enterprise agreement.',
          'Akazi reserves the right to modify, rate-limit, or terminate API access at any time to preserve system integrity.',
        ] },
      ],
    },
    {
      id: 'liability', title: { en: 'Limits of our responsibility', rw: 'Aho inshingano zacu zigarukira' },
      blocks: [
        { type: 'p', text: 'To the extent allowed by the laws of Rwanda, Akazi is not responsible for decisions or actions of employers or candidates, for losses that come from agreements made between users, or for indirect losses. Nothing in these terms removes any right you have under Rwandan law that cannot be removed, or limits liability that cannot lawfully be limited.' },
      ],
    },
    {
      id: 'ending', title: { en: 'Closing your account', rw: 'Gufunga konti' },
      blocks: [
        { type: 'p', text: `You can stop using Akazi at any time. To close your account and delete your data, email ${c.email}. We may suspend or close accounts as described above. Rules that are meant to continue (for example, about content, liability and disputes) continue after an account is closed.` },
      ],
    },
    {
      id: 'changes', title: { en: 'Changes to these terms', rw: 'Impinduka kuri aya mategeko' },
      blocks: [
        { type: 'p', text: 'We may update these terms. When the changes are important we will tell you by email or on the site before they apply. The date at the top of this page shows when the text last changed. If you keep using Akazi after a change, you accept the new terms.' },
      ],
    },
    {
      id: 'law', title: { en: 'Governing law and disputes', rw: 'Amategeko agenga n’ibibazo' },
      blocks: [
        { type: 'p', text: `These terms are governed by the laws of the Republic of Rwanda. If there is a problem, please write to us first at ${c.email} so we can try to resolve it. If we cannot, the competent courts of Rwanda will have jurisdiction.` },
      ],
    },
    {
      id: 'contact', title: { en: 'Contact', rw: 'Twandikire' },
      blocks: [
        { type: 'p', text: `${c.name}, ${c.address}. Email: ${c.email}.` },
      ],
    },
  ],
};

export const PRIVACY = {
  id: 'privacy',
  label: { en: 'Privacy Policy', rw: 'Politiki y’ibanga ry’amakuru' },
  sections: [
    {
      id: 'who', title: { en: 'Who we are', rw: 'Turi bande' },
      blocks: [
        { type: 'p', text: `${c.name} (${c.address}) decides how your personal data is used on Akazi and is responsible for protecting it. We follow Rwanda’s Law No. 058/2021 of 13/10/2021 relating to the protection of personal data and privacy. You can reach us at ${c.email}.` },
      ],
    },
    {
      id: 'collect', title: { en: 'What we collect', rw: 'Ibyo dukusanya' },
      blocks: [
        { type: 'table',
          head: ['Information', 'Examples', 'Who can see it'],
          rows: [
            ['Account details', 'Name, email, phone number, password (stored only in scrambled form)', 'You and Akazi administrators. Employers see your name, email and phone only when you apply.'],
            ['Job seeker profile', 'Gender, date of birth, education level, location, headline, skills, CV', 'You and administrators. Employers see the parts you send with an application, including your gender.'],
            ['Applications', 'Answers to questions, attachments, status, interview details', 'You and the employer you applied to, plus administrators.'],
            ['Messages', 'Chat messages with an employer or candidate', 'The two people in the conversation.'],
            ['Employer details', 'Company name, industry, website, location, registration document, logo', 'Administrators see the document. The company profile (not the document) is public.'],
            ['Payments', 'Mobile money number, amount, payment reference and status', 'You and administrators. We never receive your PIN or card details.'],
            ['Security records', 'IP address, sign-in attempts, and administrator actions', 'Administrators, for security and fraud prevention only.'],
          ] },
        { type: 'callout', tone: 'info', text: 'Please do not put your national ID number, bank details or health information in your CV or attachments. Employers do not need them to consider your application.' },
      ],
    },
    {
      id: 'use', title: { en: 'How we use your data', rw: 'Uko dukoresha amakuru yawe' },
      blocks: [
        { type: 'ul', items: [
          'to create and run your account and let you apply, post jobs and message (because you asked us to provide the service);',
          'to verify employers and protect users from scams (to prevent fraud and keep the platform safe);',
          'to take and confirm employer payments;',
          'to send emails you need: account confirmation, password reset and application results (and not marketing, unless you agree);',
          'to follow the law and answer legal requests.',
        ] },
        { type: 'p', text: 'We do not sell your personal data, and we do not use it for advertising.' },
      ],
    },
    {
      id: 'share', title: { en: 'Who we share it with', rw: 'Abo dusangiza amakuru yawe' },
      blocks: [
        { type: 'p', text: 'We share data only as needed to run Akazi:' },
        { type: 'ul', items: [
          'Employers you apply to receive what you send in your application.',
          'Administrators of Akazi can see data needed for verification, moderation and support.',
          'Service providers that work for us under agreement: Cloudflare (website delivery and private file storage), Render (our server), Resend (sending emails), PayPack (mobile money payments) and Google Fonts (the fonts you see; this means your browser contacts Google when a page loads).',
          'Authorities, when the law requires it or to protect people from serious harm.',
        ] },
      ],
    },
    {
      id: 'transfers', title: { en: 'Data outside Rwanda', rw: 'Amakuru ari hanze y’u Rwanda' },
      blocks: [
        { type: 'p', text: 'Some of our providers store or process data in other countries. When that happens we use providers with appropriate security commitments and share only what is necessary, in line with Rwandan data protection law.' },
      ],
    },
    {
      id: 'keep', title: { en: 'How long we keep it', rw: 'Igihe tuyabika' },
      blocks: [
        { type: 'ul', items: [
          'Account and profile: for as long as your account is open.',
          `Applications and messages: up to ${c.applicationRetentionMonths} months after the job closes, then deleted or anonymised.`,
          'Payment records: as long as the law requires us to keep financial records.',
          'Security records: for a limited period needed to detect and investigate abuse.',
          `When you ask us to delete your account, we delete or anonymise your personal data within ${c.responseDays} days, except what we must keep by law.`,
        ] },
      ],
    },
    {
      id: 'rights', title: { en: 'Your rights', rw: 'Uburenganzira bwawe' },
      blocks: [
        { type: 'p', text: 'You have the right to:' },
        { type: 'ul', items: [
          'know what data we hold about you and get a copy;',
          'have wrong data corrected;',
          'have your data deleted, or its use restricted, where the law allows;',
          'object to how we use your data, and withdraw consent you gave;',
          'receive your data in a common format;',
          'complain to the National Cybersecurity Authority (NCSA), Rwanda’s data protection supervisory authority, if you think we have not respected your rights.',
        ] },
        { type: 'p', text: `To use these rights, email ${c.email} from the address on your account. We reply within ${c.responseDays} days and may ask you to prove who you are first.` },
      ],
    },
    {
      id: 'security', title: { en: 'How we protect it', rw: 'Uko tuyarinda' },
      blocks: [
        { type: 'ul', items: [
          'Connections to Akazi are encrypted (HTTPS).',
          'Passwords are stored in scrambled form and cannot be read, even by us.',
          'CVs and business documents are kept in private storage. They open only through short-lived links, and only for people who are allowed to see them.',
          'Accounts are locked after repeated wrong passwords, and administrator actions are logged.',
        ] },
        { type: 'p', text: 'No online service is perfectly secure. If a breach seriously affects your data, we will tell you and the authorities as the law requires.' },
      ],
    },
    {
      id: 'cookies', title: { en: 'Cookies and browser storage', rw: 'Cookies n’ububiko bwo mu rubuga' },
      blocks: [
        { type: 'p', text: 'Akazi does not use advertising or tracking cookies. Your browser’s local storage holds only what the site needs to work: your sign-in session and your language choice. Signing out removes the session.' },
      ],
    },
    {
      id: 'children', title: { en: 'Age', rw: 'Imyaka' },
      blocks: [
        { type: 'p', text: `Akazi is for people aged 18 and over. If we learn that someone under 18 has an account, we will close it and delete their data. If you think this has happened, write to ${c.email}.` },
      ],
    },
    {
      id: 'updates', title: { en: 'Changes to this policy', rw: 'Impinduka kuri iyi politiki' },
      blocks: [
        { type: 'p', text: 'We may update this policy. We will tell you about important changes by email or on the site. The date at the top of the page shows the latest version.' },
      ],
    },
    {
      id: 'privacy-contact', title: { en: 'Contact', rw: 'Twandikire' },
      blocks: [
        { type: 'p', text: `Questions about your data? Email ${c.email}, or write to ${c.name}, ${c.address}.` },
      ],
    },
  ],
};