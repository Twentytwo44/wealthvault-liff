export type AssetKind = "account" | "cash" | "invest" | "insurance" | "land" | "building" | "liability";
export type AssetField = { key: string; label: string; type?: "text" | "number" | "date" | "textarea"; required?: boolean; placeholder?: string };

export const assetKinds: { id: AssetKind; label: string; endpoint: string; fields: AssetField[] }[] = [
  { id: "account", label: "บัญชีธนาคาร", endpoint: "asset/account", fields: [
    { key: "name", label: "ชื่อรายการ", required: true }, { key: "bank_name", label: "ธนาคาร" }, { key: "bank_account", label: "เลขที่บัญชี" },
    { key: "type", label: "ประเภทบัญชี" }, { key: "amount", label: "ยอดเงิน", type: "number", required: true }, { key: "description", label: "รายละเอียด", type: "textarea" }
  ] },
  { id: "cash", label: "เงินสด", endpoint: "asset/cash", fields: [
    { key: "name", label: "ชื่อรายการ", required: true }, { key: "amount", label: "จำนวนเงิน", type: "number", required: true }, { key: "description", label: "รายละเอียด", type: "textarea" }
  ] },
  { id: "invest", label: "การลงทุน", endpoint: "asset/invest", fields: [
    { key: "name", label: "ชื่อสินทรัพย์", required: true }, { key: "symbol", label: "Ticker / สัญลักษณ์", placeholder: "เช่น AAPL, BTC, ETH" }, { key: "type", label: "ประเภทสินทรัพย์", placeholder: "หุ้น, crypto, กองทุน" },
    { key: "broker_name", label: "โบรกเกอร์" }, { key: "quantity", label: "จำนวนหน่วย", type: "number" }, { key: "cost_per_price", label: "ราคาต่อหน่วย", type: "number" }, { key: "description", label: "รายละเอียด", type: "textarea" }
  ] },
  { id: "insurance", label: "ประกัน", endpoint: "asset/insurance", fields: [
    { key: "name", label: "ชื่อกรมธรรม์", required: true }, { key: "policy_number", label: "เลขกรมธรรม์" }, { key: "type", label: "ประเภทประกัน" },
    { key: "company_name", label: "บริษัทประกัน" }, { key: "coverage_period", label: "ระยะเวลาคุ้มครอง" }, { key: "coverage_amount", label: "วงเงินคุ้มครอง", type: "number" },
    { key: "con_date", label: "วันที่เริ่มคุ้มครอง", type: "date" }, { key: "exp_date", label: "วันหมดอายุ", type: "date" }, { key: "description", label: "รายละเอียด", type: "textarea" }
  ] },
  { id: "land", label: "ที่ดิน", endpoint: "asset/land", fields: [
    { key: "name", label: "ชื่อรายการ", required: true }, { key: "deed_num", label: "เลขโฉนด" }, { key: "area", label: "ขนาดพื้นที่", type: "number" }, { key: "amount", label: "มูลค่า", type: "number" },
    { key: "location.address", label: "ที่อยู่" }, { key: "location.sub_district", label: "ตำบล / แขวง" }, { key: "location.district", label: "อำเภอ / เขต" }, { key: "location.province", label: "จังหวัด" }, { key: "location.postal_code", label: "รหัสไปรษณีย์" }, { key: "description", label: "รายละเอียด", type: "textarea" }
  ] },
  { id: "building", label: "อสังหาริมทรัพย์", endpoint: "asset/building", fields: [
    { key: "name", label: "ชื่อรายการ", required: true }, { key: "type", label: "ประเภทอสังหาริมทรัพย์" }, { key: "area", label: "ขนาดพื้นที่", type: "number" }, { key: "amount", label: "มูลค่า", type: "number" },
    { key: "location.address", label: "ที่อยู่" }, { key: "location.sub_district", label: "ตำบล / แขวง" }, { key: "location.district", label: "อำเภอ / เขต" }, { key: "location.province", label: "จังหวัด" }, { key: "location.postal_code", label: "รหัสไปรษณีย์" }, { key: "description", label: "รายละเอียด", type: "textarea" }
  ] },
  { id: "liability", label: "หนี้สิน", endpoint: "lia", fields: [
    { key: "name", label: "ชื่อหนี้สิน", required: true }, { key: "type", label: "ประเภทหนี้สิน" }, { key: "creditor", label: "เจ้าหนี้" }, { key: "principal", label: "ยอดหนี้คงเหลือ", type: "number", required: true },
    { key: "interest_rate", label: "อัตราดอกเบี้ย" }, { key: "started_at", label: "วันที่เริ่มต้น", type: "date" }, { key: "ended_at", label: "วันที่สิ้นสุด", type: "date" }, { key: "description", label: "รายละเอียด", type: "textarea" }
  ] }
];
