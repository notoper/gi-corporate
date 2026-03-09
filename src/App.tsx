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
  const importRef = useRef<HTMLTextAreaElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [detailSaved, setDetailSaved] = useState(false);

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

  const handleAddCompany = useCallback(async () => {
    if (!newCompany.trim()) return;
    const newId = String(Date.now());
    const record: CompanyRow = {
      _id: newId, company: newCompany.trim(), uen: newUen.trim(),
      type: "", status: "", regDate: "", fye: "", address: "",
      clientName: "", phone: "", passportNo: "",
      epNo: "", epExpiry: "", epStatus: "",
      ndName: "", ndExpiry: "", ndStatus: "",
      secName: "", secExpiry: "", secStatus: "",
      addrExpiry: "", addrStatus: "",
      work: "", ar2024: "", ar2025: "", ya2025: "", ya2026: "", ltr: "",
      opsFee: "", bank: "", source: "手动新增", customTodos: "",
    };
    setData(prev => [...prev, record]);
    addLog("新增公司", newCompany.trim(), "", "", newUen.trim() ? `UEN: ${newUen.trim()}` : "");
    setNewCompany("");
    setNewUen("");
    setShowNewForm(false);
    setSelected(record);
    setView("detail");
    try { await supabase.from("companies").insert(rowToDb(record)); } catch (e) { console.error("Add company failed:", e); }
  }, [newCompany, newUen, addLog]);

  // ─── Computed ───
  const mapped = useMemo(() => data, [data]);

  const filtered = useMemo(() => {
    let rows = mapped;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => Object.values(r).some(v => v && String(v).toLowerCase().includes(q)));
    }
    if (tab === "action") rows = rows.filter(r => r.work && /(做报表|发invoice|有流水)/i.test(r.work));
    if (tab === "ep") rows = rows.filter(r => r.epNo);
    if (tab === "closed") rows = rows.filter(r => r.work && /(关闭|关了|strike)/i.test(r.work));
    return rows;
  }, [mapped, search, tab]);

  const alerts = useMemo(() => {
    const list: Array<{ type: string; date: string; person: string; detail: string; company: string; days: number; uen: string }> = [];
    mapped.forEach(r => {
      const items = [
        { type: "EP到期", date: r.epExpiry, person: r.clientName, detail: r.epNo },
        { type: "挂名到期", date: r.ndExpiry, person: r.ndName, detail: "需续费" },
        { type: "秘书到期", date: r.secExpiry, person: r.secName, detail: "需续费" },
        { type: "地址到期", date: r.addrExpiry, person: "", detail: "需续费" },
      ];
      items.forEach(item => {
        const days = daysBetween(item.date);
        if (days !== null && days <= 180) {
          list.push({ ...item, company: r.company, days, uen: r.uen });
        }
      });
    });
    list.sort((a, b) => a.days - b.days);
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
      {showNewForm && (
        <div onClick={() => setShowNewForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, maxWidth: 480, width: "100%", padding: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>➕ 新增公司</h2>
            <input value={newCompany} onChange={e => setNewCompany(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddCompany()} placeholder="公司名称 *" autoFocus style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${colors.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: FONT, marginBottom: 12 }} />
            <input value={newUen} onChange={e => setNewUen(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddCompany()} placeholder="UEN（选填）" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${colors.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: FONT, marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNewForm(false)} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>取消</button>
              <button onClick={handleAddCompany} disabled={!newCompany.trim()} style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: newCompany.trim() ? "pointer" : "not-allowed", background: newCompany.trim() ? "#16A34A" : "#D6D3D1", color: "#fff", fontWeight: 700, fontSize: 14 }}>创建并填写详情</button>
            </div>
          </div>
        </div>
      )}
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
      const groups: Record<string, typeof alerts> = { "EP到期": [], "挂名到期": [], "秘书到期": [], "地址到期": [] };
      alerts.forEach(a => { if (groups[a.type]) groups[a.type].push(a); });
      return groups;
    }, []);

    const expired = alerts.filter(a => a.days <= 0).length;
    const within90 = alerts.filter(a => a.days > 0 && a.days <= 90).length;
    const within180 = alerts.filter(a => a.days > 90 && a.days <= 180).length;
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
              {[["#DC2626", "已过期", expired], ["#D97706", "90天内", within90], ["#FBBF24", "180天内", within180]].map(([color, label, count]) => (
                <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color as string }} />
                  <span style={{ fontSize: 13 }}>{label} <strong style={{ color: color as string }}>{count}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { type: "EP到期", icon: "🛂", color: colors.purple, bg: "#F3E8FF" },
            { type: "挂名到期", icon: "👤", color: colors.blue, bg: "#DBEAFE" },
            { type: "秘书到期", icon: "📋", color: colors.orange, bg: "#FEF3C7" },
            { type: "地址到期", icon: "📍", color: "#059669", bg: "#D1FAE5" },
          ].map(cat => {
            const items = alertsByType[cat.type] || [];
            const expiredCount = items.filter(a => a.days <= 0).length;
            const urgentCount = items.filter(a => a.days > 0 && a.days <= 90).length;
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
                  ) : items.slice(0, 4).map((a, i) => {
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
                  {items.length > 4 && <div style={{ textAlign: "center", padding: "6px 0", fontSize: 12, color: colors.muted }}>还有 {items.length - 4} 项...</div>}
                </div>
              </Card>
            );
          })}
        </div>

        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📌 需要行动</h3>
          {mapped.filter(r => r.work && /(做报表|发invoice|有流水)/i.test(r.work)).length === 0 ? (
            <div style={{ padding: 16, color: "#A8A29E", fontSize: 13, textAlign: "center" }}>暂无待办</div>
          ) : mapped.filter(r => r.work && /(做报表|发invoice|有流水)/i.test(r.work)).slice(0, 8).map(r => (
            <div key={r._id} onClick={() => openCompany(r)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 4, background: "#FAFAF9", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F5F5F4")}
              onMouseLeave={e => (e.currentTarget.style.background = "#FAFAF9")}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.red, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.company}</span>
                {r.clientName && <span style={{ color: colors.muted, fontSize: 12 }}> · {r.clientName}</span>}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.muted, maxWidth: 180, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.work}</span>
            </div>
          ))}
        </Card>
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

    const Field = ({ label, fieldKey, fill }: { label: string; fieldKey: string; fill?: string }) => {
      const value = r[fieldKey as keyof CompanyRow] as string || "";
      const isEditingField = editing === fieldKey;
      return (
        <div onClick={() => !isEditingField && startEdit(fieldKey, value)}
          style={{ background: fill || "#FAFAF9", borderRadius: 10, padding: "10px 14px", cursor: isEditingField ? "default" : "pointer", border: isEditingField ? "2px solid #0C0A09" : "2px solid transparent", transition: "border .15s" }}
          title="点击编辑">
          <div style={{ fontSize: 10, color: "#A8A29E", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
            {label}
            {!isEditingField && <span style={{ fontSize: 10, color: "#D6D3D1" }}>✏️</span>}
          </div>
          {isEditingField ? (
            <input autoFocus value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => handleKeyDown(e, fieldKey)}
              onBlur={e => doSave(fieldKey, e.target.value)}
              style={{ width: "100%", fontSize: 14, fontWeight: 600, padding: "4px 8px", border: "none", borderRadius: 6, outline: "none", background: "#fff", fontFamily: FONT, boxSizing: "border-box" }} />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-word", minHeight: 20 }}>{value || "—"}</div>
          )}
        </div>
      );
    };

    const ExpiryField = ({ label, fieldKey, personKey }: { label: string; fieldKey: string; personKey?: string }) => {
      const dateStr = r[fieldKey as keyof CompanyRow] as string || "";
      const person = personKey ? (r[personKey as keyof CompanyRow] as string || "") : "";
      const days = daysBetween(dateStr);
      const u = urgency(days);
      const isEditingDate = editing === fieldKey;
      const isEditingPerson = editing === personKey;
      return (
        <div style={{ background: u.bg || "#FAFAF9", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, color: "#A8A29E", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
            {label} <span style={{ fontSize: 10, color: "#D6D3D1" }}>✏️</span>
          </div>
          {isEditingDate ? (
            <input autoFocus type="date" value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => handleKeyDown(e, fieldKey)} onBlur={e => doSave(fieldKey, e.target.value)}
              style={{ width: "100%", fontSize: 14, fontWeight: 700, border: "none", outline: "none", background: "transparent", fontFamily: FONT, color: u.color, boxSizing: "border-box" }} />
          ) : (
            <div onClick={() => startEdit(fieldKey, dateStr)} style={{ fontSize: 14, fontWeight: 700, color: u.color, cursor: "pointer" }}>
              {u.icon} {dateStr || "—"} {days !== null ? `(${u.label})` : ""}
            </div>
          )}
          {personKey && (
            isEditingPerson ? (
              <input autoFocus value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => handleKeyDown(e, personKey)}
                onBlur={e => doSave(personKey!, e.target.value)}
                style={{ width: "100%", fontSize: 12, border: "none", outline: "none", background: "#fff", borderRadius: 4, padding: "2px 6px", marginTop: 4, fontFamily: FONT, boxSizing: "border-box" }} />
            ) : (
              <div onClick={() => startEdit(personKey, person)} style={{ fontSize: 12, color: "#78716C", marginTop: 2, cursor: "pointer" }}>{person || "点击添加"}</div>
            )
          )}
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

    let customTodos: Array<{ id: number; text: string; done: boolean }> = [];
    try { customTodos = JSON.parse(r.customTodos || "[]"); } catch { customTodos = []; }

    const saveCustomTodos = (updatedTodos: typeof customTodos) => {
      const updatedRecord = { ...r, customTodos: JSON.stringify(updatedTodos) };
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
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>{(r.company || "?")[0]}</div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{r.company}</h2>
              <div style={{ fontSize: 13, color: colors.muted }}>UEN: {r.uen || "—"}</div>
            </div>
          </div>
          <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#92400E" }}>
            💡 点击任意字段即可编辑，修改后自动保存
          </div>
          {Section({ title: "公司信息", children: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {Field({ label: "公司类型", fieldKey: "type" })}
              {Field({ label: "状态", fieldKey: "status", fill: r.status && r.status.includes("LIVE") ? "#F0FDF4" : "" })}
              {Field({ label: "注册日期", fieldKey: "regDate" })}
              {Field({ label: "FYE", fieldKey: "fye" })}
              {Field({ label: "注册地址", fieldKey: "address" })}
              {Field({ label: "银行账户", fieldKey: "bank" })}
            </div>
          )})}
          {Section({ title: "客户 / EP 信息", children: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {Field({ label: "客户姓名", fieldKey: "clientName" })}
              {Field({ label: "手机号", fieldKey: "phone" })}
              {Field({ label: "护照号", fieldKey: "passportNo" })}
              {Field({ label: "EP证件号", fieldKey: "epNo" })}
              {ExpiryField({ label: "EP到期日", fieldKey: "epExpiry" })}
              {Field({ label: "运营费/月", fieldKey: "opsFee" })}
            </div>
          )})}
          {Section({ title: "到期提醒", children: (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {ExpiryField({ label: "挂名董事到期", fieldKey: "ndExpiry", personKey: "ndName" })}
              {ExpiryField({ label: "秘书到期", fieldKey: "secExpiry", personKey: "secName" })}
              {ExpiryField({ label: "地址到期", fieldKey: "addrExpiry" })}
            </div>
          )})}
          {Section({ title: "报税 / 合规", children: (<>
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
              ].map(todo => (
                <TodoRow key={todo.key} done={isDone(r[todo.key as keyof CompanyRow] as string || "")} label={todo.label} onToggle={() => toggleTodo(todo.key)} />
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

      {showNewForm && (
        <div onClick={() => setShowNewForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, maxWidth: 480, width: "100%", padding: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>➕ 新增公司</h2>
            <p style={{ fontSize: 13, color: colors.muted, marginBottom: 20 }}>输入公司名称和 UEN 创建记录，其他信息之后在详情页填写</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>公司名称 *</label>
              <input value={newCompany} onChange={e => setNewCompany(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddCompany()} placeholder="例: RICH INTERNATIONAL BUSINESS CONSULTING PTE. LTD." autoFocus
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${colors.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: FONT }}
                onFocus={e => (e.target.style.borderColor = "#0C0A09")} onBlur={e => (e.target.style.borderColor = colors.border)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>UEN（选填）</label>
              <input value={newUen} onChange={e => setNewUen(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddCompany()} placeholder="例: 202609584R"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${colors.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: FONT }}
                onFocus={e => (e.target.style.borderColor = "#0C0A09")} onBlur={e => (e.target.style.borderColor = colors.border)} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowNewForm(false); setNewCompany(""); setNewUen(""); }} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>取消</button>
              <button onClick={handleAddCompany} disabled={!newCompany.trim()} style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: newCompany.trim() ? "pointer" : "not-allowed", background: newCompany.trim() ? "#16A34A" : "#D6D3D1", color: "#fff", fontWeight: 700, fontSize: 14 }}>创建并填写详情</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", padding: 16, fontSize: 11, color: "#D6D3D1" }}>
        Gi Corporate · {mapped.length} 家公司 · 团队共享数据
      </div>
    </div>
  );
}
