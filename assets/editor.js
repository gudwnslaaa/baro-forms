/* 견적서 · 거래명세표 · 발주서 공용 작성기
   각 페이지의 <body data-doc="estimate|statement|order"> 값에 따라 문서 모양이 달라집니다. */
(function(){
const $ = id => document.getElementById(id);
const val = id => { const el = $(id); return el ? el.value : ''; };
const TYPE = document.body.dataset.doc || 'estimate';
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};

const NAME   = {estimate:'견적서', statement:'거래명세표', order:'발주서'}[TYPE];
const PREFIX = {estimate:'Q', statement:'TS', order:'PO'}[TYPE];
const ME_KEYS = ['supName','supCeo','supNo','supTel','supAddr','supType','supItem'];
const SAMPLE_ME = {supName:'한빛인테리어',supCeo:'김한빛',supNo:'123-45-67890',supTel:'031-123-4567',supAddr:'경기도 수원시 팔달구 효원로 100',supType:'건설업',supItem:'실내건축공사'};
const MATERIALS = [
  {name:'포세린 타일',spec:'600×600',qty:40,price:18000},
  {name:'타일 접착제',spec:'20kg',qty:20,price:9500},
  {name:'줄눈재',spec:'5kg 그레이',qty:10,price:6000}
];
const SAMPLES = {
  estimate: {
    fields:{toName:'(주)예시상사', toPerson:'박민수 과장', title:'2층 욕실 리모델링',
      note:'- 자재 단가는 현장 상황에 따라 변동될 수 있습니다.\n- 착공 시 계약금 30%, 완료 후 잔금 70%'},
    items:[
      {name:'욕실 벽 타일 시공',spec:'300×600',qty:12,price:45000},
      {name:'욕실 바닥 방수',spec:'우레탄 2회',qty:1,price:350000},
      {name:'수전 교체',spec:'원홀 혼합수전',qty:2,price:85000},
      {name:'폐기물 처리',spec:'1톤',qty:1,price:120000}
    ]
  },
  statement: {
    fields:{toName:'(주)예시상사', toCeo:'박민수', toNo:'234-56-78901', toAddr:'서울특별시 강남구 테헤란로 200', toTel:'02-555-1234',
      note:'- 물품을 받으신 후 수량과 상태를 확인해 주세요.'},
    items: MATERIALS
  },
  order: {
    fields:{toName:'대한타일유통', toPerson:'이정훈 대리', toTel:'031-987-6543', place:'경기도 수원시 팔달구 효원로 100 (현장 1층)', pay:'납품 완료 후 익월 10일 계좌이체',
      note:'- 납품 시 거래명세표를 함께 보내 주세요.\n- 규격·수량이 다를 경우 납품 전에 연락 바랍니다.'},
    items: MATERIALS
  }
}[TYPE];
const BLANK_ROWS = TYPE === 'estimate' ? 12 : 10;

let vat = 'excl';
let items = [];
let stamp = store.get('est_stamp');

const fmt = n => Math.round(n).toLocaleString('ko-KR');
const num = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g,'')); return isNaN(n) ? 0 : n; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const v = id => esc(val(id));

function toKorean(n){
  n = Math.round(n);
  if(n <= 0) return '영';
  const d=['','일','이','삼','사','오','육','칠','팔','구'], u=['','십','백','천'], big=['','만','억','조'];
  let out='', i=0;
  while(n>0){
    let chunk=n%10000, s='', j=0;
    while(chunk>0){ const g=chunk%10; if(g) s=d[g]+u[j]+s; chunk=Math.floor(chunk/10); j++; }
    if(s) out=s+big[i]+out;
    n=Math.floor(n/10000); i++;
  }
  return out;
}

function calcRow(it){
  const amt = it.qty * it.price;
  if(vat==='excl') return {supply:amt, tax:Math.floor(amt*0.1)};
  if(vat==='incl'){ const s=Math.round(amt/1.1); return {supply:s, tax:amt-s}; }
  return {supply:amt, tax:0};
}

