import Link from 'next/link';

const groups = [
  {
    title: 'SETTINGS',
    items: [
      ['Account', 'Manage your profile and account information.', '/settings/account'],
      ['Notifications', 'Choose what you want to be notified about.', '/settings/notifications'],
      ['Appearance', 'Light, dark, or system theme.', '/settings/appearance'],
      ['Privacy', 'Control what information is public.', '/settings/privacy'],
      ['Security', 'Manage account security.', '/settings/security'],
      ['Trusted Contributor', 'Application and status.', '/settings/trusted-contributor'],
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      ['Help Center', 'Guides and answers to common questions.', '/help'],
      ['Report a Problem', 'Report a technical issue or bug.', '/support/report'],
      ['Contact Support', 'Get help with your account.', '/support/contact'],
    ],
  },
  {
    title: 'LEGAL',
    items: [
      ['Community Guidelines', 'Rules for safety and community conduct.', '/community-guidelines'],
      ['Privacy Policy', 'How your data is handled.', '/privacy'],
      ['Terms of Service', 'Platform terms and conditions.', '/terms'],
    ],
  },
];

export default function Page() {
  return (
    <>
      <h1>Settings &amp; Support</h1>
      {groups.map(({ title, items }) => (
        <section className="settingsSection" key={title}>
          <h2 className="eyebrow">{title}</h2>
          {items.map(([name, description, path]) => (
            <Link className="settingsRow" key={path} href={path}>
              <div>
                <strong>{name}</strong>
                <p>{description}</p>
              </div>
              <span aria-hidden="true">›</span>
            </Link>
          ))}
        </section>
      ))}
    </>
  );
}
