import { Suspense } from 'react';
import PublicNavbar from '../components/public-navbar';
import AdvancedSearch from '../components/advanced-search';
export const dynamic = 'force-dynamic';
export default function SearchPage() {
  return <main><PublicNavbar returnTo="/search"/><div className="searchPage shell"><h1>Find your next inspiration.</h1><Suspense fallback={<p>Loading search…</p>}><AdvancedSearch/></Suspense></div></main>;
}
