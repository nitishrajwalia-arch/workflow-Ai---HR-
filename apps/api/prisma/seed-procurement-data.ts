/**
 * Procurement seed data, lifted verbatim from MarbellaProcurementOS.jsx.
 *
 * Same rule as the HR seed: the database starts out identical to the build the
 * client has already reviewed, so nothing they recognise moves.
 *
 * Money in these seeds is in RUPEES because that is how the file wrote it. The
 * seeder multiplies by 100 on the way in — the database stores paise, because
 * a purchase order is not a thing to hold approximately.
 */

/* eslint-disable */

/**
 * The source file pins its relative timestamps to load time. Seeded rows are
 * anchored to seed time instead, so "2 hours ago" reads correctly whenever the
 * database is first built.
 */
const _SN = Date.now();

/** Attendance row helpers, as the source file defines them. `ab` is a day absent. */
const rec = (date: string, i: string, o: string) => ({ date, in: i, out: o });
const ab = (date: string) => ({ date, in: null, out: null });

/** A small placeholder photo, as the source file ships it. */
const SEED_PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAB4CAIAAAD6wG44AAABuklEQVR42u3ZoU7DUBSAYcamEEhExRIEBEUmq1E8YR+CJyCI6SqCJICqqFjQOBLsIGTcrmU76/1+N8jo2i93vT1MHt/ejzTejl0CwAIswAIswAIswIAFWIAFWIAFWIABC7AAC7B22Sy3E26enyJ/vPnVwgoWYAEGLMACLMDyHDxcbdtm9RycHXBRFL6iBViABVhRd9Efr/fRzuTk4hanFQxYgAVYgBV5F324mUWPPLNoARZgARZgARZgwAIswIqYWXSszKL7ltssOjvgrtV1PdSfKsvSPViABViAAcsuesCmq+X6y8+zGzYjAf5Bu/5DzAf/Ff2rbuJvFR04xY/xSO7BO2uPs+iUQ49nFp2+NKer5YA3466z6KZp9nVoj0kCDNglACzA3UvfNxl3WMEKCZyyNC3fw17Bm/3o9m9WP9xt8bbr89Nhjfv/NynxRIr5ZWSP7Tg2AQc5MYv1v1ZwbiccfBYNuG/BZ9Ft8+IxSYAFGLAAC7AAC7AAC3COmUWP/NBm0X9kFq3QTaqqchVssgRYgAVYgAVYgAELsAALsAALsAADFmABFmABFmABFmDAAizAAizAAqxvfQEXnWBkHO+QXgAAAABJRU5ErkJggg==";

export const USERS: any = {
  admin:       { name: "Nitish Walia", role: "Chairman · Admin",   tier: 1, key: "admin", dept: "Admin" },
  purchase:    { name: "R. Khanna",    role: "Purchase Manager",   tier: 2, key: "purchase", dept: "Purchase" },
  store:       { name: "S. Verma",     role: "Store Manager",      tier: 2, key: "store", dept: "Store" },
  maintenance: { name: "M. Chauhan",   role: "Maintenance Lead",   tier: 2, key: "maintenance", dept: "Maintenance" },
  accounts:    { name: "P. Nair",      role: "Accounts Head",      tier: 2, key: "accounts", dept: "Accounts" },
  hr:          { name: "Simran Kaur",  role: "HR Head",            tier: 2, key: "hr", dept: "HR" },
  purchaseAsst:{ name: "A. Sethi",     role: "Purchase Assistant", tier: 3, key: "purchaseAsst", dept: "Purchase" },
  storeAsst:   { name: "D. Rana",      role: "Store Assistant",    tier: 3, key: "storeAsst", dept: "Store" },
  security:    { name: "Gate — Marbella Grand", role: "Security",          tier: 3, key: "security", dept: "Security" },
};

