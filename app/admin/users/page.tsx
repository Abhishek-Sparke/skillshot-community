import { requirePanel } from '../../../lib/authz';import UserManager from '../../components/user-manager';
export default async function Page(){const principal=await requirePanel('admin');if(!principal.permissions.includes('users.view'))return null;return <UserManager/>}