function renderItems(){
  const box = $('items');
  box.innerHTML = '';
  items.forEach((it, idx) => {
    const r = calcRow(it);
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <label class="full">품명<input id="i${idx}n" value="${esc(it.name)}"></label>
      <label class="full">규격<input id="i${idx}s" value="${esc(it.spec)}"></label>
      <label>수량<input id="i${idx}q" inputmode="decimal" value="${it.qty}"></label>
      <label>단가 (원)<input id="i${idx}p" inputmode="numeric" value="${fmt(it.price)}"></label>
      <div class="meta"><span id="i${idx}m">공급가액 ${fmt(r.supply)}원 · 세액 ${fmt(r.tax)}원</span><button type="button" class="del">삭제</button></div>`;
    const bind = (suffix, key, parse) => {
      const inp = el.querySelector('#i'+idx+suffix);
      inp.addEventListener('input', () => { it[key] = parse ? num(inp.value) : inp.value; update(idx); });
      if(key==='price') inp.addEventListener('blur', () => { inp.value = fmt(it.price); });
    };
    bind('n','name'); bind('s','spec'); bind('q','qty',true); bind('p','price',true);
    el.querySelector('.del').addEventListener('click', () => { items.splice(idx,1); renderItems(); renderDoc(); });
    box.appendChild(el);
  });
}
function update(idx){
  const r = calcRow(items[idx]);
  const m = $('i'+idx+'m'); if(m) m.textContent = `공급가액 ${fmt(r.supply)}원 · 세액 ${fmt(r.tax)}원`;
  renderDoc();
}

const pad = n => String(n).padStart(2,'0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function addDays(dateStr, days){
  const d = new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+days);
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
}
function korDate(dateStr){ if(!dateStr) return ''; const [y,m,d] = dateStr.split('-'); return `${y}년 ${+m}월 ${+d}일`; }

/* 회사 정보 표 (공급자 / 발주자 / 공급받는자 공용) */
function partyTable(label, p, withSeal){
  const rows = [
    `<tr><th>등록번호</th><td colspan="3">${p.no}</td></tr>`,
    `<tr><th>상호</th><td>${p.name}</td><th>대표</th><td>${withSeal
        ? `<span class="seal">${p.ceo} <span>(인)</span>${stamp?`<img src="${stamp}" alt="">`:''}</span>`
        : `${p.ceo}`}</td></tr>`,
    `<tr><th>주소</th><td colspan="3">${p.addr}</td></tr>`
  ];
  if(p.type !== undefined) rows.push(`<tr><th>업태</th><td>${p.type}</td><th>종목</th><td>${p.item}</td></tr>`);
  rows.push(`<tr><th>연락처</th><td colspan="3">${p.tel}</td></tr>`);
  rows[0] = rows[0].replace('<tr>', `<tr><th rowspan="${rows.length}" class="vert">${label}</th>`);
  return `<table class="sup">${rows.join('')}</table>`;
}
const me = () => ({no:v('supNo'), name:v('supName'), ceo:v('supCeo'), addr:v('supAddr'), type:v('supType'), item:v('supItem'), tel:v('supTel')});

function renderDoc(){
  const date = val('date');
  let sSum=0, tSum=0;
  const rows = items.map((it,i) => { const r=calcRow(it); sSum+=r.supply; tSum+=r.tax;
    return `<tr><td class="c">${i+1}</td><td>${esc(it.name)}</td><td class="c">${esc(it.spec)}</td><td class="c">${fmt(it.qty)}</td><td class="n">${fmt(it.price)}</td><td class="n">${fmt(r.supply)}</td><td class="n">${vat==='none'?'-':fmt(r.tax)}</td></tr>`; }).join('');
  const blanks = Array.from({length: Math.max(0, BLANK_ROWS - items.length)}, () => '<tr class="empty"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
  const total = sSum + tSum;
  const vatLabel = vat==='none' ? '면세' : '부가세 포함';
  const docNo = date ? `${PREFIX}-${date.replace(/-/g,'')}-01` : '';
  const totalLabel = TYPE==='order' ? '발주금액' : '합계금액';

  const itemsTable = `
    <div class="total"><div class="lbl">${totalLabel}</div><div class="val">일금 ${toKorean(total)}원정 <em>(₩${fmt(total)}, ${vatLabel})</em></div></div>
    <table class="items">
      <thead><tr><th style="width:36px">No</th><th>품명</th><th style="width:110px">규격</th><th style="width:50px">수량</th><th style="width:86px">단가</th><th style="width:96px">공급가액</th><th style="width:80px">세액</th></tr></thead>
      <tbody>${rows}${blanks}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:center">합 계</td><td class="n">${fmt(sSum)}</td><td class="n">${vat==='none'?'-':fmt(tSum)}</td></tr></tfoot>
    </table>
    <div class="note"><b>비고</b>${v('note')}</div>`;

  let html = '';
  if(TYPE==='estimate'){
    const validDays = +val('valid');
    html = `
      <h2>견적서</h2>
      <div class="docno">No. ${docNo}</div>
      <div class="head">
        <div class="to">
          <div class="name">${v('toName') || '&nbsp;'}<small>귀하</small></div>
          <p>${val('toPerson') ? '담당: '+v('toPerson')+'<br>' : ''}${val('title') ? '건명: '+v('title')+'<br>' : ''}견적일자: ${korDate(date)}${validDays && date ? '<br>유효기간: '+addDays(date, validDays)+'까지' : ''}<br><br>아래와 같이 견적합니다.</p>
        </div>
        ${partyTable('공급자', me(), true)}
      </div>
      ${itemsTable}
      <div class="foot">${v('supName')}${val('supTel') ? ' · '+v('supTel') : ''}</div>`;
  } else if(TYPE==='statement'){
    const copy = val('copy');
    const you = {no:v('toNo'), name:v('toName'), ceo:v('toCeo'), addr:v('toAddr'), tel:v('toTel')};
    html = `
      <h2 class="wide">거래명세표</h2>
      <div class="docno">${copy ? esc(copy)+' · ' : ''}No. ${docNo}</div>
      <div class="pair">
        ${partyTable('공급자', me(), true)}
        ${partyTable('공급받는자', you, false)}
      </div>
      <p class="lead">거래일자: ${korDate(date)}<span>아래와 같이 거래합니다.</span></p>
      ${itemsTable}
      <div class="sign"><span>인수자</span><span class="line"></span><span>(인)</span></div>`;
  } else {
    const line = (k, x) => x ? `${k}: ${x}<br>` : '';
    html = `
      <h2>발주서</h2>
      <div class="docno">No. ${docNo}</div>
      <div class="head">
        <div class="to">
          <div class="name">${v('toName') || '&nbsp;'}<small>귀중</small></div>
          <p>${line('담당', v('toPerson'))}${line('연락처', v('toTel'))}발주일자: ${korDate(date)}<br>${line('납기일자', korDate(val('due')))}${line('납품장소', v('place'))}${line('결제조건', v('pay'))}<br>아래와 같이 발주합니다.</p>
        </div>
        ${partyTable('발주자', me(), true)}
      </div>
      ${itemsTable}
      <div class="foot">${v('supName')}${val('supTel') ? ' · '+v('supTel') : ''}</div>`;
  }
  $('doc').innerHTML = html;
}

function saveMe(){ const o={}; ME_KEYS.forEach(k => o[k]=val(k)); store.set('est_sup', o); }

function init(){
  const today = new Date();
  $('date').value = isoDate(today);
  if($('due')){ const d = new Date(today); d.setDate(d.getDate()+7); $('due').value = isoDate(d); }
  const saved = store.get('est_sup') || SAMPLE_ME;
  ME_KEYS.forEach(k => { if($(k)) $(k).value = saved[k] || ''; });
  Object.entries(SAMPLES.fields).forEach(([k,x]) => { if($(k)) $(k).value = x; });
  items = SAMPLES.items.map(x => ({...x}));
  if(stamp){ $('stampThumb').src = stamp; $('stampThumb').hidden = false; $('stampDel').hidden = false; }

  // 입력칸이 바뀌면 바로 문서에 반영 (품목 칸은 renderItems에서 따로 연결)
  document.querySelectorAll('.editor input:not([type=file]), .editor select, .editor textarea').forEach(el => {
    el.addEventListener('input', () => { if(ME_KEYS.includes(el.id)) saveMe(); renderDoc(); });
  });
  $('vatSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    vat = b.dataset.v;
    $('vatSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x===b ? 'true':'false'));
    renderItems(); renderDoc();
  });
  $('addItem').addEventListener('click', () => { items.push({name:'',spec:'',qty:1,price:0}); renderItems(); renderDoc(); $('i'+(items.length-1)+'n').focus(); });
  $('btnNew').addEventListener('click', () => {
    document.querySelectorAll('[data-clear]').forEach(el => el.value = '');
    items = [{name:'',spec:'',qty:1,price:0}];
    $('notice').hidden = true;
    renderItems(); renderDoc();
  });
  $('stampFile').addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = () => { stamp = rd.result; store.set('est_stamp', stamp); $('stampThumb').src = stamp; $('stampThumb').hidden = false; $('stampDel').hidden = false; renderDoc(); };
    rd.readAsDataURL(f);
  });
  $('stampDel').addEventListener('click', () => { stamp = null; store.set('est_stamp', null); $('stampThumb').hidden = true; $('stampDel').hidden = true; $('stampFile').value=''; renderDoc(); });

  // PDF로 저장할 때 파일 이름이 "견적서_받는곳_날짜"가 되도록 잠시 제목을 바꾼다
  const pageTitle = document.title;
  window.addEventListener('beforeprint', () => {
    document.title = [NAME, val('toName'), val('date')].filter(Boolean).join('_').replace(/[\\/:*?"<>|]/g,'');
  });
  window.addEventListener('afterprint', () => { document.title = pageTitle; });

  // 다른 페이지 안에 끼워진 미리보기 창에서는 인쇄가 막혀 있으므로 안내를 보여준다
  let framed = true; try { framed = window.self !== window.top; } catch(e) {}
  if(framed){
    $('btnPrint').hidden = true;
    $('notice').textContent += ' 인쇄·PDF 저장은 사이트를 새 창으로 열었을 때 사용할 수 있어요.';
  } else {
    $('btnPrint').addEventListener('click', () => window.print());
  }
  renderItems(); renderDoc();
}
init();
})();