export const FIRMS: any = [
  { id: "grand", short: "Grand", name: "Marbella Grand", firm: "Delhi Punjab Real Estates LLP", gstin: "03AAEFD4921K1Z9", rera: "PBRERA-SAS79-PR0421", stage: "building",
    addr: "GHS 3, Sector 82-A, IT City Road, Sector 82, Sahibzada Ajit Singh Nagar, Punjab 140306, India" },
  { id: "twin", short: "Twin Towers", name: "Twin Towers", firm: "Delhi Punjab Real Estates LLP", gstin: "03AAEFD4921K1Z9", rera: "PBRERA-SAS79-PR0512", stage: "building",
    addr: "Marbella Twin Towers, 1st LOT, Main Road Sector 2, Madhya Marg, DLF Mullanpur, New Chandigarh, Punjab 140901" },
  { id: "curo", short: "Curo One", name: "Marbella Curo One", firm: "D.R. Developers & Colonisers", gstin: "03AAKFD3356N1ZB", rera: "PBRERA-SAS79-PR0338", stage: "building",
    addr: "1st LOT, Main Road Sector 2, Madhya Marg, DLF Mullanpur, New Chandigarh, Punjab 140901" },
  { id: "royce", short: "Royce", name: "Marbella Royce", firm: "D.R. Developers & Colonisers", gstin: "03AAKFD3356N1ZB", rera: "PBRERA-SAS79-PR0445", stage: "building",
    addr: "Site No. 7, Block C, Sector 83-A, IT City Road, Sahibzada Ajit Singh Nagar, Punjab 140306" },
  { id: "manifest", short: "Manifest", name: "Marbella Manifest", firm: "Des Raj Real Estates Pvt. Ltd.", gstin: "03AABCD7890P1ZR", rera: "applied · pre-launch", stage: "pre",
    addr: "SCO 2417-18, Sector 22-C, Chandigarh 160022" },
];

export const VENDORS: any = [ // 84 active — 14 shown
  { code: "MB-STL-0007", name: "RSW Steel Traders", cat: "Steel", terms: "30 days" },
  { code: "MB-STL-0014", name: "Jindal Panther (Auth. Dealer)", cat: "Steel", terms: "45 days" },
  { code: "MB-CEM-0003", name: "Ambuja Depot — Zirakpur", cat: "Cement", terms: "15 days" },
  { code: "MB-CEM-0009", name: "UltraTech — Kharar", cat: "Cement", terms: "30 days" },
  { code: "MB-RMC-0002", name: "Marbella RMC Plant", cat: "RMC", terms: "In-house" },
  { code: "MB-RMC-0005", name: "ACC Concrete", cat: "RMC", terms: "21 days" },
  { code: "MB-AGG-0011", name: "Shivalik Aggregates", cat: "Aggregate", terms: "COD" },
  { code: "MB-AGG-0018", name: "Nangal Sand Suppliers", cat: "Sand", terms: "COD" },
  { code: "MB-BRK-0004", name: "Kumar Brick & Block Kilns", cat: "Blocks", terms: "15 days" },
  { code: "MB-TIL-0021", name: "Kajaria Tiles — Panchkula", cat: "Finishes", terms: "30 days" },
  { code: "MB-MEP-0033", name: "Havells Electricals", cat: "MEP", terms: "45 days" },
  { code: "MB-LAB-0006", name: "Sharma Labour Contractors", cat: "Labour", terms: "Weekly" },
  { code: "MB-EQP-0012", name: "Gmmco Equipment Hire", cat: "Equipment", terms: "30 days" },
  { code: "MB-TRN-0005", name: "Malhotra Transport", cat: "Transport", terms: "45 days" },
];

export const SUB_SEED: any = [
  { id: "SUB-2087", title: "March steel invoices — Twin Towers", fromName: "R. Khanna", fromDept: "Purchase", to: "Accounts", status: "revised",
    versions: [
      { v: 1, fileName: "steel-invoices-mar.pdf", by: "R. Khanna", at: _SN - 3 * 864e5, note: "" },
      { v: 2, fileName: "steel-invoices-mar-REV.pdf", by: "R. Khanna", at: _SN - 3 * 864e5 + (3 * 3600e3 + 20 * 60e3), note: "Wrong GST on 2 bills — corrected and re-sent." },
    ] },
  { id: "SUB-2085", title: "Cement PO backup — Marbella Grand", fromName: "A. Sethi", fromDept: "Purchase", to: "Accounts", status: "sent",
    versions: [{ v: 1, fileName: "cement-po-grand.pdf", by: "A. Sethi", at: _SN - 26 * 3600e3, note: "" }] },
  { id: "SUB-2081", title: "Labour bills — April (Sharma Contractors)", fromName: "R. Khanna", fromDept: "Purchase", to: "Accounts", status: "sent",
    versions: [{ v: 1, fileName: "labour-bills-apr.pdf", by: "R. Khanna", at: _SN - 5 * 864e5, note: "" }] },
];

export const GATEPASS_SEED: any = [
  { id: "GP-4471", po: "PO-4471", vendor: "Jindal Panther (Auth. Dealer)", items: "TMT 550D — 120 T (Twin Towers · A)", total: 7800000, by: "R. Khanna", at: _SN - 2 * 3600e3, status: "expected" },
  { id: "GP-4468", po: "PO-4468", vendor: "UltraTech — Kharar", items: "OPC 53 — 4,000 bags", total: 1560000, by: "A. Sethi", at: _SN - 5 * 3600e3, status: "arrived" },
];

