import { notFound,redirect } from 'next/navigation';
import PublicNavbar from '../../components/public-navbar';
import SupportForm from '../../components/support-form';
import { getPrincipal } from '../../../lib/authz';
export default async function Page({params}:{params:Promise<{kind:string}>}){const {kind}=await params;if(!['report','contact'].includes(kind))notFound();const user=await getPrincipal();if(!user||user.status!=='ACTIVE')redirect(`/signin?callbackUrl=/support/${kind}`);return <><PublicNavbar returnTo={`/support/${kind}`}/><main className="settingsPage shell"><h1>{kind==='report'?'Report a Problem':'Contact Support'}</h1><p>Your message goes to the Skillshot staff review inbox.</p><SupportForm mode={kind as 'report'|'contact'}/></main></>;}
