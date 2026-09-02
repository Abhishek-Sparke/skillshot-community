'use client';
import { StaffError } from '../components/staff-states';
export default function Error({reset}:{reset:()=>void}){return <StaffError retry={reset}/>;}