export const POS: any = [
  { id: "PO-4471", vendor: "Jindal Panther", item: "TMT 550D — 120 T (Twin Towers · A slab)", amt: 7800000, status: "Approved",
    del: { flag: "ok", who: "Balwinder Singh · PB-11-AC-4471", at: "12 Aug, 9:40 AM", got: "120 T", exp: "120 T", by: "R. Chauhan (Store)", note: "Weighbridge slip matched. 20 bundles, all tagged." } },
  { id: "PO-4468", vendor: "UltraTech — Kharar", item: "OPC 53 — 4,000 bags", amt: 1560000, status: "Received",
    del: { flag: "short", tag: "SHORT LOAD", who: "Manjeet Kumar · PB-65-AB-1189", at: "10 Aug, 7:15 AM", got: "3,860 bags", exp: "4,000 bags", short: 140, gap: -54600, by: "R. Chauhan (Store)", note: "140 bags short — 62 torn/caked bags rejected at gate, 78 never loaded. Vendor informed, credit note asked." } },
  { id: "PO-4462", vendor: "ACC Concrete", item: "M30 RMC — 900 m³", amt: 5850000, status: "Partial",
    del: { flag: "ok", who: "6 transit mixers · fleet", at: "14 Aug, 5:00 AM – 1:30 PM", got: "540 m³", exp: "900 m³", by: "K. Iyer (Site Engineer)", note: "Scheduled pour — balance 360 m³ on next slab cycle. Not a shortage." } },
  { id: "PO-4459", vendor: "Shivalik Aggregates", item: "20 mm aggregate — 600 m³", amt: 900000, status: "Approved",
    del: { flag: "over", tag: "OVER TIP", who: "Sukhdev Rana · HR-38-C-7702 (+2 tippers)", at: "9 Aug, 6:20 AM", got: "648 m³", exp: "600 m³", over: 48, gap: 72000, by: "R. Chauhan (Store)", note: "48 m³ extra tipped — driver dumped a third load before the gate check. Held: accept & amend PO, or return at vendor's cost." } },
  { id: "PO-4455", vendor: "Kajaria Tiles", item: "Vitrified 800×800 — 12,000 sq ft", amt: 4200000, status: "Pending",
    del: null },
  { id: "PO-4451", vendor: "Havells Electricals", item: "Cabling & DBs — Twin Towers · B", amt: 6620000, status: "Approved",
    del: { flag: "ok", who: "Vikas Sharma · CH-01-BX-3390", at: "11 Aug, 2:05 PM", got: "Full set", exp: "Full set", by: "A. Bedi (Store Asst)", note: "38 drums + 12 DBs. Serials logged, stored in Bay 3." } },
  { id: "PO-4447", vendor: "Gmmco Equipment", item: "Excavator + boom hire — Aug", amt: 1840000, status: "Received",
    del: { flag: "ok", who: "Operator: Ram Prasad", at: "1 Aug, 8:00 AM", got: "2 machines", exp: "2 machines", by: "K. Iyer (Site Engineer)", note: "On site since 1 Aug. Hour-meter photographed at handover." } },
  { id: "PO-4443", vendor: "Sharma Labour", item: "Structure gang — Jul", amt: 3175000, status: "Paid",
    del: { flag: "ok", who: "Gang of 42 · supervisor Om Prakash", at: "Jul · daily muster", at2: true, got: "1,164 man-days", exp: "1,150 man-days", by: "HR attendance", note: "14 extra man-days approved for the Sunday pour." } },
];

export const PR_SEED: any = [
  { id: "PR-1042", item: "Waterproofing membrane", qty: "600 sq ft", when: "In 2 days", proj: "Marbella Grand", by: "K. Iyer (Site Engineer)" },
  { id: "PR-1039", item: "Scaffolding couplers", qty: "400 nos", when: "This week", proj: "Twin Towers", by: "" },
];

export const REQUESTS: any = [
  { id: "RQ-2210", dept: "Marbella Grand · Structure", item: "Binding wire — 400 kg", qty: "400 kg" },
  { id: "RQ-2208", dept: "MEP", item: "Conduits + junction boxes", qty: "18 boxes" },
  { id: "RQ-2205", dept: "Maintenance", item: "DG set — filters + oil", qty: "2 sets" },
];

