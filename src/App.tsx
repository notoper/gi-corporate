import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "./supabase";

// ─── Helpers ───
const TODAY = new Date();
const daysBetween = (ds: string | null) => {
  if (!ds) return null;
  try {
    const d = new Date(ds);
    if (isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - TODAY.getTime()) / 864e5);
  } catch { return null; }
};

const urgency = (days: number | null) => {
  if (days === null) return { icon: "", label: "—", color: "#94A3B8", bg: "" };
  if (days <= 0) return { icon: "⛔", label: "已过期", color: "#DC2626", bg: "#FEF2F2" };
  if (days <= 90) return { icon: "🔴", label: `${days}天`, color: "#DC2626", bg: "#FEF2F2" };
  if (days <= 180) return { icon: "🟡", label: `${days}天`, color: "#D97706", bg: "#FFFBEB" };
  return { icon: "🟢", label: `${days}天`, color: "#16A34A", bg: "#F0FDF4" };
};

const parseRows = (text: string) => {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line, i) => {
    const vals = line.split("\t");
    const row: Record<string, string> = { _id: String(i) };
    headers.forEach((h, j) => { row[h.trim()] = (vals[j] || "").trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v && v !== ""));
};

const findCol = (row: Record<string, string>, keywords: string[]) => {
  for (const key of Object.keys(row)) {
    const kl = key.toLowerCase();
    if (keywords.some(kw => kl.includes(kw))) return key;
  }
  return null;
};

const mapRow = (row: Record<string, string>) => {
  const g = (keywords: string[]) => {
    const col = findCol(row, keywords);
    return col ? (row[col] || "") : "";
  };
  return {
    _id: row._id,
    company: g(["公司名称", "company", "公司"]),
    uen: g(["uen"]),
    type: g(["类型", "type"]),
    status: g(["状态", "status"]),
    regDate: g(["注册日期", "成立", "incorporation"]),
    fye: g(["fye"]),
    address: g(["地址", "address"]),
    clientName: g(["客户姓名", "client"]),
    phone: g(["手机", "phone"]),
    passportNo: g(["护照号", "passport"]),
    epNo: g(["ep证件", "ep no"]),
    epExpiry: g(["ep到期", "ep expiry"]),
    epStatus: g(["ep状态"]),
    ndName: g(["挂名董事"]),
    ndExpiry: g(["挂名到期"]),
    ndStatus: g(["挂名状态"]),
    secName: g(["秘书"]),
    secExpiry: g(["秘书到期"]),
    secStatus: g(["秘书状态"]),
    addrExpiry: g(["地址到期"]),
    addrStatus: g(["地址状态"]),
    work: g(["工作备注", "工作", "报表"]),
    ar2024: g(["ar2024"]),
    ar2025: g(["ar2025"]),
    ya2025: g(["ya2025"]),
    ya2026: g(["ya2026"]),
    ltr: g(["ltr"]),
    opsFee: g(["运营费", "ops"]),
    bank: g(["银行", "bank", "账户"]),
    source: g(["数据来源", "来源"]),
    customTodos: "",
    previousNames: "",
    managed: "",
    managedStart: "",
    managedExpiry: "",
    passportExpiry: "",
    epStart: "",
    ndStart: "",
    secStart: "",
    addrStart: "",
    directorsJson: "[]",
    shareholdersJson: "[]",
    registeredCapital: "",
    paidCapital: "",
    rorc: "",
    personnelChangeLogs: "[]",
    strikeOffDate: "",
  };
};

// ─── DB Mapping ───
type CompanyRow = ReturnType<typeof mapRow>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbToRow = (db: any): CompanyRow => ({
  _id: db.id,
  company: db.company || "",
  uen: db.uen || "",
  type: db.type || "",
  status: db.status || "",
  regDate: db.reg_date || "",
  fye: db.fye || "",
  address: db.address || "",
  clientName: db.client_name || "",
  phone: db.phone || "",
  passportNo: db.passport_no || "",
  epNo: db.ep_no || "",
  epExpiry: db.ep_expiry || "",
  epStatus: db.ep_status || "",
  ndName: db.nd_name || "",
  ndExpiry: db.nd_expiry || "",
  ndStatus: db.nd_status || "",
  secName: db.sec_name || "",
  secExpiry: db.sec_expiry || "",
  secStatus: db.sec_status || "",
  addrExpiry: db.addr_expiry || "",
  addrStatus: db.addr_status || "",
  work: db.work || "",
  ar2024: db.ar2024 || "",
  ar2025: db.ar2025 || "",
  ya2025: db.ya2025 || "",
  ya2026: db.ya2026 || "",
  ltr: db.ltr || "",
  opsFee: db.ops_fee || "",
  bank: db.bank || "",
  source: db.source || "",
  customTodos: db.custom_todos || "",
  previousNames: db.previous_names || "",
  managed: db.managed || "",
  managedStart: db.managed_start || "",
  managedExpiry: db.managed_expiry || "",
  passportExpiry: db.passport_expiry || "",
  epStart: db.ep_start || "",
  ndStart: db.nd_start || "",
  secStart: db.sec_start || "",
  addrStart: db.addr_start || "",
  directorsJson: db.directors_json || "[]",
  shareholdersJson: db.shareholders_json || "[]",
  registeredCapital: db.registered_capital || "",
  paidCapital: db.paid_capital || "",
  rorc: db.rorc || "",
  personnelChangeLogs: db.personnel_change_logs || "[]",
  strikeOffDate: db.strike_off_date || "",
});

const rowToDb = (row: CompanyRow) => ({
  id: String(row._id),
  company: row.company || "",
  uen: row.uen || "",
  type: row.type || "",
  status: row.status || "",
  reg_date: row.regDate || "",
  fye: row.fye || "",
  address: row.address || "",
  client_name: row.clientName || "",
  phone: row.phone || "",
  passport_no: row.passportNo || "",
  ep_no: row.epNo || "",
  ep_expiry: row.epExpiry || "",
  ep_status: row.epStatus || "",
  nd_name: row.ndName || "",
  nd_expiry: row.ndExpiry || "",
  nd_status: row.ndStatus || "",
  sec_name: row.secName || "",
  sec_expiry: row.secExpiry || "",
  sec_status: row.secStatus || "",
  addr_expiry: row.addrExpiry || "",
  addr_status: row.addrStatus || "",
  work: row.work || "",
  ar2024: row.ar2024 || "",
  ar2025: row.ar2025 || "",
  ya2025: row.ya2025 || "",
  ya2026: row.ya2026 || "",
  ltr: row.ltr || "",
  ops_fee: row.opsFee || "",
  bank: row.bank || "",
  source: row.source || "",
  custom_todos: row.customTodos || "",
  previous_names: row.previousNames || "",
  managed: row.managed || "",
  managed_start: row.managedStart || "",
  managed_expiry: row.managedExpiry || "",
  passport_expiry: row.passportExpiry || "",
  ep_start: row.epStart || "",
  nd_start: row.ndStart || "",
  sec_start: row.secStart || "",
  addr_start: row.addrStart || "",
  directors_json: row.directorsJson || "[]",
  shareholders_json: row.shareholdersJson || "[]",
  registered_capital: row.registeredCapital || "",
  paid_capital: row.paidCapital || "",
  rorc: row.rorc || "",
  personnel_change_logs: row.personnelChangeLogs || "[]",
  strike_off_date: row.strikeOffDate || "",
});

