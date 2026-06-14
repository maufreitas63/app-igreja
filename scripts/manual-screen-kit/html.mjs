import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

export function assetDataUrl(relativePath) {
  const abs = path.join(root, relativePath);
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const LOGO = assetDataUrl('images/IBNORTE - LOGO MARCA 9.png');
const WATERMARK = assetDataUrl('logos/4.jpeg');

const FA = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css';

export const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 390px; height: 844px; overflow: hidden; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  .screen { width: 390px; height: 844px; position: relative; overflow: hidden; }
  .gradient-login { background: linear-gradient(180deg, #0f172a 0%, #020617 100%); }
  .gradient-index { background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%); }
  .gradient-maint { background: linear-gradient(180deg, #422006 0%, #1c1917 100%); }
  .scroll-y { overflow-y: auto; height: 100%; }
  .pad { padding: 20px; padding-top: 44px; padding-bottom: 28px; }
  .logo { width: 100%; max-width: 300px; height: 110px; object-fit: contain; filter: brightness(0) invert(1); display: block; margin: 0 auto 20px; }
  .h-title { font-size: 28px; font-weight: 800; color: #fff; text-align: center; margin-bottom: 10px; }
  .h-sub { font-size: 16px; color: #94a3b8; text-align: center; margin-bottom: 24px; line-height: 1.35; }
  .label { color: #10b981; font-weight: 600; font-size: 14px; margin-bottom: 8px; display: block; }
  .field { width: 100%; padding: 18px 20px; border-radius: 20px; border: 2px solid #10b981; background: rgba(15,23,42,0.92); color: #fff; font-size: 18px; text-align: center; }
  .field-muted { border-color: #334155; background: rgba(30,41,59,0.7); color: #94a3b8; text-align: left; font-size: 16px; }
  .field-pin { letter-spacing: 8px; font-weight: 700; font-size: 22px; }
  .btn { width: 100%; padding: 18px 20px; border-radius: 20px; border: none; font-size: 16px; font-weight: 700; text-align: center; cursor: default; }
  .btn-emerald { background: #10b981; color: #020617; }
  .btn-emerald-dim { opacity: 0.45; }
  .btn-whatsapp { background: #25d366; color: #064e3b; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
  .btn-amber { background: #fbbf24; color: #422006; }
  .btn-purple { background: #a855f7; color: #fff; }
  .btn-cyan { background: #22d3ee; color: #0f172a; }
  .btn-outline { background: rgba(30,41,59,0.95); border: 1px solid #334155; color: #fff; }
  .btn-sm { padding: 10px 14px; border-radius: 12px; font-size: 13px; width: auto; display: inline-flex; align-items: center; gap: 6px; }
  .gap { height: 14px; }
  .help { color: #64748b; font-size: 13px; line-height: 1.4; text-align: center; margin-top: 16px; }
  .steps { display: flex; align-items: flex-start; justify-content: center; gap: 10px; margin-bottom: 22px; }
  .step { display: flex; flex-direction: column; align-items: center; min-width: 88px; }
  .step-num { width: 32px; height: 32px; border-radius: 16px; border: 2px solid #475569; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #94a3b8; }
  .step-num.on { border-color: #10b981; background: #10b981; color: #0f172a; }
  .step-lbl { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 4px; }
  .step-lbl.on { color: #d1fae5; }
  .step-line { width: 36px; height: 2px; background: #334155; margin-top: 15px; }
  .back { color: #94a3b8; font-size: 15px; font-weight: 600; margin-bottom: 14px; display: block; }
  .confirmed { display: flex; align-items: center; justify-content: center; gap: 8px; color: #94a3b8; font-size: 14px; font-weight: 600; margin-bottom: 14px; }
  .confirmed i { color: #10b981; }
  .banner { padding: 12px 14px; border-radius: 14px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.45); color: #a7f3d0; font-size: 14px; font-weight: 600; text-align: center; margin-bottom: 14px; line-height: 1.35; }
  .pin-hint { color: #64748b; font-size: 13px; margin-top: 10px; line-height: 1.35; }
  .social { margin-top: 22px; display: flex; align-items: center; justify-content: center; gap: 12px; }
  .social-btn { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 22px; }
  .safe { padding: 12px 24px 18px; height: 844px; display: flex; flex-direction: column; }
  .welcome-box { border-radius: 18px; background: rgba(15,23,42,0.45); padding: 14px 16px; margin-bottom: 8px; }
  .welcome-kicker { color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
  .welcome-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; }
  .welcome-name { color: #fff; font-size: 24px; font-weight: 800; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badge { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; text-align: right; line-height: 1.2; max-width: 46%; flex-shrink: 0; }
  .badge-emerald { color: #6ee7b7; }
  .badge-amber { color: #fcd34d; }
  .panel-wrap { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding-top: 8px; position: relative; }
  .panel-card { width: 90%; border-radius: 28px; border: 1px solid rgba(165,180,252,0.55); background: rgba(15,23,42,0.88); padding: 22px; min-height: 520px; position: relative; overflow: hidden; }
  .panel-card-maint { border-color: rgba(251,191,36,0.38); background: rgba(28,25,23,0.92); }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.09; mix-blend-mode: multiply; pointer-events: none; }
  .watermark img { width: 100%; height: 100%; object-fit: contain; }
  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .panel-title { font-size: 17px; font-weight: 800; color: #f8fafc; flex: 1; }
  .panel-sub { font-size: 12px; color: #94a3b8; text-align: right; max-width: 48%; line-height: 1.3; }
  .shortcut { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 14px; background: rgba(30,41,59,0.55); border: 1px solid #334155; margin-bottom: 8px; }
  .shortcut.on { border-color: rgba(251,191,36,0.55); background: rgba(251,191,36,0.12); }
  .shortcut.child { margin-left: 18px; padding: 10px 12px; }
  .shortcut i { color: #818cf8; font-size: 16px; margin-top: 2px; width: 18px; text-align: center; }
  .shortcut.child i { font-size: 14px; }
  .shortcut .child-mark { color: #64748b; font-weight: 700; margin-right: 2px; }
  .shortcut-text { color: #e2e8f0; font-size: 14px; font-weight: 700; line-height: 1.25; }
  .shortcut.on .shortcut-text { color: #fde68a; }
  .rail { width: 2px; background: #334155; margin-left: 8px; margin-right: 6px; }
  .footer-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 8px; }
  .exit-btn { flex: 1; padding: 14px; border-radius: 16px; background: rgba(30,41,59,0.7); border: 1px solid #475569; color: #94a3b8; font-size: 13px; font-weight: 700; text-align: center; }
  .gear { width: 48px; height: 48px; border-radius: 16px; background: rgba(30,41,59,0.7); border: 1px solid #475569; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 22px; }
  .carousel-foot { margin-top: auto; padding-top: 10px; }
  .nav-row { display: flex; align-items: center; gap: 8px; }
  .nav-btn { height: 48px; border-radius: 16px; border: 1px solid; display: flex; align-items: center; justify-content: center; font-weight: 700; }
  .nav-side { width: 48px; font-size: 28px; line-height: 1; }
  .nav-center { flex: 1; font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; }
  .nav-emerald .nav-side { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.45); color: #6ee7b7; }
  .nav-emerald .nav-center { background: rgba(16,185,129,0.22); border-color: #10b981; color: #d1fae5; }
  .nav-amber .nav-side { background: rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.35); color: #fcd34d; }
  .nav-amber .nav-center { background: rgba(251,191,36,0.18); border-color: #fbbf24; color: #fde68a; }
  .page-ind { text-align: center; color: #94a3b8; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; margin-top: 6px; }
  .theme-card { border-radius: 24px; border: 1px solid; padding: 18px; min-height: 420px; position: relative; z-index: 1; }
  .section-label { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
  .meta { font-size: 12px; color: #94a3b8; line-height: 1.4; }
  .row { display: flex; gap: 8px; align-items: center; }
  .chip { padding: 8px 12px; border-radius: 10px; border: 1px solid; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
  .chip-kids-on { background: rgba(250,204,21,0.12); border-color: rgba(250,204,21,0.35); color: #fde68a; }
  .chip-teens { background: rgba(30,41,59,0.7); border-color: #475569; color: #94a3b8; }
  .check-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(51,65,85,0.5); }
  .check-row:last-child { border-bottom: none; }
  .check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #818cf8; background: #818cf8; color: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
  .check.off { background: transparent; color: transparent; }
  .check-name { color: #f8fafc; font-size: 14px; font-weight: 600; flex: 1; }
  .check-sub { color: #86efac; font-size: 11px; }
  .info-block { background: rgba(15,23,42,0.55); border: 1px solid rgba(51,65,85,0.8); border-radius: 16px; padding: 14px; margin-bottom: 12px; }
  .info-k { color: #94a3b8; font-size: 12px; font-weight: 600; margin-bottom: 4px; }
  .info-v { color: #f8fafc; font-size: 15px; font-weight: 700; }
  .qr-box { width: 180px; height: 180px; margin: 12px auto; background: #fff; border-radius: 8px; display: grid; place-items: center; }
  .qr-inner { width: 150px; height: 150px; background: repeating-linear-gradient(0deg,#0f172a 0 4px,#fff 4px 8px), repeating-linear-gradient(90deg,#0f172a 0 4px,#fff 4px 8px); }
  .seg-row { display: flex; gap: 8px; margin-bottom: 12px; }
  .seg { flex: 1; padding: 10px; border-radius: 12px; text-align: center; font-size: 12px; font-weight: 700; border: 1px solid #475569; color: #94a3b8; background: rgba(30,41,59,0.55); }
  .seg.on { background: rgba(99,102,241,0.35); border-color: #818cf8; color: #e0e7ff; }
  .table-head { font-size: 11px; color: #94a3b8; margin-bottom: 8px; font-weight: 600; }
  .table-line { font-size: 12px; color: #f8fafc; padding: 8px 0; border-bottom: 1px solid rgba(51,65,85,0.45); display: flex; justify-content: space-between; gap: 8px; }
  .collapse { border: 1px solid rgba(51,65,85,0.7); border-radius: 14px; margin-bottom: 10px; overflow: hidden; }
  .collapse-h { padding: 12px 14px; background: rgba(15,23,42,0.45); display: flex; justify-content: space-between; align-items: center; }
  .collapse-t { color: #f8fafc; font-size: 14px; font-weight: 700; }
  .collapse-b { padding: 12px 14px; color: #cbd5e1; font-size: 13px; line-height: 1.4; }
  .lgpd-box { height: 160px; overflow: hidden; border: 1px solid #334155; border-radius: 16px; background: rgba(30,41,59,0.7); padding: 14px; margin-bottom: 10px; }
  .lgpd-t { color: #fff; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .lgpd-p { color: #cbd5e1; font-size: 11px; line-height: 1.45; }
  .checks { display: flex; gap: 16px; margin: 12px 0; flex-wrap: wrap; }
  .cb { display: flex; align-items: center; gap: 8px; color: #e2e8f0; font-size: 14px; }
  .cb-box { width: 20px; height: 20px; border: 2px solid #10b981; border-radius: 4px; background: #10b981; }
  .cb-box.off { background: transparent; }
  .status { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
  .status-pub { background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.45); }
  .status-draft { background: rgba(249,115,22,0.2); color: #fdba74; border: 1px solid rgba(249,115,22,0.45); }
  .event-card { border: 1px solid rgba(129,140,248,0.35); border-radius: 14px; padding: 12px; margin-bottom: 10px; background: rgba(15,23,42,0.45); }
  .event-top { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; margin-bottom: 6px; }
  .event-name { color: #f8fafc; font-size: 15px; font-weight: 800; flex: 1; }
  .gantt-bar { height: 28px; border-radius: 8px; margin: 8px 0; background: linear-gradient(90deg, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0.5) 65%, transparent 65%); border: 1px solid rgba(129,140,248,0.4); position: relative; }
  .gantt-bar span { position: absolute; left: 10px; top: 5px; font-size: 11px; color: #e0e7ff; font-weight: 700; }
  .fict { position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font-size: 9px; color: rgba(148,163,184,0.65); z-index: 5; pointer-events: none; }
`;

export function page(body, gradient = 'gradient-login') {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><link rel="stylesheet" href="${FA}"/><style>${CSS}</style></head>
<body><div class="screen ${gradient}">${body}<div class="fict">Dados fictícios — captura ilustrativa do manual</div></div></body></html>`;
}

export function shellLoginStep2() {
  return page(`
  <div class="pad scroll-y">
    <img class="logo" src="${LOGO}" alt="IBN"/>
    <div class="h-title">Boas-vindas</div>
    <div class="h-sub">Acesse com seu celular e código de 4 dígitos</div>
    <div class="steps">
      <div class="step"><div class="step-num on">1</div><div class="step-lbl on">Seu celular</div></div>
      <div class="step-line"></div>
      <div class="step"><div class="step-num on">2</div><div class="step-lbl on">Código</div></div>
    </div>
    <span class="back">← Voltar</span>
    <div class="confirmed"><i class="fa fa-check-circle"></i> Celular confirmado: (11) 98765-4321</div>
    <div class="btn btn-whatsapp"><i class="fa fa-whatsapp"></i> Receber código no WhatsApp</div>
    <div class="banner">Código enviado! Confira o WhatsApp e digite os 4 dígitos abaixo.</div>
    <span class="label">2. Código de acesso</span>
    <div class="field field-pin">••••</div>
    <div class="pin-hint">Na primeira vez, use o código recebido no WhatsApp.</div>
    <div class="gap"></div>
    <div class="btn btn-emerald">Acessar</div>
    <div class="help">Depois deste acesso, você poderá escolher uma senha pessoal em Dados Cadastrais.</div>
  </div>`);
}

export function shellLoginStep1() {
  return page(`
  <div class="pad scroll-y">
    <img class="logo" src="${LOGO}" alt="IBN"/>
    <div class="h-title">Boas-vindas</div>
    <div class="h-sub">Informe seu celular com DDD para continuar</div>
    <div class="steps">
      <div class="step"><div class="step-num on">1</div><div class="step-lbl on">Seu celular</div></div>
      <div class="step-line"></div>
      <div class="step"><div class="step-num">2</div><div class="step-lbl">Código</div></div>
    </div>
    <span class="label">1. Seu celular</span>
    <div class="field">(11) 98765-4321</div>
    <div class="gap"></div>
    <div class="btn btn-emerald">Continuar</div>
    <div class="help">É sua primeira vez? O Ministério de Acolhimento da Igreja pode ajudar.</div>
    <div class="social"><div class="social-btn"><i class="fa fa-download"></i></div><div class="social-btn"><i class="fa fa-instagram"></i></div><div class="social-btn"><i class="fa fa-youtube-play"></i></div></div>
  </div>`);
}

export function shellCadastro() {
  return page(`
  <div class="pad scroll-y">
    <div class="h-title" style="font-size:24px;margin-bottom:24px;">Cadastro Igreja Batista Norte</div>
    <div class="field field-muted" style="margin-bottom:12px;">Maria Silva Santos</div>
    <div class="field field-muted" style="margin-bottom:12px;">15/03/1988</div>
    <div class="field field-muted" style="margin-bottom:12px;">01310-100</div>
    <div class="field field-muted" style="margin-bottom:12px;">Telefone: (11) 98765-4321</div>
    <div class="lgpd-box"><div class="lgpd-t">Termos de Uso e Privacidade (LGPD)</div><div class="lgpd-p">A Igreja Batista Norte (IBN) respeita a privacidade dos membros e visitantes. Este termo descreve como tratamos dados pessoais conforme a LGPD...</div></div>
    <div class="help" style="text-align:left;margin:8px 0;">✅ Termos lidos.</div>
    <div class="checks"><div class="cb"><div class="cb-box"></div>Li e aceito</div><div class="cb"><div class="cb-box off"></div>Li e não concordo</div></div>
    <div class="btn btn-emerald" style="margin-top:8px;">Tirar Selfie Biométrica</div>
  </div>`);
}

export function shellLgpd() {
  return page(`
  <div class="pad scroll-y">
    <div class="h-title" style="font-size:22px;">Termos de Uso e Privacidade (LGPD)</div>
    <div class="lgpd-box" style="height:220px;"><div class="lgpd-t">Termos de Uso e Privacidade (LGPD)</div><div class="lgpd-p">A Igreja Batista Norte (IBN) respeita a privacidade dos membros e visitantes. Ao utilizar o aplicativo, você concorda com o tratamento de dados para fins de gestão eclesiástica, comunicação pastoral e segurança dos cultos...</div></div>
    <div class="help" style="text-align:left;">✅ Termos lidos.</div>
    <div class="checks"><div class="cb"><div class="cb-box"></div>Li e aceito</div><div class="cb"><div class="cb-box off"></div>Li e não concordo</div></div>
    <div class="btn btn-emerald">Confirmar</div>
  </div>`);
}

export function shellIndex({ badge = 'Índice do Aplicativo', name = 'Maria Silva', showGear = false } = {}) {
  const shortcuts = `
    <div class="shortcut"><i class="fa fa-calendar"></i><div class="shortcut-text">Painel de Eventos</div></div>
    <div style="display:flex;"><div class="rail"></div><div style="flex:1">
      <div class="shortcut child"><span class="child-mark">›</span><i class="fa fa-child"></i><div class="shortcut-text">Sala(s)</div></div>
      <div class="shortcut child"><span class="child-mark">›</span><i class="fa fa-qrcode"></i><div class="shortcut-text">QR Code — Check-in Totem</div></div>
    </div></div>
    <div class="shortcut"><i class="fa fa-money"></i><div class="shortcut-text">Dízimos e Ofertas</div></div>
    <div class="shortcut"><i class="fa fa-heart"></i><div class="shortcut-text">Coração Aberto</div></div>
    <div class="shortcut"><i class="fa fa-users"></i><div class="shortcut-text">Lista de Membros</div></div>
    <div class="shortcut"><i class="fa fa-birthday-cake"></i><div class="shortcut-text">Aniversariantes</div></div>
    <div class="shortcut"><i class="fa fa-line-chart"></i><div class="shortcut-text">Financeiro</div></div>
    <div class="shortcut"><i class="fa fa-list-alt"></i><div class="shortcut-text">Escalas</div></div>
    <div class="shortcut"><i class="fa fa-id-card"></i><div class="shortcut-text">Dados Cadastrais</div></div>`;

  return page(`
  <div class="safe gradient-index">
    <div class="welcome-box">
      <div class="welcome-kicker">Boas-Vindas,</div>
      <div class="welcome-row"><div class="welcome-name">${name}</div><div class="badge badge-emerald">${badge}</div></div>
    </div>
    <div class="panel-wrap">
      <div class="panel-card">
        <div class="watermark"><img src="${WATERMARK}" alt=""/></div>
        <div class="panel-head"><div class="panel-title">Índice do Aplicativo</div><div class="panel-sub">Selecione a tela que deseja abrir</div></div>
        ${shortcuts}
      </div>
    </div>
    <div class="footer-row">
      <div class="exit-btn">Encerrar sessão</div>
      ${showGear ? '<div class="gear"><i class="fa fa-cog"></i></div>' : '<div style="width:48px"></div>'}
    </div>
  </div>`, 'gradient-index');
}

export function shellDashboard({ theme, title, badge, body, index = 2, total = 8, center = 'Menu' }) {
  const t = theme;
  return page(`
  <div class="safe gradient-index">
    <div class="welcome-box">
      <div class="welcome-kicker">Boas-Vindas,</div>
      <div class="welcome-row"><div class="welcome-name">Maria Silva</div><div class="badge badge-emerald">${badge}</div></div>
    </div>
    <div class="panel-wrap">
      <div class="panel-card" style="padding:14px;">
        <div class="watermark"><img src="${WATERMARK}" alt=""/></div>
        <div class="theme-card" style="background:${t.bg};border-color:${t.border};box-shadow:0 8px 24px ${t.shadow}33;">
          <div class="panel-title" style="color:${t.accent};margin-bottom:12px;">${title}</div>
          ${body}
        </div>
        <div class="carousel-foot nav-emerald">
          <div class="nav-row">
            <div class="nav-btn nav-side">‹</div>
            <div class="nav-btn nav-center">${center}</div>
            <div class="nav-btn nav-side">›</div>
          </div>
          <div class="page-ind">${index} / ${total}</div>
        </div>
      </div>
    </div>
  </div>`, 'gradient-index');
}

export function shellMaintenance({ badge, title, body, index = 0, total = 15, center = 'Menu', activeShortcut = null }) {
  const shortcuts = [
    ['Programação de Eventos', 'calendar'],
    ['Cronograma de Eventos', 'calendar-check-o'],
    ['Sala(s) - Check In', 'child'],
    ['Tipos de Escala', 'tags'],
    ['Servos em Disponibilidade', 'users'],
    ['Programação de Escalas', 'calendar-plus-o'],
    ['Cuidado Pastoral', 'heart'],
    ['Informações Financeiras', 'money'],
    ['Lista de Presença', 'list-alt'],
    ['Cadastro de Usuário', 'user'],
    ['Recepção Familiar', 'home'],
    ['Controle de Acesso', 'lock'],
    ['Mudança de Papéis', 'exchange'],
    ['Acessos de Usuários', 'history'],
  ];

  const menu = shortcuts
    .map(([label, icon]) => {
      const on = activeShortcut === label ? ' on' : '';
      return `<div class="shortcut${on}"><i class="fa fa-${icon}"></i><div class="shortcut-text">${label}</div></div>`;
    })
    .join('');

  const inner =
    body ??
    `<div class="panel-head"><div class="panel-title">Módulos de manutenção</div></div>${menu}`;

  return page(`
  <div class="safe gradient-maint">
    <div class="welcome-box" style="background:rgba(28,25,23,0.65);">
      <div class="welcome-kicker">Boas-Vindas,</div>
      <div class="welcome-row"><div class="welcome-name">Ana Coord.</div><div class="badge badge-amber">${badge}</div></div>
    </div>
    <div class="panel-wrap">
      <div class="panel-card panel-card-maint" style="padding:14px;">
        <div class="theme-card" style="background:rgba(28,25,23,0.55);border-color:rgba(251,191,36,0.38);min-height:460px;padding:16px;">
          ${title ? `<div class="panel-title" style="color:#fde68a;margin-bottom:10px;">${title}</div>` : ''}
          ${inner}
        </div>
        <div class="carousel-foot nav-amber">
          <div class="nav-row">
            <div class="nav-btn nav-side">‹</div>
            <div class="nav-btn nav-center">${center}</div>
            <div class="nav-btn nav-side">›</div>
          </div>
          <div class="page-ind">${index} / ${total}</div>
        </div>
      </div>
    </div>
  </div>`, 'gradient-maint');
}

export const THEMES = {
  event: { bg: 'rgba(99,102,241,0.24)', border: '#818cf8', shadow: '#6366f1', accent: '#c7d2fe' },
  qr: { bg: 'rgba(6,182,212,0.22)', border: '#22d3ee', shadow: '#0891b2', accent: '#a5f3fc' },
  kids: { bg: 'rgba(244,114,182,0.18)', border: '#f9a8d4', shadow: '#db2777', accent: '#fbcfe8' },
  offerings: { bg: 'rgba(217,119,6,0.22)', border: '#fbbf24', shadow: '#d97706', accent: '#fde68a' },
  pastoral: { bg: 'rgba(147,51,234,0.26)', border: '#c084fc', shadow: '#9333ea', accent: '#e9d5ff' },
  members: { bg: 'rgba(225,29,72,0.2)', border: '#fb7185', shadow: '#e11d48', accent: '#fecdd3' },
  birthdays: { bg: 'rgba(14,165,233,0.2)', border: '#38bdf8', shadow: '#0284c7', accent: '#bae6fd' },
  financial: { bg: 'rgba(5,150,105,0.22)', border: '#34d399', shadow: '#059669', accent: '#a7f3d0' },
  scales: { bg: 'rgba(249,115,22,0.2)', border: '#fb923c', shadow: '#ea580c', accent: '#fed7aa' },
  parking: { bg: 'rgba(20,184,166,0.2)', border: '#2dd4bf', shadow: '#0d9488', accent: '#99f6e4' },
  manage: { bg: 'rgba(20,184,166,0.22)', border: '#2dd4bf', shadow: '#0d9488', accent: '#99f6e4' },
};