export const INVENTORY: any = [
  { item: "OPC 53 cement", unit: "bags", qty: 1240, reorder: 500, loc: "Grand · Yard", proj: "Marbella Grand" },
  { item: "TMT 550D steel", unit: "T", qty: 18.4, reorder: 10, loc: "Grand · Steel bay", proj: "Marbella Grand" },
  { item: "Binding wire", unit: "kg", qty: 120, reorder: 80, loc: "Grand · Store", proj: "Marbella Grand" },
  { item: "PVC conduits 25mm", unit: "nos", qty: 340, reorder: 150, loc: "Twin · MEP", proj: "Twin Towers" },
  { item: "Vitrified tiles 800×800", unit: "sq ft", qty: 2100, reorder: 1500, loc: "Curo · FG store", proj: "Marbella Curo One" },
  { item: "Emulsion paint", unit: "L", qty: 60, reorder: 40, loc: "Grand · Store", proj: "Marbella Grand" },
  { item: "Safety gloves", unit: "pairs", qty: 38, reorder: 100, loc: "Grand · PPE", proj: "Marbella Grand" },
  { item: "DG oil 15W40", unit: "L", qty: 20, reorder: 40, loc: "Grand · Basement", proj: "Marbella Grand" },
  { item: "Aggregate 20mm", unit: "m³", qty: 85, reorder: 50, loc: "Grand · Yard", proj: "Marbella Grand" },
];

export const HOLDS_SEED: any = [
  { id: "HD-311", item: "TMT 550D steel", qty: 6, unit: "T", days: 10, by: "R. Khanna · Purchase Manager", why: "Twin Towers B slab is likely to pull forward — keep it back.", at: Date.now() - 1000*60*60*20 },
];

export const MOVES_SEED: any = [
  { at: Date.now() - 1000*60*60*6,  dir: "in",  item: "OPC 53 cement", qty: 3860, unit: "bags", ref: "PO-4468", bill: "INV-8841", who: "R. Chauhan (Store)", note: "Short load — 140 bags less" },
  { at: Date.now() - 1000*60*60*30, dir: "in",  item: "TMT 550D steel", qty: 120, unit: "T", ref: "PO-4471", bill: "INV-8836", who: "R. Chauhan (Store)", note: "Weighbridge matched" },
  { at: Date.now() - 1000*60*60*52, dir: "out", item: "OPC 53 cement", qty: 900, unit: "bags", ref: "RQ-2210", bill: "", who: "K. Iyer (Site Engineer)", note: "Basement raft pour" },
  { at: Date.now() - 1000*60*60*70, dir: "in",  item: "20 mm aggregate", qty: 648, unit: "m³", ref: "PO-4459", bill: "INV-8829", who: "R. Chauhan (Store)", note: "Over tip — 48 m³ extra" },
  { at: Date.now() - 1000*60*60*96, dir: "out", item: "Binding wire", qty: 60, unit: "kg", ref: "RQ-2204", bill: "", who: "Structure gang", note: "" },
];

export const GATELOG_SEED: any = [
  { id: "GT-4407", at: Date.now() - 1000 * 60 * 52, outcome: "deny", label: "Walk-in — scrap buyer, no appointment", plate: "PB11AC7745", guard: "Balbir Singh", guardId: "MB-SEC-0001", post: "Marbella Grand · Main Gate", who: "R. Khanna · Purchase Manager", ev: 2, note: "Asked for the site supervisor by name. Nobody expecting him." },
  { id: "GT-4405", at: Date.now() - 1000 * 60 * 60 * 3.5, outcome: "deny", label: "Nangal Sand Suppliers — unscheduled tipper", plate: "PB65AH2210", guard: "Balbir Singh", guardId: "MB-SEC-0001", post: "Marbella Grand · Main Gate", who: "S. Verma · Store Manager", ev: 3, note: "Sand not ordered for today. Sent back, vendor informed." },
  { id: "GT-4402", at: Date.now() - 1000 * 60 * 60 * 6, outcome: "permit", label: "UltraTech — Kharar · PO-4468", plate: "PB65AB1189", guard: "Balbir Singh", guardId: "MB-SEC-0001", post: "Marbella Grand · Main Gate", who: "R. Khanna · Purchase Manager", ev: 2, note: "" },
];

export const CAPS_SEED: any = [
  { item: "OPC 53 cement", proj: "Marbella Grand", max: 2000, unit: "bags", why: "Yard shed holds no more; bags cake in the monsoon." },
  { item: "TMT 550D steel", proj: "Marbella Grand", max: 25, unit: "T", why: "Steel bay capacity." },
];

