import Link from 'next/link';

const groups = [
  {
    title: 'SETTINGS',
    items: [
      ['Account', 'Manage your profile and account information', '/settings/account'],
      ['Notifications', 'Control what Skillshot notifies you about', '/settings/notifications'],
      ['Appearance', 'Choose light, dark, or system theme', '/settings/appearance'],
      ['Privacy', 'Understand your profile and content visibility', '/settings/privacy'],
      ['Security', 'Manage your account security and authentication', '/settings/security'],
      ['Trusted Contributor', 'View requirements and your application status', '/settings/trusted-contributor'],
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      ['Help Center', 'Learn how to use Skillshot and find answers', '/help'],
      ['Report a Problem', 'Report an issue or request help from our team', '/support/report'],
      ['Community Guidelines', 'Read our community rules and safety policies', '/community-guidelines'],
      ['Contact Support', 'Get in touch with the Skillshot support team', '/support/contact'],
    ],
  },
  {
    title: 'ABOUT',
    items: [
      ['About Skillshot', 'The vision and community behind Skillshot', '/about'],
      ['Terms', 'Read our terms of service', '/terms'],
      ['Privacy Policy', 'How we handle and protect your data', '/privacy'],
    ],
  },
];

export default function Page() {
  return <>
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
  </>;
}