type LogEntry = { id: number; time: string; action: string; company: string; field: string; oldVal: string; newVal: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbToLog = (db: any): LogEntry => ({
  id: db.id,
  time: db.time_str || "",
  action: db.action || "",
  company: db.company || "",
  field: db.field || "",
  oldVal: db.old_val || "",
  newVal: db.new_val || "",
});

// ─── Date helpers ───
const MONTHS_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const formatDateDisplay = (ds: string): string => {
  if (!ds) return "";
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
    const [y, m, day] = ds.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(ds);
  }
  if (isNaN(d.getTime())) return ds;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

// ─── BizFile PDF Parser ───
interface BizFileShareholder { name: string; shares: number; currency: string; shareType: string; }
interface BizFileData {
  company: string; uen: string; regDate: string;
  status: string; address: string; directors: string[];
  secretary: string;
  shareholders: BizFileShareholder[];
  paidUpCapital: string;
  issuedCapital: string;
}

async function parseBizFilePdf(file: File): Promise<BizFileData> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  const base64 = btoa(binary);

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("请填入")) throw new Error("请先在 .env 文件中设置 VITE_ANTHROPIC_API_KEY");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: `从这份 ACRA BizFile PDF 中提取信息，只返回 JSON，不要任何 markdown 或说明：
{
  "company": "公司完整名称",
  "uen": "UEN号码",
  "regDate": "注册日期，格式 YYYY-MM-DD",
  "status": "公司状态",
  "address": "注册地址",
  "directors": ["董事姓名列表"],
  "secretary": "秘书姓名，没有则空字符串",
  "shareholders": [{"name":"股东名称","shares":股份数量,"currency":"货币如SINGAPORE DOLLAR","shareType":"股份类型如ORDINARY"}],
  "paidUpCapital": "实缴资本，如 SGD 1",
  "issuedCapital": "已发行资本，如 SGD 100"
}` }
        ]
      }]
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API 错误 ${resp.status}: ${err.slice(0, 200)}`);
  }

  const json = await resp.json();
  const text = (json.content[0].text as string).trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(text) as BizFileData;
}

// ─── Styles ───
const FONT = "'Geist', 'Noto Sans SC', system-ui, sans-serif";
const LOGO_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAAA4CAIAAAAgirAZAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAq7klEQVR4nO19Z3hU1dbw2qdNS++QBAghQYogvYXepdyLBOQqCiqoIAkiIAqXqCDyev1QwYI0CwLSBClSQwsgCTUJBghIQqiSnkkyZ845e38/VnIcZpLJoPh+7/c+roeHJ3Nmn7V2WXv1vYcwxuBv+Bv+HAgPHaMjV5KHjv1v+B8JD4GNKAPGGANCAHjuPtZhDCgDBkAAOALkb7b6XwrkDys1xkBjwDszB1UoKBrjCIg84QlxFEkaBY77W0T9jwDGGHl42/qPsBFlQBkTOOwE+7VAScuznb4pX76n3CzRSmWwa4wAmEQINHMN/fiWYWL7SFO7cKOfmdcxEHg4wknTNADgOO4PTMqfmcqHuwy1kaCU4gLxPP/Qyamq+rDQPhgbMQBKgecAAK4Xy1vOWzdn2M7eUsrLKVAAjgBHgNNbE+Q4YAxEqO8r9IyWPhwRGOItYse1alR/HeDo9P/1wRJCeJ5/UFQ6CMLDtyn/24BSynFcRUWF2Wx+WDgfgI0oA44wAJKdL390uHjtuYriYgYCx4lE4AkBxgCckFWLHEIZUzQAm5r2enj7COPxHGvL+gYfSdQYcOSPqDkUBmVlZW+88UZcXFzfvn2DgoJUVa2i6wBukBQUFFgsFqPRWBsJlAcAwHEcx93H8na7XZKkB++4R4Cju3fv3i+//JKTk3P16tVJkyZFRET8eRGoqqogCCtXrnz33XdfeumlsWPHhoeH1zlRdYKnbKRSJnCkQlEXHSj66Ii1zApg5Ax8lawBAEKAEECWYL8bRAzlEVTxEz05tV7bcOOI1beybtg/GhU4pJk3AGiM8Q84DE3TeJ4/fPhwr169AMDf33/NmjVDhgxxakYpLS8vLysrKywsvHv37u3bt2/evHnjxo3c3Ny8vLzr168/9thjqJJQ1G3btkWWsC8+DgC6devWoUOHMjMzN27cWFRUhHRWuDOZ/v7+sbGxbdu27d69OwAcOHBg7dq1dXa4ZcuWSZMmOZLYvHnzt99+W+eLUCuZZFn+z3/+U2fj6OhoZzFIN++4R4CqioiUADgfAqcDoDiOG/j7+/iV7Ft6RxIJP/sTbM+BQuECGlJEXHRDGMuYkqNceySQ1/Bsv2J1tYZQCIIz/NSXB3kXpSdwBM2uNQAIIZzBzFDeEhV5JgFAqeQAcPrb3LiJJyq1Rm6OPzTmAXCjfV/GKvMaI8BcL78I5+0ICBzqxKKjcXBgp9MdLQ0CsMkCSB3p3wfFjqPuIiQWLxaEeSBZ0XkxmUaMxSbx/BLGcIAHj/e7lXoE4AuYLZbq+4WCAL/xJI/+iZHaJmkMtGBYiRZ1t47cBjhTqc0IALmGHvpn7n4tgVqFcrHD29FdREMRHGvHqGoKjb/YQ6UKtx/pLvvVz9XQVO7f7/K68MDGi3u9d84K4M7OA1yIRJEEOQJ/D5ue0oOKJlJAFYJTYFQLbYkCSq7DsAdmPCVU3nHlRNJIcBIDi9NPlPJMFXlZVaStlpOAD7jSSW";
const colors = {
  bg: "#FAFAF9", card: "#FFF", border: "#E7E5E4", text: "#1C1917",
  muted: "#78716C", accent: "#0C0A09", green: "#16A34A", red: "#DC2626",
  orange: "#D97706", blue: "#2563EB", purple: "#7C3AED",
};

export default function SecretaryOS() {
  const [data, setData] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdError, setPwdError] = useState(false);
  const [isSettingPwd, setIsSettingPwd] = useState(false);
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CompanyRow | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [tab, setTab] = useState("all");
  const [expandedExpiryTypes, setExpandedExpiryTypes] = useState<Set<string>>(new Set());
  const importRef = useRef<HTMLTextAreaElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [detailSaved, setDetailSaved] = useState(false);
  const [personnelRescanning, setPersonnelRescanning] = useState(false);
  const [personnelRescanError, setPersonnelRescanError] = useState("");
  const [strikeOffModal, setStrikeOffModal] = useState(false);
  const [strikeOffDateInput, setStrikeOffDateInput] = useState("");

  const FIELD_LABELS: Record<string, string> = {
    company: "公司名称", uen: "UEN", type: "公司类型", status: "状态",
    regDate: "注册日期", fye: "FYE", address: "注册地址", bank: "银行账户",
    clientName: "客户姓名", phone: "手机号", passportNo: "护照号",
    epNo: "EP证件号", epExpiry: "EP到期日", opsFee: "运营费/月",
    ndName: "挂名董事", ndExpiry: "挂名到期", secName: "秘书",
    secExpiry: "秘书到期", addrExpiry: "地址到期",
    work: "工作备注", ar2024: "AR2024", ar2025: "AR2025",
    ya2025: "YA2025", ya2026: "YA2026", ltr: "LTR/INV",
  };

  // ─── Load from Supabase ───
  useEffect(() => {
    (async () => {
      try {
        const { data: rows } = await supabase.from("companies").select("*").order("created_at");
        if (rows) setData(rows.map(dbToRow));
      } catch {}
      try {
        const { data: logRows } = await supabase.from("logs").select("*").order("created_at", { ascending: false }).limit(500);
        if (logRows) setLogs(logRows.map(dbToLog));
      } catch {}
      try {
        const { data: pwdRow } = await supabase.from("settings").select("value").eq("key", "password").maybeSingle();
        if (!pwdRow) setIsSettingPwd(true);
      } catch {
        setIsSettingPwd(true);
      }
      setLoading(false);
    })();
  }, []);

  // ─── Login ───
  const handleLogin = useCallback(async () => {
    if (!pwd.trim()) return;
    if (isSettingPwd) {
      await supabase.from("settings").upsert({ key: "password", value: pwd.trim() });
      setAuthed(true);
      setPwd("");
      setIsSettingPwd(false);
    } else {
      const { data: pwdRow } = await supabase.from("settings").select("value").eq("key", "password").maybeSingle();
      if (pwdRow && pwdRow.value === pwd.trim()) {
        setAuthed(true);
        setPwd("");
        setPwdError(false);
      } else {
        setPwdError(true);
        setTimeout(() => setPwdError(false), 1500);
      }
    }
  }, [pwd, isSettingPwd]);

  // ─── Add log ───
  const addLog = useCallback(async (action: string, company: string, field: string, oldVal: string, newVal: string) => {
    const entry: LogEntry = {
      id: Date.now(),
      time: new Date().toLocaleString("zh-CN", { hour12: false }),
      action, company: company || "",
      field: field || "", oldVal: oldVal || "", newVal: newVal || "",
    };
    setLogs(prev => [entry, ...prev].slice(0, 500));
    try {
      await supabase.from("logs").insert({ id: entry.id, action: entry.action, company: entry.company, field: entry.field, old_val: entry.oldVal, new_val: entry.newVal, time_str: entry.time });
    } catch (e) { console.error("Log save failed:", e); }
  }, []);

  // ─── Update one company ───
  const updateCompanyInDb = useCallback(async (updated: CompanyRow) => {
    setData(prev => prev.map(r => r._id === updated._id ? updated : r));
    try {
      await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id));
    } catch (e) { console.error("Update failed:", e); }
  }, []);

  // ─── Import ───
  const handleImport = useCallback(async () => {
    if (!importText.trim()) return;
    const rows = parseRows(importText);
    if (rows.length === 0) { alert("未识别到数据"); return; }
    const mapped = rows.map((r, i) => ({ ...mapRow(r), _id: `${Date.now()}_${i}` }));
    setData(mapped);
    setShowImport(false);
    setImportText("");
    setView("dashboard");
    try {
      await supabase.from("companies").delete().not("id", "is", null);
      const dbRows = mapped.map(rowToDb);
      for (let i = 0; i < dbRows.length; i += 100) {
        await supabase.from("companies").insert(dbRows.slice(i, i + 100));
      }
    } catch (e) { console.error("Import failed:", e); }
    addLog("导入数据", "", "", "", `导入 ${mapped.length} 家公司`);
  }, [importText, addLog]);

  // ─── Clear data ───
  const handleClear = useCallback(async () => {
    if (confirm("确定要清空所有数据吗？")) {
      addLog("清空数据", "", "", "", `清空 ${data.length} 家公司`);
      setData([]);
      try { await supabase.from("companies").delete().not("id", "is", null); } catch {}
    }
  }, [data.length, addLog]);

  // ─── Add company ───
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newUen, setNewUen] = useState("");
  const [bizFileMode, setBizFileMode] = useState(false);
  const [bizFileExtracting, setBizFileExtracting] = useState(false);
  const [extractedBizData, setExtractedBizData] = useState<BizFileData | null>(null);
  const [bizFileError, setBizFileError] = useState("");
  // Step 2 state (client info)
  const [newFormStep, setNewFormStep] = useState<1 | 2>(1);
  const [newClientName, setNewClientName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassportNo, setNewPassportNo] = useState("");
  const [newEpNo, setNewEpNo] = useState("");
  // Director role assignment (for BizFile mode)
  const [directorRoles, setDirectorRoles] = useState<{ name: string; tag: "nominal" | "client" | null }[]>([]);

  // Step 1 → 2: advance to client info step
  const goToStep2 = useCallback(() => {
    if (bizFileMode) {
      const clientDir = directorRoles.find(d => d.tag === "client");
      if (clientDir && !newClientName.trim()) setNewClientName(clientDir.name);
    }
    setNewFormStep(2);
  }, [bizFileMode, directorRoles, newClientName]);

  // Final create (called from step 2, or skip)
  const handleFinalCreate = useCallback(async (skipClient = false) => {
    const newId = String(Date.now());
    let company = "", uen = "", type = "", status = "LIVE COMPANY", regDate = "", address = "", secName = "", ndName = "";
    if (bizFileMode && extractedBizData) {
      company = extractedBizData.company;
      uen = extractedBizData.uen || "";
      regDate = extractedBizData.regDate || "";
      address = extractedBizData.address || "";
      secName = extractedBizData.secretary || "";
      ndName = directorRoles.find(d => d.tag === "nominal")?.name || "";
    } else {
      company = newCompany.trim();
      uen = newUen.trim();
    }
    if (!company) return;
    // Build directors JSON from BizFile roles
    let directorsJson = "[]";
    let shareholdersJson = "[]";
    let registeredCapital = "";
    if (bizFileMode && extractedBizData) {
      const dirs = directorRoles.map(d => ({ name: d.name, role: d.tag || "director" }));
      if (extractedBizData.secretary) dirs.push({ name: extractedBizData.secretary, role: "secretary" });
      directorsJson = JSON.stringify(dirs);
      shareholdersJson = JSON.stringify(extractedBizData.shareholders || []);
      registeredCapital = extractedBizData.issuedCapital || extractedBizData.paidUpCapital || "";
    }
    const record: CompanyRow = {
      _id: newId, company, uen, type, status, regDate, fye: "", address,
      clientName: skipClient ? "" : newClientName.trim(),
      phone: skipClient ? "" : newPhone.trim(),
      passportNo: skipClient ? "" : newPassportNo.trim(),
      epNo: skipClient ? "" : newEpNo.trim(),
      epExpiry: "", epStatus: "", passportExpiry: "",
      ndName, ndExpiry: "", ndStatus: "",
      secName, secExpiry: "", secStatus: "",
      addrExpiry: "", addrStatus: "",
      work: "", ar2024: "", ar2025: "", ya2025: "", ya2026: "", ltr: "",
      opsFee: "", bank: "", source: bizFileMode ? "BizFile导入" : "手动新增",
      customTodos: "", previousNames: "",
      managed: "", managedExpiry: "", managedStart: "",
      epStart: "", ndStart: "", secStart: "", addrStart: "",
      paidCapital: "", rorc: "", personnelChangeLogs: "[]", strikeOffDate: "",
      directorsJson, shareholdersJson, registeredCapital,
    };
    setData(prev => [...prev, record]);
    addLog("新增公司", company, "", "", bizFileMode ? `BizFile导入，UEN: ${uen}` : (uen ? `UEN: ${uen}` : ""));
    closeNewForm();
    setSelected(record);
    setView("detail");
    try { await supabase.from("companies").insert(rowToDb(record)); } catch (e) { console.error("Add company failed:", e); }
  }, [bizFileMode, extractedBizData, directorRoles, newCompany, newUen, newClientName, newPhone, newPassportNo, newEpNo, addLog]);

  // Manual step 1: just validate and advance
  const handleAddCompany = useCallback(() => {
    if (!newCompany.trim()) return;
    goToStep2();
  }, [newCompany, goToStep2]);

  const handleBizFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setBizFileError("请上传 PDF 格式的 BizFile"); return; }
    setBizFileExtracting(true);
    setBizFileError("");
    try {
      const data = await parseBizFilePdf(file);
      setExtractedBizData(data);
      setDirectorRoles((data.directors || []).map(name => ({ name, tag: null })));
    } catch (err) {
      setBizFileError(err instanceof Error ? err.message : "解析失败，请重试");
    }
    setBizFileExtracting(false);
    e.target.value = "";
  }, []);

  const closeNewForm = useCallback(() => {
    setShowNewForm(false); setNewCompany(""); setNewUen("");
    setBizFileMode(false); setExtractedBizData(null); setBizFileError(""); setBizFileExtracting(false);
    setNewFormStep(1); setNewClientName(""); setNewPhone(""); setNewPassportNo(""); setNewEpNo("");
    setDirectorRoles([]);
  }, []);

  // ─── Computed ───
  const mapped = useMemo(() => data, [data]);

  const filtered = useMemo(() => {
    let rows = mapped;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => Object.values(r).some(v => v && String(v).toLowerCase().includes(q)));
    }
    if (tab === "action") rows = rows.filter(r => r.work && /(做报表|发invoice|有流水)/i.test(r.work));
    if (tab === "ep") rows = rows.filter(r => r.epNo && r.epNo.trim() !== "" && r.epNo.trim() !== "-");
    if (tab === "closed") rows = rows.filter(r => r.work && /(关闭|关了|strike)/i.test(r.work));
    return rows;
  }, [mapped, search, tab]);

  const alerts = useMemo(() => {
    const list: Array<{ type: string; date: string; person: string; detail: string; company: string; days: number; uen: string }> = [];
    mapped.forEach(r => {
      if (r.status === "STRIKE OFF") return; // Strike Off 公司不提醒
      const items = [
        { type: "EP到期", date: r.epExpiry, person: r.clientName, detail: r.epNo },
        { type: "护照到期", date: r.passportExpiry, person: r.clientName, detail: r.passportNo },
        { type: "挂名到期", date: r.ndExpiry, person: r.ndName, detail: "需续费" },
        { type: "秘书到期", date: r.secExpiry, person: r.secName, detail: "需续费" },
        { type: "地址到期", date: r.addrExpiry, person: "", detail: "需续费" },
        { type: "代运营到期", date: r.managedExpiry, person: "", detail: "需续费" },
      ];
      items.forEach(item => {
        const days = daysBetween(item.date);
        const threshold = item.type === "护照到期" ? 180 : 120;
        if (days !== null && (days <= 0 || days <= threshold)) {
          list.push({ ...item, company: r.company, days, uen: r.uen });
        }
      });
    });
    // 未过期按剩余天数升序，已过期排在后面按过期程度升序
    list.sort((a, b) => {
      const aExpired = a.days <= 0, bExpired = b.days <= 0;
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      return a.days - b.days;
    });
    return list;
  }, [mapped]);

  const stats = useMemo(() => ({
    total: mapped.length,
    action: mapped.filter(r => r.work && /(做报表|发invoice)/i.test(r.work)).length,
    ep: mapped.filter(r => r.epNo).length,
    urgentAlerts: alerts.filter(a => a.days <= 90).length,
  }), [mapped, alerts]);

  const openCompany = (r: CompanyRow) => { setSelected(r); setView("detail"); };

  // ─── Render ───
  if (loading) return <div style={{ fontFamily: FONT, padding: 40, textAlign: "center", color: colors.muted }}>加载中...</div>;

  if (!authed) return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", maxWidth: 380, width: "100%", padding: 40 }}>
        <img src={LOGO_URL} alt="Gi Corporate" style={{ height: 48, margin: "0 auto 16px", display: "block" }} />
        <p style={{ color: colors.muted, marginBottom: 28, fontSize: 14 }}>
          {isSettingPwd ? "首次使用，请设置访问密码" : "请输入密码"}
        </p>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            type="password" value={pwd}
            onChange={e => { setPwd(e.target.value); setPwdError(false); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder={isSettingPwd ? "设置密码..." : "输入密码..."}
            autoFocus
            style={{ width: "100%", padding: "14px 18px", borderRadius: 12, fontSize: 16, outline: "none", border: pwdError ? "2px solid #EF4444" : "2px solid #E7E5E4", background: "#fff", boxSizing: "border-box", fontFamily: FONT, animation: pwdError ? "shake 0.3s ease" : "none" }}
          />
        </div>
        <button onClick={handleLogin} disabled={!pwd.trim()}
          style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: pwd.trim() ? colors.accent : "#D6D3D1", color: "#fff", fontSize: 16, fontWeight: 700, cursor: pwd.trim() ? "pointer" : "not-allowed" }}>
          {isSettingPwd ? "设置密码并进入" : "进入系统"}
        </button>
        {pwdError && <p style={{ color: "#EF4444", fontSize: 13, marginTop: 12, fontWeight: 600 }}>密码错误，请重试</p>}
        {isSettingPwd && <p style={{ color: colors.muted, fontSize: 12, marginTop: 16 }}>密码设置后，每次打开都需要输入</p>}
      </div>
      <style>{`@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }`}</style>
    </div>
  );

  const Badge = ({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) => (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color, background: bg, whiteSpace: "nowrap" }}>{children}</span>
  );

  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: colors.card, borderRadius: 14, border: `1px solid ${colors.border}`, padding: 18, marginBottom: 12, ...style }}>{children}</div>
  );

  if (data.length === 0 && !showImport) return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", maxWidth: 500, padding: 40 }}>
        <img src={LOGO_URL} alt="Gi Corporate" style={{ height: 48, margin: "0 auto 16px", display: "block" }} />
        <p style={{ color: colors.muted, marginBottom: 32, lineHeight: 1.6 }}>客户管理系统<br />导入你的数据开始使用</p>
        <button onClick={() => setShowImport(true)} style={{ padding: "14px 32px", borderRadius: 12, border: "none", background: colors.accent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>📂 批量导入</button>
        <div style={{ margin: "12px 0", color: colors.muted, fontSize: 13 }}>或</div>
        <button onClick={() => setShowNewForm(true)} style={{ padding: "12px 28px", borderRadius: 12, border: `2px solid ${colors.border}`, background: "#fff", color: colors.text, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>➕ 逐个新增公司</button>
        <p style={{ color: colors.muted, fontSize: 13, marginTop: 20, lineHeight: 1.6 }}>
          打开桌面上的 SecretaryOS_完整数据库.xlsx<br />
          选中"完整客户数据库"工作表的所有数据（含表头）<br />
          Ctrl+C 复制 → 粘贴到导入框中
        </p>
      </div>
    </div>
  );

  const ImportModal = () => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, maxWidth: 680, width: "100%", padding: 28 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>导入数据</h2>
        <p style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
          打开 <strong>SecretaryOS_完整数据库.xlsx</strong> → 选中"完整客户数据库"工作表所有数据（包含第一行表头） → Ctrl+C 复制 → 粘贴到下方
        </p>
        <textarea ref={importRef} value={importText} onChange={e => setImportText(e.target.value)}
          placeholder="在此粘贴..."
          style={{ width: "100%", height: 200, padding: 14, borderRadius: 12, border: `2px solid ${colors.border}`, fontFamily: "monospace", fontSize: 12, resize: "vertical", outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={() => { setShowImport(false); setImportText(""); }} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>取消</button>
          <button onClick={handleImport} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: colors.accent, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>导入 ({importText ? parseRows(importText).length : 0} 条)</button>
        </div>
      </div>
    </div>
  );

  const Dashboard = () => {
    const alertsByType = useMemo(() => {
      const groups: Record<string, typeof alerts> = { "EP到期": [], "护照到期": [], "挂名到期": [], "秘书到期": [], "地址到期": [], "代运营到期": [] };
      alerts.forEach(a => { if (groups[a.type]) groups[a.type].push(a); });
      return groups;
    }, []);

    const expired = alerts.filter(a => a.days <= 0).length;
    const within90 = alerts.filter(a => a.days > 0 && a.days <= 90).length;
    const within120 = alerts.filter(a => a.days > 90 && a.days <= 120).length;
    const goList = (filterTab: string) => { setTab(filterTab); setView("list"); };

    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {[
            { label: "客户总数", value: stats.total, color: colors.accent, onClick: () => goList("all") },
            { label: "需做报表", value: stats.action, color: colors.red, onClick: () => goList("action") },
            { label: "持EP客户", value: stats.ep, color: colors.purple, onClick: () => goList("ep") },
            { label: "已关闭", value: mapped.filter(r => r.work && /(关闭|关了|strike)/i.test(r.work)).length, color: "#78716C", onClick: () => goList("closed") },
          ].map(s => (
            <div key={s.label} onClick={s.onClick}
              style={{ flex: "1 1 130px", background: colors.card, borderRadius: 14, border: `1px solid ${colors.border}`, padding: "16px 18px", borderTop: `3px solid ${s.color}`, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{s.label} →</div>
            </div>
          ))}
        </div>

        <Card style={{ padding: "16px 20px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📊 到期概览</h3>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[["#DC2626", "已过期", expired], ["#D97706", "90天内", within90], ["#FBBF24", "120天内", within120]].map(([color, label, count]) => (
                <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color as string }} />
                  <span style={{ fontSize: 13 }}>{label} <strong style={{ color: color as string }}>{count}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { type: "EP到期",    icon: "🛂", color: colors.purple, bg: "#F3E8FF" },
            { type: "护照到期",  icon: "🛂", color: "#0891B2",     bg: "#CFFAFE" },
            { type: "挂名到期",  icon: "👤", color: colors.blue,   bg: "#DBEAFE" },
            { type: "秘书到期",  icon: "📋", color: colors.orange,  bg: "#FEF3C7" },
            { type: "地址到期",  icon: "📍", color: "#059669",     bg: "#D1FAE5" },
            { type: "代运营到期",icon: "⚙️", color: "#7C3AED",     bg: "#EDE9FE" },
          ].map(cat => {
            const items = alertsByType[cat.type] || [];
            const expiredCount = items.filter(a => a.days <= 0).length;
            const urgentCount = items.filter(a => a.days > 0 && a.days <= 90).length;

            const isExpanded = expandedExpiryTypes.has(cat.type);
            const displayItems = isExpanded ? items : items.slice(0, 4);
            const toggleExpand = () => setExpandedExpiryTypes(prev => {
              const next = new Set(prev);
              next.has(cat.type) ? next.delete(cat.type) : next.add(cat.type);
              return next;
            });
            return (
              <Card key={cat.type} style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", background: cat.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{cat.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: cat.color }}>{cat.type}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {expiredCount > 0 && <Badge color="#fff" bg={colors.red}>{expiredCount} 过期</Badge>}
                    {urgentCount > 0 && <Badge color="#fff" bg={colors.orange}>{urgentCount} 紧急</Badge>}
                    {expiredCount === 0 && urgentCount === 0 && <Badge color={cat.color} bg="#fff">全部正常</Badge>}
                  </div>
                </div>
                <div style={{ padding: "8px 12px" }}>
                  {items.length === 0 ? (
                    <div style={{ padding: "12px 6px", color: "#A8A29E", fontSize: 13, textAlign: "center" }}>暂无预警</div>
                  ) : displayItems.map((a, i) => {
                    const u = urgency(a.days);
                    return (
                      <div key={i} onClick={() => openCompany(mapped.find(m => m.company === a.company)!)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 8, cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#FAFAF9")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: u.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.company}</div>
                        <div style={{ fontSize: 12, color: u.color, fontWeight: 700, whiteSpace: "nowrap" }}>{a.days <= 0 ? "已过期" : `${a.days}天`}</div>
                      </div>
                    );
                  })}
                  {items.length > 4 && (
                    <div onClick={toggleExpand} style={{ textAlign: "center", padding: "6px 0", fontSize: 12, color: cat.color, fontWeight: 600, cursor: "pointer" }}>
                      {isExpanded ? "▲ 收起" : `▼ 还有 ${items.length - 4} 项，点击展开`}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* ── 数据中心 ── */}
        {(() => {
          const total = mapped.length;
          const managedList = mapped.filter(r => r.managed === "YES");
          const ndList = mapped.filter(r => r.ndName);
          const addrList = mapped.filter(r => r.addrExpiry);
          const secList = mapped.filter(r => r.secExpiry);
          const epList = mapped.filter(r => r.epExpiry);
          const thisYear = new Date().getFullYear().toString();
          const newThisYear = mapped.filter(r => r.regDate?.startsWith(thisYear)).length;
          const newThisMonth = mapped.filter(r => {
            if (!r.regDate) return false;
            const d = new Date(r.regDate);
            const now = new Date();
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          }).length;
          const monthlyRevenue = managedList.reduce((sum, r) => {
            const n = parseFloat((r.opsFee || "").replace(/[^0-9.]/g, ""));
            return sum + (isNaN(n) ? 0 : n);
          }, 0);
          const totalOverdue = alerts.filter(a => a.days <= 0).length;
          const totalUrgent = alerts.filter(a => a.days > 0 && a.days <= 90).length;

          const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;

          const ServiceCard = ({ icon, label, count, color, bg }: { icon: string; label: string; count: number; color: string; bg: string }) => (
            <div style={{ background: bg, borderRadius: 12, padding: "16px 18px", flex: 1 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 2 }}>{count}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.08)" }}>
                <div style={{ height: 5, borderRadius: 3, background: color, width: `${pct(count)}%`, transition: "width .4s" }} />
              </div>
              <div style={{ fontSize: 12, color, opacity: 0.6, marginTop: 4 }}>{pct(count)}% 客户</div>
            </div>
          );

          return (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>📊 数据中心</div>

              {/* 服务分布 */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>服务分布</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                {ServiceCard({ icon: "⚙️", label: "代运营", count: managedList.length, color: "#7C3AED", bg: "#F5F3FF" })}
                {ServiceCard({ icon: "👤", label: "挂名董事", count: ndList.length, color: "#2563EB", bg: "#EFF6FF" })}
                {ServiceCard({ icon: "🛂", label: "EP 客户", count: epList.length, color: "#0891B2", bg: "#ECFEFF" })}
                {ServiceCard({ icon: "📍", label: "注册地址", count: addrList.length, color: "#059669", bg: "#F0FDF4" })}
                {ServiceCard({ icon: "📋", label: "秘书服务", count: secList.length, color: "#D97706", bg: "#FFFBEB" })}
              </div>

              {/* 财务 + 增长 + 健康度 */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>财务 · 增长 · 健康度</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {/* 月收入 */}
                <div style={{ background: "#F5F3FF", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, color: "#7C3AED", fontWeight: 700, marginBottom: 10 }}>💰 代运营月收入估算</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "#7C3AED", marginBottom: 6 }}>
                    SGD {monthlyRevenue.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: "#A8A29E" }}>
                    来自 {managedList.filter(r => r.opsFee).length} 家已填写运营费的客户
                  </div>
                  {managedList.filter(r => !r.opsFee).length > 0 && (
                    <div style={{ fontSize: 13, color: "#D97706", marginTop: 6 }}>
                      ⚠️ {managedList.filter(r => !r.opsFee).length} 家代运营客户未填运营费
                    </div>
                  )}
                </div>

                {/* 新增 */}
                <div style={{ background: "#F0FDF4", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, color: "#059669", fontWeight: 700, marginBottom: 10 }}>🌱 客户增长</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: "#059669" }}>{newThisYear}</div>
                      <div style={{ fontSize: 13, color: "#A8A29E" }}>{thisYear} 年新增</div>
                    </div>
                    <div style={{ paddingBottom: 2 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#34D399" }}>{newThisMonth}</div>
                      <div style={{ fontSize: 13, color: "#A8A29E" }}>本月新增</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#A8A29E" }}>共 {total} 家客户公司</div>
                </div>

                {/* 健康度 */}
                <div style={{ background: totalOverdue > 0 ? "#FEF2F2" : "#F0FDF4", borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, color: totalOverdue > 0 ? "#DC2626" : "#059669", fontWeight: 700, marginBottom: 10 }}>
                    {totalOverdue > 0 ? "⚠️" : "✅"} 到期健康度
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: "#DC2626" }}>{totalOverdue}</div>
                      <div style={{ fontSize: 13, color: "#A8A29E" }}>已过期项</div>
                    </div>
                    <div style={{ paddingBottom: 2 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#D97706" }}>{totalUrgent}</div>
                      <div style={{ fontSize: 13, color: "#A8A29E" }}>90天内到期</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#A8A29E" }}>覆盖 EP、护照、挂名、秘书、地址、代运营</div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const CompanyList = () => (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {([["all", `全部(${mapped.length})`], ["action", "需做报表"], ["ep", "持EP"], ["closed", "已关闭"]] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: tab === k ? "2px solid #0C0A09" : "2px solid #E7E5E4", background: tab === k ? "#0C0A09" : "#fff", color: tab === k ? "#fff" : "#78716C" }}>{l}</button>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#FAFAF9" }}>
              {["公司名称", "UEN", "客户", "EP到期", "挂名到期", "秘书到期", "工作状态"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 10px", borderBottom: "2px solid #E7E5E4", fontWeight: 700, fontSize: 11, color: "#78716C", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const epD = daysBetween(r.epExpiry);
              const ndD = daysBetween(r.ndExpiry);
              const secD = daysBetween(r.secExpiry);
              return (
                <tr key={r._id} onClick={() => openCompany(r)} style={{ cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#FAFAF9")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #F5F5F4", fontWeight: 600 }}>{r.company}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #F5F5F4", fontFamily: "monospace", fontSize: 12, color: "#78716C" }}>{r.uen}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #F5F5F4" }}>{r.clientName}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #F5F5F4" }}>{r.epExpiry ? <Badge color={urgency(epD).color} bg={urgency(epD).bg}>{urgency(epD).icon} {r.epExpiry}</Badge> : "—"}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #F5F5F4" }}>{r.ndExpiry ? <Badge color={urgency(ndD).color} bg={urgency(ndD).bg}>{urgency(ndD).icon} {r.ndExpiry}</Badge> : "—"}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #F5F5F4" }}>{r.secExpiry ? <Badge color={urgency(secD).color} bg={urgency(secD).bg}>{urgency(secD).icon} {r.secExpiry}</Badge> : "—"}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #F5F5F4", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{r.work || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#A8A29E" }}>未找到匹配结果</div>}
      </Card>
      <div style={{ fontSize: 12, color: "#A8A29E", padding: "4px 0" }}>显示 {filtered.length} / {mapped.length}</div>
    </div>
  );

  const Detail = () => {
    if (!selected) return null;
    const r = selected;
    const [editing, setEditing] = useState<string | null>(null);
    const [editVal, setEditVal] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [editingCompany, setEditingCompany] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState("");
    const [confirmingRename, setConfirmingRename] = useState(false);

    let previousNames: string[] = [];
    try { previousNames = JSON.parse(r.previousNames || "[]"); } catch { previousNames = []; }

    const handleRenameConfirm = () => {
      const oldName = r.company;
      const newName = newCompanyName.trim();
      if (!newName || newName === oldName) { setEditingCompany(false); setConfirmingRename(false); return; }
      const updatedPrevNames = JSON.stringify([...previousNames, oldName]);
      const updated = { ...r, company: newName, previousNames: updatedPrevNames };
      setSelected(updated);
      setData(prev => prev.map(item => item._id === updated._id ? updated : item));
      setDetailSaved(true);
      setTimeout(() => setDetailSaved(false), 1500);
      addLog("改名", oldName, "公司名称", oldName, newName);
      void (async () => { try { await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id)); } catch (e) { console.error("Update failed:", e); } })();
      setEditingCompany(false);
      setConfirmingRename(false);
    };

    const startEdit = (fieldKey: string, currentVal: string) => { setEditing(fieldKey); setEditVal(currentVal || ""); };

    const doSave = (fieldKey: string, value: string) => {
      const oldVal = r[fieldKey as keyof CompanyRow] as string || "";
      if (value === oldVal) { setEditing(null); return; }
      const updated = { ...r, [fieldKey]: value };
      setEditing(null);
      setSelected(updated);
      setData(prev => prev.map(item => item._id === updated._id ? updated : item));
      setDetailSaved(true);
      setTimeout(() => setDetailSaved(false), 1500);
      addLog("修改", r.company, FIELD_LABELS[fieldKey] || fieldKey, oldVal, value);
      void (async () => { try { await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id)); } catch (e) { console.error("Update failed:", e); } })();
    };

    const cancelEdit = () => { setEditing(null); setEditVal(""); };
    // e.nativeEvent.isComposing: 中文选字期间为 true，此时 Enter 用于确认选字，不触发保存
    const handleKeyDown = (e: React.KeyboardEvent, fieldKey: string) => {
      if (e.key === "Enter" && !e.nativeEvent.isComposing) doSave(fieldKey, editVal);
      if (e.key === "Escape") cancelEdit();
    };

    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{title}</div>
        {children}
      </div>
    );

    const Field = ({ label, fieldKey, fill, isDate }: { label: string; fieldKey: string; fill?: string; isDate?: boolean }) => {
      const value = r[fieldKey as keyof CompanyRow] as string || "";
      const isEditingField = editing === fieldKey;
      const displayValue = isDate ? formatDateDisplay(value) : value;
      return (
        <div onClick={() => !isEditingField && startEdit(fieldKey, value)}
          style={{ background: fill || "#FAFAF9", borderRadius: 10, padding: "10px 14px", cursor: isEditingField ? "default" : "pointer", border: isEditingField ? "2px solid #0C0A09" : "2px solid transparent", transition: "border .15s" }}
          title="点击编辑">
          <div style={{ fontSize: 12, color: "#A8A29E", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
            {label}
            {!isEditingField && <span style={{ fontSize: 11, color: "#D6D3D1" }}>✏️</span>}
          </div>
          {isEditingField ? (
            <input autoFocus type={isDate ? "date" : "text"} value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => handleKeyDown(e, fieldKey)}
              onBlur={e => doSave(fieldKey, e.target.value)}
              style={{ width: "100%", fontSize: 14, fontWeight: 600, padding: "4px 8px", border: "none", borderRadius: 6, outline: "none", background: "#fff", fontFamily: FONT, boxSizing: "border-box" }} />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-word", minHeight: 20 }}>{displayValue || "—"}</div>
          )}
        </div>
      );
    };

    const ExpiryField = ({ label, fieldKey, startFieldKey, topField }: {
      label: string; fieldKey: string; startFieldKey?: string;
      topField?: { label: string; fieldKey: string };
    }) => {
      const dateStr = r[fieldKey as keyof CompanyRow] as string || "";
      const startStr = startFieldKey ? (r[startFieldKey as keyof CompanyRow] as string || "") : "";
      const topVal = topField ? (r[topField.fieldKey as keyof CompanyRow] as string || "") : "";
      const days = daysBetween(dateStr);
      const u = urgency(days);
      const isEditingDate = editing === fieldKey;
      const isEditingStart = editing === startFieldKey;
      const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, minHeight: 24 };
      const labelStyle: React.CSSProperties = { fontSize: 11, color: "#A8A29E", flexShrink: 0, width: 30 };
      return (
        <div onClick={() => !isEditingDate && !isEditingStart && startEdit(fieldKey, dateStr)}
          style={{ background: u.bg || "#FAFAF9", borderRadius: 10, padding: "10px 14px", cursor: isEditingDate || isEditingStart ? "default" : "pointer" }}>
          <div style={{ fontSize: 12, color: "#A8A29E", marginBottom: 6, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
            {label}<span style={{ fontSize: 11, color: "#D6D3D1" }}>✏️</span>
          </div>
          {/* Row 1: either topField (read-only display) or 开始日期 */}
          <div style={{ ...rowStyle, marginBottom: 4 }}>
            {topField ? (
              <>
                <span style={labelStyle}>{topField.label}</span>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#44403C" }}>
                  {topVal || <span style={{ color: "#D6D3D1" }}>—</span>}
                </div>
              </>
            ) : startFieldKey ? (
              <>
                <span style={labelStyle}>开始</span>
                {isEditingStart ? (
                  <input autoFocus type="date" value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => handleKeyDown(e, startFieldKey)} onBlur={e => doSave(startFieldKey, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, fontSize: 12, fontWeight: 600, border: "none", outline: "none", background: "transparent", fontFamily: FONT, color: "#44403C", boxSizing: "border-box" }} />
                ) : (
                  <div onClick={e => { e.stopPropagation(); startEdit(startFieldKey, startStr); }} style={{ fontSize: 12, fontWeight: 600, color: "#44403C", cursor: "pointer" }}>
                    {startStr ? formatDateDisplay(startStr) : <span style={{ color: "#D6D3D1" }}>点击设置</span>}
                  </div>
                )}
              </>
            ) : null}
          </div>
          {/* Row 2: 到期日期 */}
          <div style={rowStyle}>
            {(startFieldKey || topField) && <span style={labelStyle}>到期</span>}
            {isEditingDate ? (
              <input autoFocus type="date" value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => handleKeyDown(e, fieldKey)} onBlur={e => doSave(fieldKey, e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ flex: 1, fontSize: 13, fontWeight: 700, border: "none", outline: "none", background: "transparent", fontFamily: FONT, color: u.color, boxSizing: "border-box" }} />
            ) : (
              <div onClick={e => { e.stopPropagation(); startEdit(fieldKey, dateStr); }} style={{ fontSize: 13, fontWeight: 700, color: u.color, cursor: "pointer" }}>
                {u.icon} {dateStr ? formatDateDisplay(dateStr) : <span style={{ color: "#D6D3D1", fontWeight: 400 }}>点击设置</span>} {days !== null ? `(${u.label})` : ""}
              </div>
            )}
          </div>
        </div>
      );
    };

    const isDone = (val: string) => {
      if (!val) return false;
      const v = val.toUpperCase();
      return v === "YES" || v === "DONE" || v === "✓" || v === "NOREC" || v.includes("YES");
    };

    const toggleTodo = (fieldKey: string) => {
      const oldVal = r[fieldKey as keyof CompanyRow] as string || "";
      const newVal = isDone(oldVal) ? "" : "YES";
      const updated = { ...r, [fieldKey]: newVal };
      setSelected(updated);
      setData(prev => prev.map(item => item._id === updated._id ? updated : item));
      setDetailSaved(true);
      setTimeout(() => setDetailSaved(false), 1500);
      addLog("修改", r.company, FIELD_LABELS[fieldKey] || fieldKey, oldVal, newVal);
      void (async () => { try { await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id)); } catch (e) { console.error("Update failed:", e); } })();
    };

    let allTodosRaw: Array<{ id: number | string; text?: string; done: boolean; isDefault?: boolean; hidden?: boolean }> = [];
    try { allTodosRaw = JSON.parse(r.customTodos || "[]"); } catch { allTodosRaw = []; }
    const hiddenDefaultKeys = new Set(allTodosRaw.filter(t => t.isDefault && t.hidden).map(t => String(t.id)));
    const customTodos = allTodosRaw.filter(t => !t.isDefault) as Array<{ id: number; text: string; done: boolean }>;

    const saveCustomTodos = (updatedTodos: typeof customTodos) => {
      const hiddenDefaults = allTodosRaw.filter(t => t.isDefault && t.hidden);
      const updatedRecord = { ...r, customTodos: JSON.stringify([...hiddenDefaults, ...updatedTodos]) };
      setSelected(updatedRecord);
      setData(prev => prev.map(item => item._id === updatedRecord._id ? updatedRecord : item));
      setDetailSaved(true);
      setTimeout(() => setDetailSaved(false), 1500);
      void (async () => { try { await supabase.from("companies").update(rowToDb(updatedRecord)).eq("id", String(updatedRecord._id)); } catch (e) { console.error("Update failed:", e); } })();
    };

    const deleteDefaultTodo = (key: string) => {
      const hiddenEntry = { id: key, done: false, isDefault: true, hidden: true };
      const updatedRecord = { ...r, customTodos: JSON.stringify([...allTodosRaw.filter(t => !(t.isDefault && String(t.id) === key)), hiddenEntry]) };
      addLog("删除待办", r.company, "", key, "");
      setSelected(updatedRecord);
      setData(prev => prev.map(item => item._id === updatedRecord._id ? updatedRecord : item));
      setDetailSaved(true);
      setTimeout(() => setDetailSaved(false), 1500);
      void (async () => { try { await supabase.from("companies").update(rowToDb(updatedRecord)).eq("id", String(updatedRecord._id)); } catch (e) { console.error("Update failed:", e); } })();
    };

    const TodoRow = ({ done, label, onToggle, onRemove }: { done: boolean; label: string; onToggle: () => void; onRemove?: () => void }) => (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: done ? "#F0FDF4" : "#FAFAF9", border: done ? "1px solid #BBF7D0" : "1px solid #E7E5E4" }}>
        <div onClick={onToggle} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: done ? "none" : "2px solid #D6D3D1", background: done ? "#16A34A" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {done && <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>✓</span>}
        </div>
        <div onClick={onToggle} style={{ flex: 1, cursor: "pointer" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: done ? "#16A34A" : colors.text, textDecoration: done ? "line-through" : "none" }}>{label}</div>
        </div>
        <div style={{ fontSize: 12, color: done ? "#16A34A" : "#A8A29E", fontWeight: 600 }}>{done ? "已完成" : "待办"}</div>
        {onRemove && <span onClick={onRemove} style={{ cursor: "pointer", fontSize: 16, color: "#D6D3D1", padding: "0 4px" }}>✕</span>}
      </div>
    );

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => { setView("list"); setSelected(null); }} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>← 返回列表</button>
          {detailSaved && <span style={{ fontSize: 13, color: colors.green, fontWeight: 600, background: "#F0FDF4", padding: "6px 14px", borderRadius: 8 }}>✓ 已保存</span>}
        </div>
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20, flexShrink: 0, marginTop: 2 }}>{(r.company || "?")[0]}</div>
            <div style={{ flex: 1 }}>
              {editingCompany ? (
                <div>
                  <input autoFocus value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing && newCompanyName.trim() && newCompanyName.trim() !== r.company) setConfirmingRename(true); if (e.key === "Escape") setEditingCompany(false); }}
                    style={{ width: "100%", fontSize: 18, fontWeight: 800, padding: "6px 10px", borderRadius: 8, border: "2px solid #0C0A09", outline: "none", fontFamily: FONT, boxSizing: "border-box", marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { if (newCompanyName.trim() && newCompanyName.trim() !== r.company) setConfirmingRename(true); }} disabled={!newCompanyName.trim() || newCompanyName.trim() === r.company}
                      style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: newCompanyName.trim() && newCompanyName.trim() !== r.company ? "#0C0A09" : "#D6D3D1", color: "#fff", fontSize: 13, fontWeight: 700, cursor: newCompanyName.trim() && newCompanyName.trim() !== r.company ? "pointer" : "not-allowed" }}>确认改名</button>
                    <button onClick={() => setEditingCompany(false)} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #E7E5E4", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>取消</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{r.company}</h2>
                  <span onClick={() => { setNewCompanyName(r.company); setEditingCompany(true); }} title="修改公司名"
                    style={{ cursor: "pointer", fontSize: 14, color: "#A8A29E", padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}>✏️</span>
                </div>
              )}
              <div style={{ fontSize: 13, color: colors.muted, marginTop: editingCompany ? 8 : 4 }}>UEN: {r.uen || "—"}</div>
              {previousNames.length > 0 && (
                <div style={{ fontSize: 12, color: "#A8A29E", marginTop: 4 }}>
                  曾用名：{previousNames.map((n, i) => <span key={i} style={{ marginRight: 6 }}>{n}{i < previousNames.length - 1 ? "、" : ""}</span>)}
                </div>
              )}
            </div>
          </div>
          {confirmingRename && (
            <div onClick={() => setConfirmingRename(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, maxWidth: 480, width: "100%", padding: 28 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>⚠️ 确认公司改名</h3>
                <div style={{ background: "#FAFAF9", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "#A8A29E", marginBottom: 4 }}>原公司名</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{r.company}</div>
                </div>
                <div style={{ background: "#F0FDF4", borderRadius: 12, padding: "14px 16px", marginBottom: 20, border: "1px solid #BBF7D0" }}>
                  <div style={{ fontSize: 12, color: "#16A34A", marginBottom: 4 }}>新公司名</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#16A34A" }}>{newCompanyName.trim()}</div>
                </div>
                <p style={{ fontSize: 13, color: "#78716C", marginBottom: 20 }}>确认后，原公司名将记录为"曾用名"，此操作不可撤销。</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setConfirmingRename(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #E7E5E4", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>取消</button>
                  <button onClick={handleRenameConfirm} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#0C0A09", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>确认改名</button>
                </div>
              </div>
            </div>
          )}
          <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#92400E" }}>
            💡 点击任意字段即可编辑，修改后自动保存
          </div>
          {/* ── 公司信息 ── */}
          {Section({ title: "公司信息", children: (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, marginBottom: 8 }}>
                {/* 公司状态开关 */}
                <div style={{ background: r.status === "STRIKE OFF" ? "#FEF2F2" : "#F0FDF4", borderRadius: 10, padding: "10px 14px", transition: "background .2s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#A8A29E", fontWeight: 700 }}>状态</span>
                    <div onClick={() => {
                      if (r.status === "STRIKE OFF") {
                        // 恢复 LIVE
                        const updated = { ...r, status: "LIVE COMPANY", strikeOffDate: "" };
                        setSelected(updated); setData(prev => prev.map(item => item._id === updated._id ? updated : item));
                        setDetailSaved(true); setTimeout(() => setDetailSaved(false), 1500);
                        addLog("修改", r.company, "状态", "STRIKE OFF", "LIVE COMPANY");
                        void (async () => { try { await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id)); } catch {} })();
                      } else {
                        // 弹出日期确认
                        setStrikeOffDateInput("");
                        setStrikeOffModal(true);
                      }
                    }} style={{ width: 36, height: 20, borderRadius: 10, background: r.status === "STRIKE OFF" ? "#D6D3D1" : "#16A34A", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 2, left: r.status === "STRIKE OFF" ? 2 : 18, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: r.status === "STRIKE OFF" ? "#DC2626" : "#16A34A" }}>
                    {r.status === "STRIKE OFF" ? "STRIKE OFF" : "LIVE COMPANY"}
                  </div>
                  {r.status === "STRIKE OFF" && r.strikeOffDate && (
                    <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4, fontWeight: 500 }}>{formatDateDisplay(r.strikeOffDate)}</div>
                  )}
                </div>
                {Field({ label: "注册日期", fieldKey: "regDate", isDate: true })}
                {Field({ label: "FYE", fieldKey: "fye", isDate: true })}
                {Field({ label: "银行账户", fieldKey: "bank" })}
                {Field({ label: "RORC", fieldKey: "rorc" })}
                {/* 代运营 + 运营费 combined cell */}
                <div style={{ background: r.managed === "YES" ? "#F0FDF4" : "#FEF2F2", borderRadius: 10, padding: "10px 14px", transition: "background .2s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#A8A29E", fontWeight: 700 }}>代运营</span>
                    <div onClick={() => {
                      const updated = { ...r, managed: r.managed === "YES" ? "" : "YES" };
                      setSelected(updated); setData(prev => prev.map(item => item._id === updated._id ? updated : item));
                      setDetailSaved(true); setTimeout(() => setDetailSaved(false), 1500);
                      addLog("修改", r.company, "代运营", r.managed || "否", updated.managed || "否");
                      void (async () => { try { await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id)); } catch {} })();
                    }} style={{ width: 36, height: 20, borderRadius: 10, background: r.managed === "YES" ? "#16A34A" : "#D6D3D1", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 2, left: r.managed === "YES" ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid #E7E5E4", paddingTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#A8A29E", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>运营费/月{editing !== "opsFee" && <span style={{ fontSize: 11, color: "#D6D3D1" }}>✏️</span>}</div>
                    {editing === "opsFee" ? (
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => handleKeyDown(e, "opsFee")} onBlur={e => doSave("opsFee", e.target.value)} style={{ width: "100%", fontSize: 14, fontWeight: 600, padding: "4px 8px", border: "none", borderRadius: 6, outline: "none", background: "#fff", fontFamily: FONT, boxSizing: "border-box" }} />
                    ) : (
                      <div onClick={() => startEdit("opsFee", r.opsFee)} style={{ fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 20 }}>{r.opsFee || "—"}</div>
                    )}
                  </div>
                </div>
              </div>
              {/* 注册地址 - 长条 */}
              {Field({ label: "注册地址", fieldKey: "address" })}
            </div>
          )})}

          {/* ── 客户 / EP 信息 ── */}
          {Section({ title: "客户 / EP 信息", children: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 }}>
              {Field({ label: "客户姓名", fieldKey: "clientName" })}
              {Field({ label: "手机号", fieldKey: "phone" })}
              {Field({ label: "护照号", fieldKey: "passportNo" })}
              {Field({ label: "护照到期日", fieldKey: "passportExpiry", isDate: true })}
              {Field({ label: "EP证件号", fieldKey: "epNo" })}
              {Field({ label: "EP到期日", fieldKey: "epExpiry", isDate: true })}
            </div>
          )})}

          {/* ── 到期提醒 ── */}
          {Section({ title: "到期提醒", children: (() => {
            // 只读卡片：EP到期 & 护照到期（数据来自客户信息，不可在此编辑）
            const ReadOnlyExpiryCard = ({ label, dateStr, topLabel, topVal }: { label: string; dateStr: string; topLabel: string; topVal: string }) => {
              const days = daysBetween(dateStr);
              const u = urgency(days);
              return (
                <div style={{ background: u.bg || "#FAFAF9", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, color: "#A8A29E", marginBottom: 6, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                    {label}<span style={{ fontSize: 10, color: "#D6D3D1" }}>客户信息</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 24, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#A8A29E", flexShrink: 0, width: 30 }}>{topLabel}</span>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#44403C" }}>{topVal || <span style={{ color: "#D6D3D1" }}>—</span>}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 24 }}>
                    <span style={{ fontSize: 11, color: "#A8A29E", flexShrink: 0, width: 30 }}>到期</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: u.color }}>
                      {u.icon} {dateStr ? formatDateDisplay(dateStr) : <span style={{ color: "#D6D3D1", fontWeight: 400 }}>—</span>} {days !== null ? `(${u.label})` : ""}
                    </div>
                  </div>
                </div>
              );
            };
            const editableItems: { label: string; fieldKey: string; startFieldKey?: string }[] = [
              { label: "挂名董事到期", fieldKey: "ndExpiry",      startFieldKey: "ndStart" },
              { label: "秘书到期",     fieldKey: "secExpiry",     startFieldKey: "secStart" },
              { label: "地址到期",     fieldKey: "addrExpiry",    startFieldKey: "addrStart" },
              { label: "代运营到期",   fieldKey: "managedExpiry", startFieldKey: "managedStart" },
            ];
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {ReadOnlyExpiryCard({ label: "EP到期", dateStr: r.epExpiry || "", topLabel: "证件号", topVal: r.epNo || "" })}
                {ReadOnlyExpiryCard({ label: "护照到期", dateStr: r.passportExpiry || "", topLabel: "护照号", topVal: r.passportNo || "" })}
                {editableItems.map(i => <div key={i.fieldKey}>{ExpiryField({ label: i.label, fieldKey: i.fieldKey, startFieldKey: i.startFieldKey })}</div>)}
              </div>
            );
          })()})}

          {/* ── 人员与股权 ── */}
          {Section({ title: "人员与股权", children: (() => {
            let directors: {name: string; role: string}[] = [];
            try { directors = JSON.parse(r.directorsJson || "[]"); } catch { directors = []; }
            let shareholders: BizFileShareholder[] = [];
            try { shareholders = JSON.parse(r.shareholdersJson || "[]"); } catch { shareholders = []; }
            let changeLogs: {date: string; type: "director"|"shareholder"; note: string}[] = [];
            try { changeLogs = JSON.parse(r.personnelChangeLogs || "[]"); } catch { changeLogs = []; }
            const directorLogs = changeLogs.filter(l => l.type === "director");
            const shareholderLogs = changeLogs.filter(l => l.type === "shareholder");

            const handlePersonnelRescan = async (file: File) => {
              setPersonnelRescanning(true);
              setPersonnelRescanError("");
              try {
                const data = await parseBizFilePdf(file);
                // Build new directors list, preserve existing roles
                const roleMap: Record<string, string> = {};
                directors.forEach(d => { roleMap[d.name.trim().toUpperCase()] = d.role; });
                const newDirectors = (data.directors || []).map(name => ({
                  name: name.trim().toUpperCase(), role: roleMap[name.trim().toUpperCase()] || "director"
                }));
                if (data.secretary) newDirectors.push({ name: data.secretary.trim().toUpperCase(), role: roleMap[data.secretary.trim().toUpperCase()] || "secretary" });
                const newShareholders: BizFileShareholder[] = data.shareholders || [];

                // Detect changes
                const oldDirNames = new Set(directors.map(d => d.name.toUpperCase()));
                const newDirNames = new Set(newDirectors.map(d => d.name.toUpperCase()));
                const dirChanged = [...newDirNames].some(n => !oldDirNames.has(n)) || [...oldDirNames].some(n => !newDirNames.has(n));

                const oldShStr = JSON.stringify(shareholders.map(s => `${s.name}:${s.shares}`).sort());
                const newShStr = JSON.stringify(newShareholders.map(s => `${s.name}:${s.shares}`).sort());
                const shChanged = oldShStr !== newShStr;

                const today = new Date().toISOString().split("T")[0];
                const newLogs = [...changeLogs];
                if (dirChanged) newLogs.push({ date: today, type: "director", note: "有过董事变更" });
                if (shChanged) newLogs.push({ date: today, type: "shareholder", note: "有过股东或股权变更" });

                const updated = {
                  ...r,
                  directorsJson: JSON.stringify(newDirectors),
                  shareholdersJson: JSON.stringify(newShareholders),
                  personnelChangeLogs: JSON.stringify(newLogs),
                };
                setSelected(updated);
                setData(prev => prev.map(item => item._id === updated._id ? updated : item));
                setDetailSaved(true);
                setTimeout(() => setDetailSaved(false), 1500);
                if (dirChanged || shChanged) {
                  addLog("人员变更", r.company, "", "", dirChanged && shChanged ? "董事+股东变更" : dirChanged ? "董事变更" : "股东变更");
                }
                await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id));
              } catch (e) {
                setPersonnelRescanError((e as Error).message || "扫描失败");
              } finally {
                setPersonnelRescanning(false);
              }
            };

            const ChangeLogList = ({ logs }: { logs: typeof changeLogs }) => (
              logs.length > 0 ? (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {logs.map((l, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#FEF9C3", borderRadius: 8, border: "1px solid #FDE68A" }}>
                      <span style={{ fontSize: 12 }}>📋</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>{l.note}</span>
                      <span style={{ fontSize: 11, color: "#A8A29E", marginLeft: "auto" }}>{formatDateDisplay(l.date)}</span>
                    </div>
                  ))}
                </div>
              ) : null
            );

            const roleLabel: Record<string, {label: string; color: string; bg: string}> = {
              nominal: { label: "挂名董事", color: "#2563EB", bg: "#DBEAFE" },
              client:  { label: "客户", color: "#16A34A", bg: "#DCFCE7" },
              secretary: { label: "秘书", color: "#D97706", bg: "#FEF3C7" },
              director: { label: "董事", color: "#7C3AED", bg: "#F3E8FF" },
            };

            // Rescan button + hidden input
            const rescanBtn = (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {personnelRescanError && <span style={{ fontSize: 11, color: "#DC2626" }}>{personnelRescanError}</span>}
                <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: "#F5F3FF", border: "1px solid #DDD6FE", cursor: personnelRescanning ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: "#7C3AED" }}>
                  {personnelRescanning ? "⏳ 扫描中..." : "📄 扫描 BizFile 更新"}
                  <input type="file" accept=".pdf,application/pdf" style={{ display: "none" }} disabled={personnelRescanning}
                    onChange={e => { const f = e.target.files?.[0]; if (f) { handlePersonnelRescan(f); e.target.value = ""; } }} />
                </label>
              </div>
            );

            const hasData = directors.length > 0 || shareholders.length > 0 || r.ndName || r.secName;
            if (!hasData) return (
              <div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>{rescanBtn}</div>
                <div style={{ padding: "12px 0", fontSize: 13, color: "#A8A29E", textAlign: "center" }}>暂无人员信息 · 通过上传 BizFile 自动填充</div>
              </div>
            );
            return (
              <div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>{rescanBtn}</div>
                {/* Directors / Officers */}
                {(directors.length > 0 || r.ndName || r.secName) && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase", marginBottom: 8 }}>董事 / 秘书</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {directors.length > 0 ? directors.map((d, i) => {
                        const cfg = roleLabel[d.role] || { label: d.role, color: "#78716C", bg: "#F5F5F4" };
                        const roleOrder = ["director", "nominal", "client", "secretary"];
                        const nextRole = () => {
                          const idx = roleOrder.indexOf(d.role);
                          const next = roleOrder[(idx + 1) % roleOrder.length];
                          const newDirs = directors.map((x, j) => j === i ? { ...x, role: next } : x);
                          const updated = { ...r, directorsJson: JSON.stringify(newDirs) };
                          setSelected(updated); setData(prev => prev.map(item => item._id === updated._id ? updated : item));
                          void (async () => { try { await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id)); } catch {} })();
                        };
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#FAFAF9", borderRadius: 10, border: "1px solid #F0EFEE" }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: cfg.color, flexShrink: 0 }}>{(d.name || "?")[0]}</div>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{d.name}</span>
                            <span onClick={nextRole} title="点击切换角色" style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color, cursor: "pointer", userSelect: "none" }}>{cfg.label} ↻</span>
                          </div>
                        );
                      }) : (
                        <>
                          {r.ndName && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#FAFAF9", borderRadius: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#2563EB", flexShrink: 0 }}>{r.ndName[0]}</div>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{r.ndName}</span>
                            <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "#DBEAFE", color: "#2563EB" }}>挂名董事</span>
                          </div>}
                          {r.secName && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#FAFAF9", borderRadius: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#D97706", flexShrink: 0 }}>{r.secName[0]}</div>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{r.secName}</span>
                            <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "#FEF3C7", color: "#D97706" }}>秘书</span>
                          </div>}
                        </>
                      )}
                    </div>
                    {ChangeLogList({ logs: directorLogs })}
                  </div>
                )}
                {/* Shareholders */}
                {shareholders.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase", marginBottom: 8 }}>股东</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {shareholders.map((s, i) => {
                        const total = shareholders.reduce((sum, x) => sum + (x.shares || 0), 0);
                        const pct = total > 0 ? Math.round(s.shares / total * 100) : 0;
                        return (
                          <div key={i} style={{ padding: "10px 14px", background: "#FAFAF9", borderRadius: 10, border: "1px solid #F0EFEE" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F3E8FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#7C3AED", flexShrink: 0 }}>{(s.name || "?")[0]}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                                <div style={{ fontSize: 12, color: "#78716C", marginTop: 2 }}>{s.shares?.toLocaleString()} 股 {s.shareType} · {s.currency}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#7C3AED" }}>{pct}%</div>
                                <div style={{ fontSize: 11, color: "#A8A29E" }}>持股</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* 注册资本三格 */}
                    {(() => {
                      const parseAmt = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
                      const getCurrency = (s: string) => { const m = s.match(/[A-Z]{2,3}/); return m ? m[0] + " " : ""; };
                      const reg = r.registeredCapital || "";
                      const paid = r.paidCapital || "";
                      const regAmt = parseAmt(reg);
                      const paidAmt = parseAmt(paid);
                      const unpaidAmt = Math.max(0, regAmt - paidAmt);
                      const currency = getCurrency(reg) || getCurrency(paid);
                      const fullyPaid = reg && paid && unpaidAmt === 0;
                      return (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1 }}>{Field({ label: "总注册资本", fieldKey: "registeredCapital" })}</div>
                          <div style={{ flex: 1 }}>
                            <div onClick={() => editing !== "paidCapital" && startEdit("paidCapital", paid)}
                              style={{ background: "#FAFAF9", borderRadius: 10, padding: "10px 14px", cursor: editing === "paidCapital" ? "default" : "pointer", border: editing === "paidCapital" ? "2px solid #0C0A09" : "2px solid transparent", transition: "border .15s" }}>
                              <div style={{ fontSize: 12, color: "#A8A29E", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                                已缴资本{editing !== "paidCapital" && <span style={{ fontSize: 11, color: "#D6D3D1" }}>✏️</span>}
                              </div>
                              {editing === "paidCapital" ? (
                                <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                                  onKeyDown={e => handleKeyDown(e, "paidCapital")} onBlur={e => doSave("paidCapital", e.target.value)}
                                  style={{ width: "100%", fontSize: 14, fontWeight: 600, padding: "4px 8px", border: "none", borderRadius: 6, outline: "none", background: "#fff", fontFamily: FONT, boxSizing: "border-box" }} />
                              ) : (
                                <div style={{ fontSize: 14, fontWeight: 600 }}>
                                  {paid ? `${currency}${paidAmt.toLocaleString()}` : "—"}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ flex: 1, background: "#FAFAF9", borderRadius: 10, padding: "10px 14px" }}>
                            <div style={{ fontSize: 12, color: "#A8A29E", marginBottom: 3 }}>未缴资本</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: unpaidAmt > 0 ? "#DC2626" : "#16A34A" }}>
                              {reg ? `${currency}${unpaidAmt.toLocaleString()}` : "—"}
                            </div>
                          </div>
                          {fullyPaid && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "6px 10px" }}>
                              <span style={{ fontSize: 16 }}>✅</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#16A34A" }}>已实缴</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {ChangeLogList({ logs: shareholderLogs })}
                  </div>
                )}
              </div>
            );
          })()})}

          {/* ── 工作备注 ── */}
          {Section({ title: "工作备注", children: (<>
            <div style={{ marginBottom: 12 }}>
              {Field({ label: "工作备注", fieldKey: "work", fill: r.work && /(做报表|发invoice)/i.test(r.work) ? "#FEF2F2" : "" })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { key: "ar2024", label: "Annual Return 2024" },
                { key: "ar2025", label: "Annual Return 2025" },
                { key: "ya2025", label: "YA 2025 报税" },
                { key: "ya2026", label: "YA 2026 报税" },
                { key: "ltr", label: "LTR / Invoice 已发" },
              ].filter(todo => !hiddenDefaultKeys.has(todo.key)).map(todo => (
                <TodoRow key={todo.key} done={isDone(r[todo.key as keyof CompanyRow] as string || "")} label={todo.label} onToggle={() => toggleTodo(todo.key)} onRemove={() => deleteDefaultTodo(todo.key)} />
              ))}
              {customTodos.map(todo => (
                <TodoRow key={todo.id} done={todo.done} label={todo.text}
                  onToggle={() => { const u = customTodos.map(t => t.id === todo.id ? { ...t, done: !t.done } : t); addLog("修改", r.company, "待办事项", todo.done ? "已完成" : "待办", todo.done ? "待办" : "已完成"); saveCustomTodos(u); }}
                  onRemove={() => { addLog("删除待办", r.company, "", todo.text, ""); saveCustomTodos(customTodos.filter(t => t.id !== todo.id)); }} />
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <input placeholder="输入新的待办事项..." onKeyDown={e => {
                const input = e.target as HTMLInputElement;
                if (e.key === "Enter" && !e.nativeEvent.isComposing && input.value.trim()) {
                  const newTodo = { id: Date.now(), text: input.value.trim(), done: false };
                  addLog("新增待办", r.company, "", "", newTodo.text);
                  saveCustomTodos([...customTodos, newTodo]);
                  input.value = "";
                }
              }} style={{ flex: 1, width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px dashed #D6D3D1", background: "transparent", fontSize: 13, outline: "none", fontFamily: FONT }}
                onFocus={e => (e.target.style.borderColor = "#0C0A09")}
                onBlur={e => (e.target.style.borderColor = "#D6D3D1")} />
            </div>
          </>)})}
          <div style={{ borderTop: "1px solid #E7E5E4", paddingTop: 20, marginTop: 10 }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #FECACA", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#DC2626" }}>🗑️ 删除此公司</button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FEF2F2", padding: "12px 16px", borderRadius: 10 }}>
                <span style={{ fontSize: 13, color: "#DC2626", fontWeight: 600 }}>确定要删除 {r.company} 吗？此操作不可撤销</span>
                <button onClick={async () => {
                  addLog("删除公司", r.company, "", "", `UEN: ${r.uen || "无"}`);
                  setData(prev => prev.filter(item => item._id !== r._id));
                  try { await supabase.from("companies").delete().eq("id", String(r._id)); } catch {}
                  setSelected(null); setView("list"); setConfirmDelete(false);
                }} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>确认删除</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #E7E5E4", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>取消</button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  };

  const actionColors: Record<string, { color: string; bg: string; icon: string }> = {
    "修改": { color: "#2563EB", bg: "#DBEAFE", icon: "✏️" },
    "新增公司": { color: "#16A34A", bg: "#DCFCE7", icon: "➕" },
    "新增待办": { color: "#7C3AED", bg: "#F3E8FF", icon: "☑️" },
    "删除待办": { color: "#D97706", bg: "#FEF3C7", icon: "☐" },
    "删除公司": { color: "#DC2626", bg: "#FEE2E2", icon: "🗑️" },
    "导入数据": { color: "#0891B2", bg: "#CFFAFE", icon: "📂" },
    "清空数据": { color: "#DC2626", bg: "#FEE2E2", icon: "🗑️" },
  };

  return (
    <div style={{ fontFamily: FONT, background: colors.bg, minHeight: "100vh", color: colors.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ background: "#fff", borderBottom: "1px solid #E7E5E4", padding: "0 16px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 50, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => { setView("dashboard"); setSelected(null); }}>
            <img src={LOGO_URL} alt="Gi Corporate" style={{ height: 28 }} />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {([["dashboard", "📊 工作台"], ["list", "📋 客户"]] as [string, string][]).map(([k, l]) => (
              <button key={k} onClick={() => { setView(k); setSelected(null); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: view === k ? "#0C0A09" : "transparent", color: view === k ? "#fff" : "#78716C" }}>{l}</button>
            ))}
            <button onClick={() => { setView("logs"); setSelected(null); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: view === "logs" ? "#0C0A09" : "transparent", color: view === "logs" ? "#fff" : "#78716C", position: "relative" }}>
              📝 记录
              {logs.length > 0 && <span style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{logs.length > 99 ? "99+" : logs.length}</span>}
            </button>
            <button onClick={() => setShowNewForm(true)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "#16A34A", color: "#fff" }}>➕ 新增</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 16px 0" }}>
        {view !== "detail" && view !== "logs" && (
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#A8A29E" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索公司名、UEN、客户名、护照号..."
              style={{ width: "100%", padding: "11px 36px 11px 40px", borderRadius: 12, border: `2px solid ${colors.border}`, fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}
              onFocus={e => (e.target.style.borderColor = "#0C0A09")}
              onBlur={e => (e.target.style.borderColor = colors.border)} />
            {search && <span onClick={() => setSearch("")} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#A8A29E" }}>✕</span>}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px 40px" }}>
        {view === "dashboard" && !search && <Dashboard />}
        {(view === "list" || search) && !selected && <CompanyList />}
        {view === "detail" && selected && <Detail />}
        {view === "logs" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>📝 操作记录</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: colors.muted }}>共 {logs.length} 条记录</span>
                {logs.length > 0 && (
                  <button onClick={async () => {
                    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; }
                    setLogs([]);
                    try { await supabase.from("logs").delete().not("id", "is", null); } catch {}
                    setConfirmClear(false);
                  }} style={{ padding: "6px 14px", borderRadius: 8, border: confirmClear ? "none" : `1px solid ${colors.border}`, background: confirmClear ? colors.red : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: confirmClear ? "#fff" : colors.red }}>
                    {confirmClear ? "确认清空？再点一次" : "清空记录"}
                  </button>
                )}
              </div>
            </div>
            {logs.length === 0 ? (
              <Card><div style={{ textAlign: "center", padding: 40, color: "#A8A29E" }}>暂无操作记录</div></Card>
            ) : (
              <Card style={{ padding: 0 }}>
                {logs.map((log, i) => {
                  const ac = actionColors[log.action] || { color: "#78716C", bg: "#F5F5F4", icon: "📋" };
                  return (
                    <div key={log.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", borderBottom: i < logs.length - 1 ? "1px solid #F5F5F4" : "none" }}>
                      <div style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{ac.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: ac.color, background: ac.bg }}>{log.action}</span>
                          {log.company && <span style={{ fontWeight: 700, fontSize: 14 }}>{log.company}</span>}
                          {log.field && <span style={{ fontSize: 13, color: colors.muted }}>· {log.field}</span>}
                        </div>
                        {log.action === "修改" && (
                          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                            <span style={{ color: colors.red, background: "#FEF2F2", padding: "1px 6px", borderRadius: 4, textDecoration: "line-through" }}>{log.oldVal || "(空)"}</span>
                            <span style={{ color: "#A8A29E", margin: "0 6px" }}>→</span>
                            <span style={{ color: colors.green, background: "#F0FDF4", padding: "1px 6px", borderRadius: 4 }}>{log.newVal || "(空)"}</span>
                          </div>
                        )}
                        {log.action !== "修改" && log.newVal && <div style={{ fontSize: 13, color: "#78716C" }}>{log.newVal}</div>}
                      </div>
                      <div style={{ fontSize: 12, color: "#A8A29E", whiteSpace: "nowrap", flexShrink: 0 }}>{log.time}</div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        )}
      </div>

      {showImport && <ImportModal />}

      {/* ── Strike Off 确认弹窗 ── */}
      {strikeOffModal && selected && (
        <div onClick={() => setStrikeOffModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, maxWidth: 380, width: "100%", padding: 28 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>确认 Strike Off</div>
            <div style={{ fontSize: 13, color: "#78716C", marginBottom: 20 }}>
              请填写 <strong>{selected.company}</strong> 的 Strike Off 日期，确认后该公司到期提醒将停止。
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#A8A29E", marginBottom: 6 }}>STRIKE OFF 日期</div>
              <input
                type="date"
                value={strikeOffDateInput}
                onChange={e => setStrikeOffDateInput(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid #F0EFEE", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setStrikeOffModal(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #E7E5E4", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>取消</button>
              <button
                disabled={!strikeOffDateInput}
                onClick={() => {
                  const r = selected;
                  const dateFormatted = (() => {
                    const d = new Date(strikeOffDateInput);
                    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
                    return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
                  })();
                  const updated = { ...r, status: "STRIKE OFF", strikeOffDate: dateFormatted };
                  setSelected(updated); setData(prev => prev.map(item => item._id === updated._id ? updated : item));
                  setDetailSaved(true); setTimeout(() => setDetailSaved(false), 1500);
                  addLog("修改", r.company, "状态", r.status || "LIVE COMPANY", "STRIKE OFF");
                  void (async () => { try { await supabase.from("companies").update(rowToDb(updated)).eq("id", String(updated._id)); } catch {} })();
                  setStrikeOffModal(false);
                }}
                style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: strikeOffDateInput ? "#DC2626" : "#F5F5F4", color: strikeOffDateInput ? "#fff" : "#A8A29E", cursor: strikeOffDateInput ? "pointer" : "default", fontWeight: 700, fontSize: 14 }}
              >确认 Strike Off</button>
            </div>
          </div>
        </div>
      )}

      {showNewForm && (
        <div onClick={closeNewForm} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, maxWidth: 540, width: "100%", padding: 28, maxHeight: "92vh", overflowY: "auto" }}>

            {/* ── Header with step indicator ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>➕ 新增公司</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[1, 2].map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: newFormStep === s ? "#0C0A09" : newFormStep > s ? "#16A34A" : "#E7E5E4", color: newFormStep >= s ? "#fff" : "#A8A29E" }}>
                      {newFormStep > s ? "✓" : s}
                    </div>
                    <span style={{ fontSize: 11, color: newFormStep === s ? colors.text : colors.muted, fontWeight: newFormStep === s ? 700 : 400 }}>
                      {s === 1 ? "公司信息" : "客户信息"}
                    </span>
                    {s < 2 && <span style={{ color: "#D6D3D1", fontSize: 12, marginLeft: 2 }}>›</span>}
                  </div>
                ))}
              </div>
            </div>

            {newFormStep === 1 ? (<>

              {/* ── Mode switcher (Step 1 only) ── */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#F5F5F4", padding: 4, borderRadius: 12 }}>
                {([["manual", "✏️ 手动输入"], ["bizfile", "📄 上传 BizFile"]] as [string, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => { setBizFileMode(k === "bizfile"); setExtractedBizData(null); setBizFileError(""); setDirectorRoles([]); }}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all .15s", background: (k === "bizfile") === bizFileMode ? "#fff" : "transparent", color: (k === "bizfile") === bizFileMode ? colors.text : colors.muted, boxShadow: (k === "bizfile") === bizFileMode ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>{l}</button>
                ))}
              </div>

              {!bizFileMode ? (
                /* ── Manual: company name + UEN ── */
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>公司名称 *</label>
                    <input value={newCompany} onChange={e => setNewCompany(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddCompany()} placeholder="例: RICH INTERNATIONAL BUSINESS CONSULTING PTE. LTD." autoFocus
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${colors.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: FONT }}
                      onFocus={e => (e.target.style.borderColor = "#0C0A09")} onBlur={e => (e.target.style.borderColor = colors.border)} />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>UEN（选填）</label>
                    <input value={newUen} onChange={e => setNewUen(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddCompany()} placeholder="例: 202609584R"
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${colors.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: FONT }}
                      onFocus={e => (e.target.style.borderColor = "#0C0A09")} onBlur={e => (e.target.style.borderColor = colors.border)} />
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={closeNewForm} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>取消</button>
                    <button onClick={handleAddCompany} disabled={!newCompany.trim()} style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: newCompany.trim() ? "pointer" : "not-allowed", background: newCompany.trim() ? "#0C0A09" : "#D6D3D1", color: "#fff", fontWeight: 700, fontSize: 14 }}>下一步 →</button>
                  </div>
                </>
              ) : !extractedBizData ? (
                /* ── BizFile: upload area ── */
                <div>
                  <p style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>上传 ACRA BizFile PDF，Claude AI 自动识别公司信息并填入</p>
                  {bizFileExtracting ? (
                    <div style={{ textAlign: "center", padding: "44px 20px" }}>
                      <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>正在识别中...</div>
                      <div style={{ fontSize: 13, color: colors.muted }}>Claude AI 正在读取 BizFile，请稍候</div>
                    </div>
                  ) : (
                    <>
                      <label style={{ display: "block", cursor: "pointer" }}>
                        <div style={{ border: "2px dashed #D6D3D1", borderRadius: 14, padding: "36px 20px", textAlign: "center", transition: "all .15s" }}
                          onMouseEnter={e => { (e.currentTarget.style.borderColor = "#0C0A09"); (e.currentTarget.style.background = "#FAFAF9"); }}
                          onMouseLeave={e => { (e.currentTarget.style.borderColor = "#D6D3D1"); (e.currentTarget.style.background = ""); }}>
                          <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 6 }}>点击上传 BizFile PDF</div>
                          <div style={{ fontSize: 13, color: colors.muted }}>支持 ACRA 官方 BizFile，自动提取所有公司信息</div>
                        </div>
                        <input type="file" accept=".pdf,application/pdf" onChange={handleBizFileUpload} style={{ display: "none" }} />
                      </label>
                      {bizFileError && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", color: "#DC2626", fontSize: 13, fontWeight: 600 }}>⚠️ {bizFileError}</div>}
                    </>
                  )}
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={closeNewForm} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>取消</button>
                  </div>
                </div>
              ) : (
                /* ── BizFile: extracted preview + director assignment ── */
                <div>
                  <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>✅</span><span style={{ fontSize: 13, fontWeight: 600, color: "#16A34A" }}>识别成功！请标记董事角色后进入下一步</span>
                  </div>

                  {/* Company info summary */}
                  <div style={{ display: "grid", gap: 5, marginBottom: 16 }}>
                    {([
                      ["公司名称", extractedBizData.company],
                      ["UEN", extractedBizData.uen],
                      ["注册日期", formatDateDisplay(extractedBizData.regDate)],
                      ["状态", extractedBizData.status],
                      ["注册地址", extractedBizData.address],
                      ["股东", extractedBizData.shareholders?.map(s => `${s.name} (${s.shares}股)`).join("、")],
                      ["实缴资本", extractedBizData.paidUpCapital],
                    ] as [string, string][]).filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8, padding: "7px 10px", background: "#FAFAF9", borderRadius: 8, alignItems: "start" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: colors.muted, paddingTop: 1 }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Director role assignment */}
                  {directorRoles.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase", marginBottom: 8 }}>
                        董事标记 · 点击标签分配角色
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {directorRoles.map((d, i) => (
                          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#FAFAF9", borderRadius: 10, border: "1px solid #F0EFEE" }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#E7E5E4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#78716C", flexShrink: 0 }}>{d.name[0]}</div>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                            {(["nominal", "client"] as const).map(tag => {
                              const active = d.tag === tag;
                              const cfg = tag === "nominal"
                                ? { label: "挂名董事", activeColor: "#2563EB", activeBg: "#DBEAFE" }
                                : { label: "是客户", activeColor: "#16A34A", activeBg: "#DCFCE7" };
                              return (
                                <button key={tag} onClick={() => setDirectorRoles(prev => prev.map((item, idx) => {
                                  if (idx === i) return { ...item, tag: item.tag === tag ? null : tag };
                                  if (item.tag === tag) return { ...item, tag: null };
                                  return item;
                                }))} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: active ? cfg.activeBg : "#EDEDED", color: active ? cfg.activeColor : "#A8A29E", transition: "all .15s" }}>
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      {extractedBizData.secretary && (
                        <div style={{ marginTop: 6, padding: "8px 12px", background: "#FAFAF9", borderRadius: 10, border: "1px solid #F0EFEE", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#D97706", flexShrink: 0 }}>{extractedBizData.secretary[0]}</div>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{extractedBizData.secretary}</span>
                          <span style={{ padding: "4px 10px", borderRadius: 6, background: "#FEF3C7", color: "#D97706", fontSize: 12, fontWeight: 600 }}>秘书</span>
                        </div>
                      )}
                      <p style={{ fontSize: 12, color: "#A8A29E", marginTop: 8 }}>提示：挂名董事是我们提供的挂名服务；如果其中一位董事是你的客户，标记"是客户"可自动填入客户姓名</p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={() => { setExtractedBizData(null); setDirectorRoles([]); setBizFileError(""); }} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>重新上传</button>
                    <button onClick={goToStep2} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#0C0A09", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>下一步 →</button>
                  </div>
                </div>
              )}

            </>) : (
              /* ══ Step 2: Client info ══ */
              <div>
                <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#92400E" }}>
                  💡 客户信息可跳过，之后在详情页随时补充
                </div>

                {/* Pre-fill hint for BizFile mode */}
                {bizFileMode && directorRoles.find(d => d.tag === "client") && (
                  <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16A34A", fontWeight: 600 }}>
                    ✅ 已从 BizFile 预填客户姓名
                  </div>
                )}

                {[
                  { label: "客户姓名", value: newClientName, set: setNewClientName, placeholder: "客户真实姓名", autoFocus: true },
                  { label: "手机号", value: newPhone, set: setNewPhone, placeholder: "例: +65 9123 4567" },
                  { label: "护照号", value: newPassportNo, set: setNewPassportNo, placeholder: "例: E12345678" },
                  { label: "EP证件号", value: newEpNo, set: setNewEpNo, placeholder: "例: EP1234567A" },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} autoFocus={f.autoFocus}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${colors.border}`, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: FONT }}
                      onFocus={e => (e.target.style.borderColor = "#0C0A09")} onBlur={e => (e.target.style.borderColor = colors.border)} />
                  </div>
                ))}

                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
                  <button onClick={() => setNewFormStep(1)} style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>← 返回</button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleFinalCreate(true)} style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14, color: colors.muted }}>跳过</button>
                    <button onClick={() => handleFinalCreate(false)} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#16A34A", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>✅ 创建公司</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <div style={{ textAlign: "center", padding: 16, fontSize: 11, color: "#D6D3D1" }}>
        Gi Corporate · {mapped.length} 家公司 · 团队共享数据
      </div>
    </div>
  );
}