export const INVOICES_SEED: any = [
  { id: "INV-88213", from: "billing@jindalpanther.in", vendor: "Jindal Panther", subj: "Tax Invoice · TMT 550D · 40 T", amt: 2600000, po: "PO-4471", gstin: true, age: "2 h", state: "toclear" },
  { id: "INV-88207", from: "accounts@ultratechkharar.com", vendor: "UltraTech — Kharar", subj: "Invoice OPC 53 — 4,000 bags", amt: 1560000, po: "PO-4468", gstin: true, age: "5 h", state: "toclear" },
  { id: "INV-88198", from: "sales@accconcrete.co.in", vendor: "ACC Concrete", subj: "RMC M30 — part supply", amt: 1950000, po: "PO-4462", gstin: true, age: "yest", state: "toclear" },
  { id: "INV-88191", from: "malhotra.transport@gmail.com", vendor: "Malhotra Transport", subj: "Freight — July trips", amt: 620000, po: null, gstin: false, age: "2 d", state: "flag" },
  { id: "INV-88184", from: "havells.dealer@outlook.com", vendor: "Havells Electricals", subj: "Cabling & DBs — Twin Towers · B", amt: 6620000, po: "PO-4451", gstin: true, age: "3 d", state: "toclear" },
];

export const EXP_SEED: any = [
  { id: "EX-9051", cat: "Material", dept: "Purchase", amt: 1560000, party: "UltraTech — Kharar", date: "10 Aug", src: "PO-4468", how: "pdf", ok: true },
  { id: "EX-9050", cat: "Material", dept: "Purchase", amt: 7800000, party: "Jindal Panther", date: "12 Aug", src: "PO-4471", how: "pdf", ok: true },
  { id: "EX-9049", cat: "Salaries", dept: "HR", amt: 4180000, party: "July payroll · 65 people", date: "01 Aug", src: "Payroll run", how: "sheet", ok: true },
  { id: "EX-9048", cat: "Equipment", dept: "Site Engineering", amt: 1840000, party: "Gmmco Equipment Hire", date: "01 Aug", src: "PO-4447", how: "pdf", ok: true },
  { id: "EX-9047", cat: "Subscriptions", dept: "Accounts", amt: 42000, party: "Tally · annual renewal", date: "28 Jul", src: "Email receipt", how: "email", ok: true },
  { id: "EX-9046", cat: "Subscriptions", dept: "Admin", amt: 18600, party: "Google Workspace", date: "26 Jul", src: "Email receipt", how: "email", ok: true },
  { id: "EX-9045", cat: "Interest paid", dept: "Accounts", amt: 962000, party: "HDFC · project facility", date: "05 Aug", src: "Bank statement", how: "zip", ok: true },
  { id: "EX-9044", cat: "Bank charges", dept: "Accounts", amt: 8450, party: "HDFC · NEFT + cheque return", date: "05 Aug", src: "Bank statement", how: "zip", ok: true },
  { id: "EX-9043", cat: "Canteen & food", dept: "Site Engineering", amt: 128400, party: "Site canteen · Grand", date: "31 Jul", src: "Monthly bill", how: "photo", ok: true },
  { id: "EX-9042", cat: "Grocery", dept: "Admin", amt: 34700, party: "Guest house supplies", date: "29 Jul", src: "Shop bill", how: "photo", ok: true },
  { id: "EX-9041", cat: "Fuel & travel", dept: "Maintenance", amt: 96200, party: "Diesel · DG sets", date: "30 Jul", src: "Fuel slips", how: "photo", ok: true },
  { id: "EX-9040", cat: "Rent & utilities", dept: "Admin", amt: 285000, party: "Office + power", date: "05 Aug", src: "Bank statement", how: "zip", ok: true },
  { id: "EX-9039", cat: "Professional fees", dept: "Accounts", amt: 175000, party: "CA · quarterly", date: "20 Jul", src: "Invoice", how: "pdf", ok: true },
  { id: "EX-9038", cat: "Repairs", dept: "Maintenance", amt: 64300, party: "Lift AMC call-out", date: "22 Jul", src: "Invoice", how: "pdf", ok: true },
  { id: "EX-9037", cat: "Salaries", dept: "Security", amt: 312000, party: "Guard contract · July", date: "01 Aug", src: "Contract bill", how: "pdf", ok: true },
  { id: "EX-9052", cat: "Fuel & travel", dept: "Store", amt: 486000, party: "Malhotra Transport — material cartage", date: "08 Aug", src: "INV-8852", how: "pdf", ok: true },
  { id: "EX-9053", cat: "Fuel & travel", dept: "Site Engineering", amt: 152000, party: "Transport — tipper hire, Royce", date: "02 Aug", src: "Contract bill", how: "pdf", ok: true },
  { id: "EX-9036", cat: "Material", dept: "Store", amt: 900000, party: "Shivalik Aggregates", date: "09 Aug", src: "PO-4459", how: "pdf", ok: true },
];

