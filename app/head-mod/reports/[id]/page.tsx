import ReportCaseRoute from '../../../components/report-case-route';
export default async function Page({params}:{params:Promise<{id:string}>}) {return <ReportCaseRoute kind="head-mod" id={(await params).id}/>;}
