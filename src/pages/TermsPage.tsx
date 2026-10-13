import { LegalLayout } from '../components/LegalLayout'
import { CONTACT_EMAIL, PRO_PRICE_USD } from '../lib/site'

const sections = [
  ['What DeployBuddy is', 'DeployBuddy is a web app that scans public GitHub repositories for common deployment problems and shows a checklist. Signed-in users can save projects and results.'],
  ['Your account', 'Keep your login details safe. You are responsible for activity on your account.'],
  ['Acceptable use', 'Do not use DeployBuddy illegally, harm or overload the service, or access other users’ data.'],
  ['Results are guidance, not a guarantee', 'Automated checks cannot find every problem, and false alarms are possible. “No issues found” does not guarantee your deployment will succeed. You are responsible for your own code, deployments and secrets. If a secret is exposed, treat it as compromised and rotate it.'],
  ['Plans, billing and cancellation', `The Free plan costs nothing and includes one saved project. Pro, when available, is billed monthly at $${PRO_PRICE_USD} USD with unlimited saved projects. It renews monthly until you cancel; you can cancel any time and keep access until the end of the period you paid for. Payments are processed by Lemon Squeezy, the merchant of record, which handles payment collection and applicable taxes. DeployBuddy does not store card details. Pro features are delivered automatically online. Prices may change, with notice before a change affects your renewal.`],
  ['Refunds', `Contact ${CONTACT_EMAIL} within 14 days of a payment and we will review the request. This does not limit rights you have under the law where you live.`],
  ['Your content', 'You keep ownership of your code. We read only public repositories you ask us to scan and store only the results you choose to save.'],
  ['Availability and changes', 'There is no promise of uninterrupted service. Features and terms may change; the date at the top shows the latest update.'],
  ['Limitation of liability', 'DeployBuddy is provided “as is.” We are not liable for indirect or consequential loss. Total liability is limited to the amount you paid in the 3 months before the claim.'],
  ['Closing your account', `You can stop using DeployBuddy any time, or email ${CONTACT_EMAIL} to delete your account.`],
  ['Governing law', 'The laws of India apply. Contact us first to try to resolve a dispute.'],
  ['Contact', CONTACT_EMAIL],
]

export function TermsPage() {
  return <LegalLayout title="Terms of service">{sections.map(([heading, body]) => <section key={heading}><h2 className="text-xl font-medium text-white">{heading}</h2><p className="mt-3 leading-7">{body}</p></section>)}</LegalLayout>
}
