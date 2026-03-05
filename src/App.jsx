import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── DATA ────────────────────────────────────────────────────────────────────
const INITIAL_USERS = [
  { id:1, name:"Aryan Shah",  role:"superadmin", username:"SuperAdmin",  displayName:"Super Admin",  password:"super123",  avatar:"AS", email:"aryan@agency.com"  },
  { id:2, name:"Priya Mehta", role:"admin",       username:"Admin",       displayName:"Admin",        password:"admin123",  avatar:"PM", email:"priya@agency.com"  },
  { id:3, name:"Rahul Verma", role:"executive",   username:"Executive_1", displayName:"Executive 1", password:"exec123",   avatar:"RV", email:"rahul@agency.com"  },
  { id:4, name:"Sneha Joshi", role:"executive",   username:"Executive_2", displayName:"Executive 2", password:"exec456",   avatar:"SJ", email:"sneha@agency.com"  },
];

const SERVICES     = ["Social Media Management","Branding","Design","Video Editing","Photography","Web Design"];
const PLANNER_COLORS = ["#C4954A","#4A7C59","#2E5F8A","#9B3A3A","#6B4E9B","#B8860B"];
const MOTIVATIONAL_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Your brand is what people say about you when you're not in the room.", author: "Jeff Bezos" },
  { text: "Content is king.", author: "Bill Gates" },
  { text: "Good design is obvious. Great design is transparent.", author: "Joe Sparano" },
  { text: "The best marketing doesn't feel like marketing.", author: "Tom Fishburne" },
  { text: "Make it simple, but significant.", author: "Don Draper" },
  { text: "Consistency is the true foundation of trust.", author: "Roy T. Bennett" },
  { text: "Engage, Enlighten, Encourage and especially just be yourself.", author: "Germany Kent" },
  { text: "A brand is no longer what we tell the consumer it is.", author: "Scott Cook" },
  { text: "Either write something worth reading or do something worth writing.", author: "Benjamin Franklin" },
  { text: "People don't buy what you do, they buy why you do it.", author: "Simon Sinek" },
  { text: "Your work is going to fill a large part of your life. Do great work.", author: "Steve Jobs" },
  { text: "Design is not just what it looks like. Design is how it works.", author: "Steve Jobs" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Success is not final, failure is not fatal.", author: "Winston Churchill" },
  { text: "Opportunities don't happen, you create them.", author: "Chris Grosser" },
];
const HOURS        = Array.from({length:14},(_,i)=>i+8);
const MONTH_NAMES  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const todayISO = () => new Date().toISOString().split("T")[0];
const nowStr   = () => new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
const todayStr = () => new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
const T = todayISO();

const initialClients = [];
const initialContent = [];
const initialCalendar = [];
const initialLeaves = [];
const initialAttendance = [];
const initialPlannerEvents = {};
const initialMessages = [];

// ── localStorage helpers (local cache / offline fallback) ────────────────────
function lsGet(key, fallback) {
  try {
    if(typeof localStorage === "undefined") return fallback;
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function lsSet(key, val) {
  try {
    if(typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ── Supabase client ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://vouhrqmcpmakqcnaasdb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdWhycW1jcG1ha3FjbmFhc2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTYwMDYsImV4cCI6MjA4Nzk5MjAwNn0.4yiAH-2ax3WQr4E87driVN0JJ3HaZS28KObbpaTnYyc";

// Single shared client instance
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
});

// Keep getSB() for compatibility — returns the shared client
async function getSB() { return supabase; }

// Generic helpers — fall back to localStorage if Supabase unavailable
async function dbGet(table, fallback=[]) {
  const sb = await getSB();
  if(!sb) return fallback;
  try {
    const { data, error } = await sb.from(table).select("*");
    if(error) return fallback;
    return data || fallback;
  } catch { return fallback; }
}

async function dbUpsert(table, rows, onConflict="id") {
  const sb = await getSB();
  if(!sb) return;
  try {
    const arr = Array.isArray(rows) ? rows : [rows];
    await sb.from(table).upsert(arr, { onConflict });
  } catch(e) { console.warn("dbUpsert error:", e); }
}

async function dbDelete(table, id) {
  const sb = await getSB();
  if(!sb) return;
  try { await sb.from(table).delete().eq("id", id); }
  catch(e) { console.warn("dbDelete error:", e); }
}

// Subscribe to real-time changes on a table
async function dbSubscribe(table, callback) {
  const sb = await getSB();
  if(!sb) return ()=>{};
  try {
    const channel = sb.channel(`rt_${table}`)
      .on("postgres_changes", { event:"*", schema:"public", table }, callback)
      .subscribe();
    return () => sb.removeChannel(channel);
  } catch { return ()=>{}; }
}

// ─── AI helpers ───────────────────────────────────────────────────────────────
// Supports OpenAI (ChatGPT) — set VITE_OPENAI_API_KEY in Vercel env variables
const AI_API_KEY = typeof import.meta !== "undefined" ? import.meta.env?.VITE_OPENAI_API_KEY : null;

async function callAI(prompt, maxTokens=1200) {
  const apiKey = AI_API_KEY || (typeof window !== "undefined" && window.__OPENAI_KEY__) || null;
  if(!apiKey) throw new Error("No API key found. Add VITE_OPENAI_API_KEY in Vercel environment variables.");
  const res = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},
    body:JSON.stringify({model:"gpt-4o-mini",max_tokens:maxTokens,messages:[{role:"user",content:prompt}]})
  });
  if(!res.ok){
    const err=await res.json().catch(()=>({}));
    throw new Error(err.error?.message||`API error ${res.status}`);
  }
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}
async function generateCaption(desc,clientName,service){
  try{ return await callAI(`Premium Instagram caption for ${clientName} (${service}). Media: ${desc}. Elegant tone, 3-5 hashtags, under 150 words. Return ONLY caption.`); }
  catch{ return "Caption generation failed."; }
}
async function generateAssessment(emp,attRecs,leaveRecs,contentItems){
  const present=attRecs.length;
  const now=new Date();
  const period=`${now.toLocaleString("en-IN",{month:"long",year:"numeric"})}`;
  const workDaysThisMonth=22;
  const prompt=`You are an HR assistant. Write a professional employee performance assessment.

Employee: ${emp.name}
Role: ${emp.role}
Period: ${period}

Data:
- Attendance: ${present} days present out of ~${workDaysThisMonth} working days
- Leaves taken: ${leaveRecs.length} (${leaveRecs.filter(l=>l.status==="approved").length} approved, ${leaveRecs.filter(l=>l.status==="pending").length} pending)
- Content items created: ${contentItems.length}
- Posted: ${contentItems.filter(c=>c.status==="posted").length}
- Approved by client: ${contentItems.filter(c=>c.status==="approved_client").length}
- Pending review: ${contentItems.filter(c=>["pending_admin","pending_superadmin"].includes(c.status)).length}

Write a structured assessment with these sections using ## headers:
## Overall Performance Score
Give a score out of 10 with brief justification.
## Attendance & Punctuality
## Content Output & Quality
## Strengths
Use bullet points.
## Areas for Improvement
Use bullet points.
## Recommendation

Be professional, specific to the data, and constructive. Keep it under 400 words.`;
  try{ return await callAI(prompt,1500); }
  catch(e){ return "Assessment generation failed. Please check your API configuration."; }
}

function parseMarkdown(md){
  const lines=md.split("\n"); const out=[]; let inUl=false;
  lines.forEach(line=>{
    if(line.startsWith("## ")){if(inUl){out.push("</ul>");inUl=false;}out.push(`<h2>${line.slice(3)}</h2>`);}
    else if(line.startsWith("- ")||line.startsWith("* ")){if(!inUl){out.push("<ul>");inUl=true;}out.push(`<li>${line.slice(2)}</li>`);}
    else{if(inUl){out.push("</ul>");inUl=false;}if(line.trim())out.push(`<p>${line}</p>`);}
  });
  if(inUl)out.push("</ul>");
  return out.join("");
}

// ─── THEME STYLES ─────────────────────────────────────────────────────────────
const getStyles = (dark) => `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --cream:${dark?"#0F172A":"#EEF2F7"};
    --cream-dark:${dark?"rgba(255,255,255,0.06)":"#E2E8F0"};
    --ink:${dark?"#E8E0D0":"#1E293B"};
    --ink-light:${dark?"#CBD5E1":"#475569"};
    --ink-muted:${dark?"#A0AEC0":"#94A3B8"};
    --accent:#E87620;--accent-light:#F59E4B;--accent-pale:${dark?"rgba(232,118,32,0.2)":"#FFF3E8"};
    --white:${dark?"#0F3460":"#FFF"};
    --border:${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.5)"};
    --surface:${dark?"rgba(30,45,74,0.85)":"rgba(255,255,255,0.65)"};
    --surface2:${dark?"rgba(36,51,84,0.7)":"rgba(255,255,255,0.4)"};
    --success:#16A34A;--warning:#D97706;--danger:#DC2626;--info:#2563EB;
    --sidebar-w:248px;--header-h:62px;
    --chat-w:320px;
    --glass:${dark?"rgba(15,23,42,0.85)":"rgba(255,255,255,0.75)"};
    --glass-border:${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"};
    --glass-shadow:0 8px 32px rgba(0,0,0,0.08);
  }
  body{font-family:'DM Sans',sans-serif;background:${dark?"#0F172A":"#FFF2E8"};color:var(--ink);font-size:14.5px;line-height:1.55;}
  .serif{font-family:'Cormorant Garamond',serif;}
  ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:var(--cream-dark);}::-webkit-scrollbar-thumb{background:rgba(232,118,32,0.3);border-radius:2px;}

  .app{display:flex;min-height:100vh;}
  .sidebar{width:var(--sidebar-w);background:var(--glass);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-right:1px solid var(--glass-border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;overflow-y:auto;}
  .sidebar-logo{padding:20px 18px 18px;border-bottom:1px solid rgba(0,0,0,0.08);}
  .logo-wordmark{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;color:#E87620;letter-spacing:-0.5px;line-height:1;}
  .logo-wordmark em{font-style:italic;color:#fff;}
  .logo-byline{font-size:9px;letter-spacing:2.5px;color:#94A3B8;text-transform:uppercase;margin-top:4px;}
  .sidebar-section{padding:13px 0 5px;}
  .sidebar-section-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#94A3B8;padding:0 18px;margin-bottom:4px;}
  .nav-item{display:flex;align-items:center;gap:9px;padding:9px 18px;cursor:pointer;color:#334155;font-size:13px;transition:all 0.18s;border-left:2px solid transparent;}
  .nav-item:hover{color:#1E293B;background:rgba(0,0,0,0.05);}
  .nav-item.active{color:var(--accent);border-left-color:var(--accent);background:rgba(232,118,32,0.12);border-radius:0 10px 10px 0;}
  .nav-icon{font-size:13px;width:15px;text-align:center;}
  .nav-badge{margin-left:auto;background:linear-gradient(135deg,#E87620,#F59E4B);color:white;font-size:9px;padding:1px 6px;border-radius:10px;font-weight:700;}
  .sidebar-footer{margin-top:auto;padding:13px 18px;border-top:1px solid rgba(0,0,0,0.08);}
  .user-chip{display:flex;align-items:center;gap:8px;}
  .avatar{width:29px;height:29px;border-radius:50%;background:linear-gradient(135deg,#E87620,#F59E4B);color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .avatar.sm{width:25px;height:25px;font-size:9px;}
  .avatar.lg{width:40px;height:40px;font-size:14px;}
  .user-name{font-size:12px;color:#1E293B;font-weight:500;}
  .user-role{font-size:9.5px;color:#94A3B8;text-transform:capitalize;}

  .main{margin-left:var(--sidebar-w);flex:1;display:flex;flex-direction:column;min-height:100vh;}
  .topbar{height:var(--header-h);background:var(--surface);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px;position:sticky;top:0;z-index:50;gap:12px;}
  .topbar-title{font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--ink);flex:1;font-weight:600;}
  .topbar-right{display:flex;align-items:center;gap:9px;}
  .icon-btn{width:30px;height:30px;border:1px solid var(--border);background:var(--surface2);border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink-light);transition:all 0.18s;}
  .icon-btn:hover{background:var(--cream-dark);}
  .content{flex:1;padding:24px;overflow-y:auto;background:transparent;}

  .card{background:var(--surface);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:16px;padding:19px;box-shadow:0 8px 32px rgba(0,0,0,0.06);}
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:13px;}
  .stat-card{background:var(--surface);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:16px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.06);}
  .stat-label{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-muted);margin-bottom:6px;}
  .stat-value{font-family:'Cormorant Garamond',serif;font-size:34px;color:var(--ink);line-height:1;}
  .stat-sub{font-size:11px;color:var(--ink-muted);margin-top:3px;}
  .stat-accent{color:var(--accent);}

  .table{width:100%;border-collapse:collapse;}
  .table th{text-align:left;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-muted);padding:9px 12px;border-bottom:1px solid var(--border);font-weight:600;}
  .table td{padding:10px 12px;font-size:12.5px;border-bottom:1px solid var(--border);vertical-align:middle;color:var(--ink);}
  .table tr:last-child td{border-bottom:none;}
  .table tr:hover td{background:rgba(232,118,32,0.06);}

  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;}
  .badge-success{background:${dark?"rgba(62,125,82,0.25)":"#E5F2EA"};color:#5DB87A;}
  .badge-warning{background:${dark?"rgba(176,125,10,0.25)":"#FFF7E0"};color:#D4AA2A;}
  .badge-danger{background:${dark?"rgba(148,53,53,0.25)":"#FDECEA"};color:#E07070;}
  .badge-info{background:${dark?"rgba(42,90,138,0.3)":"#E0ECF8"};color:#5A9ACA;}
  .badge-neutral{background:var(--cream-dark);color:var(--ink-light);}
  .badge-accent{background:var(--accent-pale);color:var(--accent);}
  .badge-posted{background:${dark?"#2A3A2A":"#141414"};color:#E8C88A;}

  .btn{display:inline-flex;align-items:center;gap:5px;padding:7px 15px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all 0.18s;font-family:'DM Sans',sans-serif;}
  .btn:disabled{opacity:0.45;cursor:not-allowed;}
  .btn-primary{background:${dark?"#C4954A":"#141414"};color:white;}
  .btn-primary:hover:not(:disabled){background:${dark?"#b07a35":"#2a2a2a"};}
  .btn-accent{background:var(--accent);color:white;}
  .btn-accent:hover:not(:disabled){background:#b07a35;}
  .btn-ghost{background:transparent;color:var(--ink-light);border:1px solid var(--border);}
  .btn-ghost:hover:not(:disabled){background:var(--cream-dark);}
  .btn-danger{background:var(--danger);color:white;}
  .btn-success{background:var(--success);color:white;}
  .btn-sm{padding:5px 11px;font-size:11px;}

  .form-group{margin-bottom:13px;}
  .form-label{display:block;font-size:10px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:var(--ink-muted);margin-bottom:5px;}
  .form-input{width:100%;padding:8px 11px;border:1px solid var(--border);border-radius:7px;font-size:12.5px;font-family:'DM Sans',sans-serif;background:var(--surface);color:var(--ink);outline:none;transition:border-color 0.18s;}
  .form-input:focus{border-color:var(--accent-light);box-shadow:0 0 0 3px rgba(196,149,74,0.1);}
  .form-select{appearance:none;cursor:pointer;}
  .form-textarea{resize:vertical;min-height:72px;}

  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
  .section-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:17px;}
  .section-title{font-family:'Cormorant Garamond',serif;font-size:24px;color:var(--ink);font-weight:600;}
  .section-sub{font-size:12px;color:var(--ink-muted);margin-top:2px;}

  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;backdrop-filter:blur(4px);}
  .modal{background:var(--surface);border-radius:16px;width:100%;max-width:530px;max-height:90vh;overflow-y:auto;padding:24px;position:relative;}
  .modal-lg{max-width:720px;}
  .modal-xl{max-width:920px;}

  .login-page{min-height:100vh;background:#FFF2E8;display:flex;align-items:center;justify-content:center;padding:20px;position:relative;overflow:hidden;}
  .login-card{background:${dark?"rgba(12,10,22,0.82)":"rgba(255,255,255,0.88)"};border-radius:24px;padding:44px 38px;width:100%;max-width:420px;position:relative;z-index:10;backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border:1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.6)"};}
  .login-brand{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:700;color:${dark?"#E8E0D0":"#141414"};letter-spacing:-1px;text-align:center;}
  .login-brand em{font-style:italic;color:#E87620;}
  .login-sub{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--ink-muted);text-align:center;margin-top:5px;margin-bottom:30px;}

  .today-task-row{display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:9px;margin-bottom:7px;border:1px solid var(--border);background:var(--surface2);transition:all 0.2s;}
  .today-task-row.posted{background:${dark?"rgba(62,125,82,0.15)":"#E5F2EA"};border-color:${dark?"rgba(62,125,82,0.3)":"#B8DFC4"};opacity:0.78;}
  .task-check{width:21px;height:21px;border-radius:50%;border:2px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;transition:all 0.18s;background:var(--surface);}
  .task-check.checked{background:var(--success);border-color:var(--success);color:white;}

  .stage-dot{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;flex-shrink:0;}
  .stage-line{flex:1;height:2px;margin-top:9px;}
  .stage-active{background:var(--accent);color:white;}
  .stage-done{background:var(--success);color:white;}
  .stage-pending{background:var(--cream-dark);color:var(--ink-muted);}

  .punch-display{background:${dark?"#0D1B2A":"#141414"};color:white;border-radius:16px;padding:24px;text-align:center;}
  .punch-time{font-family:'Cormorant Garamond',serif;font-size:52px;letter-spacing:-2px;margin:5px 0;}
  .punch-date{font-size:11.5px;color:rgba(255,255,255,0.42);letter-spacing:1px;}

  .upload-zone{border:2px dashed var(--border);border-radius:11px;padding:24px;text-align:center;cursor:pointer;transition:all 0.2s;background:var(--surface2);}
  .upload-zone:hover{border-color:var(--accent-light);background:var(--accent-pale);}
  .media-preview-thumb{width:100%;max-height:280px;object-fit:contain;border-radius:9px;border:1px solid var(--border);background:var(--cream-dark);cursor:pointer;display:block;}
  .media-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
  .media-overlay img,.media-overlay video{max-width:90vw;max-height:88vh;border-radius:10px;object-fit:contain;}
  .media-close{position:absolute;top:16px;right:20px;color:white;font-size:20px;cursor:pointer;background:rgba(255,255,255,0.12);border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;}

  .ai-badge{display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#141420,#1A2035);color:#E8C88A;font-size:9px;padding:2px 7px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;font-weight:700;}
  .generating{animation:pulse 1.4s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}

  .tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:16px;}
  .tab{padding:8px 15px;font-size:12px;font-weight:500;cursor:pointer;color:var(--ink-muted);border-bottom:2px solid transparent;transition:all 0.18s;margin-bottom:-1px;}
  .tab.active{color:var(--ink);border-bottom-color:var(--accent);}

  .divider{border:none;border-top:1px solid var(--cream-dark);margin:13px 0;}
  .empty{text-align:center;padding:34px;color:var(--ink-muted);}
  .empty-icon{font-size:30px;margin-bottom:9px;}
  .empty h4{font-size:14.5px;color:var(--ink-light);margin-bottom:4px;}

  .flex{display:flex;}.items-center{align-items:center;}.justify-between{justify-content:space-between;}
  .gap-8{gap:8px;}.gap-12{gap:12px;}.gap-16{gap:16px;}
  .mt-4{margin-top:4px;}.mt-8{margin-top:8px;}.mt-12{margin-top:12px;}.mt-16{margin-top:16px;}.mt-20{margin-top:20px;}
  .mb-8{margin-bottom:8px;}.mb-12{margin-bottom:12px;}.mb-16{margin-bottom:16px;}
  .text-sm{font-size:11.5px;}.text-muted{color:var(--ink-muted);}.text-accent{color:var(--accent);}
  .font-medium{font-weight:500;}.w-full{width:100%;}

  /* ── WAVE THEME ── */
  @keyframes barShimmer{0%{opacity:0.5;}50%{opacity:0.9;}100%{opacity:0.5;}}
  @keyframes waveShimmer{0%{background-position:0% 50%;}100%{background-position:300% 50%;}}

  /* Dashboard banner */
  .dashboard-mural{position:relative;overflow:hidden;border-radius:16px;background:linear-gradient(160deg,#1A0820 0%,#2D1245 35%,#1A0D35 65%,#080F28 100%);padding:30px 28px;margin-bottom:20px;color:white;}
  .mural-greeting{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:700;line-height:1.1;position:relative;z-index:2;}
  .mural-greeting em{font-style:italic;color:#F4C08A;}
  .mural-sub{font-size:12px;color:rgba(255,255,255,0.42);margin-top:6px;position:relative;z-index:2;letter-spacing:0.5px;}
  .mural-stats{display:flex;gap:28px;margin-top:20px;position:relative;z-index:2;}
  .mural-stat{text-align:center;}
  .mural-stat-val{font-family:'Cormorant Garamond',serif;font-size:30px;color:#F4C08A;line-height:1;}
  .mural-stat-lbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.32);margin-top:3px;}

  /* Login page wave bg */
  .login-wave-bg{position:absolute;inset:0;overflow:hidden;z-index:0;}

  /* ── CONTENT CALENDAR ── */
  .cc-wrap{display:grid;grid-template-columns:1fr 300px;gap:18px;align-items:start;}
  .cc-main{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;}
  .cc-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);}
  .cc-month-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;color:var(--ink);}
  .cc-nav{background:none;border:1px solid var(--border);border-radius:7px;width:30px;height:30px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:var(--ink-muted);transition:all 0.15s;}
  .cc-nav:hover{background:var(--cream-dark);}
  .cc-dow-row{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--border);}
  .cc-dow{text-align:center;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-muted);padding:9px 0;}
  .cc-grid{display:grid;grid-template-columns:repeat(7,1fr);}
  .cc-cell{border-right:1px solid var(--cream-dark);border-bottom:1px solid var(--cream-dark);min-height:96px;padding:6px 7px;cursor:pointer;transition:background 0.12s;position:relative;}
  .cc-cell:hover{background:var(--accent-pale);}
  .cc-cell.today{background:rgba(196,149,74,0.06);}
  .cc-cell.today .cc-daynum{background:#141414;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;}
  .cc-cell.other-month{opacity:0.35;}
  .cc-cell.selected{background:var(--accent-pale);border-color:var(--accent-light);}
  .cc-cell:nth-child(7n){border-right:none;}
  .cc-daynum{font-size:11.5px;font-weight:600;color:var(--ink-muted);margin-bottom:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;}
  .cc-festival{font-size:8.5px;padding:2px 5px;border-radius:4px;margin-bottom:2px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;cursor:pointer;}
  .cc-festival.major{background:linear-gradient(90deg,rgba(232,85,58,0.18),rgba(244,160,48,0.18));color:#C4520A;border-left:2px solid #E8553A;}
  .cc-festival.regional{background:rgba(139,75,174,0.12);color:#7B35A8;border-left:2px solid #8B4BAE;}
  .cc-festival.national{background:rgba(45,71,163,0.12);color:#1E3A8A;border-left:2px solid #2D47A3;}
  .cc-post-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);display:inline-block;margin:1px;}
  .cc-post-chip{font-size:8.5px;padding:2px 6px;border-radius:4px;background:var(--accent-pale);color:var(--accent);margin-bottom:2px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;}
  .cc-sidebar{display:flex;flex-direction:column;gap:14px;}
  .cc-side-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;}
  .cc-side-title{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;color:var(--ink);margin-bottom:12px;}
  .festival-tag{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:20px;font-size:10px;font-weight:600;cursor:pointer;margin:3px;transition:all 0.15s;border:1px solid transparent;}
  .festival-tag:hover{opacity:0.8;}
  .festival-tag.major{background:rgba(232,85,58,0.12);color:#C4520A;border-color:rgba(232,85,58,0.25);}
  .festival-tag.regional{background:rgba(139,75,174,0.12);color:#7B35A8;border-color:rgba(139,75,174,0.25);}
  .festival-tag.national{background:rgba(45,71,163,0.12);color:#1E3A8A;border-color:rgba(45,71,163,0.25);}
  .cc-day-panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;}
  .cc-legend{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
  .cc-legend-item{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--ink-muted);}
  .cc-legend-dot{width:8px;height:8px;border-radius:2px;}

  /* ── HR CAL ── */
  .hr-cal-wrap{display:grid;grid-template-columns:1fr 290px;gap:16px;margin-top:16px;}
  .hr-big-cal{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;}
  .hr-cal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);}
  .hr-cal-month{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--ink);}
  .hr-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);}
  .hr-dow{text-align:center;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--ink-muted);padding:10px 0;border-bottom:1px solid var(--border);}
  .hr-day{border-right:1px solid var(--cream-dark);border-bottom:1px solid var(--cream-dark);min-height:78px;padding:5px;cursor:pointer;transition:background 0.15s;}
  .hr-day:hover{background:var(--cream-dark);}
  .hr-day.selected{background:var(--accent-pale);}
  .hr-day-num{font-size:11px;font-weight:600;color:var(--ink-muted);margin-bottom:3px;}
  .hr-day-chip{font-size:9px;padding:1px 5px;border-radius:4px;margin-bottom:2px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;}
  .chip-present{background:${dark?"rgba(62,125,82,0.3)":"#E5F2EA"};color:#5DB87A;}
  .chip-absent{background:${dark?"rgba(148,53,53,0.3)":"#FDECEA"};color:#E07070;}
  .chip-leave{background:${dark?"rgba(176,125,10,0.3)":"#FFF7E0"};color:#D4AA2A;}
  .hr-day-panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;position:sticky;top:80px;max-height:500px;overflow-y:auto;}
  .emp-row{display:flex;align-items:flex-start;gap:9px;padding:10px 0;border-bottom:1px solid var(--cream-dark);}
  .emp-row:last-child{border-bottom:none;}

  /* ── CHAT ── */
  .chat-panel{position:fixed;right:0;top:0;bottom:0;width:var(--chat-w);background:${dark?"#0D1B2A":"#FFFFFF"};border-left:1px solid var(--border);display:flex;flex-direction:column;z-index:90;transform:translateX(100%);transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);}
  .chat-panel.open{transform:translateX(0);}
  .chat-header{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}
  .chat-title{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:600;color:var(--ink);flex:1;}
  .chat-contact-list{overflow-y:auto;flex:1;}
  .chat-contact{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s;}
  .chat-contact:hover,.chat-contact.active{background:var(--cream-dark);}
  .chat-contact-info{flex:1;}
  .chat-contact-name{font-size:12.5px;font-weight:600;color:var(--ink);}
  .chat-contact-last{font-size:10.5px;color:var(--ink-muted);}
  .status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .status-online{background:#4ADE80;}
  .status-offline{background:#94A3B8;}
  .chat-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}
  .chat-bubble{max-width:78%;padding:8px 12px;border-radius:12px;font-size:12px;line-height:1.5;}
  .chat-bubble.mine{background:var(--accent);color:white;align-self:flex-end;border-bottom-right-radius:3px;}
  .chat-bubble.theirs{background:var(--cream-dark);color:var(--ink);align-self:flex-start;border-bottom-left-radius:3px;}
  .chat-bubble-time{font-size:9px;opacity:0.6;margin-top:3px;text-align:right;}
  .chat-input-row{padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;}
  .chat-input{flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:20px;font-size:12px;font-family:'DM Sans',sans-serif;background:var(--surface2);color:var(--ink);outline:none;}
  .chat-send{width:30px;height:30px;border-radius:50%;background:var(--accent);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;}
  .chat-back{background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:16px;padding:2px;}
  .meeting-bar{padding:10px 14px;background:${dark?"rgba(196,149,74,0.1)":"var(--accent-pale)"};border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;}
  .meeting-chip{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--accent);letter-spacing:0.5px;}
  .call-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:600;cursor:pointer;border:none;transition:all 0.18s;}
  .call-btn-video{background:var(--success);color:white;}
  
  /* ── VIDEO CALL MODAL ── */
  .video-call-modal{position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:400;display:flex;flex-direction:column;}
  .vc-header{padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);}
  .vc-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:2px;}
  .vc-tile{background:#1a1a2e;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;position:relative;border-radius:4px;}
  .vc-tile-name{position:absolute;bottom:12px;left:12px;background:rgba(0,0,0,0.6);color:white;font-size:11px;padding:2px 8px;border-radius:10px;}
  .vc-controls{padding:16px;display:flex;align-items:center;justify-content:center;gap:16px;border-top:1px solid rgba(255,255,255,0.1);}
  .vc-btn{width:46px;height:46px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all 0.18s;}
  .vc-btn-red{background:#E74C3C;color:white;}
  .vc-btn-gray{background:rgba(255,255,255,0.15);color:white;}
  .vc-btn-green{background:#27AE60;color:white;}

  /* ── PLANNER ── */
  .mini-cal{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;}
  .mini-cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;}
  .mini-cal-title{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;color:var(--ink);}
  .mini-cal-nav{background:none;border:1px solid var(--border);border-radius:5px;width:24px;height:24px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;color:var(--ink-muted);}
  .mini-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
  .mini-cal-dow{text-align:center;font-size:8.5px;font-weight:700;color:var(--ink-muted);padding:3px 0;}
  .mini-cal-day{text-align:center;font-size:11px;padding:5px 2px;border-radius:5px;cursor:pointer;color:var(--ink);transition:all 0.15s;}
  .mini-cal-day:hover{background:var(--cream-dark);}
  .mini-cal-day.selected{background:${dark?"var(--accent)":"#141414"};color:white;}
  .mini-cal-day.has-event{font-weight:700;color:var(--accent);}
  .timeline-wrap{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;}
  .timeline-header{padding:13px 17px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
  .timeline-date{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:600;color:var(--ink);}
  .timeline-body{height:580px;overflow-y:auto;}
  .hour-row{display:flex;border-bottom:1px solid var(--cream-dark);min-height:58px;}
  .hour-label{width:52px;flex-shrink:0;padding:5px 8px 5px 12px;font-size:10px;color:var(--ink-muted);font-weight:500;border-right:1px solid var(--cream-dark);line-height:1;}
  .hour-slot{flex:1;position:relative;cursor:pointer;overflow:visible;}
  .hour-slot:hover{background:rgba(196,149,74,0.04);}
  .event-block{position:absolute;left:5px;right:5px;top:2px;border-radius:7px;padding:5px 8px;font-size:11px;font-weight:500;color:white;overflow:hidden;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.15);z-index:2;}
  .add-hint{position:absolute;inset:0;display:flex;align-items:center;padding-left:10px;opacity:0;transition:opacity 0.15s;font-size:10.5px;color:var(--ink-muted);}
  .hour-slot:hover .add-hint{opacity:1;}

  /* ── AI ASSESSMENT ── */
  .assessment-prose{font-size:13px;line-height:1.8;color:var(--ink-light);}
  .assessment-prose h2{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:600;color:var(--ink);margin:18px 0 6px;}
  .assessment-prose h2:first-child{margin-top:0;}
  .assessment-prose ul{padding-left:20px;margin-top:4px;}
  .assessment-prose li{margin-bottom:4px;}
  .assessment-prose p{margin-bottom:8px;}
  .assess-emp-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:var(--surface);cursor:pointer;transition:all 0.18s;}
  .assess-emp-row:hover{border-color:var(--accent-light);background:var(--accent-pale);}
  .score-chip{background:${dark?"var(--accent)":"#141414"};color:var(--accent-light);font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:700;width:42px;height:42px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

  /* ── SETTINGS ── */
  .settings-grid{display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:start;}
  .settings-nav{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;}
  .settings-nav-item{display:flex;align-items:center;gap:9px;padding:12px 16px;cursor:pointer;font-size:13px;color:var(--ink-light);border-left:2px solid transparent;transition:all 0.18s;}
  .settings-nav-item:hover{background:var(--cream-dark);color:var(--ink);}
  .settings-nav-item.active{color:var(--accent);border-left-color:var(--accent);background:var(--accent-pale);}
  .settings-section{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;}
  .settings-title{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--ink);margin-bottom:18px;}
  .theme-card{border:2px solid var(--border);border-radius:10px;padding:16px;cursor:pointer;transition:all 0.2s;flex:1;text-align:center;}
  .theme-card.selected{border-color:var(--accent);background:var(--accent-pale);}
  .theme-preview{width:100%;height:50px;border-radius:6px;margin-bottom:8px;}

  .toggle-switch{width:42px;height:22px;border-radius:11px;background:var(--border);position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;}
  .toggle-switch.on{background:var(--success);}
  .toggle-knob{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);}
  .toggle-switch.on .toggle-knob{left:23px;}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStatusBadge(status){
  const map={pending_admin:["warning","Pending Admin"],pending_superadmin:["warning","Pending SA"],approved_client:["success","Client Approved"],rejected:["danger","Rejected"],posted:["posted","✓ Posted"],draft:["neutral","Draft"],active:["success","Active"],enquiry:["info","Enquiry"],closed:["neutral","Closed"],approved:["success","Approved"],pending:["warning","Pending"]};
  const [t,l]=map[status]||["neutral",status];
  return <span className={`badge badge-${t}`}>{l}</span>;
}

// ─── WAVE THEME SYSTEM ────────────────────────────────────────────────────────
// Inspired by layered colour-wave mural: warm reds/oranges fade to cool purples/blues
// Used subtly like Apple — just a whisper of colour behind clean UI

// Animated SVG wave — used in dashboard banner and login bg
function WavesSVG({ height=160, opacity=0.18, phase=0 }) {
  // Five wave layers inspired by the image palette
  const waves = [
    { color:"#E8553A", cy:height*0.18, amp:22, freq:0.012, spd:0 },
    { color:"#F4A030", cy:height*0.32, amp:18, freq:0.010, spd:0.4 },
    { color:"#E8608A", cy:height*0.50, amp:20, freq:0.013, spd:0.7 },
    { color:"#8B4BAE", cy:height*0.68, amp:22, freq:0.011, spd:1.1 },
    { color:"#2D47A3", cy:height*0.84, amp:18, freq:0.009, spd:1.5 },
  ];
  const W = 900;
  function wavePath(cy, amp, freq, ph) {
    let d = `M0,${height}`;
    for(let x=0; x<=W; x+=8) {
      const y = cy + amp * Math.sin(x * freq + ph);
      d += ` L${x},${y.toFixed(1)}`;
    }
    d += ` L${W},${height} Z`;
    return d;
  }
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}
      viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="xMidYMid slice">
      {waves.map((w,i)=>(
        <path key={i} d={wavePath(w.cy, w.amp, w.freq, phase+w.spd)}
          fill={w.color} opacity={opacity - i*0.01} />
      ))}
    </svg>
  );
}

// Thin top accent bar — the colour wave compressed into 3px. Apple-style.
function WaveAccentBar({ phase }) {
  const stops = [
    {offset:"0%",   color:"#E8553A"},
    {offset:"22%",  color:"#F4A030"},
    {offset:"44%",  color:"#E8608A"},
    {offset:"66%",  color:"#8B4BAE"},
    {offset:"88%",  color:"#2D47A3"},
    {offset:"100%", color:"#E8553A"},
  ];
  const id = "waveGrad";
  return (
    <svg style={{display:"block",width:"100%",height:3,position:"fixed",top:0,left:0,right:0,zIndex:300,pointerEvents:"none"}}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map((s,i)=><stop key={i} offset={s.offset} stopColor={s.color}/>)}
        </linearGradient>
      </defs>
      <rect width="100%" height="3" fill={`url(#${id})`} />
      {/* Animated shimmer overlay */}
      <rect width="100%" height="3" fill={`url(#${id})`} opacity="0.5" style={{animation:"barShimmer 4s linear infinite"}} />
    </svg>
  );
}

