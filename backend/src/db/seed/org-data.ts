/* Organisation seed data, copied from the prototype (frontend/src/data/seed.ts).
   Development and test data only — there is no production directory yet. */

export interface SeedUser {
  id: string; facilityId: string; empCode: string; name: string;
  role: "director" | "functional_head" | "business_head" | "manager" | "accounts_executive" | "staff";
  title: string; dealershipIds: string[]; deptId: string | null; noLogin?: boolean;
}

export const SEED_DEALERSHIPS = [
  { id: "D_MAH_CHK", short: "MCH", name: "Mahindra Chikalthana", brand: "Mahindra", code: "MAH-CSN-01", headId: "U_RAJ", territory: ["Chhatrapati Sambhajinagar", "Jalna"], active: true },
  { id: "D_MAH_BBP", short: "MBB", name: "Mahindra Beedbypass", brand: "Mahindra", code: "MAH-CSN-02", headId: null, territory: ["Chhatrapati Sambhajinagar"], active: false, note: "Operational Mar 2027" },
  { id: "D_HMSI", short: "HMS", name: "HMSI", brand: "Honda 2-Wheelers", code: "HMSI-CSN-01", headId: "U_VIS", territory: ["Chhatrapati Sambhajinagar"], active: true },
  { id: "D_CL", short: "CLG", name: "Classic Legends", brand: "Classic Legends", code: "CL-CSN-01", headId: "U_VIS", territory: ["Chhatrapati Sambhajinagar"], active: true, note: "Support staff shared with HMSI" },
  { id: "D_JCB_CSN", short: "JCS", name: "JCB CSN", brand: "JCB", code: "JCB-CSN-01", headId: "U_PRA", territory: ["Chhatrapati Sambhajinagar", "Ahilyanagar", "Beed", "Jalna"], active: true },
  { id: "D_JCB_NSK", short: "JNS", name: "JCB Nashik", brand: "JCB", code: "JCB-NSK-01", headId: "U_SAM", territory: ["Nashik", "Dhule", "Nandurbar", "Jalgaon"], active: true },
  { id: "D_MTB", short: "MTB", name: "MTB", brand: "Mahindra Trucks & Bus", code: "MTB-CSN-01", headId: "U_VIJ", territory: ["Chhatrapati Sambhajinagar", "Beed", "Jalna", "Nanded", "Parbhani", "Latur", "Osmanabad", "Hingoli"], active: true },
  { id: "D_CORP", short: "COR", name: "Corporate", brand: "Group", code: "RPW-CORP", headId: "U_ARJ", territory: [], active: true, isCorporate: true },
];

export const SEED_FACILITIES = [
  { id: "F01", dealershipId: "D_JCB_NSK", name: "Nashik", type: "3S facility", district: "Nashik", active: true },
  { id: "F02", dealershipId: "D_JCB_NSK", name: "Dhule", type: "Service outlet", district: "Dhule", active: true },
  { id: "F03", dealershipId: "D_JCB_NSK", name: "Jalgaon", type: "Service outlet", district: "Jalgaon", active: true },
  { id: "F04", dealershipId: "D_JCB_NSK", name: "Nandurbar", type: "Parts outlet", district: "Nandurbar", active: true },
  { id: "F05", dealershipId: "D_JCB_NSK", name: "Yeola", type: "Parts outlet", district: "Nashik", active: true },
  { id: "F06", dealershipId: "D_JCB_NSK", name: "Satana", type: "Parts outlet", district: "Nashik", active: true },
  { id: "F07", dealershipId: "D_JCB_CSN", name: "Chikalthana", type: "3S facility", district: "Chhatrapati Sambhajinagar", active: true },
  { id: "F08", dealershipId: "D_MAH_CHK", name: "Chikalthana", type: "3S facility", district: "Chhatrapati Sambhajinagar", active: true },
  { id: "F09", dealershipId: "D_MAH_CHK", name: "Jalna", type: "Sales outlet", district: "Jalna", active: true },
  { id: "F15", dealershipId: "D_MAH_CHK", name: "Adalat Road showroom", type: "Sales outlet", district: "Chhatrapati Sambhajinagar", active: true },
  { id: "F16", dealershipId: "D_MAH_CHK", name: "Waluj workshop", type: "Service outlet", district: "Chhatrapati Sambhajinagar", active: true },
  { id: "F10", dealershipId: "D_HMSI", name: "CSN Main", type: "3S facility", district: "Chhatrapati Sambhajinagar", active: true },
  { id: "F11", dealershipId: "D_CL", name: "CSN Jawa/Yezdi", type: "Sales outlet", district: "Chhatrapati Sambhajinagar", active: true },
  { id: "F12", dealershipId: "D_MTB", name: "CSN Main", type: "3S facility", district: "Chhatrapati Sambhajinagar", active: true },
  { id: "F13", dealershipId: "D_MTB", name: "Nanded", type: "Service outlet", district: "Nanded", active: true },
  { id: "F14", dealershipId: "D_CORP", name: "RPW Head Office", type: "Corporate office", district: "Chhatrapati Sambhajinagar", active: true },
] as const;