export const SALES_SEED: any = [
  { id: "SL-2041", unit: "B-1204", tower: "Royce · Tower B", proj: "Marbella Royce", firm: "D.R. Developers & Colonisers", plan: "Royce · Tower B, C, D", price: 14200000, booked: "18 Apr 2025", buyer: "Aman Gill", phone: "+91 98155 41207", email: "amangill@gmail.com", paid: 4970000 },
  { id: "SL-2042", unit: "A-0803", tower: "Royce · Tower A", proj: "Marbella Royce", firm: "D.R. Developers & Colonisers", plan: "Royce · Tower A", price: 16800000, booked: "02 Jun 2025", buyer: "Ritu Sharma", phone: "+91 99880 33412", email: "ritu.sharma@outlook.com", paid: 4200000 },
  { id: "SL-2043", unit: "C-0906", tower: "Royce · Tower C", proj: "Marbella Royce", firm: "D.R. Developers & Colonisers", plan: "Royce · Tower B, C, D", price: 13400000, booked: "11 Jan 2026", buyer: "Harpreet Bedi", phone: "+91 98760 22118", email: "hbedi@yahoo.in", paid: 4690000 },
  { id: "SL-2044", unit: "D-1502", tower: "Royce · Tower D", proj: "Marbella Royce", firm: "D.R. Developers & Colonisers", plan: "Royce · Tower B, C, D", price: 15100000, booked: "27 Feb 2026", buyer: "Sunil Mehta", phone: "+91 98140 77903", email: "sunilmehta@gmail.com", paid: 3775000 },
  { id: "SL-2045", unit: "T1-2101", tower: "Marbella Grand · Tower 1", proj: "Marbella Grand", firm: "Delhi Punjab Real Estates LLP", plan: "Grand · standard", price: 19500000, booked: "09 Sep 2024", buyer: "Karan Anand", phone: "+91 97790 11245", email: "karan.anand@gmail.com", paid: 15600000 },
  { id: "SL-2046", unit: "TT-A-1106", tower: "Twin Towers · A", proj: "Twin Towers", firm: "Delhi Punjab Real Estates LLP", plan: "Grand · standard", price: 17800000, booked: "21 Nov 2024", buyer: "Neha Kapoor", phone: "+91 98729 55031", email: "neha.kapoor@gmail.com", paid: 10680000 },
];

export const COMPANIES_SEED: any = [
  { id: "CO-01", name: "Delhi Punjab Real Estates LLP", kind: "Own firm", gstin: "03AAEFD4921K1Z9", pan: "AAEFD4921K", city: "Chandigarh" },
  { id: "CO-02", name: "D.R. Developers & Colonisers", kind: "Own firm", gstin: "03AAKFD3356N1ZB", pan: "AAKFD3356N", city: "Chandigarh" },
  { id: "CO-03", name: "Des Raj Real Estates Pvt. Ltd.", kind: "Own firm", gstin: "03AABCD7890P1ZR", pan: "AABCD7890P", city: "Chandigarh" },
  { id: "CO-04", name: "Marbella Facility Services", kind: "Associate", gstin: "03AAFCM2211Q1Z4", pan: "AAFCM2211Q", city: "Mohali" },
];

export const BANKS_SEED: any = [
  { id: "BK-01", bank: "HDFC Bank", acc: "•••• 4417", type: "Current", firm: "Delhi Punjab Real Estates LLP", till: "Aug 26", gaps: [], bal: 18450000 },
  { id: "BK-02", bank: "ICICI Bank", acc: "•••• 9082", type: "Current", firm: "D.R. Developers & Colonisers", till: "May 26", gaps: ["Jun 26", "Jul 26", "Aug 26"], bal: 9260000 },
  { id: "BK-03", bank: "SBI", acc: "•••• 2231", type: "RERA escrow · Royce", firm: "D.R. Developers & Colonisers", till: "Aug 26", gaps: [], bal: 42100000 },
  { id: "BK-04", bank: "Axis Bank", acc: "•••• 7756", type: "RERA escrow · Grand", firm: "Delhi Punjab Real Estates LLP", till: "Jul 26", gaps: ["Aug 26"], bal: 27800000 },
];

export const CARDS_SEED: any = [
  { id: "CC-01", bank: "HDFC Regalia", last: "4402", holder: "Nitish Walia", limit: 1500000, used: 284000, cycle: "16th – 15th", due: "3rd of every month", firm: "Delhi Punjab Real Estates LLP" },
  { id: "CC-02", bank: "ICICI Amazon Pay", last: "8819", holder: "Accounts — office", limit: 400000, used: 61400, cycle: "1st – 30th", due: "18th of every month", firm: "D.R. Developers & Colonisers" },
  { id: "CC-03", bank: "Axis Magnus", last: "3307", holder: "Nitish Walia", limit: 2000000, used: 0, cycle: "6th – 5th", due: "25th of every month", firm: "Des Raj Real Estates Pvt. Ltd." },
];