// Ambient background wave — very faint, just gives the page a warm/cool breath
function AmbientWave({ dark, phase }) {
  if(!phase && phase!==0) return null;
  const bg = dark ? "rgba(20,12,30,0.0)" : "rgba(255,255,255,0.0)";
  const stops = dark
    ? [{c:"#2D1040",o:0.06},{c:"#1A0D35",o:0.04},{c:"#0A1535",o:0.05}]
    : [{c:"#FDE8E0",o:0.28},{c:"#FDE8F8",o:0.18},{c:"#E0E8FD",o:0.22}];
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      {/* Three very subtle blobs that drift — red, purple, blue tones */}
      <div style={{
        position:"absolute", borderRadius:"50%",
        width:600, height:600, top:-150, right:-100,
        background:`radial-gradient(circle, ${stops[0].c} 0%, transparent 70%)`,
        opacity: stops[0].o,
        transform:`translateY(${Math.sin(phase)*18}px)`,
        transition:"transform 0.1s linear",
        filter:"blur(80px)",
      }}/>
      <div style={{
        position:"absolute", borderRadius:"50%",
        width:500, height:500, bottom:-100, left:-80,
        background:`radial-gradient(circle, ${stops[2].c} 0%, transparent 70%)`,
        opacity: stops[2].o,
        transform:`translateY(${-Math.sin(phase*0.7)*14}px)`,
        transition:"transform 0.1s linear",
        filter:"blur(90px)",
      }}/>
      <div style={{
        position:"absolute", borderRadius:"50%",
        width:400, height:400, top:"40%", left:"30%",
        background:`radial-gradient(circle, ${stops[1].c} 0%, transparent 70%)`,
        opacity: stops[1].o,
        transform:`translate(${Math.cos(phase*0.5)*12}px, ${Math.sin(phase*0.5)*10}px)`,
        transition:"transform 0.1s linear",
        filter:"blur(100px)",
      }}/>
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, lg, xl }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`modal ${xl?"modal-xl":lg?"modal-lg":""}`}>
        <div className="flex items-center justify-between mb-16">
          <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:600,color:"var(--ink)"}}>{title}</h3>
          <button onClick={onClose} className="icon-btn">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MediaLightbox({ src, type, onClose }) {
  return (
    <div className="media-overlay" onClick={onClose}>
      <button className="media-close" onClick={onClose}>✕</button>
      {type==="video"?<video src={src} controls autoPlay onClick={e=>e.stopPropagation()} />:<img src={src} alt="" onClick={e=>e.stopPropagation()} />}
    </div>
  );
}
function MediaDisplay({ item }) {
  const [lb,setLb]=useState(false);
  if(!item.mediaDataUrl) return <p className="text-muted text-sm">No media uploaded.</p>;
  return (
    <div>
      {item.mediaType==="video"?<video src={item.mediaDataUrl} className="media-preview-thumb" onClick={()=>setLb(true)} style={{maxHeight:200}} />:<img src={item.mediaDataUrl} className="media-preview-thumb" style={{maxHeight:200}} alt="" onClick={()=>setLb(true)} />}
      <button className="btn btn-ghost btn-sm mt-8" onClick={()=>setLb(true)}>🔍 Full Size</button>
      {lb&&<MediaLightbox src={item.mediaDataUrl} type={item.mediaType} onClose={()=>setLb(false)} />}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin, dark, phase, users }) {
  const [username,setUsername]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState("");
  function login(){ const found=users.find(x=>x.username===username&&x.password===pw); found?onLogin(found):setErr("Invalid username or password."); }
  return (
    <div className="login-page">
      <div style={{position:"absolute",inset:0,overflow:"hidden",zIndex:0}}>
        <WavesSVG height={window.innerHeight||700} opacity={0.55} phase={phase} />
      </div>
      <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.15)",zIndex:1}} />
      <div className="login-card">
        <div className="login-brand">Flow <em>by</em> Anecdote</div>
        <p className="login-sub">Agency Management Platform</p>
        <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Username" autoComplete="username" /></div>
        <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} autoComplete="current-password" /></div>
        {err&&<p style={{color:"#ff7b7b",fontSize:12,marginBottom:9}}>{err}</p>}
        <button className="btn btn-primary w-full" style={{justifyContent:"center",padding:"11px"}} onClick={login}>Sign In →</button>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ user, active, setActive, pendingCount, chatUnread }) {
  const isSA=user.role==="superadmin", isAdmin=user.role==="admin"||isSA;
  const sections=[
    {label:"Main",items:[{key:"dashboard",icon:"◈",label:"Dashboard"},{key:"punch",icon:"⏱",label:"Attendance"},{key:"notes",icon:"✦",label:"My Planner"},{key:"chat",icon:"💬",label:"Team Chat",badge:chatUnread}]},
    {label:"Clients",items:[{key:"clients",icon:"◉",label:"Clients"},{key:"calendar",icon:"⊞",label:"Content Calendar"},{key:"content",icon:"◫",label:"Content"}]},
    ...(isAdmin?[{label:"Admin",items:[{key:"approvals",icon:"✓",label:"Approvals",badge:pendingCount},...(isSA?[{key:"hr",icon:"⊕",label:"HR & Team"},{key:"assessment",icon:"◐",label:"AI Assessment"},{key:"logins",icon:"⊗",label:"User Logins"}]:[])]}]:[{label:"HR",items:[{key:"hr",icon:"⊕",label:"My Leaves"}]}]),
    {label:"Account",items:[{key:"settings",icon:"⚙",label:"Settings"}]}
  ];
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-wordmark">Flow <em>by</em> Anecdote</div>
        <div className="logo-byline">Agency OS</div>
      </div>
      {sections.map(s=>(
        <div className="sidebar-section" key={s.label}>
          <div className="sidebar-section-label">{s.label}</div>
          {s.items.map(item=>(
            <div key={item.key} className={`nav-item ${active===item.key?"active":""}`} onClick={()=>setActive(item.key)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.badge>0&&<span className="nav-badge">{item.badge}</span>}
            </div>
          ))}
        </div>
      ))}
      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="avatar">{user.avatar}</div>
          <div><div className="user-name">{user.name}</div><div className="user-role">{user.username}</div></div>
        </div>
      </div>
    </div>
  );
}

// ─── VIDEO CALL ────────────────────────────────────────────────────────────────
function VideoCallModal({ participants, onEnd, supabase, currentUser }) {
  const [muted,setMuted]=useState(false);
  const [videoOff,setVideoOff]=useState(false);
  const [sharing,setSharing]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [status,setStatus]=useState("Starting camera...");
  const localVideoRef=useRef(null);
  const remoteVideoRef=useRef(null);
  const localStreamRef=useRef(null);
  const screenStreamRef=useRef(null);
  const pcRef=useRef(null);
  const sigChRef=useRef(null);

  useEffect(()=>{const iv=setInterval(()=>setElapsed(p=>p+1),1000);return()=>clearInterval(iv);},[]);
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  useEffect(()=>{
    if(!supabase||!currentUser||participants.length<2) return;
    const remote=participants.find(p=>String(p.id)!==String(currentUser.id));
    if(!remote) return;

    const roomId=[currentUser.id,remote.id].sort().join("-");
    const turnUrl=import.meta.env?.VITE_TURN_URL||null;
    const turnUser=import.meta.env?.VITE_TURN_USER||null;
    const turnPass=import.meta.env?.VITE_TURN_PASS||null;
    const iceServers=[
      {urls:"stun:stun.l.google.com:19302"},
      {urls:"stun:stun1.l.google.com:19302"},
      ...(turnUrl?[{urls:turnUrl,username:turnUser,credential:turnPass}]:[])
    ];

    let pc;
    async function init(){
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
        localStreamRef.current=stream;
        if(localVideoRef.current) localVideoRef.current.srcObject=stream;
        setStatus("Connecting...");

        pc=new RTCPeerConnection({iceServers});
        pcRef.current=pc;
        stream.getTracks().forEach(t=>pc.addTrack(t,stream));

        pc.ontrack=(e)=>{
          if(remoteVideoRef.current) remoteVideoRef.current.srcObject=e.streams[0];
          setStatus("connected");
        };
        pc.oniceconnectionstatechange=()=>{
          const s=pc.iceConnectionState;
          if(s==="connected"||s==="completed") setStatus("connected");
          if(s==="failed") setStatus("Connection failed");
        };

        // Signaling
        const sigCh=supabase.channel("call-"+roomId,{config:{broadcast:{self:false}}});
        sigChRef.current=sigCh;
        let iceBuf=[];

        pc.onicecandidate=(e)=>{
          if(e.candidate) sigCh.send({type:"broadcast",event:"sig",payload:{t:"ice",c:e.candidate,f:currentUser.id}}).catch(()=>{});
        };

        sigCh.on("broadcast",{event:"sig"},({payload:m})=>{
          if(String(m.f)===String(currentUser.id)) return;
          if(m.t==="offer"){
            pc.setRemoteDescription(new RTCSessionDescription(m.s))
              .then(()=>{iceBuf.forEach(c=>pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{}));iceBuf=[];return pc.createAnswer();})
              .then(a=>pc.setLocalDescription(a))
              .then(()=>sigCh.send({type:"broadcast",event:"sig",payload:{t:"answer",s:pc.localDescription,f:currentUser.id}}))
              .catch(e=>console.warn("answer err:",e));
          }
          if(m.t==="answer"){
            pc.setRemoteDescription(new RTCSessionDescription(m.s)).then(()=>{iceBuf.forEach(c=>pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{}));iceBuf=[];}).catch(e=>console.warn("set answer err:",e));
          }
          if(m.t==="ice"){if(pc.remoteDescription)pc.addIceCandidate(new RTCIceCandidate(m.c)).catch(()=>{});else iceBuf.push(m.c);}
          if(m.t==="bye"){cleanup();onEnd();}
        }).subscribe(st=>{
          if(st==="SUBSCRIBED"){
            setStatus("Waiting for peer...");
            setTimeout(()=>{
              if(pc.signalingState==="stable"&&!pc.remoteDescription){
                pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>{
                  sigCh.send({type:"broadcast",event:"sig",payload:{t:"offer",s:pc.localDescription,f:currentUser.id}});
                  setStatus("Ringing...");
                }).catch(e=>console.warn("offer err:",e));
              }
            },2000);
          }
        });
      }catch(e){
        console.warn("Call init error:",e);
        setStatus("Camera/mic access denied");
      }
    }
    init();
    return ()=>cleanup();
  },[]);

  function cleanup(){
    if(localStreamRef.current) localStreamRef.current.getTracks().forEach(t=>t.stop());
    if(screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t=>t.stop());
    if(pcRef.current) try{pcRef.current.close();}catch{}
    if(sigChRef.current){
      try{sigChRef.current.send({type:"broadcast",event:"sig",payload:{t:"bye",f:currentUser?.id}});supabase.removeChannel(sigChRef.current);}catch{}
    }
  }
  function endCall(){cleanup();onEnd();}
  function toggleMute(){
    if(localStreamRef.current){localStreamRef.current.getAudioTracks().forEach(t=>{t.enabled=muted;});setMuted(!muted);}
  }
  function toggleVideo(){
    if(localStreamRef.current){localStreamRef.current.getVideoTracks().forEach(t=>{t.enabled=videoOff;});setVideoOff(!videoOff);}
  }
  async function toggleScreen(){
    const pc=pcRef.current;
    if(!pc) return;
    if(!sharing){
      try{
        const screen=await navigator.mediaDevices.getDisplayMedia({video:true});
        screenStreamRef.current=screen;
        const videoTrack=screen.getVideoTracks()[0];
        const sender=pc.getSenders().find(s=>s.track?.kind==="video");
        if(sender) await sender.replaceTrack(videoTrack);
        if(localVideoRef.current) localVideoRef.current.srcObject=screen;
        videoTrack.onended=()=>{stopScreenShare();};
        setSharing(true);
      }catch(e){console.warn("Screen share error:",e);}
    }else{
      stopScreenShare();
    }
  }
  function stopScreenShare(){
    if(screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t=>t.stop());
    const camTrack=localStreamRef.current?.getVideoTracks()[0];
    if(camTrack){
      const sender=pcRef.current?.getSenders().find(s=>s.track?.kind==="video");
      if(sender) sender.replaceTrack(camTrack);
    }
    if(localVideoRef.current&&localStreamRef.current) localVideoRef.current.srcObject=localStreamRef.current;
    setSharing(false);
  }

  const remote=participants.find(p=>String(p.id)!==String(currentUser?.id));
  const isConnected=status==="connected";

  return(
    <div className="video-call-modal">
      <div className="vc-header">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:isConnected?"#4ADE80":"#F59E0B",animation:"pulse 1.5s ease-in-out infinite"}} />
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"white",fontWeight:600}}>Flow Meet</span>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{isConnected?fmt(elapsed):status}</span>
        </div>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Video Call · {participants.length} participants{sharing?" · Screen Sharing":""}</span>
      </div>
      <div className="vc-grid" style={{gridTemplateColumns:"1fr 1fr"}}>
        <div className="vc-tile" style={{overflow:"hidden",position:"relative"}}>
          <video ref={localVideoRef} autoPlay muted playsInline style={{width:"100%",height:"100%",objectFit:"cover",transform:sharing?"none":"scaleX(-1)"}} />
          {videoOff&&!sharing&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#1a1a2e"}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:"#C4954A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,color:"white",fontWeight:700}}>{currentUser?.avatar}</div>
          </div>}
          <div className="vc-tile-name">{currentUser?.name||currentUser?.displayName} (You){sharing?" 🖥":"" }</div>
        </div>
        <div className="vc-tile" style={{overflow:"hidden",position:"relative"}}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{width:"100%",height:"100%",objectFit:"cover"}} />
          {!isConnected&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,background:"#1a1a2e"}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:"#2E5F8A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,color:"white",fontWeight:700}}>{remote?.avatar}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>{status}</div>
          </div>}
          <div className="vc-tile-name">{remote?.name||remote?.displayName}</div>
        </div>
      </div>
      <div className="vc-controls">
        <button className={`vc-btn ${muted?"vc-btn-red":"vc-btn-gray"}`} onClick={toggleMute} title={muted?"Unmute":"Mute"}>{muted?"🔇":"🎤"}</button>
        <button className={`vc-btn ${videoOff?"vc-btn-red":"vc-btn-gray"}`} onClick={toggleVideo} title="Camera">{videoOff?"📵":"📷"}</button>
        <button className={`vc-btn ${sharing?"vc-btn-green":"vc-btn-gray"}`} onClick={toggleScreen} title="Share Screen">🖥</button>
        <button className="vc-btn vc-btn-red" onClick={endCall} title="End Call" style={{width:56,height:56,fontSize:22}}>📞</button>
      </div>
    </div>
  );
}