export const SEED_DEPARTMENTS = [
  { id: "DEP_IT", name: "IT", dualAuthority: true, functionalHeadId: "U_SUNIL", active: true },
  { id: "DEP_ADM", name: "Admin", dualAuthority: true, functionalHeadId: "U_PARESH", active: true },
  { id: "DEP_HR", name: "HR", dualAuthority: true, functionalHeadId: "U_SILKI", active: true },
  { id: "DEP_ACC", name: "Accounts", dualAuthority: true, functionalHeadId: "U_SUJAY", active: true },
  { id: "DEP_SAL", name: "Sales", dualAuthority: false, functionalHeadId: null, active: true },
  { id: "DEP_SER", name: "Service", dualAuthority: false, functionalHeadId: null, active: true },
  { id: "DEP_PRT", name: "Parts", dualAuthority: false, functionalHeadId: null, active: true },
  { id: "DEP_BO", name: "Back Office", dualAuthority: false, functionalHeadId: null, active: true },
  { id: "DEP_CRM", name: "CRM", dualAuthority: false, functionalHeadId: null, active: true },
];

export const SEED_USERS: SeedUser[] = [
  { id: "U_ARJ", facilityId: "F14", empCode: "RPW-EMP-0001", name: "Arjun", role: "director", title: "Director", dealershipIds: ["D_CORP"], deptId: null },
  { id: "U_SUNIL", facilityId: "F14", empCode: "RPW-EMP-0012", name: "Sunil Raut", role: "functional_head", title: "IT Head", dealershipIds: ["D_CORP"], deptId: "DEP_IT" },
  { id: "U_PARESH", facilityId: "F14", empCode: "RPW-EMP-0018", name: "Paresh Jain", role: "functional_head", title: "Admin Manager", dealershipIds: ["D_CORP"], deptId: "DEP_ADM" },
  { id: "U_SUJAY", facilityId: "F14", empCode: "RPW-EMP-0007", name: "Sujay Kathar", role: "functional_head", title: "GM – Accounts & Finance", dealershipIds: ["D_CORP"], deptId: "DEP_ACC" },
  { id: "U_SILKI", facilityId: "F14", empCode: "RPW-EMP-0009", name: "Silki Monga", role: "functional_head", title: "HR Head", dealershipIds: ["D_CORP"], deptId: "DEP_HR" },
  { id: "U_RAJ", facilityId: "F08", empCode: "RPW-EMP-0031", name: "Rajendra Shukla", role: "business_head", title: "Business Head – Mahindra", dealershipIds: ["D_MAH_CHK"], deptId: null },
  { id: "U_VIS", facilityId: "F10", empCode: "RPW-EMP-0034", name: "Vishal Dubey", role: "business_head", title: "Business Head – HMSI & Classic Legends", dealershipIds: ["D_HMSI", "D_CL"], deptId: null },
  { id: "U_PRA", facilityId: "F07", empCode: "RPW-EMP-0040", name: "Prashant Choudary", role: "business_head", title: "Business Head – JCB CSN", dealershipIds: ["D_JCB_CSN"], deptId: null },
  { id: "U_SAM", facilityId: "F01", empCode: "RPW-EMP-0052", name: "Sambhaji Deshmukh", role: "business_head", title: "Business Head – JCB Nashik", dealershipIds: ["D_JCB_NSK"], deptId: null },
  { id: "U_VIJ", facilityId: "F12", empCode: "RPW-EMP-0044", name: "Vijay Chavan", role: "business_head", title: "Business Head – MTB", dealershipIds: ["D_MTB"], deptId: null },
  { id: "U_NIL", facilityId: "F01", empCode: "RPW-EMP-0187", name: "Nilesh Jadhav", role: "manager", title: "IT Manager – JCB Nashik", dealershipIds: ["D_JCB_NSK"], deptId: "DEP_IT" },
  { id: "U_ANI", facilityId: "F08", empCode: "RPW-EMP-0121", name: "Anita Rane", role: "manager", title: "HR Manager – Mahindra Chikalthana", dealershipIds: ["D_MAH_CHK"], deptId: "DEP_HR" },
  { id: "U_KIR", facilityId: "F12", empCode: "RPW-EMP-0209", name: "Kiran Sable", role: "manager", title: "Admin Manager – MTB", dealershipIds: ["D_MTB"], deptId: "DEP_ADM" },
  { id: "U_DEE", facilityId: "F01", empCode: "RPW-EMP-0166", name: "Deepak Kulkarni", role: "manager", title: "Accounts Manager – JCB Nashik", dealershipIds: ["D_JCB_NSK"], deptId: "DEP_ACC" },
  { id: "U_SWA", facilityId: "F08", empCode: "RPW-EMP-0133", name: "Swati Joshi", role: "manager", title: "Accounts Manager – Mahindra Chikalthana", dealershipIds: ["D_MAH_CHK"], deptId: "DEP_ACC" },
  { id: "U_RAM", facilityId: "F12", empCode: "RPW-EMP-0215", name: "Ramesh Pawar", role: "manager", title: "Accounts Manager – MTB", dealershipIds: ["D_MTB"], deptId: "DEP_ACC" },
  { id: "U_POO", facilityId: "F01", empCode: "RPW-EMP-0301", name: "Pooja Bhosale", role: "accounts_executive", title: "Accounts Executive – JCB Nashik", dealershipIds: ["D_JCB_NSK"], deptId: "DEP_ACC" },
  { id: "U_NIT", facilityId: "F08", empCode: "RPW-EMP-0288", name: "Nitin Gore", role: "accounts_executive", title: "Accounts Executive – Mahindra Chikalthana", dealershipIds: ["D_MAH_CHK"], deptId: "DEP_ACC" },
  { id: "U_SAR", facilityId: "F12", empCode: "RPW-EMP-0312", name: "Sarita Kale", role: "accounts_executive", title: "Accounts Executive – MTB", dealershipIds: ["D_MTB"], deptId: "DEP_ACC" },
  /* Frontline staff: directory records with no platform login. Assets can be issued to
     them, but they acknowledge by signature at handover rather than in the app. */
  { id: "S_001", facilityId: "F01", empCode: "RPW-EMP-0421", name: "Ganesh Shinde", role: "staff", title: "Service Advisor – JCB Nashik", dealershipIds: ["D_JCB_NSK"], deptId: "DEP_SER", noLogin: true },
  { id: "S_002", facilityId: "F02", empCode: "RPW-EMP-0455", name: "Rahul Waghmare", role: "staff", title: "Technician – JCB Nashik", dealershipIds: ["D_JCB_NSK"], deptId: "DEP_SER", noLogin: true },
  { id: "S_003", facilityId: "F15", empCode: "RPW-EMP-0388", name: "Pooja Deshpande", role: "staff", title: "Sales Consultant – Mahindra Chikalthana", dealershipIds: ["D_MAH_CHK"], deptId: "DEP_SAL", noLogin: true },
  { id: "S_004", facilityId: "F13", empCode: "RPW-EMP-0502", name: "Imran Shaikh", role: "staff", title: "Spare Parts Executive – MTB", dealershipIds: ["D_MTB"], deptId: "DEP_PRT", noLogin: true },
];

/* Powers the prototype hardcoded by user ID (GM Finance, IT Head, Admin Manager) */
export const SEED_GRANTS: Record<string, ("finance_signoff" | "dispose_assets" | "admin_console")[]> = {
  U_SUJAY: ["finance_signoff", "dispose_assets"],
  U_SUNIL: ["admin_console"],
  U_PARESH: ["admin_console"],
};
