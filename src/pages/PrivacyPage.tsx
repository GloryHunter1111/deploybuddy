import { CONTACT_EMAIL, PRIVACY_LAST_UPDATED } from '../lib/site'

const sections = [
  ['What we collect', 'We collect your email address and password, handled by our authentication provider Supabase; we never see passwords in plain text. We collect saved projects and scan results, the public GitHub repository URL you enter, and basic technical logs kept by our hosting provider. We may keep basic usage records, such as when a scan ran, whether it succeeded, how long it took, the framework detected, how many issues were found, whether you were signed in, and the type of any error. To apply a daily scan limit and prevent abuse, we also keep a scrambled code derived from your IP address (or your account ID if you are signed in) and the date. We do not store your IP address in these records, and they do not include the repository you scanned. Usage records are kept for as long as needed to run and protect the service.'],
  ['Repository data', 'Our server reads files from the public repository you enter through the GitHub API. We do not ask for access to private repositories. We keep only what you choose to save.'],
  ['Cookies and local storage', 'We use a sign-in session stored in your browser. There are no advertising cookies and no third-party analytics at present.'],
  ['How we use information', 'We use information to run your account, scan repositories, show your projects, keep the service secure, answer your messages, and manage subscriptions once paid plans exist. We do not sell personal information.'],
  ['Who else handles data', 'Supabase handles sign-in and the database, Netlify handles hosting and the scanning function, GitHub provides public repository data, and Lemon Squeezy handles payments as merchant of record under its own privacy policy. We do not store card details. Google provides the Gmail service that sends our sign-in and password reset emails, and hosts our optional feedback form. Anything you type into that form is stored by Google Forms and read by us. Links to external pages such as the form are covered by those sites’ own policies. These providers may process data in other countries. We may share information if the law requires it.'],
  ['How long we keep it', 'We keep information until you remove a project or ask us to delete your account. Some payment records may be kept by our payment provider where the law requires.'],
  ['Your choices', `Email ${CONTACT_EMAIL} to see, correct or delete your information.`],
  ['Security', 'We take reasonable steps, but no online service is completely secure. Use a strong, unique password.'],
  ['Children', 'DeployBuddy is not intended for children under 13.'],
  ['Changes', 'The date at the top shows the latest update.'],
  ['Contact', CONTACT_EMAIL],
]

export function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <p className="eyebrow">DeployBuddy</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">Privacy policy</h1>
      <p className="mt-5 text-sm text-zinc-500">Last updated: {PRIVACY_LAST_UPDATED}</p>
      <div className="mt-12 space-y-10 text-zinc-400">
        {sections.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="text-xl font-medium text-white">{heading}</h2>
            <p className="mt-3 leading-7">{body}</p>
          </section>
        ))}
      </div>
    </section>
  )
}
