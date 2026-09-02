import AuthScreen, { type AuthPageParams } from '../components/auth-screen';

export default async function SignUpPage({ searchParams }: { searchParams: Promise<AuthPageParams> }) {
  return <AuthScreen mode="signup" params={await searchParams}/>;
}