// ─── CHAT ─────────────────────────────────────────────────────────────────────
function ChatPanel({ user, users, messages, setMessages, onlineIds, open }) {
  const [thread,setThread]=useState(null); // null=list, "all"=group, userId=DM
  const [input,setInput]=useState("");
  const [call,setCall]=useState(null); // {type:'video'|'audio', participants}
  const msgEndRef=useRef();

  const visibleMsgs=thread==="all"
    ? messages.filter(m=>m.toId==="all")
    : messages.filter(m=>(m.fromId===user.id&&m.toId===thread)||(m.fromId===thread&&m.toId===user.id));

  useEffect(()=>{ if(open&&thread) msgEndRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,thread,open]);

  function send(){
    if(!input.trim()||!thread)return;
    const msg={id:Date.now(),fromId:user.id,toId:String(thread),text:input.trim(),time:nowStr(),date:todayISO(),readBy:[{userId:user.id,at:nowStr()}]};
    setMessages(p=>[...p,msg]);
    setInput("");
  }
    function startCall(participants){
    setCall({type:"video",participants:[users.find(u=>String(u.id)===String(user.id)),...participants]});
  }

  const others=users.filter(u=>u.id!==user.id);
  const getUserById=id=>users.find(u=>u.id===id);

  return(
    <>
      {call&&<VideoCallModal participants={call.participants} onEnd={()=>setCall(null)} supabase={supabase} currentUser={user} />}
      <div className={`chat-panel ${open?"open":""}`}>
        <div style={{height:4,background:"linear-gradient(90deg,#C4954A,#E8C88A,#4A7C59,#2E5F8A)",flexShrink:0}} />
        {!thread?(
          <>
            <div className="chat-header">
              <span className="chat-title">Team Inbox</span>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <div className="status-dot status-online" />
                <span style={{fontSize:10,color:"var(--ink-muted)"}}>{onlineIds.length} online</span>
              </div>
            </div>
            <div className="chat-contact-list">
              {/* Group */}
              <div className="chat-contact" onClick={()=>setThread("all")}>
                <div className="avatar" style={{background:"linear-gradient(135deg,#C4954A,#9B3A3A)"}}>✦</div>
                <div className="chat-contact-info">
                  <div className="chat-contact-name">All Hands</div>
                  <div className="chat-contact-last">Team channel</div>
                </div>
                <div className="flex items-center gap-8">
                  <button className="call-btn call-btn-video" onClick={e=>{e.stopPropagation();startCall(others);}} title="Video Meet">📹</button>
                </div>
              </div>
              {others.map(u=>{
                const isOnline=onlineIds.includes(u.id);
                const lastMsg=messages.filter(m=>(String(m.fromId)===String(u.id)&&String(m.toId)===String(user.id))||(String(m.fromId)===String(user.id)&&String(m.toId)===String(u.id))).slice(-1)[0];
                return(
                  <div key={u.id} className="chat-contact" onClick={()=>setThread(u.id)}>
                    <div style={{position:"relative"}}>
                      <div className="avatar sm" style={{background:u.role==="admin"?"var(--accent)":u.role==="superadmin"?"#943535":"var(--info)"}}>{u.avatar}</div>
                      <div className={`status-dot ${isOnline?"status-online":"status-offline"}`} style={{position:"absolute",bottom:0,right:0,border:"2px solid var(--surface)"}} />
                    </div>
                    <div className="chat-contact-info">
                      <div className="chat-contact-name">{u.name||u.displayName||u.username}</div>
                      <div className="chat-contact-last">{isOnline?"● Online":"○ Offline"}</div>
                    </div>
                    <button className="call-btn call-btn-video" style={{fontSize:9}} onClick={e=>{e.stopPropagation();startCall([u]);}}>📹</button>
                  </div>
                );
              })}
            </div>
          </>
        ):(
          <>
            <div className="chat-header">
              <button className="chat-back" onClick={()=>setThread(null)}>‹</button>
              {thread==="all"?(
                <div className="avatar" style={{background:"linear-gradient(135deg,#C4954A,#9B3A3A)",fontSize:13}}>✦</div>
              ):(
                <div style={{position:"relative"}}>
                  <div className="avatar sm" style={{background:getUserById(thread)?.role==="admin"?"var(--accent)":"var(--info)"}}>{getUserById(thread)?.avatar}</div>
                  <div className={`status-dot ${onlineIds.includes(thread)?"status-online":"status-offline"}`} style={{position:"absolute",bottom:0,right:-1,border:"2px solid var(--surface)"}} />
                </div>
              )}
              <div style={{flex:1}}>
                <div className="chat-contact-name">{thread==="all"?"All Hands":(getUserById(thread)?.name||getUserById(thread)?.displayName)}</div>
                <div style={{fontSize:10,color:"var(--ink-muted)"}}>{thread==="all"?`${onlineIds.length} active`:onlineIds.includes(thread)?"● Online":"○ Offline"}</div>
              </div>
              <div className="flex gap-8">
                
                <button className="call-btn call-btn-video" onClick={()=>startCall(thread==="all"?others:[getUserById(thread)])}>📹</button>
              </div>
            </div>
            <div className="meeting-bar">
              <span className="meeting-chip">✦ Flow Meet</span>
              <span style={{flex:1,fontSize:10,color:"var(--ink-muted)"}}>Start a video meeting with this channel</span>
              <button className="call-btn call-btn-video" onClick={()=>startCall(thread==="all"?others:[getUserById(thread)])}>📹 Start</button>
            </div>
            <div className="chat-body">
              {visibleMsgs.length===0&&<div style={{textAlign:"center",color:"var(--ink-muted)",fontSize:12,marginTop:20}}>Start the conversation ✦</div>}
              {visibleMsgs.map(m=>{
                const isMe=String(m.fromId)===String(user.id);
                const sender=getUserById(m.fromId);
                return(
                  <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start"}}>
                    {!isMe&&<div style={{fontSize:10,color:"var(--ink-muted)",marginBottom:2,marginLeft:4}}>{sender?.name||sender?.displayName||sender?.username}</div>}
                    <div className={`chat-bubble ${isMe?"mine":"theirs"}`}>
                      {m.text}
                      <div className="chat-bubble-time">{m.time}{isMe&&(()=>{
                        const rb=m.readBy||[];
                        const others=rb.filter(r=>{const uid=typeof r==="object"?r.userId:r;return String(uid)!==String(user.id);});
                        if(others.length>0){const st=others[0];const t=typeof st==="object"?st.at:null;return <span style={{marginLeft:3}}><span style={{color:"#53BDEB",fontWeight:700}}>✓✓</span></span>;}
                        return <span style={{opacity:0.5,marginLeft:3}}> ✓</span>;
                      })()}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>
            <div className="chat-input-row">
              <input className="chat-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message…" />
              <button className="chat-send" onClick={send}>➤</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({ user, users, setUsers, dark, setDark, onPasswordChange }) {
  const [tab,setTab]=useState("profile");
  const [pw,setPw]=useState({current:"",next:"",confirm:""});
  const [pwMsg,setPwMsg]=useState("");
  const [newUser,setNewUser]=useState({name:"",username:"",password:"",role:"executive",email:""});
  const [nuMsg,setNuMsg]=useState("");
  const isSA=user.role==="superadmin";

  function changePw(){
    if(pw.current!==user.password){setPwMsg("Current password is incorrect.");return;}
    if(pw.next.length<6){setPwMsg("New password must be at least 6 characters.");return;}
    if(pw.next!==pw.confirm){setPwMsg("Passwords do not match.");return;}
    onPasswordChange(pw.next);
    setPwMsg("✓ Password updated successfully.");
    setPw({current:"",next:"",confirm:""});
  }
  function addUser(){
    if(!newUser.name||!newUser.username||!newUser.password){setNuMsg("All fields are required.");return;}
    if(users.find(u=>u.username===newUser.username)){setNuMsg("Username already taken.");return;}
    const av=newUser.name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2);
    setUsers(p=>[...p,{...newUser,id:Date.now(),avatar:av}]);
    setNuMsg("✓ User added successfully.");
    setNewUser({name:"",username:"",password:"",role:"executive",email:""});
  }
  function removeUser(id){setUsers(p=>p.filter(u=>u.id!==id));}

  const navItems=[
    {key:"profile",icon:"👤",label:"Profile & Password"},
    {key:"theme",icon:"🎨",label:"Appearance"},
    ...(isSA?[{key:"team",icon:"👥",label:"Manage Team"}]:[]),
    {key:"about",icon:"ℹ",label:"About Flow"},
  ];

  return(
    <div>
      <div className="section-header"><div><h1 className="section-title">Settings</h1><p className="section-sub">Manage your account and preferences</p></div></div>
      <div className="settings-grid">
        <div className="settings-nav">
          {navItems.map(n=>(
            <div key={n.key} className={`settings-nav-item ${tab===n.key?"active":""}`} onClick={()=>setTab(n.key)}>
              <span>{n.icon}</span>{n.label}
            </div>
          ))}
        </div>
        <div className="settings-section">
          {/* PROFILE */}
          {tab==="profile"&&(
            <div>
              <div className="settings-title">Profile & Password</div>
              <div className="flex items-center gap-16 mb-20" style={{padding:"18px",background:"var(--cream-dark)",borderRadius:12}}>
                <div className="avatar lg" style={{width:56,height:56,fontSize:20,background:user.role==="superadmin"?"#943535":user.role==="admin"?"var(--accent)":"var(--info)"}}>{user.avatar}</div>
                <div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:"var(--ink)"}}>{user.name}</div>
                  <div style={{fontSize:12,color:"var(--ink-muted)",marginTop:2}}>{user.username} · <span style={{textTransform:"capitalize"}}>{user.role.replace("superadmin","Super Admin")}</span></div>
                </div>
              </div>
              <hr className="divider" />
              <p style={{fontWeight:600,fontSize:13,marginBottom:14,color:"var(--ink)"}}>Change Password</p>
              <div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" value={pw.current} onChange={e=>setPw(p=>({...p,current:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" value={pw.next} onChange={e=>setPw(p=>({...p,next:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" value={pw.confirm} onChange={e=>setPw(p=>({...p,confirm:e.target.value}))} /></div>
              {pwMsg&&<p style={{fontSize:12,marginBottom:9,color:pwMsg.startsWith("✓")?"var(--success)":"var(--danger)"}}>{pwMsg}</p>}
              <button className="btn btn-primary" onClick={changePw}>Update Password</button>
            </div>
          )}

          {/* THEME */}
          {tab==="theme"&&(
            <div>
              <div className="settings-title">Appearance</div>
              <p style={{fontSize:12,color:"var(--ink-muted)",marginBottom:18}}>Choose your preferred visual theme for Flow.</p>
              <div className="flex gap-12 mb-20">
                {[{id:"light",label:"Light",bg:"#F6F1E9",card:"#FFF",text:"#141414"},{id:"dark",label:"Dark",bg:"#1A1A2E",card:"#1E2D4A",text:"#E8E0D0"}].map(t=>(
                  <div key={t.id} className={`theme-card ${(!dark&&t.id==="light")||(dark&&t.id==="dark")?"selected":""}`} onClick={()=>setDark(t.id==="dark")}>
                    <div className="theme-preview" style={{background:t.bg,border:`1px solid ${t.id==="light"?"#DDD5C0":"#2A3A5A"}`,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                      <div style={{width:28,height:20,background:t.card,borderRadius:4,border:`1px solid ${t.id==="light"?"#DDD":"#2A3A5A"}`}} />
                      <div style={{width:40,height:8,background:t.text,borderRadius:3,opacity:0.6}} />
                    </div>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--ink)"}}>{t.label}</div>
                    {((!dark&&t.id==="light")||(dark&&t.id==="dark"))&&<div style={{fontSize:10,color:"var(--accent)",marginTop:3}}>✓ Active</div>}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between" style={{padding:"14px 16px",background:"var(--cream-dark)",borderRadius:10}}>
                <div><div style={{fontSize:13,fontWeight:500,color:"var(--ink)"}}>Dark Mode</div><div style={{fontSize:11,color:"var(--ink-muted)"}}>Switch between light and dark interface</div></div>
                <div className={`toggle-switch ${dark?"on":""}`} onClick={()=>setDark(p=>!p)}>
                  <div className="toggle-knob" />
                </div>
              </div>
            </div>
          )}

          {/* MANAGE TEAM (Super Admin only) */}
          {tab==="team"&&isSA&&(
            <div>
              <div className="settings-title">Manage Team</div>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,color:"var(--ink)",marginBottom:12}}>Add New Member</p>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={newUser.name} onChange={e=>setNewUser(p=>({...p,name:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={newUser.username} onChange={e=>setNewUser(p=>({...p,username:e.target.value}))} placeholder="e.g. Executive_3" /></div>
                <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Role</label>
                  <select className="form-input form-select" value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))}>
                    <option value="executive">Executive</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Email (optional)</label><input className="form-input" value={newUser.email} onChange={e=>setNewUser(p=>({...p,email:e.target.value}))} /></div>
              </div>
              {nuMsg&&<p style={{fontSize:12,marginBottom:9,color:nuMsg.startsWith("✓")?"var(--success)":"var(--danger)"}}>{nuMsg}</p>}
              <button className="btn btn-primary mb-20" onClick={addUser}>+ Add Member</button>
              <hr className="divider" />
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,color:"var(--ink)",marginBottom:12}}>Current Team</p>
              {users.map(u=>(
                <div key={u.id} className="flex items-center justify-between" style={{padding:"10px 14px",background:"var(--cream-dark)",borderRadius:9,marginBottom:8}}>
                  <div className="flex items-center gap-10">
                    <div className="avatar sm" style={{background:u.role==="superadmin"?"#943535":u.role==="admin"?"var(--accent)":"var(--info)"}}>{u.avatar}</div>
                    <div><div style={{fontSize:13,fontWeight:500,color:"var(--ink)"}}>{u.name}</div><div style={{fontSize:10.5,color:"var(--ink-muted)"}}>{u.username} · <span style={{textTransform:"capitalize"}}>{u.role.replace("superadmin","Super Admin")}</span></div></div>
                  </div>
                  {u.role!=="superadmin"&&<button className="btn btn-danger btn-sm" onClick={()=>removeUser(u.id)}>Remove</button>}
                </div>
              ))}
            </div>
          )}

          {/* ABOUT */}
          {tab==="about"&&(
            <div>
              <div className="settings-title">About Flow by Anecdote</div>
              <div style={{textAlign:"center",padding:"30px 0"}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:40,fontWeight:700,color:"var(--ink)",marginBottom:8}}>Flow <em style={{fontStyle:"italic",color:"var(--accent)"}}>by</em> Anecdote</div>
                <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"var(--ink-muted)",marginBottom:24}}>Agency Management OS</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
                  {[["◈","Dashboard","Client & content overview"],["💬","Team Chat","Internal messaging & meets"],["◐","AI Tools","Captions & assessments"],["⊕","HR Suite","Leaves & attendance"],["✦","Planner","Personal time blocks"],["⚙","Settings","Theme & user management"]].map(([icon,title,desc])=>(
                    <div key={title} style={{padding:"14px",background:"var(--cream-dark)",borderRadius:10,textAlign:"center"}}>
                      <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
                      <div style={{fontSize:12,fontWeight:600,color:"var(--ink)"}}>{title}</div>
                      <div style={{fontSize:10,color:"var(--ink-muted)",marginTop:2}}>{desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:"var(--ink-muted)"}}>Version 2.0 · Built with ✦ by Anecdote Agency</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function TodaysTasks({ user, content, setContent, clients }) {
  const tc=content.filter(c=>c.scheduledDate===todayISO());
  const canMark=user.role==="executive";
  return(
    <div className="card">
      <div className="flex items-center justify-between mb-16">
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,color:"var(--ink)"}}>Today's Content</h3>
        <span className="badge badge-accent">{tc.filter(c=>c.status==="posted").length}/{tc.length} posted</span>
      </div>
      {tc.length===0?<p className="text-muted text-sm">Nothing scheduled today.</p>:tc.map(item=>{
        const client=clients.find(c=>c.id===item.clientId);const isP=item.status==="posted";
        return(<div key={item.id} className={`today-task-row ${isP?"posted":""}`}>
          <div className={`task-check ${isP?"checked":""}`} style={{cursor:canMark&&!isP?"pointer":"default"}} onClick={()=>canMark&&!isP&&setContent(p=>p.map(c=>c.id===item.id?{...c,status:"posted",postedAt:nowStr()}:c))}>{isP&&"✓"}</div>
          <div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:500,textDecoration:isP?"line-through":"none",color:"var(--ink)"}}>{item.title}</div><div className="text-sm text-muted">{client?.name} · {item.scheduledTime}</div></div>
          {getStatusBadge(item.status)}
        </div>);
      })}
    </div>
  );
}

function Dashboard({ user, users=[], clients, content, setContent, attendance, dark, plannerEvents={}, calendar=[] }) {
  const myContent=user.role==="executive"?content.filter(c=>c.execId===user.id):content;
  const pending=content.filter(c=>(user.role==="admin"&&c.status==="pending_admin")||(user.role==="superadmin"&&(c.status==="pending_superadmin"||c.status==="pending_admin")));
  const todayAtt=attendance.filter(a=>a.date===todayISO());
  const today=todayISO();
  const myEvents=(plannerEvents[user.id]||[]);
  const upcomingTasks=myEvents
    .filter(e=>e.date>=today)
    .sort((a,b)=>a.date===b.date?a.startHour-b.startHour:a.date.localeCompare(b.date))
    .slice(0,6);
  const todayTasks=myEvents.filter(e=>e.date===today).sort((a,b)=>a.startHour-b.startHour);
  const unsubmitted=content.filter(c=>{const mine=user.role!=="executive"||c.execId===user.id;return mine&&c.status==="draft";}).slice(0,5);
  const [quoteIdx,setQuoteIdx]=useState(()=>Math.floor(Math.random()*MOTIVATIONAL_QUOTES.length));
  useEffect(()=>{const iv=setInterval(()=>setQuoteIdx(p=>(p+1)%MOTIVATIONAL_QUOTES.length),6000);return()=>clearInterval(iv);},[]);
  const quote=MOTIVATIONAL_QUOTES[quoteIdx];
  return(
    <div>
      {/* Dashboard Banner — wave artwork */}
      <div className="dashboard-mural">
        <WavesSVG height={160} opacity={0.22} phase={0} />
        <div className="mural-greeting">Good day,<br /><em>{(user.displayName||user.name).split(" ")[0]}.</em></div>
        <div className="mural-sub">{todayStr()}</div>
        <div className="mural-stats">
          <div className="mural-stat"><div className="mural-stat-val">{clients.filter(c=>c.status==="active").length}</div><div className="mural-stat-lbl">Clients</div></div>
          <div className="mural-stat"><div className="mural-stat-val">{myContent.filter(c=>c.status==="posted").length}</div><div className="mural-stat-lbl">Posted</div></div>
          {user.role==="superadmin"&&<div className="mural-stat" style={{cursor:"pointer"}} onClick={()=>document.getElementById("sa-selfie-panel")?.scrollIntoView({behavior:"smooth"})}><div className="mural-stat-val">{todayAtt.length}</div><div className="mural-stat-lbl">Present ↓</div></div>}
          {(user.role==="admin"||user.role==="superadmin")&&<div className="mural-stat"><div className="mural-stat-val" style={{color:pending.length>0?"#F59E0B":"#4ADE80"}}>{pending.length}</div><div className="mural-stat-lbl">Pending</div></div>}
        </div>
      </div>

      {/* Live Quote Card */}
      <div style={{margin:"16px 0",padding:"14px 20px",background:"var(--surface)",borderRadius:12,borderLeft:"3px solid var(--accent)",display:"flex",alignItems:"center",gap:16,animation:"fadeIn 0.6s ease"}}>
        <div style={{fontSize:22,opacity:0.5}}>✦</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontStyle:"italic",color:"var(--ink)",lineHeight:1.5}}>"{quote.text}"</div>
          <div style={{fontSize:11,color:"var(--ink-muted)",marginTop:4}}>— {quote.author}</div>
        </div>
      </div>

      <div className="grid-2">
        <TodaysTasks user={user} content={content} setContent={setContent} clients={clients} />
        <div className="card">
          <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:13,color:"var(--ink)"}}>Recent Content</h3>
          {myContent.slice(0,5).map(c=>{const cl=clients.find(x=>x.id===c.clientId);return(
            <div key={c.id} className="flex items-center justify-between" style={{padding:"8px 0",borderBottom:"1px solid var(--cream-dark)"}}>
              <div><div style={{fontSize:12.5,fontWeight:500,color:"var(--ink)"}}>{c.title}</div><div className="text-sm text-muted">{cl?.name} · {c.scheduledDate}</div></div>
              {getStatusBadge(c.status)}
            </div>);
          })}
          {myContent.length===0&&<p className="text-muted text-sm">No content yet.</p>}
        </div>
      </div>
    {/* Active Clients List — visible to all */}
    <div className="card" style={{marginTop:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,color:"var(--ink)"}}>Active Clients</h3>
        <span style={{fontSize:11,color:"var(--ink-muted)",background:"var(--accent-pale)",padding:"3px 10px",borderRadius:10,fontWeight:600}}>{clients.filter(c=>c.status==="active").length} active</span>
      </div>
      {clients.filter(c=>c.status==="active").length===0&&<p className="text-muted text-sm">No active clients yet.</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
        {clients.filter(c=>c.status==="active").map(cl=>{
          const clContent=content.filter(c=>c.clientId===cl.id);
          const posted=clContent.filter(c=>c.status==="posted").length;
          const pending=clContent.filter(c=>["pending_admin","pending_superadmin","draft"].includes(c.status)).length;
          return(
            <div key={cl.id} style={{padding:"12px 14px",borderRadius:12,border:"1px solid var(--border)",background:"var(--surface2)",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:38,height:38,borderRadius:10,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:14,fontWeight:700,flexShrink:0}}>{(cl.name||"?")[0].toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--ink)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cl.name}</div>
                <div style={{fontSize:10,color:"var(--ink-muted)",marginTop:2}}>{cl.service||cl.category||"Client"}</div>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <span style={{fontSize:9,color:"var(--success)",fontWeight:600}}>{posted} posted</span>
                  {pending>0&&<span style={{fontSize:9,color:"var(--warning)",fontWeight:600}}>{pending} pending</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Superadmin: Today's Team Selfies */}
    {user.role==="superadmin"&&(
      <div id="sa-selfie-panel" className="card" style={{marginTop:16}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:16,color:"var(--ink)"}}>📸 Today's Attendance — {todayISO()}</h3>
        {users.filter(u=>u.role!=="superadmin").length===0&&<p className="text-muted text-sm">No team members yet.</p>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
          {users.filter(u=>u.role!=="superadmin").map(emp=>{
            const rec=attendance.find(a=>a.userId===emp.id&&a.date===todayISO());
            const isPresent=!!rec;
            return(
              <div key={emp.id} style={{background:"var(--cream-dark)",borderRadius:12,padding:12,textAlign:"center",border:`2px solid ${isPresent?"var(--success)":"var(--cream-dark)"}`}}>
                {rec?.selfieIn
                  ? <img src={rec.selfieIn} style={{width:80,height:64,borderRadius:8,objectFit:"cover",transform:"scaleX(-1)",marginBottom:8}} alt="selfie" />
                  : <div style={{width:80,height:64,borderRadius:8,background:"var(--surface)",margin:"0 auto 8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{isPresent?"✓":"—"}</div>
                }
                <div style={{fontSize:12,fontWeight:600,color:"var(--ink)"}}>{emp.displayName||emp.name}</div>
                <div style={{fontSize:10,color:isPresent?"var(--success)":"var(--danger)",fontWeight:600,marginTop:2}}>{isPresent?`In ${rec.login}`+( rec.logout?` · Out ${rec.logout}`:""):"Absent"}</div>
                {rec?.selfieOut&&<img src={rec.selfieOut} style={{width:60,height:48,borderRadius:6,objectFit:"cover",transform:"scaleX(-1)",marginTop:6,opacity:0.8}} alt="out" />}
              </div>
            );
          })}
        </div>
      </div>
    )}
    </div>
  );
}

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
function Clients({ user, clients, setClients }) {
  const [showModal,setShowModal]=useState(false);const [editClient,setEditClient]=useState(null);const [viewClient,setViewClient]=useState(null);const [tab,setTab]=useState("active");
  const filtered=clients.filter(c=>tab==="all"?true:c.status===tab);
  function saveClient(data){if(editClient)setClients(p=>p.map(c=>c.id===editClient.id?{...c,...data}:c));else setClients(p=>[...p,{...data,id:Date.now(),onboarded:false,socialAccess:{}}]);setShowModal(false);setEditClient(null);}
  return(
    <div>
      <div className="section-header"><div><h1 className="section-title">Clients</h1></div>{user.role!=="executive"&&<button className="btn btn-primary" onClick={()=>{setEditClient(null);setShowModal(true);}}>+ Add Client</button>}</div>
      <div className="tabs">{[["active","Active"],["enquiry","Pipeline"],["all","All"]].map(([k,l])=><div key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</div>)}</div>
      <div className="card" style={{padding:0}}>
        <table className="table">
          <thead><tr><th>Client</th><th>Services</th><th>Status</th><th>Enquiry</th><th>Onboarded</th><th>Actions</th></tr></thead>
          <tbody>{filtered.map(c=>(
            <tr key={c.id}>
              <td><div style={{fontWeight:500}}>{c.name}</div><div className="text-sm text-muted">{c.contact} · {c.email}</div></td>
              <td><div className="flex gap-8" style={{flexWrap:"wrap"}}>{c.services.map(s=><span key={s} className="badge badge-accent" style={{fontSize:9}}>{s}</span>)}</div></td>
              <td>{getStatusBadge(c.status)}</td><td className="text-sm text-muted">{c.enquiryDate}</td>
              <td>{c.onboarded?<span className="badge badge-success">✓</span>:<span className="badge badge-neutral">No</span>}</td>
              <td><div className="flex gap-8"><button className="btn btn-ghost btn-sm" onClick={()=>setViewClient(c)}>View</button>{user.role!=="executive"&&<button className="btn btn-ghost btn-sm" onClick={()=>{setEditClient(c);setShowModal(true);}}>Edit</button>}</div></td>
            </tr>
          ))}</tbody>
        </table>
        {filtered.length===0&&<div className="empty"><p>No clients.</p></div>}
      </div>
      {showModal&&<ClientModal initial={editClient} onSave={saveClient} onClose={()=>{setShowModal(false);setEditClient(null);}} />}
      {viewClient&&<ClientDetailModal client={viewClient} setClients={setClients} user={user} onClose={()=>setViewClient(null)} />}
    </div>
  );
}
function ClientModal({ initial, onSave, onClose }) {
  const [form,setForm]=useState({name:initial?.name||"",contact:initial?.contact||"",email:initial?.email||"",phone:initial?.phone||"",services:initial?.services||[],status:initial?.status||"enquiry",enquiryDate:initial?.enquiryDate||todayISO()});
  const toggle=s=>setForm(p=>({...p,services:p.services.includes(s)?p.services.filter(x=>x!==s):[...p.services,s]}));
  return(<Modal title={initial?"Edit Client":"Add Client"} onClose={onClose}>
    <div className="grid-2">
      <div className="form-group"><label className="form-label">Company</label><input className="form-input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
      <div className="form-group"><label className="form-label">Contact</label><input className="form-input" value={form.contact} onChange={e=>setForm(p=>({...p,contact:e.target.value}))} /></div>
      <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} /></div>
      <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} /></div>
    </div>
    <div className="form-group"><label className="form-label">Status</label><select className="form-input form-select" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option value="enquiry">Enquiry</option><option value="active">Active</option><option value="closed">Closed</option></select></div>
    <div className="form-group"><label className="form-label">Services</label><div className="flex gap-8" style={{flexWrap:"wrap",marginTop:4}}>{SERVICES.map(s=><span key={s} onClick={()=>toggle(s)} className={`badge ${form.services.includes(s)?"badge-accent":"badge-neutral"}`} style={{cursor:"pointer",padding:"4px 10px"}}>{s}</span>)}</div></div>
    <div className="flex gap-12 mt-16"><button className="btn btn-primary" onClick={()=>onSave(form)}>Save</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
  </Modal>);
}
function ClientDetailModal({ client, setClients, user, onClose }) {
  const [sa,setSa]=useState(client.socialAccess||{});const [p,setP]=useState("");const [h,setH]=useState("");
  const [ob,setOb]=useState(client.onboarded);const [dd,setDd]=useState(client.dealDate||"");
  function save(){setClients(prev=>prev.map(c=>c.id===client.id?{...c,socialAccess:sa,onboarded:ob,dealDate:dd}:c));onClose();}
  return(<Modal title={client.name} onClose={onClose} lg>
    <div className="grid-2">
      <div><p className="form-label">Contact</p><p style={{fontSize:13,color:"var(--ink)"}}>{client.contact}</p><p className="text-sm text-muted">{client.email}</p></div>
      <div><p className="form-label">Services</p><div className="flex gap-8" style={{flexWrap:"wrap"}}>{client.services.map(s=><span key={s} className="badge badge-accent">{s}</span>)}</div></div>
    </div>
    <hr className="divider" />
    {user.role!=="executive"?(
      <>
        <div className="flex items-center gap-12 mb-12"><label style={{fontSize:12.5,fontWeight:500,color:"var(--ink)"}}><input type="checkbox" checked={ob} onChange={e=>setOb(e.target.checked)} style={{marginRight:5}} />Onboarded</label>{ob&&<input className="form-input" type="date" value={dd} onChange={e=>setDd(e.target.value)} style={{width:155}} />}</div>
        <div className="form-group">
          <label className="form-label">Social Media Access</label>
          {Object.entries(sa).map(([k,v])=><div key={k} className="flex items-center justify-between" style={{padding:"6px 10px",background:"var(--cream-dark)",borderRadius:7,marginBottom:5}}><span style={{fontSize:12,color:"var(--ink)"}}><strong>{k}:</strong> {v}</span><button onClick={()=>setSa(prev=>{const n={...prev};delete n[k];return n;})} style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)"}}>✕</button></div>)}
          <div className="flex gap-8 mt-8"><input className="form-input" placeholder="Platform" value={p} onChange={e=>setP(e.target.value)} style={{flex:1}} /><input className="form-input" placeholder="Handle" value={h} onChange={e=>setH(e.target.value)} style={{flex:1}} /><button className="btn btn-ghost btn-sm" onClick={()=>{if(p&&h){setSa(prev=>({...prev,[p]:h}));setP("");setH("");}}}>Add</button></div>
        </div>
        <div className="flex gap-12 mt-16"><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
      </>
    ):(
      <div><p className="form-label">Social Access</p>{Object.entries(client.socialAccess||{}).map(([k,v])=><div key={k} style={{fontSize:12.5,marginBottom:3,color:"var(--ink)"}}><strong>{k}:</strong> {v}</div>)}</div>
    )}
  </Modal>);
}

// ─── CONTENT CALENDAR ─────────────────────────────────────────────────────────
// ─── INDIAN FESTIVALS DATA ────────────────────────────────────────────────────
const INDIAN_FESTIVALS = {
  "2025-01-14":{ name:"Makar Sankranti", type:"major", emoji:"🪁", tip:"Kite & harvest vibes — great for lifestyle, food, fashion brands" },
  "2025-01-23":{ name:"Netaji Jayanti", type:"national", emoji:"🇮🇳", tip:"Patriotic content — ideal for brand values & community posts" },
  "2025-01-26":{ name:"Republic Day", type:"national", emoji:"🇮🇳", tip:"National pride — use tricolour palette, story reels work well" },
  "2025-02-02":{ name:"Basant Panchami", type:"major", emoji:"💛", tip:"Yellow theme, spring launch content, education brands" },
  "2025-02-14":{ name:"Valentine's Day", type:"major", emoji:"❤️", tip:"Love & gifting — jewellery, fashion, F&B brands thrive here" },
  "2025-02-19":{ name:"Chhatrapati Shivaji Jayanti", type:"regional", emoji:"⚔️", tip:"Maharashtra — strong regional engagement opportunity" },
  "2025-02-26":{ name:"Maha Shivratri", type:"major", emoji:"🔱", tip:"Spiritual tone, minimalist aesthetic, avoid loud promotions" },
  "2025-03-13":{ name:"Holi Eve", type:"major", emoji:"🎨", tip:"Pre-Holi teasers — colour-splashed creatives perform best" },
  "2025-03-14":{ name:"Holi", type:"major", emoji:"🌈", tip:"Biggest colour festival — all brands can celebrate authentically" },
  "2025-03-30":{ name:"Ram Navami", type:"major", emoji:"🙏", tip:"Devotional tone, avoid hard-sell — community & CSR content" },
  "2025-03-31":{ name:"Eid ul-Fitr", type:"major", emoji:"🌙", tip:"Celebrate togetherness, gifting, fashion & food content peak" },
  "2025-04-06":{ name:"Ugadi / Gudi Padwa", type:"regional", emoji:"🌸", tip:"South & West India New Year — fresh start messaging" },
  "2025-04-10":{ name:"Mahavir Jayanti", type:"national", emoji:"🕊️", tip:"Peace & non-violence themes — CSR & sustainability brands" },
  "2025-04-14":{ name:"Baisakhi / Ambedkar Jayanti", type:"major", emoji:"🌾", tip:"Harvest + social equality — Punjab & national audience" },
  "2025-04-18":{ name:"Good Friday", type:"national", emoji:"✝️", tip:"Sombre tone, avoid sales promotions" },
  "2025-04-20":{ name:"Easter", type:"major", emoji:"🐣", tip:"New beginnings theme, pastel palette, lifestyle brands" },
  "2025-05-12":{ name:"Mother's Day", type:"major", emoji:"💐", tip:"Emotional storytelling — gifting, fashion, skincare peak" },
  "2025-05-23":{ name:"Buddha Purnima", type:"national", emoji:"☮️", tip:"Peaceful, mindful content — wellness & spiritual brands" },
  "2025-06-05":{ name:"World Environment Day", type:"major", emoji:"🌿", tip:"Sustainability content — great for CSR and eco brands" },
  "2025-06-15":{ name:"Father's Day", type:"major", emoji:"👔", tip:"Gifting & lifestyle content — men's brands, experiences" },
  "2025-07-04":{ name:"Guru Purnima", type:"major", emoji:"🙏", tip:"Gratitude & mentorship — education, coaching brands" },
  "2025-08-09":{ name:"Muharram", type:"national", emoji:"🕌", tip:"Respectful tone, avoid promotional content" },
  "2025-08-15":{ name:"Independence Day", type:"national", emoji:"🇮🇳", tip:"Tricolour palette, freedom & aspiration themes — all brands" },
  "2025-08-16":{ name:"Onam", type:"regional", emoji:"🌺", tip:"Kerala festival — vibrant, floral aesthetics, food content" },
  "2025-08-23":{ name:"Raksha Bandhan", type:"major", emoji:"🧵", tip:"Sibling love — gifting, fashion, jewellery brands thrive" },
  "2025-08-27":{ name:"Janmashtami", type:"major", emoji:"🥛", tip:"Divine & playful tone — food (maakhan/mishri), lifestyle brands" },
  "2025-09-04":{ name:"Ganesh Chaturthi", type:"major", emoji:"🐘", tip:"Maharashtra & pan-India — joy, community, eco-friendly messaging" },
  "2025-09-15":{ name:"Engineer's Day", type:"major", emoji:"⚙️", tip:"Tech & innovation brands — quirky behind-the-scenes content" },
  "2025-10-02":{ name:"Gandhi Jayanti", type:"national", emoji:"🇮🇳", tip:"Truth & simplicity — brand values, minimalist content" },
  "2025-10-02":{ name:"Navratri Begins", type:"major", emoji:"🎶", tip:"9-day festival — fashion (chaniya choli), dance, colour series" },
  "2025-10-11":{ name:"Dussehra", type:"major", emoji:"🏹", tip:"Good over evil — bold aspirational messaging, all brands" },
  "2025-10-20":{ name:"Diwali", type:"major", emoji:"🪔", tip:"Biggest festival — gifting, fashion, home, gold, F&B — all out" },
  "2025-10-21":{ name:"Govardhan Puja", type:"major", emoji:"🌿", tip:"Post-Diwali — food & nature brands, gratitude content" },
  "2025-10-22":{ name:"Bhai Dooj", type:"major", emoji:"🎁", tip:"Sibling gifting — great for e-commerce & gifting brands" },
  "2025-11-01":{ name:"Chhath Puja", type:"regional", emoji:"🌅", tip:"UP, Bihar, Jharkhand — sunrise/sunset visuals, devotional" },
  "2025-11-05":{ name:"Guru Nanak Jayanti", type:"national", emoji:"🙏", tip:"Seva & humility — CSR, community initiatives content" },
  "2025-11-14":{ name:"Children's Day", type:"major", emoji:"🎈", tip:"Fun & nostalgia — education, toys, family brands" },
  "2025-12-19":{ name:"Goa Liberation Day", type:"regional", emoji:"🏖️", tip:"Regional pride — travel & hospitality brands" },
  "2025-12-25":{ name:"Christmas", type:"major", emoji:"🎄", tip:"Gifting, joy, year-end — all brands, warm palette" },
  "2025-12-31":{ name:"New Year's Eve", type:"major", emoji:"🎆", tip:"Year in review, resolutions — all brands celebrate" },
  "2026-01-01":{ name:"New Year", type:"major", emoji:"🎊", tip:"Fresh start — new collections, brand refresh content" },
  "2026-01-14":{ name:"Makar Sankranti", type:"major", emoji:"🪁", tip:"Kite & harvest vibes — lifestyle, food, fashion brands" },
  "2026-01-26":{ name:"Republic Day", type:"national", emoji:"🇮🇳", tip:"National pride — tricolour palette, community posts" },
  "2026-02-17":{ name:"Maha Shivratri", type:"major", emoji:"🔱", tip:"Spiritual tone, minimalist aesthetic" },
  "2026-02-14":{ name:"Valentine's Day", type:"major", emoji:"❤️", tip:"Love & gifting — jewellery, fashion, F&B brands" },
  "2026-03-02":{ name:"Holi", type:"major", emoji:"🌈", tip:"Biggest colour festival — all brands celebrate" },
  "2026-03-20":{ name:"Ram Navami", type:"major", emoji:"🙏", tip:"Devotional tone, avoid hard-sell" },
  "2026-03-20":{ name:"Eid ul-Fitr", type:"major", emoji:"🌙", tip:"Togetherness, gifting, fashion & food" },
  "2026-04-14":{ name:"Baisakhi / Ambedkar Jayanti", type:"major", emoji:"🌾", tip:"Harvest + social equality" },
  "2026-05-11":{ name:"Mother's Day", type:"major", emoji:"💐", tip:"Emotional storytelling — gifting, fashion, skincare" },
  "2026-08-15":{ name:"Independence Day", type:"national", emoji:"🇮🇳", tip:"Tricolour palette, freedom & aspiration" },
  "2026-09-12":{ name:"Ganesh Chaturthi", type:"major", emoji:"🐘", tip:"Joy, community, eco-friendly messaging" },
  "2026-10-02":{ name:"Gandhi Jayanti", type:"national", emoji:"🇮🇳", tip:"Truth & simplicity — brand values content" },
  "2026-10-08":{ name:"Dussehra", type:"major", emoji:"🏹", tip:"Good over evil — bold aspirational messaging" },
  "2026-11-08":{ name:"Diwali", type:"major", emoji:"🪔", tip:"Biggest festival — gifting, fashion, home, gold" },
  "2026-12-25":{ name:"Christmas", type:"major", emoji:"🎄", tip:"Gifting, joy, year-end — all brands" },
  "2026-12-31":{ name:"New Year's Eve", type:"major", emoji:"🎆", tip:"Year in review, resolutions — all brands" },

  // ── Special Days & International Observances ──
  "2025-01-01":{ name:"New Year", type:"major", emoji:"🎊", tip:"Fresh start content — new year resolutions, brand refresh" },
  "2025-02-04":{ name:"World Cancer Day", type:"national", emoji:"🎗️", tip:"Awareness — CSR, health brands, survivor stories" },
  "2025-03-08":{ name:"International Women's Day", type:"major", emoji:"👩", tip:"Celebrate women — powerful for all brands, especially fashion & beauty" },
  "2025-03-22":{ name:"World Water Day", type:"national", emoji:"💧", tip:"Sustainability — eco brands, CSR initiatives" },
  "2025-04-07":{ name:"World Health Day", type:"national", emoji:"🏥", tip:"Health & wellness brands — tips, awareness campaigns" },
  "2025-04-22":{ name:"Earth Day", type:"national", emoji:"🌍", tip:"Go green — eco packaging, sustainability, CSR content" },
  "2025-05-01":{ name:"Labour Day", type:"national", emoji:"👷", tip:"Appreciate your team — behind the scenes, team culture posts" },
  "2025-05-04":{ name:"Star Wars Day", type:"major", emoji:"⚔️", tip:"Pop culture fun — tech & gaming brands, casual engagement" },
  "2025-05-25":{ name:"Africa Day", type:"national", emoji:"🌍", tip:"Global awareness — international brands & CSR" },
  "2025-06-01":{ name:"World Milk Day", type:"major", emoji:"🥛", tip:"F&B brands — dairy, nutrition, recipe content" },
  "2025-06-05":{ name:"World Environment Day", type:"major", emoji:"🌿", tip:"Sustainability — eco brands, CSR, green pledges" },
  "2025-06-21":{ name:"International Yoga Day", type:"major", emoji:"🧘", tip:"Wellness & lifestyle — mindfulness, fitness brands" },
  "2025-06-21":{ name:"World Music Day", type:"major", emoji:"🎵", tip:"Brand personality — fun, music-inspired content" },
  "2025-07-18":{ name:"Nelson Mandela Day", type:"national", emoji:"✊", tip:"Social justice — CSR, equality, community posts" },
  "2025-08-12":{ name:"International Youth Day", type:"national", emoji:"🌟", tip:"Youth-focused brands — education, fashion, tech" },
  "2025-09-05":{ name:"Teacher's Day", type:"major", emoji:"📚", tip:"Education brands — tribute to teachers, learning content" },
  "2025-09-27":{ name:"World Tourism Day", type:"national", emoji:"✈️", tip:"Travel brands — destination highlights, wanderlust content" },
  "2025-10-01":{ name:"World Coffee Day", type:"major", emoji:"☕", tip:"F&B brands — coffee culture, recipe reels" },
  "2025-10-04":{ name:"World Animal Day", type:"national", emoji:"🐾", tip:"Pet brands, animal welfare — cute content performs well" },
  "2025-10-10":{ name:"World Mental Health Day", type:"major", emoji:"💚", tip:"Wellness, empathy content — mental health awareness" },
  "2025-10-31":{ name:"Halloween", type:"major", emoji:"🎃", tip:"Fun seasonal content — costumes, spooky theme, engagement boosters" },
  "2025-11-11":{ name:"Singles Day (11.11)", type:"major", emoji:"1️⃣", tip:"E-commerce mega sale day — discounts, flash deals" },
  "2025-11-19":{ name:"International Men's Day", type:"major", emoji:"👨", tip:"Celebrate men — grooming, fashion, lifestyle brands" },
  "2025-12-01":{ name:"World AIDS Day", type:"national", emoji:"🎗️", tip:"Awareness — health, CSR, red ribbon campaign" },
  "2025-12-25":{ name:"Christmas", type:"major", emoji:"🎄", tip:"Gifting, joy, year-end — all brands, warm palette" },
  "2026-01-01":{ name:"New Year", type:"major", emoji:"🎊", tip:"Fresh start — new collections, brand refresh" },
  "2026-03-08":{ name:"International Women's Day", type:"major", emoji:"👩", tip:"Celebrate women — powerful for all brands" },
  "2026-04-22":{ name:"Earth Day", type:"national", emoji:"🌍", tip:"Go green content — eco brands, CSR" },
  "2026-06-21":{ name:"International Yoga Day", type:"major", emoji:"🧘", tip:"Wellness & lifestyle content" },
  "2026-09-05":{ name:"Teacher's Day", type:"major", emoji:"📚", tip:"Education brands — tribute posts" },
  "2026-10-31":{ name:"Halloween", type:"major", emoji:"🎃", tip:"Fun seasonal — spooky theme, engagement" },
  "2026-12-25":{ name:"Christmas", type:"major", emoji:"🎄", tip:"Gifting & joy — all brands" },
};

function getFestivalsForMonth(year, month) {
  const result = {};
  Object.entries(INDIAN_FESTIVALS).forEach(([date, fest]) => {
    const d = new Date(date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!result[day]) result[day] = [];
      result[day].push({ ...fest, date });
    }
  });
  return result;
}

function getUpcomingFestivals(year, month, count=8) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month+2, 0); // 2 months ahead
  return Object.entries(INDIAN_FESTIVALS)
    .filter(([d]) => { const dt=new Date(d); return dt>=from && dt<=to; })
    .sort(([a],[b]) => new Date(a)-new Date(b))
    .slice(0, count);
}

// ─── CONTENT CALENDAR ─────────────────────────────────────────────────────────
function ContentCalendar({ user, clients, calendar, setCalendar, users }) {
  const now = new Date();
  const [calView, setCalView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selDay, setSelDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editCal, setEditCal] = useState(null);
  const [selFestival, setSelFestival] = useState(null);
  const [form, setForm] = useState({ clientId:"", posts:[""] });
  const [filterClient, setFilterClient] = useState("all"); // E1: client filter

  const { year, month } = calView;
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const monthFestivals = getFestivalsForMonth(year, month);
  const upcomingFests = getUpcomingFestivals(year, month);
  const getUserById = id => users.find(u => u.id === id);

  function dateStr(day) {
    return `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  function postsOnDay(dayStr) {
    return calendar.filter(c => {
      if (!c.dates) return false;
      if (filterClient !== "all" && String(c.clientId) !== filterClient) return false;
      return c.dates.includes(dayStr);
    });
  }

  function openNewWithDay(day) {
    const ds = dateStr(day);
    setForm({ clientId:"", posts:[""], prefillDate: ds });
    setSelDay(day);
    setShowModal(true);
  }

  function saveCalendar() {
    if (!form.clientId) return;
    const entry = {
      id: Date.now(),
      clientId: parseInt(form.clientId),
      month: `${MONTH_NAMES[month]} ${year}`,
      posts: form.posts.filter(Boolean),
      dates: form.posts.filter(Boolean).map((_,i) => {
        const base = form.prefillDate ? new Date(form.prefillDate) : new Date(year, month, 1);
        base.setDate(base.getDate() + i * 3);
        return `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,"0")}-${String(base.getDate()).padStart(2,"0")}`;
      }),
      status: user.role==="executive" ? "pending" : "approved",
      createdBy: user.id,
      approvedBy: null,
    };
    setCalendar(prev => [...prev, entry]);
    setShowModal(false);
    setForm({ clientId:"", posts:[""] });
  }

  function updateStatus(id, s) {
    setCalendar(prev => prev.map(c => c.id===id ? {...c, status:s, approvedBy:user.id} : c));
  }

  // Build grid cells: prev-month overflow + current + next-month overflow
  const cells = [];
  for (let i = firstDow-1; i >= 0; i--) cells.push({ day: daysInPrev-i, cur: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, cur: true });
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) cells.push({ day: d, cur: false });

  const selDayStr = selDay ? dateStr(selDay) : null;
  const selDayFests = selDay ? (monthFestivals[selDay] || []) : [];
  const selDayPosts = selDayStr ? postsOnDay(selDayStr) : [];

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">Content Calendar</h1>
          <p className="section-sub">Plan content around Indian festivals & occasions</p>
        </div>
        <div className="flex items-center gap-12">
          <select className="form-input form-select" style={{width:180,height:34,fontSize:12}} value={filterClient} onChange={e=>setFilterClient(e.target.value)}>
            <option value="all">All Clients</option>
            {clients.filter(c=>c.status==="active").map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Plan</button>
        </div>
      </div>

      <div className="cc-wrap">
        {/* ── LEFT: Full Calendar Grid ── */}
        <div className="cc-main">
          {/* Header */}
          <div className="cc-header">
            <button className="cc-nav" onClick={() => setCalView(p => p.month===0?{year:p.year-1,month:11}:{...p,month:p.month-1})}>‹</button>
            <div style={{textAlign:"center"}}>
              <div className="cc-month-title">{MONTH_NAMES[month]} {year}</div>
              <div style={{fontSize:10,color:"var(--ink-muted)",letterSpacing:1,marginTop:2}}>
                {Object.keys(monthFestivals).length} festivals this month
              </div>
            </div>
            <button className="cc-nav" onClick={() => setCalView(p => p.month===11?{year:p.year+1,month:0}:{...p,month:p.month+1})}>›</button>
          </div>

          {/* Legend */}
          <div className="cc-legend" style={{padding:"8px 16px 0",borderBottom:"1px solid var(--border)"}}>
            {[["#E8553A","Major Festival"],["#8B4BAE","Regional"],["#2D47A3","National Holiday"],["#C4954A","Planned Content"]].map(([c,l])=>(
              <div key={l} className="cc-legend-item">
                <div className="cc-legend-dot" style={{background:c}} />
                <span>{l}</span>
              </div>
            ))}
          </div>

          {/* Day-of-week header */}
          <div className="cc-dow-row">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="cc-dow">{d}</div>)}
          </div>

          {/* Calendar Grid */}
          <div className="cc-grid">
            {cells.map((cell, i) => {
              const ds = cell.cur ? dateStr(cell.day) : null;
              const fests = cell.cur ? (monthFestivals[cell.day] || []) : [];
              const posts = ds ? postsOnDay(ds) : [];
              const isToday = ds === todayStr;
              const isSel = cell.cur && selDay === cell.day;
              return (
                <div
                  key={i}
                  className={`cc-cell ${!cell.cur?"other-month":""} ${isToday?"today":""} ${isSel?"selected":""}`}
                  onClick={() => cell.cur && setSelDay(selDay===cell.day ? null : cell.day)}
                  onDoubleClick={() => cell.cur && openNewWithDay(cell.day)}
                >
                  <div className="cc-daynum">{cell.day}</div>
                  {fests.slice(0,2).map((f,fi) => (
                    <span
                      key={fi}
                      className={`cc-festival ${f.type}`}
                      title={f.tip}
                      onClick={e=>{e.stopPropagation();setSelFestival(f);}}
                    >
                      {f.emoji} {f.name}
                    </span>
                  ))}
                  {posts.length > 0 && (
                    <div style={{marginTop:2}}>
                      {posts.slice(0,2).map((p,pi) => {
                        const cl = clients.find(c=>c.id===p.clientId);
                        return <span key={pi} className="cc-post-chip">◈ {cl?.name||"Post"}</span>;
                      })}
                    </div>
                  )}
                  {(fests.length > 2 || posts.length > 2) && (
                    <span style={{fontSize:8,color:"var(--ink-muted)"}}>+{fests.length+posts.length-2} more</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="cc-sidebar">

          {/* Selected Day Panel */}
          {selDay && (
            <div className="cc-day-panel">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:600,color:"var(--ink)"}}>
                  {selDay} {MONTH_NAMES[month]}
                </div>
                <button className="btn btn-accent btn-sm" onClick={() => openNewWithDay(selDay)}>+ Plan</button>
              </div>

              {selDayFests.length > 0 && (
                <div style={{marginBottom:12}}>
                  <p style={{fontSize:9.5,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--ink-muted)",marginBottom:7}}>Festivals</p>
                  {selDayFests.map((f,i) => (
                    <div key={i} style={{background:"var(--cream-dark)",borderRadius:8,padding:"9px 11px",marginBottom:7}}>
                      <div style={{fontWeight:600,fontSize:12.5,color:"var(--ink)"}}>{f.emoji} {f.name}</div>
                      <div style={{fontSize:10.5,color:"var(--ink-muted)",marginTop:3,lineHeight:1.5}}>{f.tip}</div>
                    </div>
                  ))}
                </div>
              )}

              {selDayPosts.length > 0 && (
                <div>
                  <p style={{fontSize:9.5,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--ink-muted)",marginBottom:7}}>Planned Content</p>
                  {selDayPosts.map((p,i) => {
                    const cl = clients.find(c=>c.id===p.clientId);
                    return (
                      <div key={i} style={{background:"var(--accent-pale)",borderRadius:8,padding:"9px 11px",marginBottom:7,borderLeft:"3px solid var(--accent)"}}>
                        <div style={{fontWeight:600,fontSize:12,color:"var(--ink)"}}>{cl?.name}</div>
                        {p.posts.slice(0,3).map((post,pi)=><div key={pi} style={{fontSize:11,color:"var(--ink-muted)",marginTop:2}}>· {post}</div>)}
                      </div>
                    );
                  })}
                </div>
              )}

              {selDayFests.length===0 && selDayPosts.length===0 && (
                <p style={{fontSize:12,color:"var(--ink-muted)"}}>No festivals or plans. Double-click the date to add content.</p>
              )}
            </div>
          )}

          {/* Upcoming Festivals */}
          <div className="cc-side-card">
            <div className="cc-side-title">✦ Coming Up</div>
            <p style={{fontSize:10,color:"var(--ink-muted)",marginBottom:11}}>Festivals in the next 60 days</p>
            {upcomingFests.map(([date, f]) => {
              const d = new Date(date);
              const daysLeft = Math.ceil((d - new Date()) / 86400000);
              return (
                <div key={date} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:12,paddingBottom:12,borderBottom:"1px solid var(--cream-dark)"}}>
                  <div style={{
                    background: f.type==="major"?"rgba(232,85,58,0.1)":f.type==="national"?"rgba(45,71,163,0.1)":"rgba(139,75,174,0.1)",
                    borderRadius:8,padding:"6px 9px",textAlign:"center",flexShrink:0,minWidth:42
                  }}>
                    <div style={{fontSize:16}}>{f.emoji}</div>
                    <div style={{fontSize:8,fontWeight:700,color:"var(--ink-muted)",marginTop:1}}>
                      {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0,3)}
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:12,color:"var(--ink)"}}>{f.name}</div>
                    <div style={{fontSize:10,color:"var(--ink-muted)",marginTop:2,lineHeight:1.4}}>{f.tip}</div>
                    <div style={{fontSize:9,marginTop:4,fontWeight:600,color:daysLeft<=7?"#E8553A":daysLeft<=14?"#C4954A":"var(--ink-muted)"}}>
                      {daysLeft<=0?"Today":daysLeft===1?"Tomorrow":`${daysLeft} days away`}
                    </div>
                  </div>
                </div>
              );
            })}
            {upcomingFests.length===0 && <p style={{fontSize:12,color:"var(--ink-muted)"}}>No festivals in the next 60 days.</p>}
          </div>

          {/* Existing Plans Summary */}
          {calendar.length > 0 && (
            <div className="cc-side-card">
              <div className="cc-side-title">Plans — {MONTH_NAMES[month]}</div>
              {calendar
                .filter(c => c.month === `${MONTH_NAMES[month]} ${year}`)
                .map(c => {
                  const cl = clients.find(x => x.id===c.clientId);
                  return (
                    <div key={c.id} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid var(--cream-dark)"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{fontWeight:600,fontSize:12,color:"var(--ink)"}}>{cl?.name}</div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          {getStatusBadge(c.status)}
                          {(user.role==="admin"||user.role==="superadmin")&&c.status==="pending"&&(
                            <div style={{display:"flex",gap:4}}>
                              <button className="btn btn-success btn-sm" style={{padding:"2px 7px"}} onClick={()=>updateStatus(c.id,"approved")}>✓</button>
                              <button className="btn btn-danger btn-sm" style={{padding:"2px 7px"}} onClick={()=>updateStatus(c.id,"rejected")}>✕</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{fontSize:10,color:"var(--ink-muted)",marginTop:3}}>{c.posts.length} posts · By {getUserById(c.createdBy)?.name}</div>
                    </div>
                  );
                })}
              {calendar.filter(c=>c.month===`${MONTH_NAMES[month]} ${year}`).length===0 && (
                <p style={{fontSize:12,color:"var(--ink-muted)"}}>No plans for this month yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Festival tip modal */}
      {selFestival && (
        <div className="modal-overlay" onClick={()=>setSelFestival(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:48,marginBottom:8}}>{selFestival.emoji}</div>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"var(--ink)"}}>{selFestival.name}</h3>
              <span className={`festival-tag ${selFestival.type}`} style={{margin:"8px auto",display:"inline-flex"}}>
                {selFestival.type==="major"?"⭐ Major Festival":selFestival.type==="national"?"🇮🇳 National Holiday":"📍 Regional Festival"}
              </span>
            </div>
            <div style={{background:"var(--cream-dark)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--ink-muted)",marginBottom:6}}>Content Strategy Tip</p>
              <p style={{fontSize:13,lineHeight:1.6,color:"var(--ink)"}}>{selFestival.tip}</p>
            </div>
            <button className="btn btn-primary w-full" style={{justifyContent:"center"}} onClick={()=>{setSelFestival(null);setShowModal(true);}}>
              + Plan Content for This Day
            </button>
            <button className="btn btn-ghost w-full" style={{justifyContent:"center",marginTop:8}} onClick={()=>setSelFestival(null)}>Close</button>
          </div>
        </div>
      )}

      {/* New Plan Modal */}
      {showModal && (
        <Modal title="Plan Content" onClose={()=>{setShowModal(false);setForm({clientId:"",posts:[""]});}} lg>
          <div className="form-group">
            <label className="form-label">Client</label>
            <select className="form-input form-select" value={form.clientId} onChange={e=>setForm(p=>({...p,clientId:e.target.value}))}>
              <option value="">Select client…</option>
              {clients.filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Festival suggestions for this month */}
          {Object.entries(monthFestivals).length > 0 && (
            <div className="form-group">
              <label className="form-label">✦ Festival Suggestions — {MONTH_NAMES[month]}</label>
              <div style={{background:"var(--cream-dark)",borderRadius:8,padding:"10px 12px"}}>
                <p style={{fontSize:10.5,color:"var(--ink-muted)",marginBottom:8}}>Click to add as a post idea</p>
                <div style={{display:"flex",flexWrap:"wrap"}}>
                  {Object.entries(monthFestivals).map(([day,fests])=>fests.map((f,i)=>(
                    <span
                      key={`${day}-${i}`}
                      className={`festival-tag ${f.type}`}
                      onClick={()=>setForm(p=>({...p,posts:[...p.posts.filter(Boolean),`${f.emoji} ${f.name} (${day} ${MONTH_NAMES[month]})`]}))}
                    >
                      {f.emoji} {f.name} · {day}
                    </span>
                  )))}
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Post Ideas</label>
            {form.posts.map((pp,i)=>(
              <div key={i} className="flex gap-8" style={{marginBottom:6}}>
                <input
                  className="form-input"
                  placeholder={`Post ${i+1} — e.g. Diwali gifting reel`}
                  value={pp}
                  onChange={e=>{const posts=[...form.posts];posts[i]=e.target.value;setForm(p=>({...p,posts}));}}
                  style={{flex:1}}
                />
                {form.posts.length>1 && (
                  <button className="btn btn-ghost btn-sm" onClick={()=>setForm(p=>({...p,posts:p.posts.filter((_,j)=>j!==i)}))}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm mt-8" onClick={()=>setForm(p=>({...p,posts:[...p.posts,""]}))}>+ Add Post</button>
          </div>

          <div className="flex gap-12 mt-16">
            <button className="btn btn-primary" onClick={saveCalendar} disabled={!form.clientId}>Save Plan</button>
            <button className="btn btn-ghost" onClick={()=>{setShowModal(false);setForm({clientId:"",posts:[""]});}}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── CONTENT ──────────────────────────────────────────────────────────────────
function Content({ user, clients, content, setContent, users }) {
  const [showModal,setShowModal]=useState(false);const [editItem,setEditItem]=useState(null);const [tab,setTab]=useState("all");
  const myContent=user.role==="executive"?content.filter(c=>c.execId===user.id):content;
  const filtered=tab==="all"?myContent:myContent.filter(c=>c.status===tab);
  const getUserById=id=>users.find(u=>u.id===id);
  return(<div>
    <div className="section-header"><div><h1 className="section-title">Content</h1></div>{user.role==="executive"&&<button className="btn btn-primary" onClick={()=>{setEditItem(null);setShowModal(true);}}>+ New</button>}</div>
    <div className="tabs">{[["all","All"],["draft","Draft"],["pending_admin","Pending Admin"],["pending_superadmin","Pending SA"],["approved_client","Approved"],["posted","Posted"]].map(([k,l])=><div key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</div>)}</div>
    <div style={{display:"grid",gap:12}}>
      {filtered.map(item=>{
        const client=clients.find(c=>c.id===item.clientId);const exec=getUserById(item.execId);
        const order=["draft","pending_admin","pending_superadmin","approved_client","posted"];const cur=order.indexOf(item.status);
        return(<div key={item.id} className="card">
          <div className="flex items-center justify-between mb-12">
            <div><h3 style={{fontSize:14.5,fontWeight:600,color:"var(--ink)"}}>{item.title}</h3><p className="text-sm text-muted">{client?.name} · {item.scheduledDate} {item.scheduledTime}</p></div>
            <div className="flex items-center gap-12">{getStatusBadge(item.status)}<button className="btn btn-ghost btn-sm" onClick={()=>{setEditItem(item);setShowModal(true);}}>{user.role==="executive"&&item.status==="draft"?"Edit":"View"}</button></div>
          </div>
          <div className="flex items-center gap-4 mb-12">
            {[["draft","Draft"],["pending_admin","Admin"],["pending_superadmin","SA"],["approved_client","Client"],["posted","Posted"]].map((st,i,arr)=>{
              const si=order.indexOf(st[0]);const cls=si<cur?"stage-done":si===cur?"stage-active":"stage-pending";
              return(<div key={st[0]} className="flex items-center" style={{flex:i<arr.length-1?1:"none"}}>
                <div><div className={`stage-dot ${cls}`}>{si<cur?"✓":i+1}</div><div style={{fontSize:8.5,marginTop:2,textAlign:"center",color:"var(--ink-muted)"}}>{st[1]}</div></div>
                {i<arr.length-1&&<div className="stage-line" style={{background:si<cur?"var(--success)":"var(--cream-dark)"}} />}
              </div>);
            })}
          </div>
          {item.mediaDataUrl&&<div style={{marginBottom:9}}><MediaDisplay item={item} /></div>}
          {(item.adminCaption||item.execCaption)&&<div style={{background:"var(--cream-dark)",borderRadius:8,padding:"8px 11px"}}><p style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",color:"var(--ink-muted)",marginBottom:3}}>{item.adminCaption?"Final Caption":"Submitted Caption"}</p><p style={{fontSize:12.5,lineHeight:1.6,color:"var(--ink)"}}>{item.adminCaption||item.execCaption}</p></div>}
          <div className="flex items-center gap-8 mt-8"><div className="avatar sm">{exec?.avatar}</div><span className="text-sm text-muted">By {exec?.name}</span></div>
        </div>);
      })}
    </div>
    {filtered.length===0&&<div className="empty"><div className="empty-icon">◫</div><h4>No Content Found</h4></div>}
    {showModal&&<ContentModal user={user} clients={clients} initial={editItem} onSave={data=>{if(editItem)setContent(prev=>prev.map(c=>c.id===editItem.id?{...c,...data}:c));else setContent(prev=>[...prev,{...data,id:Date.now(),execId:user.id,createdAt:todayISO(),adminComment:"",adminCaption:"",postedAt:null}]);setShowModal(false);setEditItem(null);}} onClose={()=>{setShowModal(false);setEditItem(null);}} />}
  </div>);
}

function ContentModal({ user, clients, initial, onSave, onClose }) {
  const isApprover=user.role==="admin"||user.role==="superadmin";
  const isExecEdit=user.role==="executive"&&(!initial||initial.status==="draft");
  const [form,setForm]=useState({clientId:initial?.clientId||"",title:initial?.title||"",scheduledDate:initial?.scheduledDate||"",scheduledTime:initial?.scheduledTime||"10:00",execCaption:initial?.execCaption||"",adminCaption:initial?.adminCaption||"",adminComment:initial?.adminComment||"",status:initial?.status||"draft",clientStatus:initial?.clientStatus||"not_submitted",mediaType:initial?.mediaType||null,mediaName:initial?.mediaName||null,mediaDataUrl:initial?.mediaDataUrl||null});
  const [gen,setGen]=useState(false);const [desc,setDesc]=useState("");const [lb,setLb]=useState(false);const fileRef=useRef();
  const client=clients.find(c=>c.id===parseInt(form.clientId));
  async function genCaption(){if(!desc.trim()){alert("Describe the media first.");return;}setGen(true);const cap=await generateCaption(desc,client?.name||"brand",client?.services?.[0]||"social media");setForm(p=>({...p,execCaption:cap}));setGen(false);}
  function handleFile(e){const file=e.target.files[0];if(!file)return;const type=file.type.startsWith("video")?"video":"image";const reader=new FileReader();reader.onload=ev=>setForm(p=>({...p,mediaType:type,mediaName:file.name,mediaDataUrl:ev.target.result}));reader.readAsDataURL(file);}
  return(<Modal title={initial?(isApprover?"Review Content":"Edit Content"):"New Content"} onClose={onClose} lg>
    <div className="grid-2">
      <div className="form-group"><label className="form-label">Client</label>{!isExecEdit?<p style={{fontSize:13,color:"var(--ink)"}}>{client?.name}</p>:<select className="form-input form-select" value={form.clientId} onChange={e=>setForm(p=>({...p,clientId:e.target.value}))}><option value="">Select…</option>{clients.filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}</div>
      <div className="form-group"><label className="form-label">Title</label>{!isExecEdit?<p style={{fontSize:13,color:"var(--ink)"}}>{form.title}</p>:<input className="form-input" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} />}</div>
      <div className="form-group"><label className="form-label">Date</label>{!isExecEdit?<p style={{fontSize:13,color:"var(--ink)"}}>{form.scheduledDate}</p>:<input className="form-input" type="date" value={form.scheduledDate} onChange={e=>setForm(p=>({...p,scheduledDate:e.target.value}))} />}</div>
      <div className="form-group"><label className="form-label">Time</label>{!isExecEdit?<p style={{fontSize:13,color:"var(--ink)"}}>{form.scheduledTime}</p>:<input className="form-input" type="time" value={form.scheduledTime} onChange={e=>setForm(p=>({...p,scheduledTime:e.target.value}))} />}</div>
    </div>
    <div className="form-group"><label className="form-label">Media</label>
      {form.mediaDataUrl?(
        <div>{form.mediaType==="video"?<video src={form.mediaDataUrl} className="media-preview-thumb" onClick={()=>setLb(true)} style={{maxHeight:200}} />:<img src={form.mediaDataUrl} className="media-preview-thumb" style={{maxHeight:200}} alt="" onClick={()=>setLb(true)} />}
          <div className="flex gap-8 mt-8"><button className="btn btn-ghost btn-sm" onClick={()=>setLb(true)}>🔍 Full Size</button>{isExecEdit&&<button className="btn btn-danger btn-sm" onClick={()=>setForm(p=>({...p,mediaDataUrl:null,mediaName:null,mediaType:null}))}>Remove</button>}</div>
          {lb&&<MediaLightbox src={form.mediaDataUrl} type={form.mediaType} onClose={()=>setLb(false)} />}
        </div>
      ):isExecEdit?(<div className="upload-zone" onClick={()=>fileRef.current?.click()}><div style={{fontSize:24,marginBottom:6}}>📎</div><p style={{color:"var(--ink-muted)"}}>Upload JPG, PNG or MP4</p><input ref={fileRef} type="file" accept="image/*,video/mp4" style={{display:"none"}} onChange={handleFile} /></div>):<p className="text-muted text-sm">No media.</p>}
    </div>
    <div className="form-group">
      <div className="flex items-center gap-8 mb-8"><label className="form-label" style={{margin:0}}>Caption</label><span className="ai-badge">✦ AI</span></div>
      {isExecEdit&&<div className="flex gap-8 mb-8"><input className="form-input" placeholder="Describe media for AI caption…" value={desc} onChange={e=>setDesc(e.target.value)} style={{flex:1}} /><button className="btn btn-accent btn-sm" onClick={genCaption} disabled={gen}>{gen?<span className="generating">Generating…</span>:"✦ Generate"}</button></div>}
      {!isApprover&&(isExecEdit?<textarea className="form-input form-textarea" value={form.execCaption} onChange={e=>setForm(p=>({...p,execCaption:e.target.value}))} />:<div style={{padding:"8px 11px",background:"var(--cream-dark)",borderRadius:8,fontSize:12.5,lineHeight:1.6,color:"var(--ink)"}}>{form.execCaption||"—"}</div>)}
      {isApprover&&(<><div style={{marginBottom:9,padding:"8px 11px",background:"var(--cream-dark)",borderRadius:8}}><p className="form-label" style={{marginBottom:3}}>Executive's Caption</p><p style={{fontSize:12.5,lineHeight:1.6,color:"var(--ink)"}}>{form.execCaption||"—"}</p></div><label className="form-label">Revised Caption</label><textarea className="form-input form-textarea" value={form.adminCaption} onChange={e=>setForm(p=>({...p,adminCaption:e.target.value}))} /><label className="form-label mt-8">Comment</label><textarea className="form-input form-textarea" value={form.adminComment} onChange={e=>setForm(p=>({...p,adminComment:e.target.value}))} style={{minHeight:52}} /></>)}
    </div>
    {/* Client Status Tag — exec, admin, superadmin can change */}
    <div className="form-group" style={{marginBottom:12}}>
      <label className="form-label">Client Status</label>
      <div className="flex gap-6" style={{flexWrap:"wrap",marginTop:6}}>
        {[["not_submitted","Not Submitted","#6B7280"],["submitted_to_client","Sent to Client","#2E5F8A"],["approved_by_client","✓ Client Approved","#4A7C59"],["revision_requested","Revision Requested","#9B3A3A"]].map(([s,label,col])=>(
          <span key={s} onClick={()=>setForm(p=>({...p,clientStatus:s}))} style={{
            cursor:"pointer",padding:"5px 11px",borderRadius:20,fontSize:10.5,fontWeight:600,
            background:(form.clientStatus||"not_submitted")===s?col:"transparent",
            color:(form.clientStatus||"not_submitted")===s?"white":"var(--ink-muted)",
            border:`1px solid ${(form.clientStatus||"not_submitted")===s?col:"var(--border)"}`,
            transition:"all 0.15s"
          }}>{label}</span>
        ))}
      </div>
    </div>
    <div className="flex gap-8">
      {isExecEdit&&<><button className="btn btn-ghost" onClick={()=>onSave({...form,status:"draft"})}>Save Draft</button><button className="btn btn-primary" onClick={()=>onSave({...form,status:"pending_admin"})}>Submit for Approval</button></>}
      {user.role==="admin"&&initial?.status==="pending_admin"&&<><button className="btn btn-success" onClick={()=>onSave({...form,status:"pending_superadmin"})}>✓ Forward to SA</button><button className="btn btn-danger" onClick={()=>onSave({...form,status:"rejected"})}>✕ Reject</button></>}
      {user.role==="superadmin"&&initial?.status==="pending_superadmin"&&<><button className="btn btn-success" onClick={()=>onSave({...form,status:"approved_client"})}>✓ Final Approve</button><button className="btn btn-danger" onClick={()=>onSave({...form,status:"rejected"})}>✕ Reject</button></>}
      {user.role==="superadmin"&&initial?.status==="approved_client"&&<button className="btn btn-accent" onClick={()=>onSave({...form,status:"posted",postedAt:nowStr()})}>Mark as Posted</button>}
      <button className="btn btn-ghost" onClick={onClose}>Close</button>
    </div>
  </Modal>);
}

// ─── APPROVALS ────────────────────────────────────────────────────────────────
function Approvals({ user, clients, content, setContent, users }) {
  const pending=content.filter(c=>(user.role==="admin"&&c.status==="pending_admin")||(user.role==="superadmin"&&(c.status==="pending_superadmin"||c.status==="pending_admin")));
  const [sel,setSel]=useState(null);
  const getUserById=id=>users.find(u=>u.id===id);
  return(<div>
    <div className="section-header"><div><h1 className="section-title">Approvals</h1><p className="section-sub">{pending.length} pending</p></div></div>
    {pending.length===0?<div className="empty"><div className="empty-icon">✓</div><h4>All Clear!</h4></div>:pending.map(item=>{
      const client=clients.find(c=>c.id===item.clientId);const exec=getUserById(item.execId);
      return(<div key={item.id} className="card" style={{marginBottom:12}}>
        <div className="flex items-center justify-between"><div><h3 style={{fontSize:14.5,fontWeight:600,color:"var(--ink)"}}>{item.title}</h3><p className="text-sm text-muted">{client?.name} · By {exec?.name} · {item.scheduledDate}</p></div><div className="flex items-center gap-12">{getStatusBadge(item.status)}<button className="btn btn-primary btn-sm" onClick={()=>setSel(item)}>Review →</button></div></div>
        {item.mediaDataUrl&&<div style={{marginTop:9}}><MediaDisplay item={item} /></div>}
        <div style={{marginTop:8,padding:"8px 11px",background:"var(--cream-dark)",borderRadius:8,fontSize:12.5,lineHeight:1.6,color:"var(--ink)"}}><strong>Caption:</strong> {item.execCaption||"—"}</div>
      </div>);
    })}
    {sel&&<ContentModal user={user} clients={clients} initial={sel} onSave={data=>{setContent(prev=>prev.map(c=>c.id===sel.id?{...c,...data}:c));setSel(null);}} onClose={()=>setSel(null)} />}
  </div>);
}

// ─── PUNCH ────────────────────────────────────────────────────────────────────
function PunchPage({ user, users=[], attendance, setAttendance }) {
  const [clock,setClock]=useState(nowStr());
  const [punchedIn,setPunchedIn]=useState(false);
  const [loginTime,setLoginTime]=useState(null);
  const [showCam,setShowCam]=useState(false);
  const [pendingAction,setPendingAction]=useState(null); // "in"|"out"
  const [selfieIn,setSelfieIn]=useState(null);
  const [selfieOut,setSelfieOut]=useState(null);
  const videoRef=useRef(); const canvasRef=useRef();

  useEffect(()=>{
    const iv=setInterval(()=>setClock(nowStr()),1000);
    const r=attendance.find(a=>a.userId===user.id&&a.date===todayISO());
    if(r){
      setPunchedIn(!r.logout);
      setLoginTime(r.login);
      if(r.selfieIn) setSelfieIn(r.selfieIn);
      if(r.selfieOut) setSelfieOut(r.selfieOut);
    }
    return()=>clearInterval(iv);
  },[attendance,user.id]);

  async function startCamera(action){
    setPendingAction(action);
    setShowCam(true);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});
      if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play();}
    }catch(e){alert("Camera access denied. Please allow camera in browser settings.");setShowCam(false);}
  }

  function takeSelfie(){
    const v=videoRef.current; const c=canvasRef.current;
    if(!v||!c) return;
    c.width=v.videoWidth||320; c.height=v.videoHeight||240;
    c.getContext("2d").drawImage(v,0,0);
    const img=c.toDataURL("image/jpeg",0.7);
    // stop stream
    v.srcObject?.getTracks().forEach(t=>t.stop());
    setShowCam(false);
    const t=nowStr();
    if(pendingAction==="in"){
      setSelfieIn(img);
      setAttendance(prev=>[...prev,{id:Date.now(),userId:user.id,date:todayISO(),login:t,logout:null,selfieIn:img,selfieOut:null}]);
      setPunchedIn(true); setLoginTime(t);
    } else {
      setSelfieOut(img);
      setAttendance(prev=>prev.map(a=>a.userId===user.id&&a.date===todayISO()&&!a.logout?{...a,logout:t,selfieOut:img}:a));
      setPunchedIn(false);
    }
    setPendingAction(null);
  }

  function cancelCam(){
    videoRef.current?.srcObject?.getTracks().forEach(t=>t.stop());
    setShowCam(false); setPendingAction(null);
  }

  const myRec=attendance.filter(a=>a.userId===user.id).slice(-7).reverse();
  const todayRec=attendance.find(a=>a.userId===user.id&&a.date===todayISO());
  const isSA=user.role==="superadmin"||user.role==="admin";
  const teamMembers=users.filter(u=>u.id!==user.id);
  // Get last 3 months of dates
  const threeMonthsAgo=new Date();threeMonthsAgo.setMonth(threeMonthsAgo.getMonth()-3);
  const teamAttendance=attendance.filter(a=>{
    const d=new Date(a.date);
    return d>=threeMonthsAgo && teamMembers.some(u=>u.id===a.userId);
  }).sort((a,b)=>b.date.localeCompare(a.date));
  const [attMonth,setAttMonth]=useState(()=>({year:new Date().getFullYear(),month:new Date().getMonth()}));
  const [selMember,setSelMember]=useState("all");

  return(<div>
    <div className="section-header"><h1 className="section-title">Attendance</h1></div>

    {/* Camera modal */}
    {showCam&&(
      <div className="modal-overlay" onClick={cancelCam}>
        <div className="modal" style={{maxWidth:380,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
          <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,marginBottom:12,color:"var(--ink)"}}>
            {pendingAction==="in"?"Punch In Selfie":"Punch Out Selfie"}
          </h3>
          <video ref={videoRef} style={{width:"100%",borderRadius:10,background:"#000",transform:"scaleX(-1)"}} autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{display:"none"}} />
          <div className="flex gap-12 mt-16" style={{justifyContent:"center"}}>
            <button className="btn btn-accent" style={{padding:"10px 28px"}} onClick={takeSelfie}>📸 Capture & {pendingAction==="in"?"Punch In":"Punch Out"}</button>
            <button className="btn btn-ghost" onClick={cancelCam}>Cancel</button>
          </div>
        </div>
      </div>
    )}

    <div className="grid-2">
      <div>
        <div className="punch-display">
          <div className="punch-date">{todayStr()}</div>
          <div className="punch-time">{clock}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:20}}>{punchedIn?`✓ In at ${loginTime}`:"Not logged in"}</div>
          {!punchedIn&&!todayRec&&<button className="btn btn-accent" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={()=>startCamera("in")}>📸 Take Selfie & Punch In</button>}
          {punchedIn&&<button className="btn btn-danger" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={()=>startCamera("out")}>📸 Take Selfie & Punch Out</button>}
          {todayRec&&!punchedIn&&<div style={{background:"rgba(62,125,82,0.2)",borderRadius:9,padding:"10px",fontSize:12.5,color:"#90D4A5"}}>✓ Done — {todayRec.login} → {todayRec.logout}</div>}
        </div>
        {/* Today's selfies */}
        {(selfieIn||selfieOut)&&(
          <div className="card" style={{marginTop:12}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--ink-muted)",marginBottom:10}}>Today's Selfies</p>
            <div className="flex gap-12">
              {selfieIn&&<div style={{textAlign:"center"}}><img src={selfieIn} style={{width:90,height:68,borderRadius:8,objectFit:"cover",transform:"scaleX(-1)"}} alt="in" /><div style={{fontSize:9,color:"var(--ink-muted)",marginTop:3}}>Punch In</div></div>}
              {selfieOut&&<div style={{textAlign:"center"}}><img src={selfieOut} style={{width:90,height:68,borderRadius:8,objectFit:"cover",transform:"scaleX(-1)"}} alt="out" /><div style={{fontSize:9,color:"var(--ink-muted)",marginTop:3}}>Punch Out</div></div>}
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:600,marginBottom:12,color:"var(--ink)"}}>My Recent Attendance</h3>
        {myRec.length===0?<p className="text-muted text-sm">No records.</p>:(
          <table className="table"><thead><tr><th>Date</th><th>Login</th><th>Logout</th><th>Photo</th></tr></thead>
          <tbody>{myRec.map((r,i)=><tr key={i}>
            <td>{r.date}</td>
            <td style={{color:"var(--success)",fontWeight:500}}>{r.login}</td>
            <td style={{color:r.logout?"var(--danger)":"var(--ink-muted)"}}>{r.logout||"—"}</td>
            <td>{r.selfieIn&&<img src={r.selfieIn} style={{width:28,height:22,borderRadius:4,objectFit:"cover",transform:"scaleX(-1)"}} alt="" />}</td>
          </tr>)}</tbody></table>
        )}
      </div>

    {/* ── Team Attendance (3 months) — visible to Admin/SuperAdmin ── */}
    {isSA&&(<div style={{marginTop:20}}>
      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}}>
          <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"var(--ink)"}}>Team Attendance — Last 3 Months</h3>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <select value={selMember} onChange={e=>setSelMember(e.target.value)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--ink)",fontSize:12}}>
              <option value="all">All Members</option>
              {teamMembers.map(u=><option key={u.id} value={u.id}>{u.displayName||u.name}</option>)}
            </select>
            <div style={{display:"flex",gap:4}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAttMonth(p=>p.month===0?{year:p.year-1,month:11}:{...p,month:p.month-1})}>‹</button>
              <span style={{fontSize:13,fontWeight:600,color:"var(--ink)",minWidth:120,textAlign:"center"}}>{MONTH_NAMES[attMonth.month]} {attMonth.year}</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAttMonth(p=>p.month===11?{year:p.year+1,month:0}:{...p,month:p.month+1})}>›</button>
            </div>
          </div>
        </div>
        {(()=>{
          const daysInMonth=new Date(attMonth.year,attMonth.month+1,0).getDate();
          const members=selMember==="all"?teamMembers:teamMembers.filter(u=>String(u.id)===String(selMember));
          const monthStr=m=>`${attMonth.year}-${String(attMonth.month+1).padStart(2,"0")}-${String(m).padStart(2,"0")}`;
          return(
            <div style={{overflowX:"auto"}}>
              <table className="table" style={{fontSize:12}}>
                <thead>
                  <tr>
                    <th style={{position:"sticky",left:0,background:"var(--surface)",zIndex:2,minWidth:120}}>Member</th>
                    {Array.from({length:daysInMonth},(_,i)=>{
                      const d=new Date(attMonth.year,attMonth.month,i+1);
                      const isWeekend=d.getDay()===0||d.getDay()===6;
                      const isToday=monthStr(i+1)===todayISO();
                      return <th key={i} style={{textAlign:"center",minWidth:44,fontSize:10,background:isToday?"var(--accent-pale)":isWeekend?"var(--cream-dark)":"transparent",color:isWeekend?"var(--ink-muted)":"var(--ink)"}}>{i+1}<br/><span style={{fontSize:8}}>{["S","M","T","W","T","F","S"][d.getDay()]}</span></th>;
                    })}
                    <th style={{textAlign:"center",minWidth:50}}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(emp=>{
                    let total=0;
                    return(
                      <tr key={emp.id}>
                        <td style={{position:"sticky",left:0,background:"var(--surface)",zIndex:1,fontWeight:600,fontSize:12}}>{emp.displayName||emp.name}</td>
                        {Array.from({length:daysInMonth},(_,i)=>{
                          const dateStr=monthStr(i+1);
                          const rec=attendance.find(a=>a.userId===emp.id&&a.date===dateStr);
                          const d=new Date(attMonth.year,attMonth.month,i+1);
                          const isWeekend=d.getDay()===0||d.getDay()===6;
                          const isFuture=dateStr>todayISO();
                          if(rec){total++;}
                          return <td key={i} style={{textAlign:"center",padding:"6px 2px",background:rec?"rgba(62,125,82,0.12)":isWeekend?"var(--cream-dark)":"transparent"}} title={rec?`In: ${rec.login||"?"} Out: ${rec.logout||"—"}`:""}>
                            {rec?<span style={{color:"var(--success)",fontWeight:700,fontSize:11}} title={`${rec.login}`}>✓</span>
                              :isFuture?<span style={{color:"var(--ink-muted)",fontSize:9}}>—</span>
                              :isWeekend?<span style={{color:"var(--ink-muted)",fontSize:9}}>W</span>
                              :<span style={{color:"var(--danger)",fontSize:10}}>✗</span>}
                          </td>;
                        })}
                        <td style={{textAlign:"center",fontWeight:700,color:"var(--accent)"}}>{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
        <div style={{marginTop:12,display:"flex",gap:16,fontSize:11,color:"var(--ink-muted)"}}>
          <span><span style={{color:"var(--success)",fontWeight:700}}>✓</span> Present</span>
          <span><span style={{color:"var(--danger)"}}>✗</span> Absent</span>
          <span><span style={{color:"var(--ink-muted)"}}>W</span> Weekend</span>
          <span>Hover on ✓ for login time</span>
        </div>
      </div>
    </div>)}
    </div>
  </div>);
}

// ─── HR ───────────────────────────────────────────────────────────────────────
function HR({ user, leaves, setLeaves, attendance, users }) {
  const [showModal,setShowModal]=useState(false);const [form,setForm]=useState({from:"",to:"",reason:""});
  const [tab,setTab]=useState("calendar");const [leaveTab,setLeaveTab]=useState("pending");
  const [calM,setCalM]=useState({year:new Date().getFullYear(),month:new Date().getMonth()});const [selDay,setSelDay]=useState(null);
  const isSA=user.role==="superadmin";
  const myLeaves=isSA?leaves:leaves.filter(l=>l.userId===user.id);
  const filteredLeaves=leaveTab==="all"?myLeaves:myLeaves.filter(l=>l.status===leaveTab);
  function submitLeave(){setLeaves(prev=>[...prev,{from:form.from,to:form.to,reason:form.reason,userId:user.id,id:Date.now(),status:"pending",appliedOn:todayISO()}]);setShowModal(false);setForm({from:"",to:"",reason:""});}
  function updLeave(id,s){setLeaves(prev=>prev.map(l=>l.id===id?{...l,status:s}:l));}
  const firstDay=new Date(calM.year,calM.month,1).getDay();
  const daysInM=new Date(calM.year,calM.month+1,0).getDate();
  const ds=d=>`${calM.year}-${String(calM.month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  function getDayData(day){const date=ds(day);return{att:attendance.filter(a=>a.date===date&&a.userId!==1),lv:leaves.filter(l=>l.userId!==1&&date>=l.from&&date<=l.to)};}
  const selData=selDay?getDayData(selDay):null;
  const todayAtt=attendance.filter(a=>a.date===todayISO()&&a.userId!==1);
  const getUserById=id=>users.find(u=>u.id===id);
  const employees=users.filter(u=>u.role!=="superadmin");

  return(<div>
    <div className="section-header"><div><h1 className="section-title">{isSA?"HR & Team":"My Leaves"}</h1></div>{!isSA&&<button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Apply Leave</button>}</div>
    {isSA&&<div className="tabs">{[["calendar","Team Calendar"],["attendance","Today"],["leaves","Leaves"]].map(([k,l])=><div key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</div>)}</div>}

    {isSA&&tab==="calendar"&&(<div>
      <div className="flex gap-12 mb-12" style={{flexWrap:"wrap"}}>
        {[["chip-present","Present"],["chip-absent","Absent"],["chip-leave","Leave (Approved)"]].map(([c,l])=><span key={c} className={`hr-day-chip ${c}`} style={{display:"inline-block",width:"auto",fontSize:10,padding:"2px 8px"}}>{l}</span>)}
      </div>
      <div className="hr-cal-wrap">
        <div className="hr-big-cal">
          <div className="hr-cal-header">
            <button className="mini-cal-nav" onClick={()=>setCalM(p=>p.month===0?{year:p.year-1,month:11}:{...p,month:p.month-1})}>‹</button>
            <span className="hr-cal-month">{MONTH_NAMES[calM.month]} {calM.year}</span>
            <button className="mini-cal-nav" onClick={()=>setCalM(p=>p.month===11?{year:p.year+1,month:0}:{...p,month:p.month+1})}>›</button>
          </div>
          <div className="hr-cal-grid">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="hr-dow">{d}</div>)}
            {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i} style={{borderRight:"1px solid var(--cream-dark)",borderBottom:"1px solid var(--cream-dark)"}} />)}
            {Array(daysInM).fill(null).map((_,i)=>{
              const day=i+1;const {att,lv}=getDayData(day);const isSel=selDay===day;const date=ds(day);
              return(<div key={day} className={`hr-day ${isSel?"selected":""}`} onClick={()=>setSelDay(isSel?null:day)}>
                <div className="hr-day-num">{day}</div>
                {employees.map(emp=>{
                  const pres=att.find(a=>a.userId===emp.id);
                  const leave=lv.find(l=>l.userId===emp.id);
                  const dow=new Date(date+"T12:00").getDay();
                  const isWeekend=dow===0||dow===6;
                  const isPast=date<todayISO();
                  const isToday=date===todayISO();
                  if(leave) return <span key={emp.id} className="hr-day-chip chip-leave" title="On Leave">{(emp.displayName||emp.name).split(" ")[0]}</span>;
                  if(pres) return <span key={emp.id} className="hr-day-chip chip-present" title={`In: ${pres.login}${pres.logout?" | Out: "+pres.logout:""}`}>{(emp.displayName||emp.name).split(" ")[0]} ✓ <span style={{fontSize:8,opacity:0.7}}>{pres.login}</span></span>;
                  if(isWeekend) return null;
                  if(isPast||isToday) return <span key={emp.id} className="hr-day-chip chip-absent" title="Absent">{(emp.displayName||emp.name).split(" ")[0]}</span>;
                  return null; // future dates — don't mark absent
                })}
              </div>);
            })}
          </div>
        </div>
        <div className="hr-day-panel">
          {!selDay?<p className="text-muted text-sm" style={{textAlign:"center",padding:"20px 0"}}>Click a date to see detail</p>:(
            <div>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:600,color:"var(--ink)",marginBottom:14}}>{new Date(ds(selDay)+"T12:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</p>
              {employees.map(emp=>{
                const pres=selData.att.find(a=>a.userId===emp.id);const leave=selData.lv.find(l=>l.userId===emp.id);
                return(<div key={emp.id} className="emp-row">
                  <div className="avatar sm">{emp.avatar}</div>
                  <div style={{flex:1,fontSize:12}}>
                    <strong style={{display:"block",marginBottom:3,color:"var(--ink)"}}>{emp.name}</strong>
                    {leave?<><span className="badge badge-warning" style={{fontSize:9}}>On Leave</span><div className="text-muted" style={{marginTop:3}}>{leave.reason}</div></>
                    :pres?<><span className="badge badge-success" style={{fontSize:9}}>Present</span><div className="text-muted" style={{marginTop:3}}>In: <strong>{pres.login}</strong> · Out: <strong>{pres.logout||"—"}</strong></div></>
                    :<span className="badge badge-danger" style={{fontSize:9}}>{new Date(ds(selDay)).getDay()===0||new Date(ds(selDay)).getDay()===6?"Weekend":"Absent"}</span>}
                  </div>
                </div>);
              })}
            </div>
          )}
        </div>
      </div>
    </div>)}

    {isSA&&tab==="attendance"&&(<div>
      <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:16,color:"var(--ink)"}}>Today — {todayISO()}</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12,marginBottom:16}}>
        {employees.map(emp=>{
          const rec=todayAtt.find(a=>a.userId===emp.id);
          return(
            <div key={emp.id} style={{background:"var(--cream-dark)",borderRadius:12,padding:12,textAlign:"center",border:`2px solid ${rec?"#4ADE80":"var(--cream-dark)"}`}}>
              {rec?.selfieIn
                ?<img src={rec.selfieIn} style={{width:80,height:64,borderRadius:8,objectFit:"cover",transform:"scaleX(-1)",marginBottom:8}} alt="in" />
                :<div style={{width:80,height:64,borderRadius:8,background:"var(--surface)",margin:"0 auto 8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{rec?"👤":"—"}</div>
              }
              <div style={{fontSize:12,fontWeight:600,color:"var(--ink)"}}>{emp.displayName||emp.name}</div>
              <div style={{fontSize:10,fontWeight:600,marginTop:2,color:rec?"#4ADE80":"var(--danger)"}}>{rec?`✓ In ${rec.login}`:"Absent"}</div>
              {rec?.logout&&<div style={{fontSize:10,color:"var(--ink-muted)",marginTop:1}}>Out {rec.logout}</div>}
              {rec?.selfieOut&&<img src={rec.selfieOut} style={{width:60,height:48,borderRadius:6,objectFit:"cover",transform:"scaleX(-1)",marginTop:6,opacity:0.8}} alt="out" />}
            </div>
          );
        })}
      </div>
      {todayAtt.length===0&&<p className="text-muted text-sm">No one has punched in yet today.</p>}
    </div>)}

    {(isSA?tab==="leaves":true)&&(<div style={{marginTop:isSA?0:0}}>
      {!isSA&&<div className="flex items-center justify-between mb-12"><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:600,color:"var(--ink)"}}>My Leaves</h3><button className="btn btn-primary btn-sm" onClick={()=>setShowModal(true)}>+ Apply</button></div>}
      <div className="tabs">{[["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["all","All"]].map(([k,l])=><div key={k} className={`tab ${leaveTab===k?"active":""}`} onClick={()=>setLeaveTab(k)}>{l}</div>)}</div>
      <div className="card" style={{padding:0}}>
        <table className="table"><thead><tr>{isSA&&<th>Employee</th>}<th>From</th><th>To</th><th>Reason</th><th>Status</th>{isSA&&<th>Action</th>}</tr></thead>
        <tbody>{filteredLeaves.map(l=>{const emp=getUserById(l.userId);return(
          <tr key={l.id}>{isSA&&<td><div className="flex items-center gap-8"><div className="avatar sm">{emp?.avatar}</div>{emp?.name}</div></td>}
          <td>{l.from}</td><td>{l.to}</td><td style={{maxWidth:150}}>{l.reason}</td><td>{getStatusBadge(l.status)}</td>
          {isSA&&<td>{l.status==="pending"?<div className="flex gap-8"><button className="btn btn-success btn-sm" onClick={()=>updLeave(l.id,"approved")}>✓</button><button className="btn btn-danger btn-sm" onClick={()=>updLeave(l.id,"rejected")}>✕</button></div>:null}</td>}
          </tr>);})}</tbody></table>
        {filteredLeaves.length===0&&<div className="empty"><p>No requests.</p></div>}
      </div>
    </div>)}

    {showModal&&(<Modal title="Apply for Leave" onClose={()=>setShowModal(false)}>
      <div className="grid-2"><div className="form-group"><label className="form-label">From</label><input className="form-input" type="date" value={form.from} onChange={e=>setForm(p=>({...p,from:e.target.value}))} /></div><div className="form-group"><label className="form-label">To</label><input className="form-input" type="date" value={form.to} onChange={e=>setForm(p=>({...p,to:e.target.value}))} /></div></div>
      <div className="form-group"><label className="form-label">Reason</label><textarea className="form-input form-textarea" value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} /></div>
      <div className="flex gap-12"><button className="btn btn-primary" onClick={submitLeave}>Submit</button><button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button></div>
    </Modal>)}
  </div>);
}

// ─── AI ASSESSMENT ────────────────────────────────────────────────────────────
function Assessment({ attendance, leaves, content, users }) {
  const employees=users.filter(u=>u.role!=="superadmin");
  const [assessments,setAssessments]=useState({});const [loading,setLoading]=useState({});const [selected,setSelected]=useState(null);
  async function run(emp){
    setLoading(p=>({...p,[emp.id]:true}));
    const res=await generateAssessment(emp,attendance.filter(a=>a.userId===emp.id),leaves.filter(l=>l.userId===emp.id),content.filter(c=>c.execId===emp.id));
    setAssessments(p=>({...p,[emp.id]:{text:res,at:new Date().toLocaleString()}}));
    setLoading(p=>({...p,[emp.id]:false}));setSelected(emp.id);
  }
  function score(text){const m=text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);return m?m[1]:"?";}
  return(<div>
    <div className="section-header">
      <div>
        <h1 className="section-title">AI Employee Assessment</h1>
        <p className="section-sub" style={{fontSize:11,color:"var(--ink-muted)"}}>Requires OpenAI API key in your Vercel environment as VITE_OPENAI_API_KEY</p>
      </div>
      <span className="ai-badge" style={{fontSize:10,padding:"4px 10px"}}>✦ ChatGPT</span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
      <div>
        {employees.map(emp=>{const has=!!assessments[emp.id];const isLoad=loading[emp.id];const isSel=selected===emp.id;return(
          <div key={emp.id} className="assess-emp-row" style={isSel?{borderColor:"var(--accent)",background:"var(--accent-pale)"}:{}} onClick={()=>has&&setSelected(emp.id)}>
            <div className="avatar lg" style={{background:emp.role==="admin"?"var(--accent)":"var(--info)"}}>{emp.avatar}</div>
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:"var(--ink)"}}>{emp.name}</div><div className="text-sm text-muted">{emp.username}</div></div>
            {has&&!isLoad&&<div className="score-chip">{score(assessments[emp.id].text)}</div>}
            <button className={`btn btn-sm ${has?"btn-ghost":"btn-accent"}`} disabled={isLoad} onClick={e=>{e.stopPropagation();run(emp);}}>
              {isLoad?<span className="generating">…</span>:has?"Re-run":"✦ Assess"}
            </button>
          </div>);})}
      </div>
      <div>
        {!selected&&!Object.values(loading).some(Boolean)&&<div className="card" style={{minHeight:280,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}><div style={{fontSize:36}}>◐</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"var(--ink)"}}>Select an employee</p></div>}
        {selected&&assessments[selected]&&<div className="card"><div className="flex items-center justify-between mb-16"><div><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,color:"var(--ink)"}}>Report — {users.find(u=>u.id===selected)?.name}</h3><p className="text-muted text-sm">{assessments[selected].at}</p></div><span className="ai-badge">✦ AI</span></div><div className="assessment-prose" dangerouslySetInnerHTML={{__html:parseMarkdown(assessments[selected].text)}} /></div>}
        {Object.entries(loading).filter(([,v])=>v).map(([id])=><div key={id} className="card" style={{textAlign:"center",padding:40}}><div style={{fontSize:28}} className="generating">◐</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"var(--ink)",marginTop:12}}>Analysing {users.find(u=>u.id===parseInt(id))?.name}…</p></div>)}
      </div>
    </div>
  </div>);
}

