import StaffLayout from '../components/staff-layout';
import '../staff.css';
export default function Layout({ children }: { children: React.ReactNode }) { return <StaffLayout kind="mod">{children}</StaffLayout>; }