export const CATALOG_SEED: any = [
  { name: "Cement OPC 53 grade", unit: "bag", rate: 380, vendor: "Ambuja Cement" },
  { name: "TMT steel bar 8mm", unit: "kg", rate: 66, vendor: "RSW Steel Traders" },
  { name: "TMT steel bar 12mm", unit: "kg", rate: 68, vendor: "RSW Steel Traders" },
  { name: "TMT steel bar 16mm", unit: "kg", rate: 67, vendor: "RSW Steel Traders" },
  { name: "Binding wire", unit: "kg", rate: 72, vendor: "RSW Steel Traders" },
  { name: "River sand", unit: "cft", rate: 55, vendor: "Verma Suppliers" },
  { name: "Aggregate 20mm", unit: "cft", rate: 48, vendor: "Verma Suppliers" },
  { name: "Red clay bricks", unit: "nos", rate: 8, vendor: "Local Kiln" },
  { name: "Sintex water tank 2000L", unit: "nos", rate: 18500, vendor: "Sintex Depot" },
  { name: "PVC pipe 4 inch", unit: "m", rate: 240, vendor: "Supreme Traders" },
  { name: "Vitrified tiles 600x600", unit: "box", rate: 720, vendor: "Tile House" },
  { name: "Emulsion paint 20L", unit: "bucket", rate: 3200, vendor: "Asian Paints Dealer" },
  { name: "Plywood 18mm", unit: "sheet", rate: 2100, vendor: "Century Ply Dealer" },
  { name: "Safety gloves", unit: "pair", rate: 45, vendor: "Safety Mart" },
  { name: "Safety helmet", unit: "nos", rate: 180, vendor: "Safety Mart" },
];

export const CAL_SEED: any = [
  { id: "EV1", title: "Monthly all-hands", date: "2026-08-05", time: "11:00", kind: "meeting", priority: "priority", audience: { type: "all" }, by: "Nitish Walia", note: "Numbers and what's next across all five sites.", where: "Head office" },
  { id: "EV2", title: "Site safety walk — Marbella Grand", date: "2026-08-03", time: "08:30", kind: "task", priority: "urgent", audience: { type: "dept", dept: "Maintenance" }, by: "M. Chauhan" },
  { id: "EV3", title: "Cement delivery expected — Twin Towers", date: "2026-08-02", time: "14:00", kind: "reminder", priority: "priority", audience: { type: "dept", dept: "Store" }, by: "S. Verma" },
  { id: "EV4", title: "Vendor payment review", date: "2026-08-04", time: "16:00", kind: "meeting", priority: "priority", audience: { type: "dept", dept: "Accounts" }, by: "P. Nair" },
  { id: "EV5", title: "Call Ambuja rep on rate revision", date: "2026-08-02", time: "12:30", kind: "reminder", priority: "urgent", audience: { type: "person", personId: "MB-PUR-0012" }, by: "R. Khanna" },
  { id: "EV6", title: "Marbella Manifest kickoff", date: "2026-08-08", time: "10:00", kind: "meeting", priority: "priority", audience: { type: "all" }, by: "Nitish Walia", where: "Manifest site" },
  { id: "EV7", title: "Submit GST working", date: "2026-08-09", time: "17:00", kind: "task", priority: "low", audience: { type: "dept", dept: "Accounts" }, by: "P. Nair" },
];

export const PKG_SEED: any = [
  { id: "PK-2001", name: "Quarter Star — Purchase", amount: 10000, threshold: 8, scale: 10, dept: "Purchase", period: "Q2 FY26", how: "Score 8+/10 for the quarter across performance, attendance and tasks. The top scorer takes the bonus.", status: "live" },
  { id: "PK-2002", name: "Perfect Attendance — Site", amount: 5000, threshold: 8, scale: 10, dept: "Site Engineering", period: "Q2 FY26", how: "Clean attendance and 8+/10 through the quarter.", status: "proposed" },
];

export const REPORTS_SEED: any = [
  { id: "RP-208", cat: "Missing material", by: "D. Rana (Store Asst)", proj: "Marbella Grand", when: "2 h ago", text: "12 cement bags counted yesterday evening aren't on the rack this morning.", voice: { dur: "0:14" }, media: { type: "image", url: SEED_PHOTO } },
  { id: "RP-205", cat: "Need support", by: "K. Iyer (Site Engineer)", proj: "Twin Towers", when: "yesterday", text: "Short on labour for Thursday's slab pour — need 4 more hands.", voice: null },
  { id: "RP-201", cat: "Safety", by: "M. Chauhan (Maintenance)", proj: "Marbella Grand", when: "2 d ago", text: "Edge protection missing on 3rd floor east side.", voice: { dur: "0:09" } },
];