// ─── PLANNER ──────────────────────────────────────────────────────────────────
function PlannerCalendar({ user, plannerEvents={}, setPlannerEvents }) {
  const events = plannerEvents[user.id]||[];
  function setEvents(updater){
    const next=typeof updater==="function"?updater(events):updater;
    setPlannerEvents(p=>({...p,[user.id]:next}));
  }
  const [selDate,setSelDate]=useState(todayISO());
  const [cal,setCal]=useState(()=>{const d=new Date();return{year:d.getFullYear(),month:d.getMonth()};});
  const [showModal,setShowModal]=useState(false);const [editEv,setEditEv]=useState(null);
  const [form,setForm]=useState({title:"",startHour:9,startMin:0,endHour:10,endMin:0,color:PLANNER_COLORS[0]});
  const firstDay=new Date(cal.year,cal.month,1).getDay();const daysInM=new Date(cal.year,cal.month+1,0).getDate();
  const ds=day=>`${cal.year}-${String(cal.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  const dayEvents=events.filter(e=>e.date===selDate);
  function openAdd(h,m=0){
    // Block adding tasks in the past on today
    if(selDate===todayISO()&&h<new Date().getHours()) return;
    setEditEv(null);setForm({title:"",desc:"",startHour:h,startMin:m,endHour:Math.min(h+1,22),endMin:0,color:PLANNER_COLORS[0]});setShowModal(true);
  }
  function openEdit(ev){setEditEv(ev);setForm({title:ev.title,desc:ev.desc||"",startHour:ev.startHour,startMin:ev.startMin||0,endHour:ev.endHour,endMin:ev.endMin||0,color:ev.color});setShowModal(true);}
  function saveEv(){if(!form.title.trim())return;if(editEv)setEvents(prev=>prev.map(e=>e.id===editEv.id?{...e,...form,date:selDate}:e));else setEvents(prev=>[...prev,{id:Date.now(),...form,date:selDate}]);setShowModal(false);}
  function delEv(id){setEvents(prev=>prev.filter(e=>e.id!==id));setShowModal(false);}
  const selDisplay=new Date(selDate+"T12:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
  const [nowTime,setNowTime]=useState(()=>new Date());
  const isToday=selDate===todayISO();
  useEffect(()=>{const iv=setInterval(()=>setNowTime(new Date()),30000);return()=>clearInterval(iv);},[]);
  const currentHour=nowTime.getHours();
  const currentMin=nowTime.getMinutes();
  return(<div>
    <div className="section-header"><div><h1 className="section-title">My Planner</h1></div><button className="btn btn-primary" onClick={()=>openAdd(9)}>+ Add Task</button></div>
    <div style={{display:"grid",gridTemplateColumns:"210px 1fr",gap:16}}>
      <div>
        <div className="mini-cal">
          <div className="mini-cal-header"><button className="mini-cal-nav" onClick={()=>setCal(p=>p.month===0?{year:p.year-1,month:11}:{...p,month:p.month-1})}>‹</button><span className="mini-cal-title">{MONTH_NAMES[cal.month].slice(0,3)} {cal.year}</span><button className="mini-cal-nav" onClick={()=>setCal(p=>p.month===11?{year:p.year+1,month:0}:{...p,month:p.month+1})}>›</button></div>
          <div className="mini-cal-grid">
            {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} className="mini-cal-dow">{d}</div>)}
            {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i} />)}
            {Array(daysInM).fill(null).map((_,i)=>{const day=i+1,d=ds(day),isSel=d===selDate,hasE=events.some(e=>e.date===d);return(<div key={day} onClick={()=>setSelDate(d)} className={`mini-cal-day ${isSel?"selected":""}${hasE&&!isSel?" has-event":""}`}>{day}</div>);})}
          </div>
        </div>
        <div className="mini-cal" style={{marginTop:11}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--ink-muted)",marginBottom:9}}>Tasks — {selDisplay}</p>
          {dayEvents.length===0?<p className="text-muted text-sm">None.</p>:dayEvents.map(ev=>(
            <div key={ev.id} className="flex items-center gap-8" style={{marginBottom:8,cursor:"pointer"}} onClick={()=>openEdit(ev)}>
              <div style={{width:9,height:9,borderRadius:3,background:ev.color,flexShrink:0}} />
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500,color:"var(--ink)"}}>{ev.title}</div><div style={{fontSize:9.5,color:"var(--ink-muted)"}}>{ev.startHour}:{String(ev.startMin||0).padStart(2,"0")}–{ev.endHour}:{String(ev.endMin||0).padStart(2,"0")}</div></div>
              <button onClick={e=>{e.stopPropagation();delEv(ev.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",fontSize:11}}>✕</button>
            </div>
          ))}
        </div>
      </div>
      <div className="timeline-wrap">
        <div className="timeline-header"><span className="timeline-date">{selDisplay}</span></div>
        <div className="timeline-body">
          {HOURS.map(hour=>{
            const evHere=dayEvents.filter(e=>e.startHour===hour);const blocked=dayEvents.filter(e=>hour>=e.startHour&&hour<e.endHour);
            const isPast=isToday&&hour<currentHour;
            const isCurrentHour=isToday&&hour===currentHour;
            const timeIndicatorTop=isCurrentHour?Math.round((currentMin/60)*58):0;
            return(<div key={hour} className="hour-row" style={{position:"relative"}}>
              <div className="hour-label" style={{opacity:isPast?0.4:1}}>{hour<12?`${hour}am`:hour===12?"12pm":`${hour-12}pm`}</div>
              <div className="hour-slot" style={{position:"relative",opacity:isPast?0.5:1,background:isPast?"var(--cream-dark)":"transparent"}} onClick={()=>{if(isPast)return;if(!blocked.length)openAdd(hour);}}>
                {isCurrentHour&&<div style={{position:"absolute",top:timeIndicatorTop,left:0,right:0,height:2,background:"#E53935",zIndex:5,pointerEvents:"none"}}><div style={{position:"absolute",left:-4,top:-3,width:8,height:8,borderRadius:"50%",background:"#E53935"}} /></div>}
                {evHere.map(ev=><div key={ev.id} className="event-block" style={{background:ev.color,height:`${((ev.endHour+(ev.endMin||0)/60)-(ev.startHour+(ev.startMin||0)/60))*58}px`,position:"absolute",top:`${((ev.startMin||0)/60)*58}px`,left:0,right:0,opacity:isPast?0.5:1,zIndex:2}} onClick={e=>{e.stopPropagation();openEdit(ev);}}><div style={{fontWeight:600,lineHeight:1.3}}>{ev.title}</div><div style={{fontSize:9.5,opacity:0.8,marginTop:1}}>{ev.startHour}:{String(ev.startMin||0).padStart(2,"0")}–{ev.endHour}:{String(ev.endMin||0).padStart(2,"0")}</div></div>)}
                {!blocked.length&&evHere.length===0&&!isPast&&<div className="add-hint">+ Add block</div>}
                {isPast&&!blocked.length&&evHere.length===0&&<div style={{fontSize:10,color:"var(--ink-muted)",opacity:0.5,padding:"8px 12px",fontStyle:"italic"}}>Past</div>}
              </div>
            </div>);
          })}
        </div>
      </div>
    </div>
    {showModal&&(<Modal title={editEv?"Edit Task":"Add Task Block"} onClose={()=>setShowModal(false)}>
      <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} autoFocus /></div>
      <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={2} value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} placeholder="Add details…" style={{resize:"vertical"}} /></div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Start Time</label>
          <div className="flex gap-6">
            <select className="form-input form-select" style={{flex:1}} value={form.startHour} onChange={e=>setForm(p=>({...p,startHour:parseInt(e.target.value)}))}>
              {HOURS.filter(h=>selDate!==todayISO()||h>=new Date().getHours()).map(h=><option key={h} value={h}>{h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`}</option>)}
            </select>
            <select className="form-input form-select" style={{width:72}} value={form.startMin||0} onChange={e=>setForm(p=>({...p,startMin:parseInt(e.target.value)}))}>
              {[0,5,10,15,20,25,30,35,40,45,50,55].map(m=><option key={m} value={m}>{String(m).padStart(2,"0")}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">End Time</label>
          <div className="flex gap-6">
            <select className="form-input form-select" style={{flex:1}} value={form.endHour} onChange={e=>setForm(p=>({...p,endHour:parseInt(e.target.value)}))}>
              {HOURS.filter(h=>h>form.startHour||(h===form.startHour&&(form.endMin||0)>(form.startMin||0))).map(h=><option key={h} value={h}>{h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`}</option>)}
            </select>
            <select className="form-input form-select" style={{width:72}} value={form.endMin||0} onChange={e=>setForm(p=>({...p,endMin:parseInt(e.target.value)}))}>
              {[0,5,10,15,20,25,30,35,40,45,50,55].map(m=><option key={m} value={m}>{String(m).padStart(2,"0")}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="form-group"><label className="form-label">Color</label><div className="flex gap-8 mt-4">{PLANNER_COLORS.map(c=><div key={c} onClick={()=>setForm(p=>({...p,color:c}))} style={{width:24,height:24,borderRadius:6,background:c,cursor:"pointer",border:form.color===c?"3px solid var(--ink)":"3px solid transparent"}} />)}</div></div>
      <div className="flex gap-12 mt-16"><button className="btn btn-primary" onClick={saveEv}>Save</button>{editEv&&<button className="btn btn-danger" onClick={()=>delEv(editEv.id)}>Delete</button>}<button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button></div>
    </Modal>)}
  </div>);
}

// ─── USER LOGINS ──────────────────────────────────────────────────────────────
function UserLogins({ users, setUsers, currentUser, setCurrentUser }) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ name: "", displayName: "" });
  const [flashId, setFlashId] = useState(null);

  function startEdit(u) {
    setEditId(u.id);
    setDraft({ name: u.name, displayName: u.displayName || u.username });
  }

  function save(u) {
    const trimName = draft.name.trim();
    const trimDisplay = draft.displayName.trim();
    if (!trimName || !trimDisplay) return;
    const newAvatar = trimName.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
    setUsers(prev => prev.map(x =>
      x.id === u.id ? { ...x, name: trimName, displayName: trimDisplay, avatar: newAvatar } : x
    ));
    if (currentUser.id === u.id) {
      setCurrentUser(prev => ({ ...prev, name: trimName, displayName: trimDisplay, avatar: newAvatar }));
    }
    setEditId(null);
    setFlashId(u.id);
    setTimeout(() => setFlashId(null), 2000);
  }

  function cancel() { setEditId(null); setDraft({ name: "", displayName: "" }); }

  const roleBg = r => r === "superadmin" ? "#943535" : r === "admin" ? "var(--accent)" : "var(--info)";

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">User Login Details</h1>
          <p className="section-sub">Edit any member name — updates everywhere instantly</p>
        </div>
      </div>
      <div className="card" style={{padding:0}}>
        <table className="table">
          <thead>
            <tr>
              <th>Member (Full Name)</th>
              <th>Display Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Password</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isEditing = editId === u.id;
              const flashing = flashId === u.id;
              const previewAvatar = isEditing
                ? draft.name.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"
                : u.avatar;
              return (
                <tr key={u.id} style={{ background: flashing ? "rgba(62,125,82,0.07)" : "inherit", transition: "background 0.4s" }}>
                  <td>
                    <div className="flex items-center gap-12">
                      <div className="avatar" style={{ background: roleBg(u.role), flexShrink: 0, fontSize: 10 }}>
                        {previewAvatar}
                      </div>
                      {isEditing ? (
                        <input
                          className="form-input"
                          style={{ width: 150, padding: "5px 9px", fontSize: 12.5 }}
                          value={draft.name}
                          autoFocus
                          onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") save(u); if (e.key === "Escape") cancel(); }}
                          placeholder="Full name"
                        />
                      ) : (
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                          {u.name}
                          {flashing && <span style={{ fontSize: 10, color: "var(--success)", marginLeft: 6 }}>✓ Saved</span>}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className="form-input"
                        style={{ width: 140, padding: "5px 9px", fontSize: 12.5 }}
                        value={draft.displayName}
                        onChange={e => setDraft(p => ({ ...p, displayName: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") save(u); if (e.key === "Escape") cancel(); }}
                        placeholder="Chat name"
                      />
                    ) : (
                      <span style={{ fontSize: 12.5, color: "var(--ink)" }}>{u.displayName || u.username}</span>
                    )}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 12.5, color: "var(--ink)" }}>{u.username}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
                      {u.role.replace("superadmin", "Super Admin")}
                    </span>
                  </td>
                  <td>
                    <code style={{ background: "var(--cream-dark)", padding: "2px 7px", borderRadius: 5, fontSize: 11, color: "var(--ink)" }}>
                      {u.password}
                    </code>
                  </td>
                  <td>
                    {isEditing ? (
                      <div className="flex gap-8">
                        <button className="btn btn-success btn-sm" onClick={() => save(u)}>✓ Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={cancel}>✕</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(u)}>✎ Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 10, paddingLeft: 4 }}>
        ✦ Changing a name updates the sidebar, dashboard greeting, chat, HR panel, AI assessment, and attendance — everywhere at once.
      </p>
    </div>
  );
}

// ─── CHAT PAGE ────────────────────────────────────────────────────────────────
function ChatPage({ user, users, messages, setMessages, onlineIds }) {
  const [thread,setThread]   = useState("all");
  const [input,setInput]     = useState("");
  const [call,setCall]       = useState(null);
  const [search,setSearch]   = useState("");
  const [replyTo,setReplyTo] = useState(null);
  const [reactions,setReactions] = useState({}); // msgId -> emoji[]
  const [showEmoji,setShowEmoji] = useState(null); // msgId
  const msgEndRef = useRef();
  const inputRef  = useRef();

  const EMOJI_QUICK = ["👍","❤️","😂","🎉","🔥","✅"];

  const visibleMsgs = thread==="all"
    ? messages.filter(m=>m.toId==="all")
    : messages.filter(m=>(String(m.fromId)===String(user.id)&&String(m.toId)===String(thread))||(String(m.fromId)===String(thread)&&String(m.toId)===String(user.id)));

  // Unread counts per thread
  const unreadCount = (tid) => {
    const msgs = tid==="all"
      ? messages.filter(m=>m.toId==="all")
      : messages.filter(m=>String(m.fromId)===String(tid)&&String(m.toId)===String(user.id));
    return msgs.filter(m=>!(m.readBy||[]).some(r=>typeof r==="object"?r.userId===user.id:r===user.id)).length;
  };

  useEffect(()=>{ msgEndRef.current?.scrollIntoView({behavior:"smooth"}); },[visibleMsgs.length,thread]);

  // Mark as read when thread opened — persist to Supabase so sender sees blue ticks
  useEffect(()=>{
    if(!thread) return;
    const now = nowStr();
    const toUpdate = [];
    setMessages(prev=>prev.map(m=>{
      const isForMe = m.toId==="all" || (String(m.fromId)===String(thread)&&String(m.toId)===String(user.id));
      const alreadyRead = (m.readBy||[]).some(r=>typeof r==="object"?r.userId===user.id:r===user.id);
      if(isForMe && !alreadyRead) {
        const newReadBy = [...(m.readBy||[]),{userId:user.id,at:now}];
        toUpdate.push({id:m.id, readBy:newReadBy});
        return {...m, readBy:newReadBy};
      }
      return m;
    }));
    // Persist read receipts to Supabase so sender sees blue ticks
    if(toUpdate.length>0 && supabase) {
      console.log("Marking",toUpdate.length,"messages as read");
      toUpdate.forEach(u=>{
        supabase.from("flow_messages").update({readBy:u.readBy}).eq("id",u.id)
          .then(res=>{if(res.error) console.warn("Read receipt error:",res.error);})
          .catch(e=>console.warn("Read receipt failed:",e));
      });
    }
  },[thread]);

  // Also mark new incoming messages as read if thread is already open
  useEffect(()=>{
    if(!thread) return;
    const unread = visibleMsgs.filter(m=>{
      if(String(m.fromId)===String(user.id)) return false;
      return !(m.readBy||[]).some(r=>typeof r==="object"?r.userId===user.id:r===user.id);
    });
    if(unread.length===0) return;
    const now = nowStr();
    setMessages(prev=>prev.map(m=>{
      if(!unread.find(u=>u.id===m.id)) return m;
      return {...m, readBy:[...(m.readBy||[]),{userId:user.id,at:now}]};
    }));
    if(supabase) {
      unread.forEach(m=>{
        const newRb = [...(m.readBy||[]),{userId:user.id,at:now}];
        supabase.from("flow_messages").update({readBy:newRb}).eq("id",m.id).then(()=>{}).catch(()=>{});
      });
    }
  },[visibleMsgs.length, thread]);

  function send(){
    if(!input.trim()) return;
    const msg = {
      id:Date.now(), fromId:user.id, toId:String(thread),
      text:input.trim(), time:nowStr(), date:todayISO(),
      replyTo:replyTo?{id:replyTo.id,text:replyTo.text,from:replyTo.fromId}:null,
      readBy:[{userId:user.id,at:nowStr()}]
    };
    setMessages(p=>[...p,msg]);
    setInput(""); setReplyTo(null);
  }

  function addReaction(msgId, emoji){
    setReactions(prev=>{
      const cur = prev[msgId]||[];
      const exists = cur.find(r=>r.emoji===emoji&&r.userId===user.id);
      if(exists) return {...prev,[msgId]:cur.filter(r=>!(r.emoji===emoji&&r.userId===user.id))};
      return {...prev,[msgId]:[...cur,{emoji,userId:user.id}]};
    });
    setShowEmoji(null);
  }

  function startCall(participants){
    setCall({type:"video",participants:[users.find(u=>String(u.id)===String(user.id)),...participants.filter(Boolean)]});
  }

  const others  = users.filter(u=>u.id!==user.id);
  const getUser = id=>users.find(u=>u.id===id);
  const threadUser = thread!=="all" ? getUser(thread) : null;
  const threadName = thread==="all" ? "All Hands" : (threadUser?.name||threadUser?.displayName||"Unknown");

  // Filtered contacts for search
  const filteredOthers = others.filter(u=>(u.name||u.displayName||u.username).toLowerCase().includes(search.toLowerCase()));

  // Group messages by date
  function groupByDate(msgs){
    const groups = [];
    let lastDate = null;
    msgs.forEach(m=>{
      if(m.date!==lastDate){ groups.push({type:"date",date:m.date}); lastDate=m.date; }
      groups.push({type:"msg",...m});
    });
    return groups;
  }
  const grouped = groupByDate(visibleMsgs);

  return(
    <div style={{display:"grid",gridTemplateColumns:"260px 1fr",height:"calc(100vh - 112px)",margin:"-24px",overflow:"hidden"}}>
      {call&&<VideoCallModal participants={call.participants} onEnd={()=>setCall(null)} supabase={supabase} currentUser={user} />}

      {/* ── LEFT SIDEBAR ── */}
      <div style={{background:"var(--surface)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"var(--ink)",marginBottom:8}}>Chat</div>
          <input
            placeholder="🔍 Search people…"
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:"100%",padding:"7px 11px",borderRadius:8,border:"1px solid var(--border)",background:"var(--cream-dark)",fontSize:12,color:"var(--ink)",outline:"none",boxSizing:"border-box"}}
          />
        </div>

        {/* Threads */}
        <div style={{overflowY:"auto",flex:1}}>
          {/* All Hands */}
          <div
            onClick={()=>setThread("all")}
            style={{padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
              background:thread==="all"?"var(--accent-pale)":"transparent",
              borderLeft:thread==="all"?"3px solid var(--accent)":"3px solid transparent"
            }}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#C4954A,#9B3A3A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>✦</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:13,color:"var(--ink)"}}>All Hands</div>
              <div style={{fontSize:11,color:"var(--ink-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {messages.filter(m=>m.toId==="all").slice(-1)[0]?.text||"Team channel"}
              </div>
            </div>
            {unreadCount("all")>0&&<span style={{background:"var(--accent)",color:"white",borderRadius:10,fontSize:9,fontWeight:700,padding:"2px 6px",flexShrink:0}}>{unreadCount("all")}</span>}
          </div>

          {/* Separator */}
          <div style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--ink-muted)",padding:"10px 14px 4px"}}>Direct Messages</div>

          {filteredOthers.map(u=>{
            const isOnline=onlineIds.includes(u.id);
            const lastMsg=messages.filter(m=>(String(m.fromId)===String(u.id)&&String(m.toId)===String(user.id))||(String(m.fromId)===String(user.id)&&String(m.toId)===String(u.id))).slice(-1)[0];
            const unread=unreadCount(u.id);
            const isActive=String(thread)===String(u.id);
            return(
              <div key={u.id} onClick={()=>setThread(u.id)}
                style={{padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
                  background:isActive?"var(--accent-pale)":"transparent",
                  borderLeft:isActive?"3px solid var(--accent)":"3px solid transparent"
                }}>
                <div style={{position:"relative",flexShrink:0}}>
                  <div style={{width:36,height:36,borderRadius:10,background:u.role==="admin"?"var(--accent)":u.role==="superadmin"?"#943535":"var(--info)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"white",fontSize:13}}>{u.avatar}</div>
                  <div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",background:isOnline?"#4ADE80":"#6B7280",border:"2px solid var(--surface)"}} />
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:unread?700:500,fontSize:13,color:"var(--ink)"}}>{u.name||u.displayName}</div>
                  <div style={{fontSize:11,color:"var(--ink-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {lastMsg?lastMsg.text:isOnline?"● Online":"○ Offline"}
                  </div>
                </div>
                {unread>0&&<span style={{background:"var(--accent)",color:"white",borderRadius:10,fontSize:9,fontWeight:700,padding:"2px 6px",flexShrink:0}}>{unread}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CHAT AREA ── */}
      <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>

        {/* Thread header */}
        <div style={{padding:"12px 20px",borderBottom:"1px solid var(--border)",background:"var(--surface)",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          {thread==="all"
            ? <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#C4954A,#9B3A3A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✦</div>
            : <div style={{position:"relative"}}>
                <div style={{width:36,height:36,borderRadius:10,background:threadUser?.role==="admin"?"var(--accent)":"var(--info)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"white",fontSize:13}}>{threadUser?.avatar}</div>
                <div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",background:onlineIds.includes(thread)?"#4ADE80":"#6B7280",border:"2px solid var(--surface)"}} />
              </div>
          }
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14,color:"var(--ink)"}}>{threadName}</div>
            <div style={{fontSize:11,color:"var(--ink-muted)"}}>
              {thread==="all"?`${users.length} members`:(onlineIds.includes(thread)?"● Online now":"○ Offline")}
            </div>
          </div>

          <button onClick={()=>startCall(thread==="all"?others:[threadUser])} title="Video Call"
            style={{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:16}}>📹</button>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:2}} onClick={()=>setShowEmoji(null)}>
          {visibleMsgs.length===0&&(
            <div style={{textAlign:"center",margin:"auto",color:"var(--ink-muted)"}}>
              <div style={{fontSize:40,marginBottom:12}}>💬</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Start the conversation</div>
              <div style={{fontSize:12,marginTop:4}}>Be the first to say something ✦</div>
            </div>
          )}
          {grouped.map((item,idx)=>{
            if(item.type==="date") return(
              <div key={idx} style={{textAlign:"center",margin:"12px 0",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
                <span style={{fontSize:10,color:"var(--ink-muted)",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>
                  {item.date===todayISO()?"Today":item.date}
                </span>
                <div style={{flex:1,height:1,background:"var(--border)"}} />
              </div>
            );
            const isMe=String(item.fromId)===String(user.id);
            const sender=getUser(item.fromId);
            const replyMsg=item.replyTo?messages.find(m=>m.id===item.replyTo.id):null;
            const msgReactions=reactions[item.id]||[];
            // Group reactions by emoji
            const reactionGroups={};
            msgReactions.forEach(r=>{ reactionGroups[r.emoji]=(reactionGroups[r.emoji]||0)+1; });
            return(
              <div key={item.id}
                style={{display:"flex",flexDirection:isMe?"row-reverse":"row",gap:8,alignItems:"flex-end",marginBottom:4}}
                onMouseEnter={()=>{}}
              >
                {!isMe&&<div style={{width:28,height:28,borderRadius:7,background:sender?.role==="admin"?"var(--accent)":"var(--info)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:11,fontWeight:700,flexShrink:0,marginBottom:4}}>{sender?.avatar}</div>}
                <div style={{maxWidth:"68%"}}>
                  {!isMe&&<div style={{fontSize:10,color:"var(--ink-muted)",marginBottom:2,fontWeight:600}}>{sender?.name||sender?.displayName}</div>}
                  {/* Reply preview */}
                  {item.replyTo&&(
                    <div style={{background:"var(--cream-dark)",borderLeft:"3px solid var(--accent)",borderRadius:4,padding:"4px 8px",marginBottom:4,fontSize:11,color:"var(--ink-muted)"}}>
                      ↩ {item.replyTo.text?.slice(0,60)}{item.replyTo.text?.length>60?"…":""}
                    </div>
                  )}
                  <div style={{position:"relative",display:"inline-block",maxWidth:"100%"}}>
                    <div style={{
                      padding:"9px 13px",borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",
                      background:isMe?"var(--accent)":"var(--surface)",
                      color:isMe?"white":"var(--ink)",
                      fontSize:13,lineHeight:1.5,wordBreak:"break-word",
                      border:isMe?"none":"1px solid var(--border)"
                    }}>
                      {item.text}
                      <span style={{fontSize:9,opacity:0.6,marginLeft:8,whiteSpace:"nowrap"}}>{item.time}</span>
                      {isMe&&(()=>{
                        const rb=item.readBy||[];
                        const readByOthers=rb.filter(r=>{const uid=typeof r==="object"?r.userId:r;return String(uid)!==String(user.id);});
                        const isSeen=readByOthers.length>0;
                        const seenEntry=readByOthers[0];
                        const seenTime=seenEntry&&typeof seenEntry==="object"?seenEntry.at:null;
                        if(isSeen) return <span style={{fontSize:9,marginLeft:4}}>
                          <span style={{color:"#53BDEB",fontWeight:700}}>✓✓</span>
                          {seenTime&&<span style={{color:"#53BDEB",marginLeft:2,fontSize:8}}>seen {seenTime}</span>}
                        </span>;
                        return <span style={{fontSize:9,marginLeft:4,opacity:0.5}}>✓</span>;
                      })()}
                    </div>
                    {/* Hover actions */}
                    <div style={{position:"absolute",top:-28,right:isMe?0:"auto",left:isMe?"auto":0,display:"flex",gap:3,opacity:0,transition:"opacity 0.15s"}}
                      className="msg-actions">
                      <button onClick={e=>{e.stopPropagation();setShowEmoji(showEmoji===item.id?null:item.id);}}
                        style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:12}}>😊</button>
                      <button onClick={()=>setReplyTo(item)}
                        style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:11}}>↩</button>
                    </div>
                    {/* Emoji picker */}
                    {showEmoji===item.id&&(
                      <div style={{position:"absolute",bottom:"100%",right:isMe?0:"auto",left:isMe?"auto":0,zIndex:100,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"6px 10px",display:"flex",gap:6,boxShadow:"0 4px 16px rgba(0,0,0,0.12)"}}>
                        {EMOJI_QUICK.map(em=><span key={em} onClick={e=>{e.stopPropagation();addReaction(item.id,em);}} style={{cursor:"pointer",fontSize:18,lineHeight:1}}>{em}</span>)}
                      </div>
                    )}
                  </div>
                  {/* Reactions */}
                  {Object.keys(reactionGroups).length>0&&(
                    <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                      {Object.entries(reactionGroups).map(([em,count])=>(
                        <span key={em} onClick={()=>addReaction(item.id,em)}
                          style={{background:"var(--cream-dark)",border:"1px solid var(--border)",borderRadius:12,padding:"2px 7px",fontSize:12,cursor:"pointer"}}>
                          {em} {count>1?count:""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>

        {/* Reply banner */}
        {replyTo&&(
          <div style={{padding:"8px 20px",background:"var(--cream-dark)",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{flex:1,fontSize:12,color:"var(--ink-muted)",borderLeft:"3px solid var(--accent)",paddingLeft:8}}>
              ↩ Replying to: <em>{replyTo.text?.slice(0,60)}</em>
            </div>
            <button onClick={()=>setReplyTo(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",fontSize:16}}>✕</button>
          </div>
        )}

        {/* Input bar */}
        <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)",background:"var(--surface)",display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
          <input
            ref={inputRef}
            className="chat-input"
            style={{flex:1,borderRadius:22,padding:"10px 16px",fontSize:13,border:"1px solid var(--border)",background:"var(--cream-dark)",color:"var(--ink)",outline:"none"}}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),send())}
            placeholder={`Message ${threadName}…`}
          />
          <button onClick={send} disabled={!input.trim()}
            style={{background:input.trim()?"var(--accent)":"var(--border)",color:"white",border:"none",borderRadius:22,padding:"10px 18px",cursor:input.trim()?"pointer":"default",fontSize:13,fontWeight:600,transition:"background 0.2s"}}>
            Send ➤
          </button>
        </div>
      </div>

      <style>{`
        .msg-actions { opacity: 0; }
        div:hover > div > .msg-actions { opacity: 1; }
      `}</style>
    </div>
  );
}


// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [users,setUsersRaw]       = useState(INITIAL_USERS);
  const [user,setUser]             = useState(()=>lsGet("flow_user",null));
  const [active,setActive]         = useState("dashboard");
  const [dark,setDark]             = useState(()=>lsGet("flow_dark",false));
  const [clients,setClientsRaw]    = useState([]);
  const [content,setContentRaw]    = useState([]);
  const [calendar,setCalendarRaw]  = useState([]);
  const [leaves,setLeavesRaw]      = useState([]);
  const [attendance,setAttendanceRaw] = useState([]);
  const [messages,setMessagesRaw]  = useState([]);
  const [plannerEvents,setPlannerEventsRaw] = useState({});
  const [onlineIds,setOnlineIds]   = useState([]);
  const [phase,setPhase]           = useState(0);
  const [chatNotif,setChatNotif]   = useState(null);
  const [dbReady,setDbReady]       = useState(false);
  const currentUserRef             = useRef(null);
  const channelsRef                = useRef([]);

  // Keep currentUserRef in sync after refresh
  useEffect(()=>{
    if(user) currentUserRef.current = user;
  },[user]);

  // Online status: database heartbeat (like MS Teams approach)
  // Write lastSeen timestamp to DB every 20s, check who is recent
  useEffect(()=>{
    if(!user || !dbReady || !supabase) return;
    async function heartbeat() {
      try {
        const now = new Date().toISOString();
        await supabase.from("flow_users").update({lastSeen:now}).eq("id",user.id);
      } catch(e) { console.warn("Heartbeat error:",e); }
    }
    async function pollOnline() {
      try {
        const {data} = await supabase.from("flow_users").select("id,lastSeen");
        if(data) {
          const now = Date.now();
          const online = data.filter(u => u.lastSeen && (now - new Date(u.lastSeen).getTime()) < 60000).map(u=>u.id);
          setOnlineIds(online);
        }
      } catch(e) { console.warn("Poll online error:",e); }
    }
    // Immediately mark self online and check others
    heartbeat();
    pollOnline();
    // Heartbeat every 20 seconds, poll every 15 seconds
    const hbInterval = setInterval(heartbeat, 20000);
    const pollInterval = setInterval(pollOnline, 15000);
    return ()=>{ clearInterval(hbInterval); clearInterval(pollInterval); };
  },[user, dbReady]);

  // ── Connect to Supabase and load all data once on mount ───────────────────
  useEffect(()=>{
    async function init() {
      
      // Load all tables in parallel
      try {
        const [u,cl,co,ca,lv,at,ms,pl] = await Promise.all([
          supabase.from("flow_users").select("*"),
          supabase.from("flow_clients").select("*"),
          supabase.from("flow_content").select("*"),
          supabase.from("flow_calendar").select("*"),
          supabase.from("flow_leaves").select("*"),
          supabase.from("flow_attendance").select("*"),
          supabase.from("flow_messages").select("*").order("id",{ascending:true}),
          supabase.from("flow_planner").select("*"),
        ]);

        if(u.data?.length) {
          const merged = INITIAL_USERS.map(iu=>({...iu,...(u.data.find(x=>x.id===iu.id)||{})}));
          // Also include any users added later that aren't in INITIAL_USERS
          const existingIds = new Set(INITIAL_USERS.map(iu=>iu.id));
          const newUsers = u.data.filter(x=>!existingIds.has(x.id));
          setUsersRaw([...merged, ...newUsers]);
        }
        if(cl.data) setClientsRaw(cl.data);
        if(co.data) setContentRaw(co.data);
        if(ca.data) setCalendarRaw(ca.data);
        if(lv.data) setLeavesRaw(lv.data);
        if(at.data) setAttendanceRaw(at.data);
        if(ms.data) setMessagesRaw(ms.data);
        if(pl.data) {
          const map={};
          pl.data.forEach(r=>{ map[r.userId]=r.events||[]; });
          setPlannerEventsRaw(map);
        }
      } catch(e){ console.warn("Load error:",e); }
      setDbReady(true);
    }
    init();
  },[]);

  // ── Real-time: subscribe to ALL table changes after DB is ready ───────────
  useEffect(()=>{
    if(!dbReady || !supabase || !user) return;
    const sb = supabase;
    const channels = [];

    function sub(table, handler) {
      const ch = supabase.channel(`rt-${table}-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table}, handler)
        .subscribe();
      channels.push(ch);
    }

    // Messages — most important: append new, update existing
    sub("flow_messages", (payload)=>{
      if(payload.eventType==="INSERT") {
        const msg = payload.new;
        // Check if this is a call signal

        setMessagesRaw(prev=>{
          if(prev.find(m=>String(m.id)===String(msg.id))) return prev;
          // Notify if message is for current user and not from them
          const cu = currentUserRef.current;
          if(cu && msg.fromId!==cu.id && (msg.toId==="all" || String(msg.toId)===String(cu.id))) {
            const allUsers = [...INITIAL_USERS, ...(prev||[])];
            const sender = allUsers.find(x=>x.id===msg.fromId);
            setChatNotif({text:msg.text, from:sender?.displayName||sender?.name||"Someone"});
            setTimeout(()=>setChatNotif(null),4000);
          }
          return [...prev, msg];
        });
      }
      if(payload.eventType==="UPDATE") {
        setMessagesRaw(prev=>prev.map(m=>m.id===payload.new.id?payload.new:m));
      }
    });

    // Attendance — append/update
    sub("flow_attendance", (payload)=>{
      if(payload.eventType==="INSERT") {
        setAttendanceRaw(prev=>{
          if(prev.find(a=>a.id===payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      }
      if(payload.eventType==="UPDATE") {
        setAttendanceRaw(prev=>prev.map(a=>a.id===payload.new.id?payload.new:a));
      }
    });

    // Clients
    sub("flow_clients", (payload)=>{
      if(payload.eventType==="INSERT") setClientsRaw(prev=>[...prev.filter(x=>x.id!==payload.new.id),payload.new]);
      if(payload.eventType==="UPDATE") setClientsRaw(prev=>prev.map(x=>x.id===payload.new.id?payload.new:x));
      if(payload.eventType==="DELETE") setClientsRaw(prev=>prev.filter(x=>x.id!==payload.old.id));
    });

    // Content
    sub("flow_content", (payload)=>{
      if(payload.eventType==="INSERT") setContentRaw(prev=>[...prev.filter(x=>x.id!==payload.new.id),payload.new]);
      if(payload.eventType==="UPDATE") setContentRaw(prev=>prev.map(x=>x.id===payload.new.id?payload.new:x));
      if(payload.eventType==="DELETE") setContentRaw(prev=>prev.filter(x=>x.id!==payload.old.id));
    });

    // Leaves
    sub("flow_leaves", (payload)=>{
      if(payload.eventType==="INSERT") setLeavesRaw(prev=>[...prev.filter(x=>x.id!==payload.new.id),payload.new]);
      if(payload.eventType==="UPDATE") setLeavesRaw(prev=>prev.map(x=>x.id===payload.new.id?payload.new:x));
    });

    // Planner
    sub("flow_planner", (payload)=>{
      if(payload.new) {
        setPlannerEventsRaw(prev=>({...prev,[payload.new.userId]:payload.new.events||[]}));
      }
    });

    // Users
    sub("flow_users", (payload)=>{
      if(payload.new) {
        setUsersRaw(prev=>prev.map(u=>u.id===payload.new.id?{...u,...payload.new}:u));
      }
    });

    channelsRef.current = channels;

  
    return ()=>channels.forEach(ch=>{ try{ supabase.removeChannel(ch); }catch{} });
  },[dbReady, user?.id]);

  // ── Simple setters: update state + write to Supabase ─────────────────────
  async function setUsers(u) {
    const v=typeof u==="function"?u(users):u;
    setUsersRaw(v);
        for(const usr of v) {
      await supabase.from("flow_users").upsert({id:usr.id,name:usr.name,displayName:usr.displayName,username:usr.username,password:usr.password,role:usr.role,avatar:usr.avatar,email:usr.email},{onConflict:"id"});
    }
  }
  async function setClients(u) {
    const v=typeof u==="function"?u(clients):u;
    setClientsRaw(v);
        for(const row of v) await supabase.from("flow_clients").upsert(row,{onConflict:"id"});
  }
  async function setContent(u) {
    const v=typeof u==="function"?u(content):u;
    setContentRaw(v);
        for(const row of v) await supabase.from("flow_content").upsert(row,{onConflict:"id"});
  }
  async function setCalendar(u) {
    const v=typeof u==="function"?u(calendar):u;
    setCalendarRaw(v);
        for(const row of v) await supabase.from("flow_calendar").upsert(row,{onConflict:"id"});
  }
  async function setLeaves(u) {
    const v=typeof u==="function"?u(leaves):u;
    setLeavesRaw(v);
        for(const row of v) await supabase.from("flow_leaves").upsert(row,{onConflict:"id"});
  }
  async function setAttendance(u) {
    const v=typeof u==="function"?u(attendance):u;
    setAttendanceRaw(v);
        for(const row of v) if(row.id) await supabase.from("flow_attendance").upsert(row,{onConflict:"id"});
  }
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  async function setMessages(u) {
    const prev = messagesRef.current;
    const v = typeof u === "function" ? u(prev) : u;
    setMessagesRaw(v);
    messagesRef.current = v;
    if (v.length > prev.length) {
      const prevIds = new Set(prev.map(m => m.id));
      const newMsgs = v.filter(m => !prevIds.has(m.id));
      for (const msg of newMsgs) {
        try {
          await supabase.from("flow_messages").insert(msg);
        } catch (e) {
          console.warn("Message insert error:", e);
        }
      }
    }
  }
  async function setPlannerEvents(u) {
    const v=typeof u==="function"?u(plannerEvents):u;
    setPlannerEventsRaw(v);
        for(const [uid,evs] of Object.entries(v)) {
      await supabase.from("flow_planner").upsert({id:parseInt(uid),userId:parseInt(uid),events:evs},{onConflict:"userId"});
    }
  }

  // ── When user logs in, start presence tracking ────────────────────────────
  function handleLogin(loggedUser) {
    const freshUser = users.find(u=>u.id===loggedUser.id)||loggedUser;
    setUser(freshUser);
    lsSet("flow_user",freshUser);
    currentUserRef.current = freshUser;
    setOnlineIds(prev=>[...new Set([...prev,freshUser.id])]);
    // Mark self online in DB immediately
    if(supabase) supabase.from("flow_users").update({lastSeen:new Date().toISOString()}).eq("id",freshUser.id).then(()=>{}).catch(()=>{});
  }

  // ── Wave animation ─────────────────────────────────────────────────────────
  useEffect(()=>{
    const iv=setInterval(()=>setPhase(p=>p+0.006),50);
    return()=>clearInterval(iv);
  },[]);

  // ── Persist dark mode ──────────────────────────────────────────────────────
  function handleSetDark(v) { lsSet("flow_dark",v); setDark(v); }

  function handlePasswordChange(newPw){
    setUsers(p=>p.map(u=>u.id===user.id?{...u,password:newPw}:u));
    setUser(p=>({...p,password:newPw}));
  }

  const titles={dashboard:"Dashboard",clients:"Clients",calendar:"Content Calendar",content:"Content",approvals:"Approvals",punch:"Attendance",hr:"HR & Team",assessment:"AI Assessment",logins:"User Logins",notes:"My Planner",chat:"Team Chat",settings:"Settings"};
  const pendingCount=content.filter(c=>(user?.role==="admin"&&c.status==="pending_admin")||(user?.role==="superadmin"&&(c.status==="pending_superadmin"||c.status==="pending_admin"))).length;

  // ── Login screen ───────────────────────────────────────────────────────────
  // Show loading while Supabase fetches data
  if(!dbReady) return (
    <><style>{getStyles(dark)}</style>
    <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"var(--cream)",fontFamily:"'Cormorant Garamond',serif"}}>
      <div style={{fontSize:36,marginBottom:16,animation:"pulse 1.5s ease-in-out infinite"}}>◐</div>
      <div style={{fontSize:22,color:"var(--ink)",fontWeight:600}}>Flow by Anecdote</div>
      <div style={{fontSize:13,color:"var(--ink-muted)",marginTop:8}}>Connecting to database…</div>
    </div></>
  );
  if(!user) return <><style>{getStyles(dark)}</style><LoginPage onLogin={handleLogin} dark={dark} phase={phase} users={users} /></>;

  return(
    <>
      <style>{getStyles(dark)}</style>
      <WaveAccentBar phase={phase} />
      <AmbientWave dark={dark} phase={phase} />

      {/* ── Chat notification popup ── */}
      {chatNotif&&(
        <div onClick={()=>{setActive("chat");setChatNotif(null);}} style={{
          position:"fixed",bottom:24,right:24,zIndex:9999,
          background:"var(--surface)",border:"1px solid var(--accent)",borderRadius:12,
          padding:"12px 16px",maxWidth:280,cursor:"pointer",
          boxShadow:"0 8px 32px rgba(0,0,0,0.18)",animation:"slideUp 0.3s ease"
        }}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--accent)",marginBottom:4}}>💬 New Message</div>
          <div style={{fontWeight:600,fontSize:12,color:"var(--ink)",marginBottom:2}}>{chatNotif.from}</div>
          <div style={{fontSize:12,color:"var(--ink-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{chatNotif.text}</div>
        </div>
      )}

      <div className="app" style={{paddingTop:3,position:"relative",zIndex:1}}>
        <Sidebar user={user} active={active} setActive={setActive} pendingCount={pendingCount} chatUnread={0} />
        <div className="main">
          <div className="topbar">
            <span className="topbar-title serif" style={{fontStyle:active==="dashboard"?"italic":"normal"}}>{titles[active]||active}</span>
            <div className="topbar-right">
              <button className="icon-btn" title="Toggle Theme" onClick={()=>handleSetDark(p=>!p)}>{dark?"☀":"🌙"}</button>
              <div className="flex items-center gap-8"><div className="avatar sm">{user.avatar}</div><span style={{fontSize:12,fontWeight:500,color:"var(--ink)"}}>{user.displayName||user.name}</span></div>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setUser(null);lsSet("flow_user",null);setOnlineIds([]);}}>Sign Out</button>
            </div>
          </div>
          <div className="content" style={{paddingRight:0}}>
            {active==="dashboard"&&<div style={{paddingRight:24}}><Dashboard user={user} users={users} clients={clients} content={content} setContent={setContent} attendance={attendance} dark={dark} plannerEvents={plannerEvents} calendar={calendar} /></div>}
            {active==="clients"&&<div style={{paddingRight:24}}><Clients user={user} clients={clients} setClients={setClients} /></div>}
            {active==="calendar"&&<div style={{paddingRight:24}}><ContentCalendar user={user} clients={clients} calendar={calendar} setCalendar={setCalendar} users={users} /></div>}
            {active==="content"&&<div style={{paddingRight:24}}><Content user={user} clients={clients} content={content} setContent={setContent} users={users} /></div>}
            {active==="approvals"&&(user.role==="admin"||user.role==="superadmin")&&<div style={{paddingRight:24}}><Approvals user={user} clients={clients} content={content} setContent={setContent} users={users} /></div>}
            {active==="punch"&&<div style={{paddingRight:24}}><PunchPage user={user} users={users} attendance={attendance} setAttendance={setAttendance} /></div>}
            {active==="hr"&&<div style={{paddingRight:24}}><HR user={user} leaves={leaves} setLeaves={setLeaves} attendance={attendance} users={users} /></div>}
            {active==="assessment"&&user.role==="superadmin"&&<div style={{paddingRight:24}}><Assessment attendance={attendance} leaves={leaves} content={content} users={users} /></div>}
            {active==="notes"&&<div style={{paddingRight:24}}><PlannerCalendar user={user} plannerEvents={plannerEvents} setPlannerEvents={setPlannerEvents} /></div>}
            {active==="logins"&&user.role==="superadmin"&&<div style={{paddingRight:24}}><UserLogins users={users} setUsers={setUsers} currentUser={user} setCurrentUser={setUser} /></div>}
            {active==="chat"&&<ChatPage user={user} users={users} messages={messages} setMessages={setMessages} onlineIds={onlineIds} />}
            {active==="settings"&&<div style={{paddingRight:24}}><Settings user={user} users={users} setUsers={setUsers} dark={dark} setDark={handleSetDark} onPasswordChange={handlePasswordChange} /></div>}
          </div>
        </div>
      </div>
    </>
  );
}

