import { LegalLayout } from '../components/LegalLayout'
import { CONTACT_EMAIL } from '../lib/site'

const sections = [
  ['What we collect', 'We collect your email address and password, handled by our authentication provider Supabase; we never see passwords in plain text. We collect saved projects and scan results, the public GitHub repository URL you enter, and basic technical logs kept by our hosting provider. We may keep basic usage records, such as when a scan ran, whether it succeeded, how long it took, the framework detected and the type of any error, to keep the service running and prevent abuse.'],
  ['Repository data', 'Our server reads files from the public repository you enter through the GitHub API. We do not ask for access to private repositories. We keep only what you choose to save.'],
  ['Cookies and local storage', 'We use a sign-in session stored in your browser. There are no advertising cookies and no third-party analytics at present.'],
  ['How we use information', 'We use information to run your account, scan repositories, show your projects, keep the service secure, answer your messages, and manage subscriptions once paid plans exist. We do not sell personal information.'],
  ['Who else handles data', 'Supabase handles sign-in and the database, Netlify handles hosting and the scanning function, GitHub provides public repository data, and Lemon Squeezy handles payments as merchant of record under its own privacy policy. We do not store card details. These providers may process data in other countries. We may share information if the law requires it.'],
  ['How long we keep it', 'We keep information until you remove a project or ask us to delete your account. Some payment records may be kept by our payment provider where the law requires.'],
  ['Your choices', `Email ${CONTACT_EMAIL} to see, correct or delete your information.`],
  ['Security', 'We take reasonable steps, but no online service is completely secure. Use a strong, unique password.'],
  ['Children', 'DeployBuddy is not intended for children under 13.'],
  ['Changes', 'The date at the top shows the latest update.'],
  ['Contact', CONTACT_EMAIL],
]

export function PrivacyPage() {
  return <LegalLayout title="Privacy policy">{sections.map(([heading, body]) => <section key={heading}><h2 className="text-xl font-medium text-white">{heading}</h2><p className="mt-3 leading-7">{body}</p></section>)}</LegalLayout>
}
