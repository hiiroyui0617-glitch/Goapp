import{d as g,s as N,j as t,r as j}from"./react-vendor-BKk7ucTW.js";import{at as M,aV as P}from"./icons-Baa24Bry.js";import{cT as C,cV as S,cU as $,bc as I,aX as w,cm as b}from"./main-jQnVUv5W.js";import{S as A}from"./StaticBoard-DeYB95qc.js";import{p as B}from"./print-Cbpnm6c-.js";import"./vendor-awwjIm7w.js";function E(d,n){const r=d.filter(o=>o.move!=null);if(r.length===0)return[];const h=n==="all"?r.length:n,l=[];for(let o=0;o<r.length;o+=h){const c=Math.min(r.length,o+h),s=r.slice(o,c),x=s[s.length-1],m=[],p=[],u=new Map;for(let a=o;a<c;a++){const i=r[a].move;if(i.x<0||i.y<0)continue;const f=a+1,k=`${i.x},${i.y}`,y=u.get(k);if(y!==void 0){p.push({move:f,at:y});continue}u.set(k,f),m.push({x:i.x,y:i.y,text:String(f),player:i.player})}const e=(r[o].parent?.gameState.board??x.gameState.board).map(a=>[...a]);for(const a of m){const i=e[a.y];i&&(i[a.x]=a.player)}l.push({index:l.length,startMove:o+1,endMove:c,board:e,markers:m,repeats:p})}return l}const F=[{value:10,label:"10"},{value:25,label:"25"},{value:50,label:"50"},{value:100,label:"100"},{value:"all",label:"All on one"}];function R(d){let n=d;for(;n.parent;)n=n.parent;return n.properties??{}}const D=`
  @media print {
    @page { size: A4 portrait; margin: 12mm; }
    /* The dialog is portalled to <body> so everything else can leave the
       flow. Hiding the app with visibility kept the dialog inside the fixed
       overlay and its 92dvh scroller, which printed the first screenful --
       one page of a three-diagram game. */
    html, body { height: auto !important; overflow: visible !important; background: #ffffff !important; }
    body > :not(.kifu-print-overlay) { display: none !important; }
    .kifu-print-overlay {
      position: static !important; display: block !important;
      padding: 0 !important; background: none !important;
    }
    .kifu-print {
      position: static !important; width: 100% !important; max-width: none !important;
      max-height: none !important; overflow: visible !important;
      border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
      background: #ffffff !important; color: #0f172a !important;
    }
    .kifu-print .kifu-scroll {
      max-height: none !important; overflow: visible !important; padding: 0 !important;
    }
    .kifu-print .kifu-controls { display: none !important; }
    /* One diagram to a page, which is what the break below already asks for.
       On screen they sit two to a row to keep the preview scannable, and that
       column count followed them onto paper: each figure came out about 3.5in
       on A4, where 50 numbered moves do not fit — adjacent labels overlapped by
       11-17px, up to 16 pairs in a single diagram. A full-width figure is twice
       the size, and the numbers scale with it. */
    .kifu-print .kifu-diagram-grid {
      grid-template-columns: 1fr !important;
    }
    .kifu-diagram-page {
      break-after: page !important; page-break-after: always !important;
      break-inside: avoid !important; page-break-inside: avoid !important;
    }
    .kifu-diagram-page:last-child { break-after: auto !important; page-break-after: auto !important; }
    .kifu-diagram-caption { color: #334155 !important; }
    .kifu-print .kifu-diagram-repeats { color: #334155 !important; }
  }
`,T=({onClose:d})=>{C(d);const n=S(),[r,h]=g.useState(50),{currentNode:l,activeBranchChildIds:o,treeVersion:c}=$(e=>({currentNode:e.currentNode,activeBranchChildIds:e.activeBranchChildIds,treeVersion:e.treeVersion}),N);g.useEffect(()=>{const e=document.createElement("style");return e.textContent=D,document.head.appendChild(e),()=>{document.head.removeChild(e)}},[]);const{diagrams:s,playerNames:x}=g.useMemo(()=>{const a=I(l,o).filter(f=>f.move!=null),i=R(l);return{diagrams:E(a,r),playerNames:{black:w(b(i,"PB"),b(i,"BR"),"Black"),white:w(b(i,"PW"),b(i,"WR"),"White")}}},[o,l,r,c]),m=e=>e.map(a=>({x:a.x,y:a.y,text:a.text,kind:"label",color:a.player==="black"?"#0b0b0b":"#f9fafb",textColor:a.player==="black"?"#f9fafb":"#0b0b0b"})),p=s.length>0,u=p?"Print kifu or save as PDF":"No moves to print",v=t.jsx("div",{ref:n,tabIndex:-1,className:"kifu-print-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-6",role:"dialog","aria-modal":"true","aria-labelledby":"kifu-print-title",children:t.jsxs("div",{className:"kifu-print ui-panel flex max-h-[92dvh] w-[92vw] max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl",children:[t.jsxs("div",{className:"kifu-controls relative flex flex-col items-stretch gap-3 border-b border-[var(--ui-border)] px-3 py-3 ui-bar sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4",children:[t.jsxs("div",{className:"min-w-0 pr-12 sm:pr-0",children:[t.jsx("div",{className:"text-xs uppercase tracking-[0.2em] ui-text-faint",children:"Print kifu"}),t.jsxs("h2",{id:"kifu-print-title",className:"text-lg font-semibold text-[var(--ui-text)]",children:[t.jsx("span",{className:"sr-only",children:"Print Kifu: "}),x.black," vs ",x.white]})]}),t.jsxs("div",{className:"flex min-w-0 w-full items-center gap-1 sm:w-auto sm:gap-2",children:[t.jsx("div",{className:"flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-[var(--ui-border)] sm:flex-none",role:"group","aria-label":"Moves per diagram",children:F.map(e=>{const a=r===e.value;return t.jsx("button",{type:"button",onClick:()=>h(e.value),"aria-pressed":a,className:["min-h-11 min-w-11 flex-1 px-2 py-2 text-sm font-semibold sm:flex-none sm:px-3 desktop-shell:min-h-0 desktop-shell:min-w-0",a?"bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]":"text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-2)]"].join(" "),children:e.value==="all"?t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"sm:hidden",children:"All"}),t.jsx("span",{className:"hidden sm:inline",children:e.label})]}):e.label},String(e.value))})}),t.jsxs("button",{type:"button",onClick:()=>B(),disabled:!p,className:"inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg ui-accent-bg px-3 py-2 text-sm font-semibold not-disabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50","aria-label":u,title:u,children:[t.jsx(M,{"aria-hidden":"true"})," ",t.jsx("span",{className:"hidden lg:inline",children:"Print / PDF"})]}),t.jsx("button",{type:"button",onClick:d,className:"ui-control absolute right-3 top-3 grid shrink-0 place-items-center rounded-lg text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-text)] sm:static","aria-label":"Close kifu print",children:t.jsx(P,{"aria-hidden":"true"})})]})]}),t.jsxs("div",{className:"kifu-scroll overflow-y-auto p-5",children:[t.jsx("div",{className:"kifu-controls mb-4 text-xs ui-text-muted",children:s.length===0?"No moves to print yet.":`${s.length} diagram${s.length===1?"":"s"} · ${r==="all"?"all moves on one board":`${r} moves per diagram`}.`}),t.jsx("div",{className:"kifu-diagram-grid grid grid-cols-1 gap-6 sm:grid-cols-2",children:s.map(e=>t.jsxs("div",{className:"kifu-diagram-page flex flex-col items-center",children:[t.jsx("div",{className:"kifu-diagram-caption mb-2 text-sm font-semibold text-[var(--ui-text)]",children:e.startMove===e.endMove?`Move ${e.startMove}`:`Moves ${e.startMove}–${e.endMove}`}),t.jsx(A,{board:e.board,markers:m(e.markers),showCoordinates:!0,maxPx:720,ariaLabel:`Kifu diagram moves ${e.startMove} to ${e.endMove}`}),e.repeats.length>0&&t.jsx("div",{className:"kifu-diagram-repeats mt-1 text-xs text-[var(--ui-text-muted)]",children:e.repeats.map(a=>`${a.move} at ${a.at}`).join(", ")})]},e.index))})]})]})});return typeof document>"u"?v:j.createPortal(v,document.body)};T.displayName="KifuPrintModal";export{T as KifuPrintModal};
