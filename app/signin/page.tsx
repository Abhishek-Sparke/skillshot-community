import AuthScreen, { type AuthPageParams } from '../components/auth-screen';

export default async function SignInPage({ searchParams }: { searchParams: Promise<AuthPageParams> }) {
  return <AuthScreen mode="signin" params={await searchParams}/>;
}