export const ATT_SEED: any = {
  "MB-PUR-0012": [rec("28 Jul", "09:28", "18:40"), rec("29 Jul", "09:31", "18:36"), rec("30 Jul", "09:26", "18:52"), rec("31 Jul", "09:33", "18:44"), rec("01 Aug", "09:22", "18:39")],
  "MB-PUR-0018": [rec("28 Jul", "09:52", "18:31"), rec("29 Jul", "10:14", "18:33"), rec("30 Jul", "09:41", null), rec("31 Jul", "09:58", "18:20"), rec("01 Aug", "10:06", "18:29")],
  "MB-STR-0004": [rec("28 Jul", "09:24", "18:38"), rec("29 Jul", "09:29", "18:41"), rec("30 Jul", "09:27", "18:35"), rec("31 Jul", "09:30", "18:44"), rec("01 Aug", "09:25", "18:37")],
  "MB-STR-0009": [rec("28 Jul", "09:47", "18:22"), ab("29 Jul"), rec("30 Jul", "09:55", "18:18"), rec("31 Jul", "10:02", "18:25"), rec("01 Aug", "09:44", "18:30")],
  "MB-SIT-0021": [rec("28 Jul", "08:58", "19:10"), rec("29 Jul", "09:02", "19:04"), rec("30 Jul", "08:55", "19:22"), rec("31 Jul", "09:05", "19:00"), rec("01 Aug", "08:52", "19:12")],
  "MB-MNT-0006": [rec("28 Jul", "09:40", "18:33"), rec("29 Jul", "09:51", "18:28"), rec("30 Jul", "09:38", "18:41"), rec("31 Jul", "09:47", null), rec("01 Aug", "09:44", "18:36")],
  "MB-SIT-0052": [rec("28 Jul", "09:20", "18:48"), rec("29 Jul", "09:18", "18:52"), rec("30 Jul", "09:24", "18:46"), rec("31 Jul", "09:21", "18:50"), rec("01 Aug", "09:19", "18:49")],
  "MB-ACC-0002": [rec("28 Jul", "09:15", "18:42"), rec("29 Jul", "09:17", "18:40"), rec("30 Jul", "09:12", "18:47"), rec("31 Jul", "09:19", "18:39"), rec("01 Aug", "09:14", "18:44")],
  "MB-LAB-0102": [rec("28 Jul", "08:32", "17:35"), rec("29 Jul", "08:29", "17:40"), rec("30 Jul", "08:35", "17:33"), rec("31 Jul", "08:31", "17:38"), rec("01 Aug", "08:28", "17:41")],
  "MB-SEC-0007": [rec("28 Jul", "07:58", "20:05"), rec("29 Jul", "08:01", "20:02"), rec("30 Jul", "07:55", "20:08"), rec("31 Jul", "08:03", "20:00"), rec("01 Aug", "07:52", "20:10")],
};

export const HRTASKS_SEED: any = [
  { id: "T1", done: false, text: "Print ID cards for the 3 new labour hires", who: "" },
  { id: "T2", done: false, text: "Probation review — Manoj Kumar (Gate Security)", who: "Manoj Kumar" },
  { id: "T3", done: true, text: "Issue appreciation letter — R. Khanna", who: "R. Khanna" },
];

export const HRANN_SEED: any = [
  { when: "today", title: "Safety refresher — Friday 4 PM", text: "All site staff & labour to attend the toolbox talk at Twin Towers site office.", audience: "Site & Labour" },
  { when: "3 days ago", title: "Salary credited", text: "March salaries have been credited. Payslips are on your profile.", audience: "Everyone" },
];

export const AREA_GROUPS: any = [
  ["Money", [["expenses", "Expenses"], ["sales", "Sales & dues"], ["masters", "Masters"], ["accounts", "Reconciliation"], ["tax", "Tax & RERA"], ["cost", "Budget"]]],
  ["Buying", [["overview", "Purchase desk"], ["intent", "Intent → PO"], ["invoices", "Invoices"], ["subs", "Submissions"]]],
  ["Site", [["store", "Store floor"], ["inventory", "Inventory"], ["maintenance", "Maintenance"], ["security", "Gate"]]],
  ["People", [["people", "People"], ["hr", "HR Desk"], ["incentives", "Incentives"], ["attendance", "Attendance"]]],
  ["Shared", [["calendar", "Calendar"], ["directory", "Directory"], ["firms", "Projects"], ["connect", "Connections"]]],
];

export const POWERS: any = [["view", "See it"], ["edit", "Change it"], ["approve", "Approve it"], ["export", "Take it out"]];
